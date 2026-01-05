/**
 * RPC Types
 *
 * JSON-RPC 2.0 types for NatDO communication.
 */

// Request ID type
export type RpcId = string | number

// RPC Request
export interface RpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown> | unknown[]
  id: RpcId
}

// RPC Notification (no id)
export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown> | unknown[]
}

// RPC Error
export interface RpcError {
  code: number
  message: string
  data?: unknown
}

// RPC Response
export interface RpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: RpcError
  id: RpcId | null
}

// Batch types
export type RpcBatchRequest = Array<RpcRequest | RpcNotification>
export type RpcBatchResponse = RpcResponse[]

// Standard JSON-RPC 2.0 error codes
export const RPC_ERROR_CODES = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // NATS-specific error codes (-32001 to -32099)
  STREAM_NOT_FOUND: -32001,
  CONSUMER_NOT_FOUND: -32002,
  NO_RESPONDERS: -32003,
  TIMEOUT: -32004,
  MESSAGE_NOT_FOUND: -32005,
  STREAM_EXISTS: -32006,
  CONSUMER_EXISTS: -32007,
  INVALID_SUBJECT: -32008,
  PERMISSION_DENIED: -32009,
  MAX_PAYLOAD_EXCEEDED: -32010,
  DUPLICATE_MESSAGE: -32011,
  STREAM_SEALED: -32012,
  CONSUMER_DELETED: -32013,
} as const

// Type guard for error responses
export function isRpcError(response: RpcResponse): response is RpcResponse & { error: RpcError } {
  return 'error' in response && response.error !== undefined
}

// Type guard for success responses
export function isRpcSuccess(response: RpcResponse): response is RpcResponse & { result: unknown } {
  return !isRpcError(response)
}

// Request ID counter for auto-incrementing IDs
let requestIdCounter = 0

// Create RPC request helper
export function createRpcRequest(
  method: string,
  opts?: { params?: Record<string, unknown> | unknown[]; id?: RpcId }
): RpcRequest {
  return {
    jsonrpc: '2.0',
    method,
    ...(opts?.params && { params: opts.params }),
    id: opts?.id ?? ++requestIdCounter,
  }
}

// Create RPC error response helper
export function createRpcError(
  code: number,
  message: string,
  id?: RpcId | null,
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

// Create RPC success response helper
export function createRpcSuccess(result: unknown, id: RpcId): RpcResponse {
  return {
    jsonrpc: '2.0',
    result,
    id,
  }
}

// Reset request ID counter (for testing)
export function resetRequestIdCounter(): void {
  requestIdCounter = 0
}
