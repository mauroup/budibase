import { v4 as uuidv4 } from "uuid"
import { BUILTIN_ACTION_DEFINITIONS } from "../../actions"
import { TRIGGER_DEFINITIONS } from "../../triggers"
import {
  AppActionTriggerInputs,
  AppActionTriggerOutputs,
  Automation,
  AutomationActionStepId,
  AutomationResults,
  AutomationStep,
  AutomationStepInputs,
  AutomationTrigger,
  AutomationTriggerDefinition,
  AutomationTriggerInputs,
  AutomationTriggerStepId,
  BashStepInputs,
  Branch,
  BranchStepInputs,
  CollectStepInputs,
  CreateRowStepInputs,
  CronTriggerInputs,
  CronTriggerOutputs,
  DelayStepInputs,
  DeleteRowStepInputs,
  DiscordStepInputs,
  ExecuteQueryStepInputs,
  ExecuteScriptStepInputs,
  FilterStepInputs,
  isDidNotTriggerResponse,
  LoopStepInputs,
  MakeIntegrationInputs,
  n8nStepInputs,
  OpenAIStepInputs,
  OutgoingWebhookStepInputs,
  QueryRowsStepInputs,
  RowCreatedTriggerInputs,
  RowCreatedTriggerOutputs,
  RowDeletedTriggerInputs,
  RowDeletedTriggerOutputs,
  RowUpdatedTriggerInputs,
  RowUpdatedTriggerOutputs,
  SearchFilters,
  ServerLogStepInputs,
  SmtpEmailStepInputs,
  TestAutomationRequest,
  TriggerAutomationStepInputs,
  UpdateRowStepInputs,
  WebhookTriggerInputs,
  WebhookTriggerOutputs,
  ZapierStepInputs,
} from "@budibase/types"
import TestConfiguration from "../../../tests/utilities/TestConfiguration"
import * as setup from "../utilities"
import { automations } from "@budibase/shared-core"

type TriggerOutputs =
  | RowCreatedTriggerOutputs
  | RowUpdatedTriggerOutputs
  | RowDeletedTriggerOutputs
  | AppActionTriggerOutputs
  | WebhookTriggerOutputs
  | CronTriggerOutputs
  | undefined

type StepBuilderFunction = (stepBuilder: StepBuilder) => void

type BranchConfig = {
  [key: string]: {
    steps: StepBuilderFunction
    condition: SearchFilters
  }
}

class BaseStepBuilder {
  protected steps: AutomationStep[] = []
  protected stepNames: { [key: string]: string } = {}

  protected step<TStep extends AutomationActionStepId>(
    stepId: TStep,
    stepSchema: Omit<AutomationStep, "id" | "stepId" | "inputs">,
    inputs: AutomationStepInputs<TStep>,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    const id = opts?.stepId || uuidv4()
    this.steps.push({
      ...stepSchema,
      inputs: inputs as any,
      id,
      stepId,
      name: opts?.stepName || stepSchema.name,
    })
    if (opts?.stepName) {
      this.stepNames[id] = opts.stepName
    }
    return this
  }
  protected addBranchStep(branchConfig: BranchConfig): void {
    const branchStepInputs: BranchStepInputs = {
      branches: [] as Branch[],
      children: {},
    }

    Object.entries(branchConfig).forEach(([key, branch]) => {
      const stepBuilder = new StepBuilder()
      branch.steps(stepBuilder)
      let branchId = uuidv4()
      branchStepInputs.branches.push({
        name: key,
        condition: branch.condition,
        id: branchId,
      })
      branchStepInputs.children![branchId] = stepBuilder.build()
    })
    const branchStep: AutomationStep = {
      ...automations.steps.branch.definition,
      id: uuidv4(),
      stepId: AutomationActionStepId.BRANCH,
      inputs: branchStepInputs,
    }
    this.steps.push(branchStep)
  }

