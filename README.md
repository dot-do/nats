# nats.do

> Pub/Sub and Streams. Edge-Native. Zero Ops. AI-First.

Synadia charges enterprise rates for NATS clustering. AWS charges egress for SQS. Kafka needs a fleet of ZooKeepers. Every messaging system assumes you want to manage infrastructure.

**nats.do** is NATS Core and JetStream on Cloudflare Durable Objects. Pub/sub in one line. Streams that speak natural language. Zero servers to manage.

## AI-Native API

```typescript
import { nats } from 'nats.do'           // Full SDK
import { nats } from 'nats.do/tiny'      // Minimal client
import { nats } from 'nats.do/stream'    // JetStream only
```

Natural language for messaging:

```typescript
import { nats } from 'nats.do'

// Talk to it like a colleague
await nats`publish order completed to orders.new`
await nats`broadcast system maintenance starting in 10 minutes`
await nats`request user profile from api.users.get with id 123`

// Subscribe with plain English
await nats`listen for orders.* messages`.each(msg =>
  console.log(msg.data)
)

// Wildcards just work
await nats`listen for events.>`.each(msg =>
  console.log(`${msg.subject}: ${msg.data}`)
)
```

## The Problem

Messaging infrastructure is surprisingly expensive and complex:

| What They Charge | The Reality |
|------------------|-------------|
| **NATS Synadia** | $1,500/month minimum for managed clusters |
| **AWS SQS/SNS** | Penny per million, but egress kills you |
| **Kafka (Confluent)** | $1/hour minimum, scales to $10k/month |
| **RabbitMQ (Cloud)** | $100/month for tiny clusters |
| **Redis Pub/Sub** | Fast but ephemeral, no persistence |

### The Ops Tax

Every messaging system requires:

- Cluster management and scaling
- Partition rebalancing
- Consumer group coordination
- Dead letter queue handling
- Monitoring and alerting
- Backup and disaster recovery

### The Codec Dance

```typescript
// This is what they make you write
import { connect, StringCodec, JSONCodec } from 'nats'
const nc = await connect({ servers: 'nats://localhost:4222' })
const sc = StringCodec()
const jc = JSONCodec()
nc.publish('orders.new', sc.encode(JSON.stringify({ id: 456 })))
```

Why are you encoding strings to bytes to send JSON?

### The Configuration Maze

```typescript
// JetStream stream creation in native NATS
await jsm.streams.add({
  name: 'ORDERS',
  subjects: ['orders.*'],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  max_msgs: 10000,
  max_bytes: 1024 * 1024 * 100,
  max_age: 24 * 60 * 60 * 1_000_000_000, // nanoseconds, seriously?
  discard: DiscardPolicy.Old,
  num_replicas: 3,
})
```

You just wanted a queue.

## The Solution

**nats.do** is messaging that speaks human:

```
Traditional NATS                    nats.do
-----------------------------------------------------------------
Install NATS server                 npm install nats.do
Configure clustering                Nothing to configure
Set up persistence                  Durable by default
Manage consumer groups              Automatic
Handle acknowledgments              Built in
Monitor partitions                  No partitions
Scale brokers                       Scales automatically
```

## One-Click Deploy

```bash
npx create-dotdo nats
```

Your own NATS cluster. Running on Cloudflare's global network. Zero infrastructure.

```typescript
import { Nats } from 'nats.do'

export default Nats({
  name: 'my-messaging',
  streams: ['ORDERS', 'EVENTS', 'LOGS'],
})
```

## Features

### Publish/Subscribe

```typescript
// Publish is one sentence
await nats`publish order created to orders.new`
await nats`broadcast hello to all services`

// Subscribe reads like English
const sub = await nats`listen for orders.*`
for await (const msg of sub) {
  console.log(`Order: ${msg.data}`)
}

// Or with inline handler
await nats`listen for orders.>`.each(msg => {
  console.log(`${msg.subject}: ${msg.data}`)
})
```

### Request/Reply

