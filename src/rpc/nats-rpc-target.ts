/**
 * NatsRpcTarget
 *
 * Wraps a DurableObjectStub to provide RPC methods for NATS operations.
 * Sends JSON-RPC 2.0 requests via fetch to the stub.
 */

import type { RpcRequest, RpcResponse, RpcId } from '../types/rpc'
import type { PublishOptions, SubscriptionOptions, RequestOptions } from '../types/nats'

/**
 * Result of a publish operation
 */
export interface PublishResult {
  success: boolean
}

/**
 * Result of a subscribe operation
 */
export interface SubscribeResult {
  sid: number
  subject: string
  queue?: string
  max?: number
}

/**
 * Result of a request operation
 */
export interface RequestResult {
  subject: string
  data: Uint8Array
  sid: number
}

/**
 * Result of an unsubscribe operation
 */
export interface UnsubscribeResult {
  success: boolean
}

/**
 * RPC Error thrown when the server returns an error response
 */
export class RpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message)
    this.name = 'RpcError'
  }
}

/**
 * Encode Uint8Array to base64 string
 */
function encodeBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  return btoa(binary)
}

/**
 * Decode base64 string to Uint8Array
 */
function decodeBase64(base64: string): Uint8Array {
  if (!base64) {
    return new Uint8Array(0)
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * NatsRpcTarget wraps a DurableObjectStub to provide RPC methods for NATS operations.
 */
export class NatsRpcTarget {
  private readonly stub: DurableObjectStub
  private requestIdCounter: number = 0

  constructor(stub: DurableObjectStub) {
    this.stub = stub
  }

  /**
   * Generate a unique request ID
   */
  private nextId(): RpcId {
    return ++this.requestIdCounter
  }

  /**
   * Send an RPC request to the stub
   */
  private async rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const request: RpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.nextId(),
    }

    const httpRequest = new Request('http://internal/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const httpResponse = await this.stub.fetch(httpRequest)
    const response = await httpResponse.clone().json() as RpcResponse

    if (response.error) {
      throw new RpcError(response.error.code, response.error.message, response.error.data)
    }

    return response.result as T
  }

  /**
   * Publish a message to a subject
   */
  async publish(
    subject: string,
    data?: Uint8Array,
    opts?: PublishOptions
  ): Promise<PublishResult> {
    const params: Record<string, unknown> = {
      subject,
      data: encodeBase64(data ?? new Uint8Array(0)),
    }

    if (opts?.reply) {
      params.reply = opts.reply
    }

    return this.rpc<PublishResult>('nats.publish', params)
  }

  /**
   * Subscribe to a subject
   */
  async subscribe(
    subject: string,
    opts?: SubscriptionOptions
  ): Promise<SubscribeResult> {
    const params: Record<string, unknown> = {
      subject,
    }

    if (opts?.queue) {
      params.queue = opts.queue
    }

    if (opts?.max !== undefined) {
      params.max = opts.max
    }

    return this.rpc<SubscribeResult>('nats.subscribe', params)
  }

  /**
   * Send a request and wait for a response
   */
  async request(
    subject: string,
    data?: Uint8Array,
    opts?: RequestOptions
  ): Promise<RequestResult> {
    const params: Record<string, unknown> = {
      subject,
      data: encodeBase64(data ?? new Uint8Array(0)),
    }

    if (opts?.timeout !== undefined) {
      params.timeout = opts.timeout
    }

    const result = await this.rpc<{ subject: string; data: string; sid: number }>(
      'nats.request',
      params
    )

    return {
      subject: result.subject,
      data: decodeBase64(result.data),
      sid: result.sid,
    }
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(sid: number, max?: number): Promise<UnsubscribeResult> {
    const params: Record<string, unknown> = {
      sid,
    }

    if (max !== undefined) {
      params.max = max
    }

    return this.rpc<UnsubscribeResult>('nats.unsubscribe', params)
  }
}
