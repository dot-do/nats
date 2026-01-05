/**
 * MCP Server Factory
 *
 * Creates an MCP server that exposes NATS and JetStream tools.
 */

/**
 * Tool definition interface
 */
interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Tool result content item
 */
interface ToolResultContent {
  type: 'text'
  text: string
}

/**
 * Tool result interface
 */
interface ToolResult {
  content: ToolResultContent[]
  isError?: boolean
}

/**
 * NatsAccess interface for tool invocations
 */
interface NatsAccess {
  publish?: (subject: string, data: string, opts?: unknown) => Promise<unknown>
  request?: (subject: string, data: string, opts?: { timeout?: number }) => Promise<unknown>
  jsPublish?: (subject: string, data: string, opts?: unknown) => Promise<unknown>
  createStream?: (config: { name: string; subjects: string[] }) => Promise<unknown>
  getStreamInfo?: (name: string) => Promise<unknown>
  createConsumer?: (stream: string, config: unknown) => Promise<unknown>
  fetchMessages?: (stream: string, consumer: string, opts?: unknown) => Promise<unknown>
}

/**
 * Options for creating an MCP server
 */
export interface McpServerOptions {
  name?: string
  version?: string
  natsAccess?: NatsAccess
}

/**
 * Server info interface
 */
interface ServerInfo {
  name: string
  version: string
}

/**
 * Server capabilities interface
 */
interface ServerCapabilities {
  tools: Record<string, unknown>
  resources?: Record<string, unknown>
  prompts?: Record<string, unknown>
}

/**
 * MCP Server interface
 */
interface McpServer {
  serverInfo: ServerInfo
  capabilities: ServerCapabilities
  listTools(): Promise<ToolDefinition[]>
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
}

// Tool definitions
const tools: ToolDefinition[] = [
  {
    name: 'nats_publish',
    description: 'Publish a message to a NATS subject',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject to publish to',
        },
        data: {
          type: 'string',
          description: 'Message data',
        },
        headers: {
          type: 'object',
          description: 'Optional headers',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'nats_subscribe',
    description: 'Subscribe to a NATS subject',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject to subscribe to',
        },
        queue: {
          type: 'string',
          description: 'Optional queue group',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'nats_request',
    description: 'Send a request to a NATS subject and wait for response',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject to send request to',
        },
        data: {
          type: 'string',
          description: 'Request data',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'jetstream_publish',
    description: 'Publish a message to a JetStream subject',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject to publish to',
        },
        data: {
          type: 'string',
          description: 'Message data',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'jetstream_stream_create',
    description: 'Create a new JetStream stream',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Stream name',
        },
        subjects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Subjects to bind to the stream',
        },
        config: {
          type: 'object',
          description: 'Optional stream configuration',
        },
      },
      required: ['name', 'subjects'],
    },
  },
  {
    name: 'jetstream_stream_info',
    description: 'Get information about a JetStream stream',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Stream name',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'jetstream_consumer_create',
    description: 'Create a consumer on a JetStream stream',
    inputSchema: {
      type: 'object',
      properties: {
        stream: {
          type: 'string',
          description: 'Stream name',
        },
        config: {
          type: 'object',
          description: 'Consumer configuration',
        },
      },
      required: ['stream'],
    },
  },
  {
    name: 'jetstream_consumer_fetch',
    description: 'Fetch messages from a JetStream consumer',
    inputSchema: {
      type: 'object',
      properties: {
        stream: {
          type: 'string',
          description: 'Stream name',
        },
        consumer: {
          type: 'string',
          description: 'Consumer name',
        },
        maxMessages: {
          type: 'number',
          description: 'Maximum number of messages to fetch',
        },
      },
      required: ['stream', 'consumer'],
    },
  },
]

/**
 * Create success result
 */
function successResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

/**
 * Create error result
 */
function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Creates an MCP server with NATS and JetStream tools
 */
export function createMcpServer(options: McpServerOptions): McpServer {
  const name = options.name ?? 'natdo-mcp'
  const version = options.version ?? '0.1.0'
  const natsAccess = options.natsAccess

  const serverInfo: ServerInfo = {
    name,
    version,
  }

  const capabilities: ServerCapabilities = {
    tools: {},
  }

  return {
    serverInfo,
    capabilities,

    async listTools(): Promise<ToolDefinition[]> {
      return tools
    },

    async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.find((t) => t.name === toolName)
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`)
      }

      try {
        switch (toolName) {
          case 'nats_publish': {
            if (!natsAccess?.publish) {
              return errorResult('No NATS connection available')
            }
            const result = await natsAccess.publish(
              args.subject as string,
              args.data as string,
              args.headers ?? {}
            )
            return successResult(result)
          }

          case 'nats_request': {
            if (!natsAccess?.request) {
              return errorResult('No NATS connection available')
            }
            const result = await natsAccess.request(
              args.subject as string,
              args.data as string,
              { timeout: args.timeout as number }
            )
            return successResult(result)
          }

          case 'jetstream_publish': {
            if (!natsAccess?.jsPublish) {
              return errorResult('No JetStream connection available')
            }
            const result = await natsAccess.jsPublish(
              args.subject as string,
              args.data as string
            )
            return successResult(result)
          }

          case 'jetstream_stream_create': {
            if (!natsAccess?.createStream) {
              return errorResult('No JetStream connection available')
            }
            const result = await natsAccess.createStream({
              name: args.name as string,
              subjects: args.subjects as string[],
            })
            return successResult(result)
          }

          case 'jetstream_stream_info': {
            if (!natsAccess?.getStreamInfo) {
              return errorResult('No JetStream connection available')
            }
            const result = await natsAccess.getStreamInfo(args.name as string)
            return successResult(result)
          }

          case 'jetstream_consumer_create': {
            if (!natsAccess?.createConsumer) {
              return errorResult('No JetStream connection available')
            }
            const result = await natsAccess.createConsumer(
              args.stream as string,
              args.config
            )
            return successResult(result)
          }

          case 'jetstream_consumer_fetch': {
            if (!natsAccess?.fetchMessages) {
              return errorResult('No JetStream connection available')
            }
            const result = await natsAccess.fetchMessages(
              args.stream as string,
              args.consumer as string,
              { maxMessages: args.maxMessages }
            )
            return successResult(result)
          }

          case 'nats_subscribe': {
            // Subscribe is a special case - return a subscription info
            return successResult({ subscribed: true, subject: args.subject })
          }

          default:
            throw new Error(`Tool not implemented: ${toolName}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return errorResult(message)
      }
    },
  }
}