```typescript
// Request with natural syntax
const user = await nats`request user from api.users.get with id 123`

// Responders are just as simple
await nats`respond to api.users.get`.with(async (msg) => {
  const user = await db.users.find(msg.data.id)
  return user
})

// Chain requests naturally
const enriched = await nats`request user 123`
  .then(user => nats`request orders for ${user.id}`)
  .then(orders => ({ user, orders }))
```

### Subject Wildcards

```typescript
// * matches one token
await nats`listen for orders.*`           // orders.new, orders.shipped
await nats`listen for logs.*.error`       // logs.api.error, logs.web.error

// > matches everything after
await nats`listen for events.>`           // events.user.created, events.order.shipped.tracking
await nats`listen for *.>`                // everything from all services
```

### JetStream Streams

```typescript
// Create streams with plain English
await nats`create stream ORDERS for orders.* with workqueue retention`
await nats`create stream EVENTS for events.> max 100000 messages`
await nats`create stream LOGS for logs.> keep 7 days`

// Complex configs still read naturally
await nats`create stream AUDIT for audit.* max 1GB keep forever`

// Publish with acknowledgment
const ack = await nats`publish to ORDERS: order 456 created`
console.log(`Published at sequence ${ack.seq}`)
```

### JetStream Consumers

```typescript
// Create consumers naturally
await nats`consume ORDERS as order-processor from beginning`
await nats`consume ORDERS as analytics-reader from now deliver all`

// Fetch messages
const messages = await nats`fetch 10 from ORDERS order-processor`
for (const msg of messages) {
  await processOrder(msg.data)
  await msg.ack()
}

// Or stream continuously
await nats`stream from ORDERS order-processor`.each(async msg => {
  await processOrder(msg.data)
  await msg.ack()
})
```

### Message Acknowledgment

```typescript
// Explicit ack (default)
await nats`stream from ORDERS`.each(async msg => {
  try {
    await process(msg.data)
    await msg.ack()           // success
  } catch (err) {
    await msg.nak()           // retry later
  }
})

// Ack in progress for long operations
await nats`stream from ORDERS`.each(async msg => {
  await msg.working()         // reset ack timer
  await longProcess(msg.data)
  await msg.ack()
})

// Terminate (don't redeliver)
await msg.term()              // dead letter
```

### Stream Management

```typescript
// List streams
const streams = await nats`list streams`

// Get stream info
const info = await nats`info for stream ORDERS`
console.log(`${info.messages} messages, ${info.bytes} bytes`)

// Purge old messages
await nats`purge stream ORDERS older than 7 days`
await nats`purge stream LOGS keep last 1000`

// Delete stream
await nats`delete stream TEMP_LOGS`
```

### Consumer Groups

```typescript
// Multiple workers share the load
await nats`consume ORDERS as workers from beginning shared`

// Each message delivered to one worker
// Scale horizontally by adding more consumers with same name
// Automatic rebalancing when workers join/leave
```

## Promise Pipelining

Chain operations without waiting:

```typescript
// Publish to multiple subjects in parallel
await Promise.all([
  nats`publish user created to events.user.created`,
  nats`publish audit log to audit.user`,
  nats`publish notification to notify.welcome`,
])

// Or chain with map
const results = await nats`listen for orders.new`
  .take(10)
  .map(order => nats`request inventory check for ${order.data.sku}`)
  .map(inv => inv.available ? 'confirm' : 'backorder')
```

## Architecture

nats.do uses three Durable Object classes:

| Durable Object | Scope | Responsibility |
|----------------|-------|----------------|
| `NatsCoordinator` | Global singleton | Stream registry, consumer discovery, cluster metadata |
| `NatsPubSub` | Per region | Core pub/sub, WebSocket connections, request/reply |
| `StreamDO` | Per stream | Message storage, consumer state, ack tracking, retention |

### Edge-Native Design

```
Message Flow:

Publisher --> Cloudflare Edge --> NatsPubSub DO --> Subscribers (WebSocket)
                                       |
                                       v
                               StreamDO (persistent)
                                       |
                                       v
                               SQLite (storage)
```

### Storage

- **SQLite** in Durable Objects for message storage
- **Automatic compaction** based on retention policy
- **Global replication** through Cloudflare's network
- **Zero configuration** required

