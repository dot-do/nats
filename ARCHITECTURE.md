# NatDO: NATS/JetStream on Cloudflare Durable Objects

## Overview

NatDO implements NATS Core and JetStream messaging on Cloudflare Workers using Durable Objects with SQLite storage. It exposes an API compatible with the `nats` and `@nats-io/jetstream` npm packages via Cloudflare Workers RPC and capnweb.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  nats.js Compatible Client  │  @nats-io/jetstream Client  │  MCP Tools  │
│  - connect()                │  - jetstream(nc)             │  - publish  │
│  - publish()                │  - jetstreamManager(nc)      │  - consume  │
│  - subscribe()              │  - streams, consumers        │  - manage   │
│  - request()                │  - publish/consume           │             │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │           RPC TRANSPORT           │
                    │  - HTTP POST (JSON-RPC 2.0)       │
                    │  - WebSocket (persistent conn)    │
                    │  - Service Bindings (Workers)     │
                    │  - capnweb (promise pipelining)   │
                    └─────────────────┬─────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORKER ENTRYPOINT                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  NatDoEntrypoint extends WorkerEntrypoint                               │
│  - Routes to appropriate Durable Object                                  │
│  - Handles JetStream wire API ($JS.API.*)                               │
│  - MCP endpoint at /mcp                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│  NatsCoordinator  │   │   NatsPubSub      │   │     StreamDO          │
│  (Single Global)  │   │   (Per Region)    │   │   (Per Stream)        │
├───────────────────┤   ├───────────────────┤   ├───────────────────────┤
│ Stream Registry   │   │ Core NATS Pub/Sub │   │ JetStream Messages    │
│ Consumer Registry │   │ Hibernatable WS   │   │ Consumer State        │
│ Subject Bindings  │   │ Subject Wildcards │   │ Ack Tracking          │
│ Cluster Info      │   │ Queue Groups      │   │ Retention/Trimming    │
└───────────────────┘   │ Request/Reply     │   │ Deduplication         │
                        └───────────────────┘   └───────────────────────┘
                                      │                             │
                                      ▼                             ▼
                        ┌───────────────────┐   ┌───────────────────────┐
                        │  SQLite Storage   │   │    SQLite Storage     │
                        │  - subscriptions  │   │  - messages           │
                        │  - queue_groups   │   │  - consumers          │
                        │  - pending_reqs   │   │  - pending_acks       │
                        └───────────────────┘   │  - dedup_window       │
                                                └───────────────────────┘
