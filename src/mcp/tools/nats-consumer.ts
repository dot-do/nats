/**
 * nats_consumer MCP Tool
 *
 * Manage JetStream consumers via MCP.
 * Operations: create, delete, info, fetch, ack
 */

import type {
  ConsumerConfig,
  ConsumersAPI,
  ConsumersAccessor,
  JsMsg,
  PullOptions,
} from '../../types/jetstream'

/**
 * Valid actions for the nats_consumer tool
 */
export type NatsConsumerAction = 'create' | 'delete' | 'info' | 'fetch' | 'ack'

/**
 * Parameters for the nats_consumer tool
 */
export interface NatsConsumerParams {
  action: NatsConsumerAction
  stream: string
  consumer?: string
  config?: ConsumerConfig
  seq?: number
  maxMessages?: number
  timeout?: number
}

/**
 * Context required for nats_consumer operations
 */
export interface NatsConsumerContext {
  jsm: {
    consumers: ConsumersAPI
  }
  js: {
    consumers: ConsumersAccessor
  }
  ackMessage?: (stream: string, consumer: string, seq: number) => Promise<boolean>
  nakMessage?: (stream: string, consumer: string, seq: number, delay?: number) => Promise<boolean>
}

/**
 * MCP tool result content item
 */
interface ToolResultContent {
  type: 'text'
  text: string
}

/**
 * MCP tool result
 */
interface ToolResult {
  content: ToolResultContent[]
  isError?: boolean
}

/**
 * Serialized message for fetch response
 */
interface SerializedMessage {
  subject: string
  data: string
  seq: number
  streamSequence: number
  consumerSequence: number
  pending: number
  redelivered: boolean
}

/**
 * Create a successful tool result
 */
function success(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

/**
 * Create an error tool result
 */
function error(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Validate required parameters for an action
 */
function validateParams(params: NatsConsumerParams): string | null {
  if (!params.action) {
    return 'action is required'
  }

  if (!params.stream) {
    return 'stream is required'
  }

  const validActions: NatsConsumerAction[] = ['create', 'delete', 'info', 'fetch', 'ack']
  if (!validActions.includes(params.action as NatsConsumerAction)) {
    return `Invalid action: ${params.action}. Must be one of: ${validActions.join(', ')}`
  }

  switch (params.action) {
    case 'create':
      if (!params.config) {
        return 'config is required for create action'
      }
      break
    case 'delete':
    case 'info':
    case 'fetch':
      if (!params.consumer) {
        return 'consumer is required for ' + params.action + ' action'
      }
      break
    case 'ack':
      if (!params.consumer) {
        return 'consumer is required for ack action'
      }
      if (params.seq === undefined) {
        return 'seq is required for ack action'
      }
      break
  }

  return null
}

/**
 * Handle create action
 */
async function handleCreate(
  params: NatsConsumerParams,
  context: NatsConsumerContext
): Promise<ToolResult> {
  const info = await context.jsm.consumers.add(params.stream, params.config!)
  return success(info)
}

/**
 * Handle delete action
 */
async function handleDelete(
  params: NatsConsumerParams,
  context: NatsConsumerContext
): Promise<ToolResult> {
  await context.jsm.consumers.delete(params.stream, params.consumer!)
  return success({ success: true, deleted: params.consumer })
}

/**
 * Handle info action
 */
async function handleInfo(
  params: NatsConsumerParams,
  context: NatsConsumerContext
): Promise<ToolResult> {
  const info = await context.jsm.consumers.info(params.stream, params.consumer!)
  return success(info)
}

/**
 * Serialize a JsMsg for transport
 */
function serializeMessage(msg: JsMsg): SerializedMessage {
  return {
    subject: msg.subject,
    data: new TextDecoder().decode(msg.data),
    seq: msg.seq,
    streamSequence: msg.info.streamSequence,
    consumerSequence: msg.info.consumerSequence,
    pending: msg.info.pending,
    redelivered: msg.info.redelivered,
  }
}

/**
 * Handle fetch action
 */
async function handleFetch(
  params: NatsConsumerParams,
  context: NatsConsumerContext
): Promise<ToolResult> {
  const consumer = await context.js.consumers.get(params.stream, params.consumer!)

  const fetchOpts: PullOptions = {
    max_messages: params.maxMessages ?? 10,
    expires: params.timeout ?? 5000,
  }

  const messages = await consumer.fetch(fetchOpts)
  const serializedMessages: SerializedMessage[] = []

  for await (const msg of messages) {
    serializedMessages.push(serializeMessage(msg))
  }

  return success({ messages: serializedMessages })
}

/**
 * Handle ack action
 */
async function handleAck(
  params: NatsConsumerParams,
  context: NatsConsumerContext
): Promise<ToolResult> {
  if (!context.ackMessage) {
    return error('ackMessage function not available in context')
  }

  await context.ackMessage(params.stream, params.consumer!, params.seq!)
  return success({ success: true, acked: params.seq })
}

/**
 * nats_consumer MCP Tool definition
 */
export const natsConsumerTool = {
  name: 'nats_consumer',
  description: 'Manage JetStream consumers',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string' as const,
        enum: ['create', 'delete', 'info', 'fetch', 'ack'] as const,
        description: 'Consumer operation to perform',
      },
      stream: {
        type: 'string' as const,
        description: 'Name of the stream',
      },
      consumer: {
        type: 'string' as const,
        description: 'Name of the consumer',
      },
      config: {
        type: 'object' as const,
        description: 'Consumer configuration for create action',
      },
      seq: {
        type: 'number' as const,
        description: 'Message sequence number for ack action',
      },
      maxMessages: {
        type: 'number' as const,
        description: 'Maximum messages to fetch (default: 10)',
      },
      timeout: {
        type: 'number' as const,
        description: 'Fetch timeout in milliseconds (default: 5000)',
      },
    },
    required: ['action', 'stream'] as const,
  },

  /**
   * Handle nats_consumer tool invocation
   */
  async handler(params: NatsConsumerParams, context: NatsConsumerContext): Promise<ToolResult> {
    // Validate parameters
    const validationError = validateParams(params)
    if (validationError) {
      return error(validationError)
    }

    try {
      switch (params.action) {
        case 'create':
          return await handleCreate(params, context)
        case 'delete':
          return await handleDelete(params, context)
        case 'info':
          return await handleInfo(params, context)
        case 'fetch':
          return await handleFetch(params, context)
        case 'ack':
          return await handleAck(params, context)
        default:
          return error(`Unknown action: ${params.action}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return error(message)
    }
  },
}
