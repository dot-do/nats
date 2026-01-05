/**
 * Core NATS Types
 *
 * Implements types compatible with the nats.js library.
 */

// Connection options for NatDO
export interface ConnectionOptions {
  servers: string | string[]
  name?: string
  token?: string
  user?: string
  pass?: string
  timeout?: number
  reconnect?: boolean
  maxReconnectAttempts?: number
  reconnectTimeWait?: number
}

// Message headers interface
export interface MsgHdrs {
  get(key: string): string | undefined
  set(key: string, value: string): void
  append(key: string, value: string): void
  has(key: string): boolean
  delete(key: string): void
  keys(): IterableIterator<string>
  values(key: string): string[]
  code?: number
  description?: string
}

// Create headers implementation
class MsgHdrsImpl implements MsgHdrs {
  private readonly headers: Map<string, string[]> = new Map()
  code?: number
  description?: string

  get(key: string): string | undefined {
    const values = this.headers.get(key.toLowerCase())
    return values?.[0]
  }

  set(key: string, value: string): void {
    this.headers.set(key.toLowerCase(), [value])
  }

  append(key: string, value: string): void {
    const lowerKey = key.toLowerCase()
    const existing = this.headers.get(lowerKey) || []
    existing.push(value)
    this.headers.set(lowerKey, existing)
  }

  has(key: string): boolean {
    return this.headers.has(key.toLowerCase())
  }

  delete(key: string): void {
    this.headers.delete(key.toLowerCase())
  }

  *keys(): IterableIterator<string> {
    yield* this.headers.keys()
  }

  values(key: string): string[] {
    return this.headers.get(key.toLowerCase()) || []
  }
}

export function createHeaders(): MsgHdrs {
  return new MsgHdrsImpl()
}

// Message interface
export interface Msg {
  subject: string
  data: Uint8Array
  sid: number
  reply?: string
  headers?: MsgHdrs
  respond(data?: Uint8Array, opts?: PublishOptions): boolean
  string(): string
  json<T = unknown>(): T
}

// Publish options
export interface PublishOptions {
  reply?: string
  headers?: MsgHdrs
}

// Subscription options
export interface SubscriptionOptions {
  queue?: string
  max?: number
  callback?: (err: Error | null, msg: Msg) => void
  timeout?: number
}

// Request options
export interface RequestOptions {
  timeout?: number
  headers?: MsgHdrs
  noMux?: boolean
}

// Subscription interface
export interface Subscription extends AsyncIterable<Msg> {
  getSubject(): string
  unsubscribe(max?: number): void
  drain(): Promise<void>
  isClosed(): boolean
  getReceived(): number
  getMax(): number | undefined
}

// Queued iterator for async message consumption
export interface QueuedIterator<T> extends AsyncIterator<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>
  stop(): void
}

// Status types
export type StatusType =
  | 'disconnect'
  | 'reconnecting'
  | 'reconnect'
  | 'update'
  | 'ldm'
  | 'error'

// Status event
export interface Status {
  type: StatusType
  data?: string | Error | { added?: string[]; deleted?: string[] }
}

// Server info
export interface ServerInfo {
  server_id: string
  server_name: string
  version: string
  proto: number
  host: string
  port: number
  max_payload: number
  jetstream?: boolean
  client_id?: number
  client_ip?: string
}

// NATS Connection interface
export interface NatsConnection {
  publish(subject: string, data?: Uint8Array, opts?: PublishOptions): void
  subscribe(subject: string, opts?: SubscriptionOptions): Subscription
  request(
    subject: string,
    data?: Uint8Array,
    opts?: RequestOptions
  ): Promise<Msg>
  flush(): Promise<void>
  drain(): Promise<void>
  close(): Promise<void>
  closed(): Promise<void | Error>
  status(): AsyncIterable<Status>
  isClosed(): boolean
  isDraining(): boolean
  getServer(): string
  info?: ServerInfo
}

// Codec interface
export interface Codec<T> {
  encode(data: T): Uint8Array
  decode(data: Uint8Array): T
}

// String codec
export function StringCodec(): Codec<string> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  return {
    encode(data: string): Uint8Array {
      return encoder.encode(data)
    },
    decode(data: Uint8Array): string {
      return decoder.decode(data)
    },
  }
}

// JSON codec
export function JSONCodec<T = unknown>(): Codec<T> {
  const sc = StringCodec()
  return {
    encode(data: T): Uint8Array {
      return sc.encode(JSON.stringify(data))
    },
    decode(data: Uint8Array): T {
      return JSON.parse(sc.decode(data))
    },
  }
}

// Empty payload constant
export const Empty: Uint8Array = new Uint8Array(0)
