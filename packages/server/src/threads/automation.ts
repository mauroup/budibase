import { default as threadUtils } from "./utils"
import { Job } from "bull"
import { disableCronById } from "../automations/utils"
import * as actions from "../automations/actions"
import * as automationUtils from "../automations/automationUtils"
import { dataFilters, helpers } from "@budibase/shared-core"
import { default as AutomationEmitter } from "../events/AutomationEmitter"
import { generateAutomationMetadataID, isProdAppID } from "../db/utils"
import { automations } from "@budibase/shared-core"
import { MAX_AUTOMATION_RECURRING_ERRORS } from "../constants"
import { storeLog } from "../automations/logging"
import {
  Automation,
  AutomationActionStepId,
  AutomationData,
  AutomationJob,
  AutomationMetadata,
  AutomationStatus,
  AutomationStep,
  AutomationStepStatus,
  BranchSearchFilters,
  BranchStep,
  LoopStep,
  ContextEmitter,
  LoopStepType,
  AutomationTriggerResult,
  AutomationResults,
  AutomationStepResult,
  isLogicalFilter,
  Branch,
} from "@budibase/types"
import { AutomationContext } from "../definitions/automations"
import { WorkerCallback } from "./definitions"
import { context, logging, configs, utils } from "@budibase/backend-core"
import {
  findHBSBlocks,
  processObject,
  processStringSync,
} from "@budibase/string-templates"
import { cloneDeep } from "lodash/fp"
import * as sdkUtils from "../sdk/utils"
import env from "../environment"
import tracer from "dd-trace"
import { isPlainObject } from "lodash"

threadUtils.threadSetup()
const CRON_STEP_ID = automations.triggers.definitions.CRON.stepId
const STOPPED_STATUS = { success: true, status: AutomationStatus.STOPPED }

function matchesLoopFailureCondition(step: LoopStep, currentItem: any) {
  const { failure } = step.inputs
  if (!failure) {
    return false
  }

  if (isPlainObject(currentItem)) {
    return Object.values(currentItem).some(e => e === failure)
  }

  return currentItem === failure
}

// Returns an array of the things to loop over for a given LoopStep.  This
// function handles the various ways that a LoopStep can be configured, parsing
// the input and returning an array of items to loop over.
function getLoopIterable(step: LoopStep): any[] {
  const option = step.inputs.option
  let input = step.inputs.binding

  if (option === LoopStepType.ARRAY && typeof input === "string") {
    input = JSON.parse(input)
  }

  if (option === LoopStepType.STRING && Array.isArray(input)) {
    input = input.join(",")
  }

  if (option === LoopStepType.STRING && typeof input === "string") {
    input = automationUtils.stringSplit(input)
  }

  return Array.isArray(input) ? input : [input]
}

function getLoopMaxIterations(loopStep: LoopStep): number {
  const loopMaxIterations =
    typeof loopStep.inputs.iterations === "string"
      ? parseInt(loopStep.inputs.iterations)
      : loopStep.inputs.iterations
  return Math.min(
    loopMaxIterations || env.AUTOMATION_MAX_ITERATIONS,
    env.AUTOMATION_MAX_ITERATIONS
  )
}

function stepSuccess(
  step: Readonly<AutomationStep>,
  outputs: Readonly<Record<string, any>>,
  inputs?: Readonly<Record<string, any>>
): AutomationStepResult {
  return {
    id: step.id,
    stepId: step.stepId,
    inputs: inputs || step.inputs,
    outputs: {
      success: true,
      ...outputs,
    },
  }
}

function stepFailure(
  step: Readonly<AutomationStep>,
  outputs: Readonly<Record<string, any>>,
  inputs?: Readonly<Record<string, any>>
): AutomationStepResult {
  return {
    id: step.id,
    stepId: step.stepId,
    inputs: inputs || step.inputs,
    outputs: {
      success: false,
      ...outputs,
    },
  }
}

function stepStopped(step: AutomationStep): AutomationStepResult {
  return {
    id: step.id,
    stepId: step.stepId,
    inputs: step.inputs,
    outputs: STOPPED_STATUS,
  }
}

