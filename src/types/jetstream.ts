/**
 * JetStream Types
 *
 * Implements types compatible with @nats-io/jetstream library.
 */

// Policy types
export type RetentionPolicy = 'limits' | 'interest' | 'workqueue'
export type StorageType = 'file' | 'memory'
export type DiscardPolicy = 'old' | 'new'
export type AckPolicy = 'none' | 'all' | 'explicit'
export type DeliverPolicy =
  | 'all'
  | 'last'
  | 'new'
  | 'by_start_sequence'
  | 'by_start_time'
  | 'last_per_subject'
export type ReplayPolicy = 'instant' | 'original'

// Stream configuration
export interface StreamConfig {
  name: string
  subjects: string[]
  description?: string
  retention?: RetentionPolicy
  storage?: StorageType
  max_msgs?: number
  max_bytes?: number
  max_age?: number // nanoseconds
  max_msg_size?: number
  max_msgs_per_subject?: number
  max_consumers?: number
  discard?: DiscardPolicy
  discard_new_per_subject?: boolean
  duplicate_window?: number // nanoseconds
  num_replicas?: number
  deny_delete?: boolean
  deny_purge?: boolean
  allow_rollup_hdrs?: boolean
  allow_direct?: boolean
  mirror_direct?: boolean
  sealed?: boolean
  placement?: {
    cluster?: string
    tags?: string[]
  }
  mirror?: {
    name: string
    opt_start_seq?: number
    opt_start_time?: string
    filter_subject?: string
  }
  sources?: Array<{
    name: string
    opt_start_seq?: number
    opt_start_time?: string
    filter_subject?: string
  }>
  republish?: {
    src: string
    dest: string
    headers_only?: boolean
  }
  subject_transform?: {
    src: string
    dest: string
  }
}

// Default stream config helper
export function defaultStreamConfig(name: string): StreamConfig {
  return {
    name,
    subjects: [],
    retention: 'limits',
    storage: 'file',
    max_msgs: -1,
    max_bytes: -1,
    max_age: 0,
    max_msg_size: -1,
    max_consumers: -1,
    discard: 'old',
    duplicate_window: 2 * 60 * 1_000_000_000, // 2 minutes in nanos
    num_replicas: 1,
    deny_delete: false,
    deny_purge: false,
  }
}

// Stream state
export interface StreamState {
  messages: number
  bytes: number
  first_seq: number
  first_ts?: string
  last_seq: number
  last_ts?: string
  consumer_count: number
  num_deleted?: number
  num_subjects?: number
  subjects?: Record<string, number>
}

// Stream info
export interface StreamInfo {
  config: StreamConfig
  state: StreamState
  created: string
  cluster?: {
    name?: string
    leader?: string
    replicas?: Array<{
      name: string
      current: boolean
      active: number
      lag: number
    }>
  }
  mirror?: {
    name: string
    lag: number
    active: number
  }
  sources?: Array<{
    name: string
    lag: number
    active: number
  }>
}

// Consumer configuration
export interface ConsumerConfig {
  name?: string
  durable_name?: string
  description?: string
  deliver_policy?: DeliverPolicy
  opt_start_seq?: number
  opt_start_time?: string
  ack_policy: AckPolicy
  ack_wait?: number // nanoseconds
  max_deliver?: number
  filter_subject?: string
  filter_subjects?: string[]
  replay_policy?: ReplayPolicy
  rate_limit_bps?: number
  sample_freq?: string
  max_waiting?: number
  max_ack_pending?: number
  headers_only?: boolean
  max_batch?: number
  max_expires?: number // nanoseconds
  max_bytes?: number
  inactive_threshold?: number // nanoseconds
  backoff?: number[] // nanoseconds
  num_replicas?: number
  mem_storage?: boolean
  metadata?: Record<string, string>
}

// Default consumer config helper
export function defaultConsumerConfig(): ConsumerConfig {
  return {
    ack_policy: 'explicit',
    deliver_policy: 'all',
    replay_policy: 'instant',
    ack_wait: 30 * 1_000_000_000, // 30 seconds in nanos
    max_deliver: -1,
    max_ack_pending: 1000,
    max_waiting: 512,
  }
}

// Sequence pair for consumer tracking
export interface SequencePair {
  consumer_seq: number
  stream_seq: number
}

