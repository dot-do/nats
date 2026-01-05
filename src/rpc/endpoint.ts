/**
 * RPC Endpoint
 *
 * JSON-RPC 2.0 compliant request handling for NatDO.
 */

import {
  type RpcRequest,
  type RpcResponse,
  type RpcNotification,
  type RpcId,
  RPC_ERROR_CODES,
} from '../types/rpc'

/**
 * Handler function type for RPC methods
 */
export type RpcHandler = (
  params?: Record<string, unknown> | unknown[]
) => Promise<unknown>

/**
 * Map of method names to handlers
 */
export type RpcHandlers = Record<string, RpcHandler>

/**
 * Result of parsing a request body
 */
export type ParseResult =
  | {
      success: true
      data: RpcRequest | RpcNotification | Array<RpcRequest | RpcNotification>
    }
  | {
      success: false
      error: { code: number; message: string }
    }

/**
 * Result of validating a request
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: { code: number; message: string } }

/**
 * Parse JSON-RPC request body
 */
export async function parseRequest(body: string): Promise<ParseResult> {
  if (!body || body.trim() === '') {
    return {
      success: false,
      error: { code: RPC_ERROR_CODES.PARSE_ERROR, message: 'Parse error' },
    }
  }

  try {
    const data = JSON.parse(body)
    return { success: true, data }
  } catch {
    return {
      success: false,
      error: { code: RPC_ERROR_CODES.PARSE_ERROR, message: 'Parse error' },
    }
  }
}

/**
 * Validate JSON-RPC request structure
 */
export function validateRequest(
  request: unknown
): ValidationResult {
  if (typeof request !== 'object' || request === null) {
    return {
      valid: false,
      error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
    }
  }

  const req = request as Record<string, unknown>

  // Check jsonrpc version
  if (req.jsonrpc !== '2.0') {
    return {
      valid: false,
      error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
    }
  }

  // Check method is a string
  if (typeof req.method !== 'string') {
    return {
      valid: false,
      error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
    }
  }

  // Check id if present (must be string or number, not null for requests)
  if ('id' in req) {
    const id = req.id
    if (id === null || (typeof id !== 'string' && typeof id !== 'number')) {
      return {
        valid: false,
        error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
      }
    }
  }

  // Check params if present (must be object or array)
  if ('params' in req && req.params !== undefined) {
    const params = req.params
    if (typeof params !== 'object' || params === null) {
      return {
        valid: false,
        error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
      }
    }
  }

  return { valid: true }
}

/**
 * Handle a single JSON-RPC request
 * Returns null for notifications (requests without id)
 */
export async function handleRequest(
  request: RpcRequest | RpcNotification,
  handlers: RpcHandlers
): Promise<RpcResponse | null> {
  const isNotification = !('id' in request)
  const id = isNotification ? null : (request as RpcRequest).id

  // Validate the request
  const validation = validateRequest(request)
  if (!validation.valid) {
    if (isNotification) return null
    return formatError(validation.error.code, validation.error.message, id)
  }

  // Find handler
  const handler = handlers[request.method]
  if (!handler) {
    if (isNotification) return null
    return formatError(
      RPC_ERROR_CODES.METHOD_NOT_FOUND,
      'Method not found',
      id!
    )
  }

  // Execute handler
  try {
    const result = await handler(request.params)
    if (isNotification) return null
    return formatSuccess(result, id!)
  } catch (error) {
    if (isNotification) return null
    const message = error instanceof Error ? error.message : 'Internal error'
    return formatError(RPC_ERROR_CODES.INTERNAL_ERROR, message, id!)
  }
}

/**
 * Handle a batch of JSON-RPC requests
 * Executes requests concurrently and returns responses in order
 */
export async function handleBatch(
  requests: Array<RpcRequest | RpcNotification>,
  handlers: RpcHandlers
): Promise<RpcResponse[]> {
  if (requests.length === 0) {
    return []
  }

  // Execute all requests concurrently
  const results = await Promise.all(
    requests.map((request) => handleRequest(request, handlers))
  )

  // Filter out null responses (from notifications)
  return results.filter((r): r is RpcResponse => r !== null)
}

/**
 * Format an error response
 */
export function formatError(
  code: number,
  message: string,
  id: RpcId | null | undefined,
  data?: unknown
): RpcResponse {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
    id: id ?? null,
  }
}

/**
 * Format a success response
 */
export function formatSuccess(result: unknown, id: RpcId): RpcResponse {
  return {
    jsonrpc: '2.0',
    result,
    id,
  }
}