async function branchMatches(
  ctx: AutomationContext,
  branch: Readonly<Branch>
): Promise<boolean> {
  const toFilter: Record<string, any> = {}
  const preparedCtx = prepareContext(ctx)

  // Because we allow bindings on both the left and right of each condition in
  // automation branches, we can't pass the BranchSearchFilters directly to
  // dataFilters.runQuery as-is. We first need to walk the filter tree and
  // evaluate all of the bindings.
  const evaluateBindings = (fs: Readonly<BranchSearchFilters>) => {
    const filters = cloneDeep(fs)
    for (const filter of Object.values(filters)) {
      if (!filter) {
        continue
      }

      if (isLogicalFilter(filter)) {
        filter.conditions = filter.conditions.map(evaluateBindings)
      } else {
        for (const [field, value] of Object.entries(filter)) {
          toFilter[field] = processStringSync(field, preparedCtx)
          if (typeof value === "string" && findHBSBlocks(value).length > 0) {
            filter[field] = processStringSync(value, preparedCtx)
          }
        }
      }
    }

    return filters
  }

  const result = dataFilters.runQuery(
    [toFilter],
    evaluateBindings(branch.condition)
  )
  return result.length > 0
}

function prepareContext(context: AutomationContext) {
  return {
    ...context,
    steps: {
      ...context.steps,
      ...context.stepsById,
      ...context.stepsByName,
    },
  }
}

async function enrichBaseContext(context: AutomationContext) {
  context.env = await sdkUtils.getEnvironmentVariables()

  try {
    const { config } = await configs.getSettingsConfigDoc()
    context.settings = {
      url: config.platformUrl,
      logo: config.logoUrl,
      company: config.company,
    }
  } catch (e) {
    context.settings = {}
  }
}

// Because the trigger appears twice in an AutomationResult, once as .trigger
// and again as .steps[0], this function makes sure that the two are kept in
// sync when setting trigger output.
function setTriggerOutput(result: AutomationResults, outputs: any) {
  result.trigger.outputs = {
    ...result.trigger.outputs,
    ...outputs,
  }
  result.steps[0] = result.trigger
}

class Orchestrator {
  private readonly job: AutomationJob
  private emitter: ContextEmitter
  private stopped: boolean

  constructor(job: Readonly<AutomationJob>) {
    this.job = job
    this.stopped = false

    // create an emitter which has the chain count for this automation run in
    // it, so it can block excessive chaining if required
    const chainCount = job.data.event.metadata?.automationChainCount || 0
    this.emitter = new AutomationEmitter(chainCount + 1)
  }

  get automation(): Automation {
    return this.job.data.automation
  }

  get appId(): string {
    return this.job.data.event.appId!
  }

  private async getMetadata(): Promise<AutomationMetadata> {
    const id = generateAutomationMetadataID(this.automation._id!)
    const db = context.getAppDB()
    const doc = await db.tryGet<AutomationMetadata>(id)
    return doc || { _id: id, errorCount: 0 }
  }

  async stopCron(reason: string, opts?: { result: AutomationResults }) {
    if (!this.isCron()) {
      throw new Error("Not a cron automation")
    }

    const msg = `CRON disabled reason=${reason} - ${this.appId}/${this.automation._id}`
    logging.logWarn(msg)

    await disableCronById(this.job.id)

    const { result } = opts || {}
    if (result) {
      setTriggerOutput(result, {
        success: false,
        status: AutomationStatus.STOPPED,
      })
      await this.logResult(result)
    }
  }

  private async logResult(result: AutomationResults) {
    try {
      await storeLog(this.automation, result)
    } catch (e: any) {
      if (e.status === 413 && e.request?.data) {
        // if content is too large we shouldn't log it
        delete e.request.data
        e.request.data = { message: "removed due to large size" }
      }
      logging.logAlert("Error writing automation log", e)
    }
  }

  private async shouldStop(metadata: AutomationMetadata): Promise<boolean> {
    if (!metadata.errorCount || !this.isCron()) {
      return false
    }
    if (metadata.errorCount >= MAX_AUTOMATION_RECURRING_ERRORS) {
      return true
    }
    return false
  }

  private isCron(): boolean {
    return this.automation.definition.trigger.stepId === CRON_STEP_ID
  }

  private isProdApp(): boolean {
    return isProdAppID(this.appId)
  }

  hasErrored(context: AutomationContext): boolean {
    const [_trigger, ...steps] = context.steps
    for (const step of steps) {
      if (step.outputs?.success === false) {
        return true
      }
    }
    return false
  }

