import TestConfiguration from "../../../tests/utilities/TestConfiguration"
import { BUILTIN_ACTION_DEFINITIONS } from "../../actions"
import env from "../../../environment"
import { Automation, AutomationData, Datasource } from "@budibase/types"
import { Knex } from "knex"
import { getQueue } from "../.."
import { Job } from "bull"
import { helpers } from "@budibase/shared-core"

let config: TestConfiguration

export function getConfig(): TestConfiguration {
  if (!config) {
    config = new TestConfiguration(true)
  }
  return config
}

export function afterAll() {
  config.end()
}

export async function runInProd(fn: any) {
  env._set("NODE_ENV", "production")
  let error
  try {
    await fn()
  } catch (err) {
    error = err
  }
  env._set("NODE_ENV", "jest")
  if (error) {
    throw error
  }
}

export async function captureAllAutomationQueueMessages(
  f: () => Promise<unknown>
) {
  const messages: Job<AutomationData>[] = []
  const queue = getQueue()

  const messageListener = async (message: Job<AutomationData>) => {
    messages.push(message)
  }

  queue.on("message", messageListener)
  try {
    await f()
    // Queue messages tend to be send asynchronously in API handlers, so there's
    // no guarantee that awaiting this function will have queued anything yet.
    // We wait here to make sure we're queued _after_ any existing async work.
    await helpers.wait(100)
  } finally {
    queue.off("message", messageListener)
  }

  return messages
}

export async function captureAutomationQueueMessages(
  automation: Automation | string,
  f: () => Promise<unknown>
) {
  const messages = await captureAllAutomationQueueMessages(f)
  return messages.filter(
    m =>
      m.data.automation._id ===
      (typeof automation === "string" ? automation : automation._id)
  )
}

/**
 * Capture all automation runs that occur during the execution of a function.
 * This function will wait for all messages to be processed before returning.
 */
export async function captureAllAutomationResults(
  f: () => Promise<unknown>
): Promise<Job<AutomationData>[]> {
  const runs: Job<AutomationData>[] = []
  const queue = getQueue()
  let messagesOutstanding = 0

  const completedListener = async (job: Job<AutomationData>) => {
    runs.push(job)
    messagesOutstanding--
  }
  const messageListener = async (message: Job<AutomationData>) => {
    // Don't count cron messages, as they don't get triggered automatically.
    if (message.opts?.repeat != null) {
      return
    }
    messagesOutstanding++
  }
  queue.on("message", messageListener)
  queue.on("completed", completedListener)
  try {
    await f()
    // Queue messages tend to be send asynchronously in API handlers, so there's
    // no guarantee that awaiting this function will have queued anything yet.
    // We wait here to make sure we're queued _after_ any existing async work.
    await helpers.wait(100)
  } finally {
    const waitMax = 10000
    let waited = 0
    // eslint-disable-next-line no-unmodified-loop-condition
    while (messagesOutstanding > 0) {
      await helpers.wait(50)
      waited += 50
      if (waited > waitMax) {
        // eslint-disable-next-line no-unsafe-finally
        throw new Error(
          `Timed out waiting for automation runs to complete. ${messagesOutstanding} messages waiting for completion.`
        )
      }
    }
    queue.off("completed", completedListener)
    queue.off("message", messageListener)
  }

  return runs
}

export async function captureAutomationResults(
  automation: Automation | string,
  f: () => Promise<unknown>
) {
  const results = await captureAllAutomationResults(f)
  return results.filter(
    r =>
      r.data.automation._id ===
      (typeof automation === "string" ? automation : automation._id)
  )
}

export async function saveTestQuery(
  config: TestConfiguration,
  client: Knex,
  tableName: string,
  datasource: Datasource
) {
  return await config.api.query.save({
    name: "test query",
    datasourceId: datasource._id!,
    parameters: [],
    fields: {
      sql: client(tableName).select("*").toSQL().toNative().sql,
    },
    transformer: "",
    schema: {},
    readable: true,
    queryVerb: "read",
  })
}

export const apiKey = "test"
export const actions = BUILTIN_ACTION_DEFINITIONS
