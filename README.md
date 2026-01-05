# NATS.do

NATS/JetStream on Cloudflare Durable Objects

NATS.do implements [NATS](https://nats.io/) Core messaging and [JetStream](https://docs.nats.io/nats-concepts/jetstream) persistence using Cloudflare Workers and Durable Objects with SQLite storage. It provides a `nats.js`-compatible API accessible via JSON-RPC 2.0 over HTTP, WebSockets, or Cloudflare Workers Service Bindings.

## Features

- **NATS Core**: Publish/subscribe messaging with subject wildcards (`*`, `>`)
- **JetStream Streams**: Persistent message storage with configurable retention policies
- **JetStream Consumers**: Pull and push consumers with acknowledgment tracking
- **MCP Integration**: Model Context Protocol tools for AI agent access
- **Edge-Native**: Runs entirely on Cloudflare's global network

## Installation

```bash
npm install nats.do
```

## Quick Start

### Basic Pub/Sub

```typescript
import { StringCodec, JSONCodec } from 'nats.do'

const sc = StringCodec()
const jc = JSONCodec()

// Publish a message
nc.publish('orders.new', sc.encode('Hello NATS!'))

// Subscribe with wildcards
const sub = nc.subscribe('orders.*')
for await (const msg of sub) {
  console.log(`Received: ${sc.decode(msg.data)}`)
}

// Request/Reply pattern
const response = await nc.request('api.users.get', jc.encode({ id: 123 }))
console.log(jc.decode(response.data))
```

### JetStream Streams

```typescript
// Create a stream
const jsm = nc.jetstreamManager()
await jsm.streams.add({
  name: 'ORDERS',
  subjects: ['orders.*'],
  retention: 'workqueue',
  max_msgs: 10000,
  max_age: 24 * 60 * 60 * 1_000_000_000, // 24 hours in nanoseconds
})

// Publish with acknowledgment
const js = nc.jetstream()
const ack = await js.publish('orders.new', sc.encode('{"id": 456}'))
console.log(`Published to ${ack.stream} at seq ${ack.seq}`)
```

### JetStream Consumers

```typescript
// Create a durable consumer
await jsm.consumers.add('ORDERS', {
  durable_name: 'order-processor',
  ack_policy: 'explicit',
  deliver_policy: 'all',
})

// Fetch messages
const consumer = await js.consumers.get('ORDERS', 'order-processor')
const messages = await consumer.fetch({ max_messages: 10 })

for await (const msg of messages) {
  console.log(`Processing: ${sc.decode(msg.data)}`)
  msg.ack()
}
```

## API Reference

### Core Types

```typescript
// Connection options
interface ConnectionOptions {
  servers: string | string[]
  name?: string
  token?: string
  timeout?: number
}

// Message
interface Msg {
  subject: string
  data: Uint8Array
  reply?: string
  headers?: MsgHdrs
  respond(data?: Uint8Array): boolean
}

// Subscription
interface Subscription extends AsyncIterable<Msg> {
  getSubject(): string
  unsubscribe(max?: number): void
  drain(): Promise<void>
}
```

### JetStream Types

```typescript
// Stream configuration
interface StreamConfig {
  name: string
  subjects: string[]
  retention?: 'limits' | 'interest' | 'workqueue'
  storage?: 'file' | 'memory'
  max_msgs?: number
  max_bytes?: number
  max_age?: number // nanoseconds
  discard?: 'old' | 'new'
}

// Consumer configuration
interface ConsumerConfig {
  name?: string
  durable_name?: string
  ack_policy: 'none' | 'all' | 'explicit'
  deliver_policy?: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time'
  filter_subject?: string
  max_deliver?: number
  ack_wait?: number // nanoseconds
}

// Publish acknowledgment
interface PubAck {
  stream: string
  seq: number
  duplicate?: boolean
}
```

### Codecs

```typescript
import { StringCodec, JSONCodec, Empty } from 'nats.do'

const sc = StringCodec()
sc.encode('hello')  // Uint8Array
sc.decode(data)     // string

const jc = JSONCodec<MyType>()
jc.encode({ key: 'value' })  // Uint8Array
jc.decode(data)              // MyType

Empty  // Empty Uint8Array for messages without payload
```

### Subject Wildcards

NATS.do supports NATS subject wildcards for subscriptions:

- `*` matches exactly one token: `orders.*` matches `orders.new` but not `orders.us.new`
- `>` matches one or more tokens (must be last): `orders.>` matches `orders.new` and `orders.us.new`

```typescript
import { matchSubject, isValidSubject, isValidWildcard } from 'nats.do/utils'

matchSubject('orders.*', 'orders.new')     // true
matchSubject('orders.*', 'orders.us.new')  // false
matchSubject('orders.>', 'orders.us.new')  // true
```

## Architecture

NATS.do uses three Durable Object classes:

| Durable Object | Scope | Responsibility |
|---------------|-------|----------------|
| `NatsCoordinator` | Global singleton | Stream registry, consumer discovery, cluster metadata |
| `NatsPubSub` | Per region | Core NATS pub/sub, WebSocket connections, request/reply |
| `StreamDO` | Per stream | Message storage, consumer state, ack tracking, retention |

### RPC Protocol

NATS.do uses JSON-RPC 2.0 for communication:

```typescript
// Request
{
  "jsonrpc": "2.0",
  "method": "nats.publish",
  "params": { "subject": "orders.new", "data": "base64..." },
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": { "success": true },
  "id": 1
}
```

## MCP Tools

NATS.do exposes MCP (Model Context Protocol) tools for AI agent integration:

| Tool | Description |
|------|-------------|
| `nats_publish` | Publish a message to a subject |
| `nats_subscribe` | Subscribe to a subject |
| `nats_request` | Send a request and wait for response |
| `jetstream_publish` | Publish to JetStream with acknowledgment |
| `jetstream_stream_create` | Create a new stream |
| `jetstream_stream_info` | Get stream information |
| `jetstream_consumer_create` | Create a consumer |
| `jetstream_consumer_fetch` | Fetch messages from a consumer |

## Cloudflare Workers Deployment

### wrangler.jsonc

```jsonc
{
  "name": "nats.do",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
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
  ]
}
```

### Service Binding Usage

```typescript
// In another Worker
export default {
  async fetch(request: Request, env: Env) {
    const id = env.NATS_COORDINATOR.idFromName('global')
    const stub = env.NATS_COORDINATOR.get(id)

    const response = await stub.fetch(new Request('http://internal/rpc', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'consumers.list',
        params: { streamName: 'ORDERS' },
        id: 1
      })
    }))

    return response
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Local development
npm run dev
```

## License

MIT