  // STEPS
  createRow(
    inputs: CreateRowStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.CREATE_ROW,
      BUILTIN_ACTION_DEFINITIONS.CREATE_ROW,
      inputs,
      opts
    )
  }

  updateRow(
    inputs: UpdateRowStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.UPDATE_ROW,
      BUILTIN_ACTION_DEFINITIONS.UPDATE_ROW,
      inputs,
      opts
    )
  }

  deleteRow(
    inputs: DeleteRowStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.DELETE_ROW,
      BUILTIN_ACTION_DEFINITIONS.DELETE_ROW,
      inputs,
      opts
    )
  }

  sendSmtpEmail(
    inputs: SmtpEmailStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.SEND_EMAIL_SMTP,
      BUILTIN_ACTION_DEFINITIONS.SEND_EMAIL_SMTP,
      inputs,
      opts
    )
  }

  executeQuery(
    inputs: ExecuteQueryStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.EXECUTE_QUERY,
      BUILTIN_ACTION_DEFINITIONS.EXECUTE_QUERY,
      inputs,
      opts
    )
  }

  queryRows(
    inputs: QueryRowsStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.QUERY_ROWS,
      BUILTIN_ACTION_DEFINITIONS.QUERY_ROWS,
      inputs,
      opts
    )
  }

  loop(
    inputs: LoopStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.LOOP,
      BUILTIN_ACTION_DEFINITIONS.LOOP,
      inputs,
      opts
    )
  }

  serverLog(
    input: ServerLogStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.SERVER_LOG,
      BUILTIN_ACTION_DEFINITIONS.SERVER_LOG,
      input,
      opts
    )
  }

  /**
   * @deprecated Use `executeScriptV2` instead
   */
  executeScript(
    input: ExecuteScriptStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.EXECUTE_SCRIPT,
      BUILTIN_ACTION_DEFINITIONS.EXECUTE_SCRIPT,
      input,
      opts
    )
  }

  executeScriptV2(
    input: ExecuteScriptStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.EXECUTE_SCRIPT_V2,
      BUILTIN_ACTION_DEFINITIONS.EXECUTE_SCRIPT_V2,
      input,
      opts
    )
  }

  filter(input: FilterStepInputs): this {
    return this.step(
      AutomationActionStepId.FILTER,
      BUILTIN_ACTION_DEFINITIONS.FILTER,
      input
    )
  }

  bash(
    input: BashStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.EXECUTE_BASH,
      BUILTIN_ACTION_DEFINITIONS.EXECUTE_BASH,
      input,
      opts
    )
  }

  openai(
    input: OpenAIStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.OPENAI,
      BUILTIN_ACTION_DEFINITIONS.OPENAI,
      input,
      opts
    )
  }

  collect(
    input: CollectStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.COLLECT,
      BUILTIN_ACTION_DEFINITIONS.COLLECT,
      input,
      opts
    )
  }

  zapier(
    input: ZapierStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.zapier,
      BUILTIN_ACTION_DEFINITIONS.zapier,
      input,
      opts
    )
  }

  triggerAutomationRun(
    input: TriggerAutomationStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.TRIGGER_AUTOMATION_RUN,
      BUILTIN_ACTION_DEFINITIONS.TRIGGER_AUTOMATION_RUN,
      input,
      opts
    )
  }

  outgoingWebhook(
    input: OutgoingWebhookStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.OUTGOING_WEBHOOK,
      BUILTIN_ACTION_DEFINITIONS.OUTGOING_WEBHOOK,
      input,
      opts
    )
  }

  n8n(
    input: n8nStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.n8n,
      BUILTIN_ACTION_DEFINITIONS.n8n,
      input,
      opts
    )
  }

  make(
    input: MakeIntegrationInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.integromat,
      BUILTIN_ACTION_DEFINITIONS.integromat,
      input,
      opts
    )
  }

  discord(
    input: DiscordStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.discord,
      BUILTIN_ACTION_DEFINITIONS.discord,
      input,
      opts
    )
  }

  delay(
    input: DelayStepInputs,
    opts?: { stepName?: string; stepId?: string }
  ): this {
    return this.step(
      AutomationActionStepId.DELAY,
      BUILTIN_ACTION_DEFINITIONS.DELAY,
      input,
      opts
    )
  }
}