// Consumer info
export interface ConsumerInfo {
  stream_name: string
  name: string
  config: ConsumerConfig
  created: string
  delivered: SequencePair
  ack_floor: SequencePair
  num_ack_pending: number
  num_redelivered: number
  num_waiting: number
  num_pending: number
  cluster?: {
    name?: string
    leader?: string
  }
  push_bound?: boolean
}

// Publish acknowledgment
export interface PubAck {
  stream: string
  seq: number
  duplicate?: boolean
  domain?: string
}

// JetStream message info
export interface JsMsgInfo {
  stream: string
  consumer: string
  delivered: number
  streamSequence: number
  consumerSequence: number
  timestampNanos: bigint
  pending: number
  redelivered: boolean
  redeliveryCount?: number
}

// JetStream message
export interface JsMsg {
  subject: string
  data: Uint8Array
  headers?: import('./nats').MsgHdrs
  seq: number
  info: JsMsgInfo
  ack(): void
  nak(delay?: number): void
  working(): void
  term(reason?: string): void
  ackAck(): Promise<boolean>
  string?(): string
  json?<T = unknown>(): T
}

// Pull options for fetch
export interface PullOptions {
  max_messages?: number
  max_bytes?: number
  expires?: number // milliseconds
  idle_heartbeat?: number // milliseconds
  batch?: number
  no_wait?: boolean
}

// Consume options
export interface ConsumeOptions {
  max_messages?: number
  max_bytes?: number
  expires?: number
  idle_heartbeat?: number
  callback?: (msg: JsMsg) => void | Promise<void>
}

// Consumer messages iterator
export interface ConsumerMessages extends AsyncIterable<JsMsg> {
  close(): Promise<void>
  stop(): Promise<void>
}

// Stream interface
export interface Stream {
  info(cached?: boolean): Promise<StreamInfo>
  getMessage(query: {
    seq?: number
    last_by_subj?: string
    next_by_subj?: string
  }): Promise<StoredMsg | null>
  deleteMessage(seq: number, erase?: boolean): Promise<boolean>
}

// Stored message
export interface StoredMsg {
  subject: string
  data: Uint8Array
  headers?: import('./nats').MsgHdrs
  seq: number
  time: string
}

// Consumer interface
export interface Consumer {
  info(cached?: boolean): Promise<ConsumerInfo>
  consume(opts?: ConsumeOptions): Promise<ConsumerMessages>
  fetch(opts?: PullOptions): Promise<ConsumerMessages>
  delete(): Promise<boolean>
}

// Purge response
export interface PurgeResponse {
  success: boolean
  purged: number
}

// Streams API
export interface StreamsAPI {
  add(config: StreamConfig): Promise<StreamInfo>
  update(config: StreamConfig): Promise<StreamInfo>
  delete(stream: string): Promise<boolean>
  get(stream: string): Promise<Stream>
  list(): AsyncIterable<StreamInfo>
  info(stream: string): Promise<StreamInfo>
  names(): AsyncIterable<string>
  purge(stream: string, opts?: { filter?: string; seq?: number; keep?: number }): Promise<PurgeResponse>
}

// Consumers API
export interface ConsumersAPI {
  add(stream: string, config: ConsumerConfig): Promise<ConsumerInfo>
  update(stream: string, config: ConsumerConfig): Promise<ConsumerInfo>
  delete(stream: string, consumer: string): Promise<boolean>
  list(stream: string): AsyncIterable<ConsumerInfo>
  info(stream: string, consumer: string): Promise<ConsumerInfo>
}

// JetStream manager
export interface JetStreamManager {
  streams: StreamsAPI
  consumers: ConsumersAPI
}

// Consumers accessor for JetStreamClient
export interface ConsumersAccessor {
  get(stream: string, consumer: string): Promise<Consumer>
}

// Streams accessor for JetStreamClient
export interface StreamsAccessor {
  get(stream: string): Promise<Stream>
}

// JetStream publish options
export interface JetStreamPublishOptions {
  msgID?: string
  expect?: {
    lastMsgID?: string
    lastSequence?: number
    lastSubjectSequence?: number
    streamName?: string
  }
  headers?: import('./nats').MsgHdrs
  timeout?: number
}

// JetStream client
export interface JetStreamClient {
  publish(
    subject: string,
    data?: Uint8Array,
    opts?: JetStreamPublishOptions
  ): Promise<PubAck>
  consumers: ConsumersAccessor
  streams: StreamsAccessor
}