## vs Traditional NATS

| Feature | Traditional NATS | nats.do |
|---------|-----------------|---------|
| **Setup** | Install servers, configure cluster | `npm install nats.do` |
| **Scaling** | Manual broker management | Automatic |
| **Persistence** | JetStream requires planning | Built in |
| **Multi-region** | Complex replication | Global by default |
| **Monitoring** | Prometheus + Grafana stack | Cloudflare dashboard |
| **Cost** | Servers + ops time | Pay per request |
| **API** | Codec encoding required | Natural language |

## MCP Tools

nats.do exposes MCP tools for AI agent integration:

| Tool | Description |
|------|-------------|
| `nats_publish` | Publish a message to a subject |
| `nats_subscribe` | Subscribe to a subject pattern |
| `nats_request` | Send request and await response |
| `nats_stream_create` | Create a JetStream stream |
| `nats_stream_info` | Get stream information |
| `nats_consumer_create` | Create a stream consumer |
| `nats_consumer_fetch` | Fetch messages from consumer |

```typescript
// AI agents can use messaging naturally
await agent`publish task completed to workflow.tasks`
await agent`listen for approvals.>`.each(handleApproval)
```

## Use Cases

### Event-Driven Architecture

```typescript
// Services publish events
await nats`publish user signed up to events.user.signup`

// Other services react
await nats`listen for events.user.*`.each(async event => {
  if (event.subject === 'events.user.signup') {
    await sendWelcomeEmail(event.data)
  }
})
```

### Work Queues

```typescript
// Create a work queue stream
await nats`create stream JOBS for jobs.* workqueue`

// Workers pull jobs
await nats`stream from JOBS worker`.each(async job => {
  await processJob(job.data)
  await job.ack()
})

// Scale workers horizontally
// Each job delivered to exactly one worker
```

### Fan-Out Notifications

```typescript
// Publish once
await nats`broadcast server maintenance in 5 minutes to alerts.system`

// All subscribers receive
await nats`listen for alerts.>`  // monitoring service
await nats`listen for alerts.>`  // slack notifier
await nats`listen for alerts.>`  // pagerduty integration
```

### Request/Reply Services

```typescript
// API service
await nats`respond to api.users.get`.with(async req => {
  return await db.users.find(req.id)
})

// Clients request
const user = await nats`request from api.users.get with id 123`
```

## Deployment

### Cloudflare Workers

```bash
npx create-dotdo nats
```

### Service Binding

```typescript
// In another Worker
export default {
  async fetch(request: Request, env: Env) {
    const nats = NatsClient(env.NATS)
    await nats`publish request received to logs.requests`
    return new Response('OK')
  }
}
```

### wrangler.jsonc

```jsonc
{
  "name": "my-app",
  "main": "src/index.ts",
  "services": [
    { "binding": "NATS", "service": "nats-do" }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Local development
npm run dev

# Type checking
npm run typecheck
```

## Roadmap

### Core Messaging
- [x] Pub/Sub with wildcards
- [x] Request/Reply pattern
- [x] Subject-based routing
- [x] WebSocket connections
- [ ] Queue groups
- [ ] Headers support

### JetStream
- [x] Stream creation and management
- [x] Pull consumers
- [x] Push consumers
- [x] Acknowledgment tracking
- [x] Retention policies
- [ ] Key-Value store
- [ ] Object store
- [ ] Mirror and source streams

### Operations
- [x] Natural language API
- [x] MCP tool integration
- [ ] Stream import/export
- [ ] Consumer replay
- [ ] Dead letter queues
- [ ] Metrics and monitoring

## License

MIT License

---

<p align="center">
  <strong>Messaging without the infrastructure.</strong>
  <br />
  Pub/sub in one line. Streams that scale.
  <br /><br />
  <a href="https://nats.do">Website</a> |
  <a href="https://docs.nats.do">Docs</a> |
  <a href="https://discord.gg/dotdo">Discord</a> |
  <a href="https://github.com/dotdo/nats.do">GitHub</a>
</p>