  async execute(): Promise<AutomationResults> {
    return tracer.trace(
      "Orchestrator.execute",
      { resource: "automation" },
      async span => {
        span?.addTags({ appId: this.appId, automationId: this.automation._id })

        const job = cloneDeep(this.job)
        delete job.data.event.appId
        delete job.data.event.metadata

        if (this.isCron() && !job.data.event.timestamp) {
          job.data.event.timestamp = Date.now()
        }

        const trigger: AutomationTriggerResult = {
          id: job.data.automation.definition.trigger.id,
          stepId: job.data.automation.definition.trigger.stepId,
          inputs: null,
          outputs: job.data.event,
        }
        const result: AutomationResults = { trigger, steps: [trigger] }

        let metadata: AutomationMetadata | undefined = undefined

        if (this.isProdApp() && this.isCron()) {
          span?.addTags({ recurring: true })
          metadata = await this.getMetadata()
          if (await this.shouldStop(metadata)) {
            await this.stopCron("errors")
            span?.addTags({ shouldStop: true })
            return result
          }
        }

        const ctx: AutomationContext = {
          trigger: trigger.outputs,
          steps: [trigger.outputs],
          stepsById: {},
          stepsByName: {},
          user: trigger.outputs.user,
        }
        await enrichBaseContext(ctx)

        const timeout =
          this.job.data.event.timeout || env.AUTOMATION_THREAD_TIMEOUT

        try {
          await helpers.withTimeout(timeout, async () => {
            const [stepOutputs, executionTime] = await utils.time(() =>
              this.executeSteps(ctx, job.data.automation.definition.steps)
            )

            result.steps.push(...stepOutputs)

            console.info(
              `Automation ID: ${
                this.automation._id
              } Execution time: ${executionTime.toMs()} milliseconds`,
              {
                _logKey: "automation",
                executionTime,
              }
            )
          })
        } catch (e: any) {
          if (e.errno === "ETIME") {
            span?.addTags({ timedOut: true })
            console.warn(`Automation execution timed out after ${timeout}ms`)
          }
        }

        await this.logResult(result)

        if (
          this.isProdApp() &&
          this.isCron() &&
          metadata &&
          this.hasErrored(ctx)
        ) {
          metadata.errorCount ??= 0
          metadata.errorCount++

          const db = context.getAppDB()
          try {
            await db.put(metadata)
          } catch (err) {
            logging.logAlertWithInfo(
              "Failed to write automation metadata",
              db.name,
              job.data.automation._id!,
              err
            )
          }
        }
        return result
      }
    )
  }

  private async executeSteps(
    ctx: AutomationContext,
    steps: AutomationStep[]
  ): Promise<AutomationStepResult[]> {
    return tracer.trace("Orchestrator.executeSteps", async () => {
      let stepIndex = 0
      const results: AutomationStepResult[] = []

      function addToContext(
        step: AutomationStep,
        result: AutomationStepResult
      ) {
        ctx.steps.push(result.outputs)
        ctx.stepsById[step.id] = result.outputs
        ctx.stepsByName[step.name || step.id] = result.outputs
        results.push(result)
      }

      while (stepIndex < steps.length) {
        if (this.stopped) {
          break
        }

        const step = steps[stepIndex]
        switch (step.stepId) {
          case AutomationActionStepId.BRANCH: {
            results.push(...(await this.executeBranchStep(ctx, step)))
            stepIndex++
            break
          }
          case AutomationActionStepId.LOOP: {
            const stepToLoop = steps[stepIndex + 1]
            addToContext(
              stepToLoop,
              await this.executeLoopStep(ctx, step, stepToLoop)
            )
            // We increment by 2 here because the way loops work is that the
            // step immediately following the loop step is what gets looped.
            // So when we're done looping, to advance correctly we need to
            // skip the step that was looped.
            stepIndex += 2
            break
          }
          default: {
            addToContext(step, await this.executeStep(ctx, step))
            stepIndex++
            break
          }
        }
      }

      return results
    })
  }

