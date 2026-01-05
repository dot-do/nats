/**
 * RPC Client
 *
 * HTTP-based JSON-RPC 2.0 client for NatDO communication.
 */

/**
 * RPC Error class for JSON-RPC error responses
 */
export class RpcError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

/**
 * RPC Client options
 */
export interface RpcClientOptions {
  /** The URL of the RPC endpoint */
  url: string
  /** Custom headers to include in requests */
  headers?: Record<string, string>
  /** Custom fetch implementation */
  fetch?: typeof fetch
  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Batch request item
 */
interface BatchRequest {
  method: string
  params?: Record<string, unknown> | unknown[]
}

/**
 * JSON-RPC 2.0 response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
  id: number | string | null
}

/**
 * RPC Client class for making JSON-RPC 2.0 calls over HTTP
 */
export class RpcClient {
  private readonly url: string
  private readonly headers: Record<string, string>
  private readonly fetchFn: typeof fetch
  private readonly timeout?: number
  private requestId = 0

  constructor(options: RpcClientOptions) {
    this.url = options.url
    this.headers = options.headers ?? {}
    this.fetchFn = options.fetch ?? globalThis.fetch
    this.timeout = options.timeout
  }

  /**
   * Generate a unique request ID
   */
  private nextId(): number {
    return ++this.requestId
  }

  /**
   * Make an HTTP request with optional timeout
   */
  private async request(body: unknown): Promise<Response> {
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(body),
    }

    if (this.timeout !== undefined) {
      options.signal = AbortSignal.timeout(this.timeout)
    }

    const response = await this.fetchFn(this.url, options)

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    return response
  }

  /**
   * Make a single RPC call
   */
  async call<T = unknown>(
    method: string,
    params?: Record<string, unknown> | unknown[]
  ): Promise<T> {
    const id = this.nextId()
    const request: Record<string, unknown> = {
      jsonrpc: '2.0',
      method,
      id,
    }

    if (params !== undefined) {
      request.params = params
    }

    const response = await this.request(request)
    const data = (await response.json()) as JsonRpcResponse

    if (data.error) {
      throw new RpcError(data.error.code, data.error.message, data.error.data)
    }

    return data.result as T
  }

  /**
   * Make a batch of RPC calls
   */
  async batch(requests: BatchRequest[]): Promise<Array<unknown | RpcError>> {
    if (requests.length === 0) {
      return []
    }

    // Create requests with IDs and track their order
    const idToIndex = new Map<number, number>()
    const rpcRequests = requests.map((req, index) => {
      const id = this.nextId()
      idToIndex.set(id, index)

      const request: Record<string, unknown> = {
        jsonrpc: '2.0',
        method: req.method,
        id,
      }

      if (req.params !== undefined) {
        request.params = req.params
      }

      return request
    })

    const response = await this.request(rpcRequests)
    const data = (await response.json()) as JsonRpcResponse[]

    // Create results array in original request order
    const results: Array<unknown | RpcError> = new Array(requests.length)

    for (const item of data) {
      const index = idToIndex.get(item.id as number)
      if (index !== undefined) {
        if (item.error) {
          results[index] = new RpcError(
            item.error.code,
            item.error.message,
            item.error.data
          )
        } else {
          results[index] = item.result
        }
      }
    }

    return results
  }

  /**
   * Send a notification (no response expected)
   */
  async notify(
    method: string,
    params?: Record<string, unknown> | unknown[]
  ): Promise<void> {
    const request: Record<string, unknown> = {
      jsonrpc: '2.0',
      method,
    }

    if (params !== undefined) {
      request.params = params
    }

    await this.request(request)
  }
}