```

## Durable Object Design

### 1. NatsCoordinator (Global Registry)

Single global DO managing cluster-wide metadata.

**Responsibilities:**
- Stream registry (name → config)
- Subject → Stream bindings
- Consumer discovery
- Account limits/stats

**SQLite Schema:**
```sql
CREATE TABLE streams (
  name TEXT PRIMARY KEY,
  config TEXT NOT NULL,          -- JSON: StreamConfig
  state TEXT NOT NULL,           -- JSON: StreamState
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE stream_subjects (
  stream_name TEXT NOT NULL REFERENCES streams(name) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  PRIMARY KEY (stream_name, subject)
);
CREATE INDEX idx_subjects ON stream_subjects(subject);

CREATE TABLE consumers (
  stream_name TEXT NOT NULL REFERENCES streams(name) ON DELETE CASCADE,
  consumer_name TEXT NOT NULL,
  config TEXT NOT NULL,          -- JSON: ConsumerConfig
  durable INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (stream_name, consumer_name)
);
```

### 2. NatsPubSub (Core NATS)

Regional DO handling non-persistent pub/sub with Hibernatable WebSockets.

**Responsibilities:**
- Subject subscriptions (with wildcards)
- Queue group distribution
- Request/Reply coordination
- Real-time message delivery

**SQLite Schema:**
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  queue_group TEXT,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_subs_subject ON subscriptions(subject);
CREATE INDEX idx_subs_queue ON subscriptions(queue_group) WHERE queue_group IS NOT NULL;

CREATE TABLE pending_requests (
  inbox TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  timeout_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_pending_timeout ON pending_requests(timeout_at);
```

**WebSocket Attachment (Hibernation State):**
```typescript
interface NatsWsAttachment {
  clientId: string
  subscriptions: Map<string, {
    subject: string
    queue?: string
    sid: number
  }>
  connectedAt: number
  lastPingAt: number
}
```

### 3. StreamDO (JetStream Stream)

One DO per stream, handling all messages and consumers for that stream.

**Responsibilities:**
- Message storage (append-only log)
- Consumer state management
- Acknowledgment tracking
- Retention enforcement
- Message deduplication

**SQLite Schema:**
```sql
-- Messages (append-only log)
CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  data BLOB NOT NULL,
  headers TEXT,                  -- JSON headers
  timestamp INTEGER NOT NULL,
  msg_id TEXT,                   -- For deduplication
  INDEX idx_messages_subject ON messages(subject),
  INDEX idx_messages_timestamp ON messages(timestamp),
  INDEX idx_messages_msgid ON messages(msg_id) WHERE msg_id IS NOT NULL
);

-- Stream state
CREATE TABLE stream_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  first_seq INTEGER NOT NULL DEFAULT 1,
  last_seq INTEGER NOT NULL DEFAULT 0,
  first_ts INTEGER,
  last_ts INTEGER,
  bytes INTEGER NOT NULL DEFAULT 0,
  msgs INTEGER NOT NULL DEFAULT 0,
  consumer_count INTEGER NOT NULL DEFAULT 0
);

-- Consumer state (per consumer within stream)
CREATE TABLE consumer_state (
  name TEXT PRIMARY KEY,
  config TEXT NOT NULL,          -- JSON: ConsumerConfig
  deliver_seq INTEGER NOT NULL DEFAULT 0,
  ack_floor_seq INTEGER NOT NULL DEFAULT 0,
  ack_floor_ts INTEGER,
  num_ack_pending INTEGER NOT NULL DEFAULT 0,
  num_redelivered INTEGER NOT NULL DEFAULT 0,
  num_waiting INTEGER NOT NULL DEFAULT 0,
  num_pending INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER
);

-- Pending acknowledgments
CREATE TABLE pending_acks (
  consumer_name TEXT NOT NULL REFERENCES consumer_state(name) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  deliver_count INTEGER NOT NULL DEFAULT 1,
  deliver_time INTEGER NOT NULL,
  ack_wait_deadline INTEGER NOT NULL,
  PRIMARY KEY (consumer_name, seq)
);
CREATE INDEX idx_pending_deadline ON pending_acks(ack_wait_deadline);

-- Deduplication window
CREATE TABLE dedup_window (
  msg_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX idx_dedup_ts ON dedup_window(timestamp);
```

## RPC Interface Design

Following the "DO IS the RPC Target" pattern from Redois/MondoDB:

### NatsRpcTarget (Abstract Base)

```typescript
import { RpcTarget } from 'capnweb'

export abstract class NatsRpcTarget extends RpcTarget {
  // Core NATS
  abstract publish(subject: string, data: Uint8Array, options?: PublishOptions): Promise<void>
  abstract subscribe(subject: string, options?: SubscribeOptions): Promise<Subscription>
  abstract request(subject: string, data: Uint8Array, options?: RequestOptions): Promise<Msg>

  // Connection
  abstract info(): Promise<ServerInfo>
  abstract ping(): Promise<void>
  abstract flush(): Promise<void>
}

export abstract class JetStreamRpcTarget extends RpcTarget {
  // Stream Management (JetStreamManager)
  abstract streams(): Promise<StreamInfo[]>
  abstract addStream(config: StreamConfig): Promise<StreamInfo>
  abstract updateStream(config: StreamConfig): Promise<StreamInfo>
  abstract deleteStream(name: string): Promise<boolean>
  abstract getStream(name: string): Promise<Stream>
  abstract purgeStream(name: string, opts?: PurgeOpts): Promise<PurgeResponse>

  // Consumer Management
  abstract consumers(stream: string): Promise<ConsumerInfo[]>
  abstract addConsumer(stream: string, config: ConsumerConfig): Promise<ConsumerInfo>
  abstract deleteConsumer(stream: string, consumer: string): Promise<boolean>
  abstract getConsumer(stream: string, consumer: string): Promise<Consumer>

  // Message Operations
  abstract publish(subject: string, data: Uint8Array, opts?: JetStreamPublishOptions): Promise<PubAck>
  abstract getMessage(stream: string, query: MsgRequest): Promise<StoredMsg>
  abstract deleteMessage(stream: string, seq: number, erase?: boolean): Promise<boolean>
}

export abstract class ConsumerRpcTarget extends RpcTarget {
  // Pull Consumer
  abstract fetch(opts?: FetchOptions): Promise<JetStreamPullSubscription>
  abstract next(opts?: NextOptions): Promise<JsMsg | null>

  // Push Consumer (via WebSocket)
  abstract consume(opts?: ConsumeOptions): Promise<ConsumerMessages>

  // Acknowledgments
  abstract ack(seq: number): Promise<void>
  abstract nak(seq: number, delay?: number): Promise<void>
  abstract working(seq: number): Promise<void>
  abstract term(seq: number): Promise<void>
}
```

### JetStream Wire API Mapping

The JetStream wire API uses `$JS.API.*` subjects. We map these to RPC methods:

| Wire API Subject | RPC Method | Handler |
|-----------------|------------|---------|
| `$JS.API.INFO` | `info()` | NatsCoordinator |
| `$JS.API.STREAM.CREATE.*` | `addStream()` | NatsCoordinator → StreamDO |
| `$JS.API.STREAM.UPDATE.*` | `updateStream()` | StreamDO |
| `$JS.API.STREAM.DELETE.*` | `deleteStream()` | NatsCoordinator → StreamDO |
| `$JS.API.STREAM.INFO.*` | `getStream()` | StreamDO |
| `$JS.API.STREAM.LIST` | `streams()` | NatsCoordinator |
| `$JS.API.STREAM.NAMES` | `streamNames()` | NatsCoordinator |
| `$JS.API.STREAM.PURGE.*` | `purgeStream()` | StreamDO |
| `$JS.API.STREAM.MSG.GET.*` | `getMessage()` | StreamDO |
| `$JS.API.STREAM.MSG.DELETE.*` | `deleteMessage()` | StreamDO |
| `$JS.API.CONSUMER.CREATE.*` | `addConsumer()` | StreamDO |
| `$JS.API.CONSUMER.DURABLE.CREATE.*.*` | `addConsumer()` | StreamDO |
| `$JS.API.CONSUMER.DELETE.*.*` | `deleteConsumer()` | StreamDO |
| `$JS.API.CONSUMER.INFO.*.*` | `getConsumer()` | StreamDO |
| `$JS.API.CONSUMER.LIST.*` | `consumers()` | StreamDO |
| `$JS.API.CONSUMER.MSG.NEXT.*.*` | `fetch()` / `next()` | StreamDO |

## MCP Integration

Following MondoDB's adapter pattern:

```typescript
// src/mcp/nats-access.ts
export interface NatsAccess {
  // Core NATS
  publish(subject: string, data: string | Uint8Array): Promise<void>
  subscribe(subject: string): AsyncIterable<Msg>
  request(subject: string, data: string | Uint8Array, timeout?: number): Promise<Msg>

  // JetStream Streams
  listStreams(): Promise<StreamInfo[]>
  getStream(name: string): Promise<StreamInfo>
  createStream(config: Partial<StreamConfig>): Promise<StreamInfo>
  deleteStream(name: string): Promise<boolean>
  purgeStream(name: string): Promise<PurgeResponse>

  // JetStream Consumers
  listConsumers(stream: string): Promise<ConsumerInfo[]>
  getConsumer(stream: string, name: string): Promise<ConsumerInfo>
  createConsumer(stream: string, config: Partial<ConsumerConfig>): Promise<ConsumerInfo>
  deleteConsumer(stream: string, name: string): Promise<boolean>

  // JetStream Messages
  jsPublish(subject: string, data: string | Uint8Array, opts?: JsPublishOpts): Promise<PubAck>
  getMessage(stream: string, seq: number): Promise<StoredMsg>
  fetchMessages(stream: string, consumer: string, batch?: number): Promise<JsMsg[]>
}

// src/mcp/server.ts
export function createMcpServer(config: { natsAccess: NatsAccess }): McpServer {
  const server = new McpServer()

  // Publishing tool
  server.tool('nats_publish', {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Subject to publish to' },
      data: { type: 'string', description: 'Message payload' },
      jetstream: { type: 'boolean', description: 'Use JetStream for persistence' }
    },
    required: ['subject', 'data']
  }, async ({ subject, data, jetstream }) => {
    if (jetstream) {
      const ack = await config.natsAccess.jsPublish(subject, data)
      return { success: true, stream: ack.stream, seq: ack.seq }
    }
    await config.natsAccess.publish(subject, data)
    return { success: true }
  })

  // Stream management tool
  server.tool('nats_stream', {
    type: 'object',
    properties: {
      action: { enum: ['list', 'get', 'create', 'delete', 'purge'] },
      name: { type: 'string' },
      subjects: { type: 'array', items: { type: 'string' } },
      retention: { enum: ['limits', 'workqueue', 'interest'] },
      maxAge: { type: 'number', description: 'Max age in nanoseconds' },
      maxMsgs: { type: 'number' },
      maxBytes: { type: 'number' }
    },
    required: ['action']
  }, async (args) => {
    switch (args.action) {
      case 'list': return config.natsAccess.listStreams()
      case 'get': return config.natsAccess.getStream(args.name!)
      case 'create': return config.natsAccess.createStream({
        name: args.name!,
        subjects: args.subjects!,
        retention: args.retention as any,
        max_age: args.maxAge,
        max_msgs: args.maxMsgs,
        max_bytes: args.maxBytes
      })
      case 'delete': return config.natsAccess.deleteStream(args.name!)
      case 'purge': return config.natsAccess.purgeStream(args.name!)
    }
  })

  // Consumer management tool
  server.tool('nats_consumer', {
    type: 'object',
    properties: {
      action: { enum: ['list', 'get', 'create', 'delete', 'fetch'] },
      stream: { type: 'string' },
      name: { type: 'string' },
      durable: { type: 'string' },
      deliverPolicy: { enum: ['all', 'last', 'new', 'by_start_sequence', 'by_start_time'] },
      ackPolicy: { enum: ['explicit', 'none', 'all'] },
      batch: { type: 'number' }
    },
    required: ['action', 'stream']
  }, async (args) => {
    switch (args.action) {
      case 'list': return config.natsAccess.listConsumers(args.stream)
      case 'get': return config.natsAccess.getConsumer(args.stream, args.name!)
      case 'create': return config.natsAccess.createConsumer(args.stream, {
        name: args.name,
        durable_name: args.durable,
        deliver_policy: args.deliverPolicy as any,
        ack_policy: args.ackPolicy as any
      })
      case 'delete': return config.natsAccess.deleteConsumer(args.stream, args.name!)
      case 'fetch': return config.natsAccess.fetchMessages(args.stream, args.name!, args.batch)
    }
  })

  // Code execution tool (sandboxed)
  server.tool('nats_do', {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'JavaScript code to execute with nats proxy' }
    },
    required: ['code']
  }, async ({ code }) => {
    // Use Worker Loader sandbox like Redois
    return evaluator.execute(code, { nats: config.natsAccess })
  })

  return server
}
```

## Project Structure

```
natdo/
├── src/
│   ├── index.ts                    # Library exports
│   ├── worker.ts                   # Worker export (default)
│   ├── entrypoint.ts               # NatDoEntrypoint (HTTP routing)
│   │
│   ├── durable-objects/
│   │   ├── index.ts
│   │   ├── nats-coordinator.ts     # Global registry DO
│   │   ├── nats-pubsub.ts          # Core NATS pub/sub DO
│   │   ├── stream-do.ts            # JetStream stream DO
│   │   └── schema.ts               # SQLite schemas
│   │
│   ├── rpc/
│   │   ├── index.ts
│   │   ├── nats-rpc-target.ts      # Abstract RPC interface
│   │   ├── jetstream-rpc-target.ts # JetStream RPC interface
│   │   ├── endpoint.ts             # JSON-RPC 2.0 handler
│   │   └── rpc-client.ts           # Client with batching
│   │
│   ├── client/
│   │   ├── index.ts
│   │   ├── nats-connection.ts      # NatsConnection compatible
│   │   ├── jetstream.ts            # JetStream client
│   │   ├── jetstream-manager.ts    # JetStreamManager
│   │   ├── subscription.ts         # Subscription iterators
│   │   └── codecs.ts               # StringCodec, JSONCodec
│   │
│   ├── mcp/
│   │   ├── index.ts
│   │   ├── server.ts               # MCP server factory
│   │   ├── nats-access.ts          # NatsAccess adapter
│   │   ├── types.ts                # MCP types
│   │   ├── transport/
│   │   │   ├── http.ts             # HTTP/SSE transport
│   │   │   └── stdio.ts            # CLI transport
│   │   └── sandbox/
│   │       └── worker-evaluator.ts # Code sandbox
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── nats.ts                 # Core NATS types
│   │   ├── jetstream.ts            # JetStream types
│   │   ├── rpc.ts                  # RPC request/response
│   │   └── env.ts                  # Cloudflare Env bindings
│   │
│   └── utils/
│       ├── subject-matcher.ts      # Wildcard matching (*, >)
│       ├── nuid.ts                 # NATS UID generator
│       └── errors.ts               # Error hierarchy
│
├── test/
│   ├── unit/
│   │   ├── subject-matcher.test.ts
│   │   ├── stream-do.test.ts
│   │   └── pubsub.test.ts
│   └── integration/
│       └── jetstream.test.ts
│
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── vitest.config.ts
└── README.md
```

## TypeScript Types (nats.js Compatible)

```typescript
// src/types/nats.ts

export interface NatsConnection {
  info: ServerInfo
  closed(): Promise<void | Error>
  close(): Promise<void>
  publish(subject: string, data?: Uint8Array, options?: PublishOptions): void
  subscribe(subject: string, opts?: SubscriptionOptions): Subscription
  request(subject: string, data?: Uint8Array, opts?: RequestOptions): Promise<Msg>
  flush(): Promise<void>
  drain(): Promise<void>
  isClosed(): boolean
  isDraining(): boolean
  getServer(): string
  status(): AsyncIterable<Status>
  stats(): Stats

  // JetStream access
  jetstream(opts?: JetStreamOptions): JetStreamClient
  jetstreamManager(opts?: JetStreamOptions): JetStreamManager
}

export interface Msg {
  subject: string
  sid: number
  reply?: string
  data: Uint8Array
  headers?: MsgHdrs
  respond(data?: Uint8Array, opts?: PublishOptions): boolean
}

export interface Subscription extends AsyncIterable<Msg> {
  unsubscribe(max?: number): void
  drain(): Promise<void>
  isDraining(): boolean
  isClosed(): boolean
  getSubject(): string
  getReceived(): number
  getPending(): number
  getProcessed(): number
  getMax(): number | undefined
}

// src/types/jetstream.ts

export interface JetStreamClient {
  publish(subject: string, data?: Uint8Array, opts?: JetStreamPublishOptions): Promise<PubAck>
  consumers: ConsumerAPI
  streams: StreamAPI
}

export interface JetStreamManager {
  streams: StreamsAPI
  consumers: ConsumersAPI
  getAccountInfo(): Promise<AccountInfo>
}

export interface StreamConfig {
  name: string
  description?: string
  subjects?: string[]
  retention: RetentionPolicy     // 'limits' | 'workqueue' | 'interest'
  max_consumers: number
  max_msgs: number
  max_bytes: number
  max_age: number               // nanoseconds
  max_msgs_per_subject: number
  max_msg_size?: number
  discard: DiscardPolicy        // 'old' | 'new'
  storage: StorageType          // 'file' | 'memory'
  num_replicas: number
  no_ack?: boolean
  duplicate_window?: number     // nanoseconds
  placement?: Placement
  mirror?: StreamSource
  sources?: StreamSource[]
  sealed?: boolean
  deny_delete?: boolean
  deny_purge?: boolean
  allow_rollup_hdrs?: boolean
  republish?: Republish
  allow_direct?: boolean
  mirror_direct?: boolean
  metadata?: Record<string, string>
}

export interface ConsumerConfig {
  name?: string
  durable_name?: string
  description?: string
  deliver_policy: DeliverPolicy  // 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time' | 'last_per_subject'
  opt_start_seq?: number
  opt_start_time?: string       // RFC3339
  ack_policy: AckPolicy         // 'explicit' | 'none' | 'all'
  ack_wait?: number             // nanoseconds
  max_deliver?: number
  backoff?: number[]            // nanoseconds
  filter_subject?: string
  filter_subjects?: string[]
  replay_policy: ReplayPolicy   // 'instant' | 'original'
  rate_limit_bps?: number
  sample_freq?: string
  max_waiting?: number
  max_ack_pending?: number
  headers_only?: boolean
  max_batch?: number
  max_expires?: number          // nanoseconds
  inactive_threshold?: number   // nanoseconds
  num_replicas?: number
  mem_storage?: boolean
  metadata?: Record<string, string>
}

export interface PubAck {
  stream: string
  seq: number
  duplicate: boolean
  domain?: string
}

export interface JsMsg extends Msg {
  info: JsMsgInfo
  ack(): void
  nak(delay?: number): void
  working(): void
  term(): void
  ackAck(): Promise<boolean>
}
```

## Wrangler Configuration

```jsonc
// wrangler.jsonc
{
  "name": "natdo",
  "main": "src/worker.ts",
  "compatibility_date": "2026-01-01",
  "compatibility_flags": ["nodejs_compat"],

  "durable_objects": {
    "bindings": [
      { "name": "NATS_COORDINATOR", "class_name": "NatsCoordinator" },
      { "name": "NATS_PUBSUB", "class_name": "NatsPubSub" },
      { "name": "STREAM_DO", "class_name": "StreamDO" }
    ]
  },

  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["NatsCoordinator", "NatsPubSub", "StreamDO"]
    }
  ],

  // For MCP code sandbox
  "unsafe": {
    "bindings": [
      { "name": "LOADER", "type": "worker_loader" }
    ]
  }
}
```

## Key Implementation Details

### Subject Wildcard Matching

```typescript
// src/utils/subject-matcher.ts

/**
 * NATS subject wildcard matching:
 * - '*' matches exactly one token
 * - '>' matches one or more tokens (must be last)
 *
 * Examples:
 * - "foo.*" matches "foo.bar" but not "foo.bar.baz"
 * - "foo.>" matches "foo.bar", "foo.bar.baz", etc.
 * - "foo.*.baz" matches "foo.bar.baz" but not "foo.bar.qux.baz"
 */
export function matchSubject(pattern: string, subject: string): boolean {
  const patternTokens = pattern.split('.')
  const subjectTokens = subject.split('.')

  let pi = 0, si = 0

  while (pi < patternTokens.length && si < subjectTokens.length) {
    const pt = patternTokens[pi]

    if (pt === '>') {
      // '>' must be last token and matches rest
      return pi === patternTokens.length - 1
    }

    if (pt === '*') {
      // '*' matches exactly one token
      pi++
      si++
      continue
    }

    if (pt !== subjectTokens[si]) {
      return false
    }

    pi++
    si++
  }

  // Both exhausted = match
  // Pattern has '>' at end = match
  return pi === patternTokens.length && si === subjectTokens.length
}

export function isValidSubject(subject: string): boolean {
  if (!subject || subject.length === 0) return false
  if (subject.startsWith('.') || subject.endsWith('.')) return false
  if (subject.includes('..')) return false
  return true
}

export function isValidWildcard(pattern: string): boolean {
  if (!isValidSubject(pattern.replace(/[*>]/g, 'x'))) return false
  const tokens = pattern.split('.')
  const gtIndex = tokens.indexOf('>')
  if (gtIndex !== -1 && gtIndex !== tokens.length - 1) return false
  return true
}
```

### Message Retention & Trimming

```typescript
// In StreamDO

async enforceRetention(): Promise<void> {
  const config = await this.getConfig()
  const state = await this.getState()
  const now = Date.now() * 1_000_000 // nanoseconds

  // Enforce max_age
  if (config.max_age > 0) {
    const cutoff = now - config.max_age
    await this.sql.exec(
      `DELETE FROM messages WHERE timestamp < ?`,
      cutoff
    )
  }

  // Enforce max_msgs (FIFO)
  if (config.max_msgs > 0 && state.msgs > config.max_msgs) {
    const excess = state.msgs - config.max_msgs
    await this.sql.exec(
      `DELETE FROM messages WHERE seq IN (
        SELECT seq FROM messages ORDER BY seq ASC LIMIT ?
      )`,
      excess
    )
  }

  // Enforce max_bytes
  if (config.max_bytes > 0 && state.bytes > config.max_bytes) {
    // Delete oldest messages until under limit
    while (state.bytes > config.max_bytes) {
      const oldest = await this.sql.exec(
        `SELECT seq, length(data) as size FROM messages ORDER BY seq ASC LIMIT 1`
      ).one()
      if (!oldest) break
      await this.sql.exec(`DELETE FROM messages WHERE seq = ?`, oldest.seq)
      state.bytes -= oldest.size
      state.msgs--
    }
  }

  // Update first_seq after deletion
  const first = await this.sql.exec(
    `SELECT MIN(seq) as seq, MIN(timestamp) as ts FROM messages`
  ).one()
  if (first?.seq) {
    state.first_seq = first.seq
    state.first_ts = first.ts
  }

  await this.updateState(state)
}

// Schedule periodic trimming via alarm
async alarm(): Promise<void> {
  await this.enforceRetention()
  await this.redeliverPendingAcks()
  await this.cleanupDedupWindow()

  // Reschedule
  const nextAlarm = Date.now() + 60_000 // 1 minute
  await this.ctx.storage.setAlarm(nextAlarm)
}
```

### Consumer Pull Implementation

```typescript
// In StreamDO

async fetchMessages(
  consumerName: string,
  opts: FetchOptions
): Promise<JsMsg[]> {
  const consumer = await this.getConsumer(consumerName)
  if (!consumer) throw new Error(`consumer not found: ${consumerName}`)

  const config = consumer.config as ConsumerConfig
  const batch = Math.min(opts.batch || 1, opts.max_messages || 100)
  const expires = opts.expires || 30_000_000_000 // 30s default

  // Build query based on deliver policy and current state
  let startSeq = consumer.deliver_seq + 1

  // Apply filter subjects
  let subjectFilter = ''
  if (config.filter_subject) {
    subjectFilter = `AND subject = ?`
  } else if (config.filter_subjects?.length) {
    subjectFilter = `AND subject IN (${config.filter_subjects.map(() => '?').join(',')})`
  }

  const messages = await this.sql.exec(`
    SELECT seq, subject, data, headers, timestamp
    FROM messages
    WHERE seq >= ? ${subjectFilter}
    ORDER BY seq ASC
    LIMIT ?
  `, startSeq, ...(config.filter_subjects || [config.filter_subject].filter(Boolean)), batch).toArray()

  if (messages.length === 0) {
    // No messages available
    if (opts.no_wait) return []
    // Would need WebSocket for long-poll behavior
    return []
  }

  // Track pending acks
  const ackDeadline = Date.now() + (config.ack_wait || 30_000_000_000) / 1_000_000

  for (const msg of messages) {
    if (config.ack_policy !== 'none') {
      await this.sql.exec(`
        INSERT OR REPLACE INTO pending_acks
        (consumer_name, seq, deliver_count, deliver_time, ack_wait_deadline)
        VALUES (?, ?, COALESCE((SELECT deliver_count FROM pending_acks WHERE consumer_name = ? AND seq = ?), 0) + 1, ?, ?)
      `, consumerName, msg.seq, consumerName, msg.seq, Date.now(), ackDeadline)
    }
  }

  // Update consumer state
  const lastDelivered = messages[messages.length - 1]
  await this.sql.exec(`
    UPDATE consumer_state
    SET deliver_seq = ?, num_pending = num_pending + ?, last_active_at = ?
    WHERE name = ?
  `, lastDelivered.seq, messages.length, Date.now(), consumerName)

  return messages.map(m => this.toJsMsg(m, consumer))
}

async ack(consumerName: string, seq: number): Promise<void> {
  await this.sql.exec(`
    DELETE FROM pending_acks WHERE consumer_name = ? AND seq = ?
  `, consumerName, seq)

  await this.sql.exec(`
    UPDATE consumer_state
    SET num_ack_pending = num_ack_pending - 1,
        ack_floor_seq = MAX(ack_floor_seq, ?),
        ack_floor_ts = ?
    WHERE name = ?
  `, seq, Date.now(), consumerName)
}
```

## npm Package Compatibility

The client library provides a drop-in compatible interface:

```typescript
// Usage example (compatible with nats.js)
import { connect, StringCodec } from 'natdo/client'

// Connect to NatDO worker
const nc = await connect({
  servers: 'https://natdo.example.workers.dev',
  // or for service binding:
  // binding: env.NATDO
})

const sc = StringCodec()

// Core NATS pub/sub
const sub = nc.subscribe('orders.*')
;(async () => {
  for await (const msg of sub) {
    console.log(`Received: ${sc.decode(msg.data)}`)
    msg.respond(sc.encode('ack'))
  }
})()

nc.publish('orders.new', sc.encode(JSON.stringify({ id: 123 })))

// JetStream
const js = nc.jetstream()
const jsm = nc.jetstreamManager()

// Create stream
await jsm.streams.add({
  name: 'ORDERS',
  subjects: ['orders.*'],
  retention: 'workqueue'
})

// Publish with ack
const ack = await js.publish('orders.new', sc.encode('{"id": 456}'))
console.log(`Published to ${ack.stream} at seq ${ack.seq}`)

// Create consumer
await jsm.consumers.add('ORDERS', {
  durable_name: 'order-processor',
  ack_policy: 'explicit'
})

// Consume messages
const consumer = await js.consumers.get('ORDERS', 'order-processor')
const messages = await consumer.fetch({ max_messages: 10 })

for await (const msg of messages) {
  console.log(`Processing order: ${sc.decode(msg.data)}`)
  msg.ack()
}

await nc.close()
```

## Sources

- [NATS JetStream Docs](https://docs.nats.io/nats-concepts/jetstream)
- [JetStream Streams](https://docs.nats.io/nats-concepts/jetstream/streams)
- [JetStream Consumers](https://docs.nats.io/nats-concepts/jetstream/consumers)
- [JetStream Wire API](https://docs.nats.io/reference/reference-protocols/nats_api_reference)
- [Cloudflare Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [Cap'n Web](https://github.com/cloudflare/capnweb)
- [nats.node GitHub](https://github.com/nats-io/nats.node)
- [@nats-io/jetstream npm](https://www.npmjs.com/package/@nats-io/jetstream)