  private async executeLoopStep(
    ctx: AutomationContext,
    step: LoopStep,
    stepToLoop: AutomationStep
  ): Promise<AutomationStepResult> {
    await processObject(step.inputs, prepareContext(ctx))

    const maxIterations = getLoopMaxIterations(step)
    const items: Record<string, any>[] = []
    let iterations = 0
    let iterable: any[] = []
    try {
      iterable = getLoopIterable(step)
    } catch (err) {
      return stepFailure(stepToLoop, {
        status: AutomationStepStatus.INCORRECT_TYPE,
      })
    }

    for (; iterations < iterable.length; iterations++) {
      const currentItem = iterable[iterations]

      if (iterations === maxIterations) {
        return stepFailure(stepToLoop, {
          status: AutomationStepStatus.MAX_ITERATIONS,
          iterations,
        })
      }

      if (matchesLoopFailureCondition(step, currentItem)) {
        return stepFailure(stepToLoop, {
          status: AutomationStepStatus.FAILURE_CONDITION,
        })
      }

      ctx.loop = { currentItem }
      const result = await this.executeStep(ctx, stepToLoop)
      items.push(result.outputs)
      ctx.loop = undefined
    }

    const status =
      iterations === 0 ? AutomationStatus.NO_CONDITION_MET : undefined
    return stepSuccess(stepToLoop, { status, iterations, items })
  }

  private async executeBranchStep(
    ctx: AutomationContext,
    step: BranchStep
  ): Promise<AutomationStepResult[]> {
    const { branches, children } = step.inputs

    for (const branch of branches) {
      if (await branchMatches(ctx, branch)) {
        return [
          stepSuccess(step, {
            branchName: branch.name,
            status: `${branch.name} branch taken`,
            branchId: `${branch.id}`,
          }),
          ...(await this.executeSteps(ctx, children?.[branch.id] || [])),
        ]
      }
    }

    return [stepFailure(step, { status: AutomationStatus.NO_CONDITION_MET })]
  }

  private async executeStep(
    ctx: AutomationContext,
    step: Readonly<AutomationStep>
  ): Promise<AutomationStepResult> {
    return tracer.trace("Orchestrator.executeStep", async span => {
      span.addTags({
        step: {
          stepId: step.stepId,
          id: step.id,
          name: step.name,
          type: step.type,
          title: step.stepTitle,
          internal: step.internal,
          deprecated: step.deprecated,
        },
      })

      if (this.stopped) {
        span.addTags({ stopped: true })
        return stepStopped(step)
      }

      const fn = await actions.getAction(step.stepId)
      if (fn == null) {
        throw new Error(`Cannot find automation step by name ${step.stepId}`)
      }

      const inputs = automationUtils.cleanInputValues(
        await processObject(cloneDeep(step.inputs), prepareContext(ctx)),
        step.schema.inputs.properties
      )

      const outputs = await fn({
        inputs,
        appId: this.appId,
        emitter: this.emitter,
        context: prepareContext(ctx),
      })

      if (
        step.stepId === AutomationActionStepId.FILTER &&
        "result" in outputs &&
        outputs.result === false
      ) {
        this.stopped = true
        ;(outputs as any).status = AutomationStatus.STOPPED
      }

      return stepSuccess(step, outputs, inputs)
    })
  }
}

export function execute(job: Job<AutomationData>, callback: WorkerCallback) {
  const appId = job.data.event.appId
  if (!appId) {
    throw new Error("Unable to execute, event doesn't contain app ID.")
  }

  const automationId = job.data.automation._id
  if (!automationId) {
    throw new Error("Unable to execute, event doesn't contain automation ID.")
  }

  return context.doInAutomationContext({
    appId,
    automationId,
    task: async () => {
      const envVars = await sdkUtils.getEnvironmentVariables()
      await context.doInEnvironmentContext(envVars, async () => {
        const orchestrator = new Orchestrator(job)
        try {
          callback(null, await orchestrator.execute())
        } catch (err) {
          callback(err)
        }
      })
    },
  })
}

export async function executeInThread(
  job: Job<AutomationData>
): Promise<AutomationResults> {
  const appId = job.data.event.appId
  if (!appId) {
    throw new Error("Unable to execute, event doesn't contain app ID.")
  }

  return await context.doInAppContext(appId, async () => {
    await context.ensureSnippetContext()
    const envVars = await sdkUtils.getEnvironmentVariables()
    return await context.doInEnvironmentContext(envVars, async () => {
      const orchestrator = new Orchestrator(job)
      return orchestrator.execute()
    })
  })
}

export const removeStalled = async (job: Job) => {
  const appId = job.data.event.appId
  if (!appId) {
    throw new Error("Unable to execute, event doesn't contain app ID.")
  }
  await context.doInAppContext(appId, async () => {
    const orchestrator = new Orchestrator(job)
    await orchestrator.stopCron("stalled")
  })
}
