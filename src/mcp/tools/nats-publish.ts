/**
 * NATS Publish MCP Tool
 *
 * Publishes messages to NATS subjects via MCP.
 */

import { createHeaders, type MsgHdrs, type PublishOptions } from '../../types/nats'

/**
 * Parameters for nats_publish tool
 */
export interface NatsPublishParams {
  subject: string
  data?: string
  headers?: Record<string, string>
}

/**
 * Result from nats_publish tool
 */
export interface NatsPublishResult {
  isError?: boolean
  content: Array<{
    type: 'text'
    text: string
  }>
}

/**
 * Context provided to MCP tool handlers
 */
export interface McpToolContext {
  natsConnection: {
    publish: (subject: string, data?: Uint8Array, opts?: PublishOptions) => void
  } | null
}

/**
 * Validates a NATS subject
 * - Cannot be empty
 * - Cannot start or end with a dot
 * - Cannot contain spaces
 * - Cannot have consecutive dots
 */
function isValidSubject(subject: string): boolean {
  if (!subject || subject.length === 0) {
    return false
  }
  if (subject.startsWith('.') || subject.endsWith('.')) {
    return false
  }
  if (subject.includes(' ')) {
    return false
  }
  if (subject.includes('..')) {
    return false
  }
  return true
}

/**
 * Creates MsgHdrs from a plain object
 */
function createHeadersFromObject(headers: Record<string, string>): MsgHdrs {
  const msgHdrs = createHeaders()
  for (const [key, value] of Object.entries(headers)) {
    msgHdrs.set(key, value)
  }
  return msgHdrs
}

/**
 * Creates an error result
 */
function errorResult(message: string): NatsPublishResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

/**
 * Creates a success result
 */
function successResult(message: string): NatsPublishResult {
  return {
    content: [{ type: 'text', text: message }],
  }
}

/**
 * NATS Publish Tool Definition
 */
export const natsPublishTool = {
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
        additionalProperties: { type: 'string' },
      },
    },
    required: ['subject'],
  },

  /**
   * Handler for nats_publish tool
   */
  handler: async (
    params: NatsPublishParams,
    context: McpToolContext
  ): Promise<NatsPublishResult> => {
    // Check for connection
    if (!context.natsConnection) {
      return errorResult('No NATS connection available')
    }

    const { subject, data, headers } = params

    // Validate subject
    if (!subject || subject.length === 0) {
      return errorResult('subject is required')
    }

    if (!isValidSubject(subject)) {
      return errorResult(`Invalid subject format: "${subject}"`)
    }

    try {
      // Encode data as Uint8Array
      const encoder = new TextEncoder()
      const encodedData = data ? encoder.encode(data) : new Uint8Array(0)

      // Build publish options
      const opts: PublishOptions = {}
      if (headers) {
        opts.headers = createHeadersFromObject(headers)
      }

      // Publish the message
      context.natsConnection.publish(subject, encodedData, opts)

      return successResult(
        `Message published to "${subject}" successfully`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return errorResult(`Failed to publish message: ${message}`)
    }
  },
}
