/**
 * NATS Stream MCP Tool
 *
 * Manage JetStream streams via MCP.
 * Operations: create, delete, info, list
 */

/**
 * Valid operations for the nats_stream tool
 */
export type StreamOperation = 'create' | 'delete' | 'info' | 'list'

/**
 * Optional stream configuration
 */
export interface StreamConfig {
  retention?: 'limits' | 'interest' | 'workqueue'
  storage?: 'file' | 'memory'
  max_msgs?: number
  max_bytes?: number
  max_age?: number
  max_msg_size?: number
  max_consumers?: number
  discard?: 'old' | 'new'
  num_replicas?: number
}

/**
 * Parameters for the nats_stream tool
 */
export interface NatsStreamParams {
  operation: StreamOperation
  name?: string
  subjects?: string[]
  config?: StreamConfig
}

/**
 * MCP tool result content item
 */
interface ToolResultContent {
  type: 'text'
  text: string
}

/**
 * Result from nats_stream tool
 */
export interface NatsStreamResult {
  content: ToolResultContent[]
  isError?: boolean
}

/**
 * Stream info returned from JetStream
 */
interface StreamInfo {
  config: {
    name: string
    subjects: string[]
    [key: string]: unknown
  }
  state: {
    messages: number
    bytes: number
    first_seq: number
    last_seq: number
    consumer_count: number
  }
  created: string
}

/**
 * Streams API interface
 */
interface StreamsAPI {
  add: (config: Record<string, unknown>) => Promise<StreamInfo>
  delete: (name: string) => Promise<boolean>
  info: (name: string) => Promise<StreamInfo>
  list: () => AsyncGenerator<StreamInfo>
}

/**
 * Context provided to MCP tool handlers
 */
export interface McpToolContext {
  jetStreamManager: {
    streams: StreamsAPI
  } | null
}

/**
 * Validates a stream name
 * - Must contain only alphanumeric characters, dashes, and underscores
 * - Cannot contain spaces or special characters
 */
function isValidStreamName(name: string): boolean {
  if (!name || name.length === 0) {
    return false
  }
  // Stream names must be alphanumeric with dashes and underscores only
  return /^[a-zA-Z0-9_-]+$/.test(name)
}

/**
 * Creates an error result
 */
function errorResult(message: string): NatsStreamResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Creates a success result
 */
function successResult(data: unknown): NatsStreamResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return {
    content: [{ type: 'text', text }],
  }
}

/**
 * Validates the parameters for the given operation
 */
function validateParams(params: NatsStreamParams): string | null {
  // Operation is required
  if (!params.operation) {
    return 'operation is required'
  }

  // Validate operation is a valid enum value
  const validOperations: StreamOperation[] = ['create', 'delete', 'info', 'list']
  if (!validOperations.includes(params.operation)) {
    return `Invalid operation: ${params.operation}. Must be one of: ${validOperations.join(', ')}`
  }

  // Validate name for operations that require it
  if (params.operation === 'create' || params.operation === 'delete' || params.operation === 'info') {
    if (!params.name) {
      return 'name is required for ' + params.operation + ' operation'
    }

    // Validate stream name format
    if (!isValidStreamName(params.name)) {
      return `Invalid stream name: "${params.name}". Stream names must contain only alphanumeric characters, dashes, and underscores.`
    }
  }

  // Validate subjects for create operation
  if (params.operation === 'create') {
    if (!params.subjects || params.subjects.length === 0) {
      return 'subjects is required for create operation'
    }
  }

  return null
}

/**
 * Handle create operation
 */
async function handleCreate(
  params: NatsStreamParams,
  context: McpToolContext
): Promise<NatsStreamResult> {
  const streamConfig: Record<string, unknown> = {
    name: params.name,
    subjects: params.subjects,
  }

  // Merge optional config
  if (params.config) {
    Object.assign(streamConfig, params.config)
  }

  const info = await context.jetStreamManager!.streams.add(streamConfig)
  return successResult({
    message: `Stream "${params.name}" created successfully`,
    stream: info,
  })
}

/**
 * Handle delete operation
 */
async function handleDelete(
  params: NatsStreamParams,
  context: McpToolContext
): Promise<NatsStreamResult> {
  await context.jetStreamManager!.streams.delete(params.name!)
  return successResult({
    message: `Stream "${params.name}" deleted successfully`,
    deleted: params.name,
  })
}

/**
 * Handle info operation
 */
async function handleInfo(
  params: NatsStreamParams,
  context: McpToolContext
): Promise<NatsStreamResult> {
  const info = await context.jetStreamManager!.streams.info(params.name!)
  return successResult(info)
}

/**
 * Handle list operation
 */
async function handleList(
  context: McpToolContext
): Promise<NatsStreamResult> {
  const streams: StreamInfo[] = []

  for await (const stream of context.jetStreamManager!.streams.list()) {
    streams.push(stream)
  }

  if (streams.length === 0) {
    return successResult({ message: 'No streams found', streams: [], count: 0 })
  }

  return successResult({
    message: `Found ${streams.length} stream(s)`,
    streams,
    count: streams.length,
  })
}

/**
 * NATS Stream Tool Definition
 */
export const natsStreamTool = {
  name: 'nats_stream',
  description: 'Manage NATS JetStream streams (create, delete, info, list)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string' as const,
        enum: ['create', 'delete', 'info', 'list'] as const,
        description: 'Operation to perform on stream',
      },
      name: {
        type: 'string' as const,
        description: 'Stream name (required for create, delete, info)',
      },
      subjects: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Subjects to bind to stream (required for create)',
      },
      config: {
        type: 'object' as const,
        description: 'Optional stream configuration',
        properties: {
          retention: {
            type: 'string' as const,
            enum: ['limits', 'interest', 'workqueue'] as const,
          },
          storage: {
            type: 'string' as const,
            enum: ['file', 'memory'] as const,
          },
          max_msgs: { type: 'number' as const },
          max_bytes: { type: 'number' as const },
          max_age: { type: 'number' as const },
          max_msg_size: { type: 'number' as const },
          max_consumers: { type: 'number' as const },
          discard: {
            type: 'string' as const,
            enum: ['old', 'new'] as const,
          },
          num_replicas: { type: 'number' as const },
        },
      },
    },
    required: ['operation'] as const,
  },

  /**
   * Handler for nats_stream tool
   */
  async handler(
    params: NatsStreamParams,
    context: McpToolContext
  ): Promise<NatsStreamResult> {
    // Check for connection
    if (!context.jetStreamManager) {
      return errorResult('No NATS connection available')
    }

    // Validate parameters
    const validationError = validateParams(params)
    if (validationError) {
      return errorResult(validationError)
    }

    try {
      switch (params.operation) {
        case 'create':
          return await handleCreate(params, context)
        case 'delete':
          return await handleDelete(params, context)
        case 'info':
          return await handleInfo(params, context)
        case 'list':
          return await handleList(context)
        default:
          return errorResult(`Unknown operation: ${params.operation}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResult(message)
    }
  },
}