class StepBuilder extends BaseStepBuilder {
  build(): AutomationStep[] {
    return this.steps
  }

  branch(branchConfig: BranchConfig): this {
    this.addBranchStep(branchConfig)
    return this
  }
}

class AutomationBuilder extends BaseStepBuilder {
  private automationConfig: Automation
  private config: TestConfiguration
  private triggerOutputs: TriggerOutputs
  private triggerSet = false

  constructor(
    options: { name?: string; appId?: string; config?: TestConfiguration } = {}
  ) {
    super()
    this.config = options.config || setup.getConfig()
    this.automationConfig = {
      name: options.name || `Test Automation ${uuidv4()}`,
      definition: {
        steps: [],
        trigger: {} as AutomationTrigger,
        stepNames: {},
      },
      type: "automation",
      appId: options.appId ?? this.config.getAppId(),
    }
  }

  // TRIGGERS
  rowSaved(inputs: RowCreatedTriggerInputs, outputs: RowCreatedTriggerOutputs) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.ROW_SAVED,
      AutomationTriggerStepId.ROW_SAVED,
      inputs,
      outputs
    )
  }

  rowUpdated(
    inputs: RowUpdatedTriggerInputs,
    outputs: RowUpdatedTriggerOutputs
  ) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.ROW_UPDATED,
      AutomationTriggerStepId.ROW_UPDATED,
      inputs,
      outputs
    )
  }

  rowDeleted(
    inputs: RowDeletedTriggerInputs,
    outputs: RowDeletedTriggerOutputs
  ) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.ROW_DELETED,
      AutomationTriggerStepId.ROW_DELETED,
      inputs,
      outputs
    )
  }

  appAction(outputs: AppActionTriggerOutputs, inputs?: AppActionTriggerInputs) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.APP,
      AutomationTriggerStepId.APP,
      inputs,
      outputs
    )
  }

  webhook(outputs: WebhookTriggerOutputs, inputs?: WebhookTriggerInputs) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.WEBHOOK,
      AutomationTriggerStepId.WEBHOOK,
      inputs,
      outputs
    )
  }

  cron(inputs: CronTriggerInputs, outputs?: CronTriggerOutputs) {
    this.triggerOutputs = outputs
    return this.trigger(
      TRIGGER_DEFINITIONS.CRON,
      AutomationTriggerStepId.CRON,
      inputs,
      outputs
    )
  }

  private trigger<TStep extends AutomationTriggerStepId>(
    triggerSchema: AutomationTriggerDefinition,
    stepId: TStep,
    inputs?: AutomationTriggerInputs<TStep>,
    outputs?: TriggerOutputs
  ): this {
    if (this.triggerSet) {
      throw new Error("Only one trigger can be set for an automation.")
    }
    this.automationConfig.definition.trigger = {
      ...triggerSchema,
      stepId,
      inputs: inputs || ({} as any),
      id: uuidv4(),
    }
    this.triggerOutputs = outputs
    this.triggerSet = true

    return this
  }

  branch(branchConfig: BranchConfig): this {
    this.addBranchStep(branchConfig)
    return this
  }

  build(): Automation {
    this.automationConfig.definition.steps = this.steps
    this.automationConfig.definition.stepNames = this.stepNames
    return this.automationConfig
  }

  async save() {
    if (!Object.keys(this.automationConfig.definition.trigger).length) {
      throw new Error("Please add a trigger to this automation test")
    }
    this.automationConfig.definition.steps = this.steps
    const { automation } = await this.config.api.automation.post(this.build())
    return automation
  }

  async run() {
    const automation = await this.save()
    const response = await this.config.api.automation.test(
      automation._id!,
      this.triggerOutputs as TestAutomationRequest
    )

    if (isDidNotTriggerResponse(response)) {
      throw new Error(response.message)
    }
    const results: AutomationResults = response as AutomationResults
    results.steps.shift()
    return {
      trigger: results.trigger,
      steps: results.steps,
    }
  }
}

export function createAutomationBuilder(options?: {
  name?: string
  appId?: string
  config?: TestConfiguration
}) {
  return new AutomationBuilder(options)
}
