# NatDO TDD Implementation Plan

## Overview

This document outlines the Test-Driven Development (TDD) approach for implementing NatDO - NATS/JetStream on Cloudflare Durable Objects. Each module follows the RED → GREEN → REFACTOR cycle to ensure 100% test coverage.

## TDD Methodology

### RED Phase
- Write failing tests FIRST
- Tests define the expected behavior/API
- All tests should fail initially (no implementation)
- Focus on edge cases, error conditions, and happy paths

### GREEN Phase
- Write MINIMAL code to make tests pass
- No premature optimization
- Keep implementation simple and focused
- All tests must pass before moving on

### REFACTOR Phase
- Clean up code while keeping tests green
- Extract common patterns
- Improve naming and documentation
- Optimize where measurable

---

## Layer 1: Foundation (No Dependencies)

### 1.1 Core Types (`src/types/`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Type validation, defaults, serialization | ~50 tests |
| GREEN | Implement all interfaces | - |
| REFACTOR | Type guards, utility types | - |

**Files:**
- `src/types/nats.ts` - NatsConnection, Msg, Subscription, PublishOptions, etc.
- `src/types/jetstream.ts` - StreamConfig, ConsumerConfig, PubAck, JsMsg, etc.
- `src/types/rpc.ts` - RpcRequest, RpcResponse, error codes
- `src/types/env.ts` - Cloudflare Env bindings

**Key Tests:**
```typescript
// types.test.ts
describe('StreamConfig', () => {
  it('should require name field')
  it('should default retention to "limits"')
  it('should default storage to "file"')
  it('should validate max_age is non-negative')
  it('should serialize/deserialize correctly')
})

describe('ConsumerConfig', () => {
  it('should require deliver_policy')
  it('should require ack_policy')
  it('should default max_ack_pending to 1000')
  it('should validate filter_subject is valid subject')
})
```

### 1.2 Subject Matcher (`src/utils/subject-matcher.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Wildcard matching, validation | ~30 tests |
| GREEN | matchSubject, isValidSubject, isValidWildcard | - |
| REFACTOR | Performance optimization | - |

**Key Tests:**
```typescript
describe('matchSubject', () => {
  // Exact matches
  it('matches exact subjects', () => expect(matchSubject('foo.bar', 'foo.bar')).toBe(true))
  it('rejects non-matching', () => expect(matchSubject('foo.bar', 'foo.baz')).toBe(false))

  // Single-token wildcard (*)
  it('* matches one token', () => expect(matchSubject('foo.*', 'foo.bar')).toBe(true))
  it('* does not match multiple tokens', () => expect(matchSubject('foo.*', 'foo.bar.baz')).toBe(false))
  it('* in middle position', () => expect(matchSubject('foo.*.baz', 'foo.bar.baz')).toBe(true))

  // Multi-token wildcard (>)
  it('> matches one or more tokens', () => expect(matchSubject('foo.>', 'foo.bar')).toBe(true))
  it('> matches deep nesting', () => expect(matchSubject('foo.>', 'foo.bar.baz.qux')).toBe(true))
  it('> must be last token', () => expect(isValidWildcard('foo.>.bar')).toBe(false))

  // Edge cases
  it('empty subject is invalid', () => expect(isValidSubject('')).toBe(false))
  it('leading dot is invalid', () => expect(isValidSubject('.foo')).toBe(false))
  it('trailing dot is invalid', () => expect(isValidSubject('foo.')).toBe(false))
  it('double dots are invalid', () => expect(isValidSubject('foo..bar')).toBe(false))
})
```

### 1.3 NUID Generator (`src/utils/nuid.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Uniqueness, format, performance | ~15 tests |
| GREEN | NUID class implementation | - |
| REFACTOR | Optimize for high-frequency generation | - |

**Key Tests:**
```typescript
describe('NUID', () => {
  it('generates 22-character IDs')
  it('uses base36 alphabet')
  it('generates unique IDs (1000 iterations)')
  it('is monotonically increasing within same instance')
  it('generates at least 100k IDs/second')
})
```

### 1.4 Error Hierarchy (`src/utils/errors.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Error types, codes, inheritance | ~20 tests |
| GREEN | All error classes | - |
| REFACTOR | Error message formatting | - |

**Key Tests:**
```typescript
describe('NatsError', () => {
  it('extends Error')
  it('includes code property')
  it('includes name property')
})

describe('JetStreamError', () => {
  it('extends NatsError')
  it('includes stream name when relevant')
  it('includes consumer name when relevant')
})

describe('TimeoutError', () => {
  it('includes timeout duration')
})

describe('NoRespondersError', () => {
  it('includes subject')
})
```

### 1.5 SQLite Schemas (`src/durable-objects/schema.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Schema creation, constraints, indexes | ~25 tests |
| GREEN | All CREATE TABLE/INDEX statements | - |
| REFACTOR | Schema versioning, migrations | - |

**Key Tests:**
```typescript
describe('Schema', () => {
  describe('messages table', () => {
    it('has auto-increment seq primary key')
    it('has subject NOT NULL')
    it('has data NOT NULL as BLOB')
    it('has timestamp index')
    it('has msg_id unique index for dedup')
  })

  describe('consumer_state table', () => {
    it('has name primary key')
    it('tracks deliver_seq')
    it('tracks ack_floor_seq')
  })

  describe('pending_acks table', () => {
    it('has composite primary key (consumer_name, seq)')
    it('has deadline index for redelivery')
  })
})
```

---

## Layer 2: Durable Objects (Depends on Layer 1)

### 2.1 NatsCoordinator (`src/durable-objects/nats-coordinator.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Stream/consumer registry CRUD | ~40 tests |
| GREEN | Full registry implementation | - |
| REFACTOR | Caching, query optimization | - |

**Key Tests:**
```typescript
describe('NatsCoordinator', () => {
  describe('Stream Registry', () => {
    it('creates stream with config')
    it('rejects duplicate stream names')
    it('updates stream config')
    it('deletes stream and cascades to subjects')
    it('lists all streams')
    it('gets stream by name')
    it('binds subjects to stream')
    it('resolves subject to stream')
  })

  describe('Consumer Registry', () => {
    it('registers durable consumer')
    it('tracks ephemeral consumer')
    it('removes ephemeral on timeout')
    it('lists consumers for stream')
  })
})
```

### 2.2 NatsPubSub (`src/durable-objects/nats-pubsub.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Pub/sub, queue groups, req/reply, WebSocket | ~60 tests |
| GREEN | Full pub/sub implementation | - |
| REFACTOR | Message routing optimization | - |

**Key Tests:**
```typescript
describe('NatsPubSub', () => {
  describe('Subscriptions', () => {
    it('subscribes to exact subject')
    it('subscribes with wildcard *')
    it('subscribes with wildcard >')
    it('unsubscribes by sid')
    it('auto-unsubscribes after max messages')
  })

  describe('Message Delivery', () => {
    it('delivers to all matching subscriptions')
    it('filters by subject pattern')
    it('does not deliver to non-matching')
  })

  describe('Queue Groups', () => {
    it('delivers to one subscriber per group')
    it('load balances across group members')
    it('removes member on unsubscribe')
  })

  describe('Request/Reply', () => {
    it('generates unique inbox')
    it('routes reply to requester')
    it('times out if no responder')
    it('throws NoRespondersError when applicable')
  })

  describe('WebSocket Hibernation', () => {
    it('serializes subscription state')
    it('deserializes on wake')
    it('maintains subscriptions across hibernation')
  })
})
```

### 2.3 StreamDO (`src/durable-objects/stream-do.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Messages, consumers, acks, retention, dedup | ~80 tests |
| GREEN | Full JetStream stream implementation | - |
| REFACTOR | Batch operations, query optimization | - |

**Key Tests:**
```typescript
describe('StreamDO', () => {
  describe('Message Storage', () => {
    it('appends message with auto-increment seq')
    it('stores subject, data, headers, timestamp')
    it('returns PubAck with stream, seq')
    it('handles binary data correctly')
  })

  describe('Retention Policies', () => {
    describe('Limits', () => {
      it('enforces max_msgs')
      it('enforces max_bytes')
      it('enforces max_age')
      it('uses discard_old by default')
      it('rejects new messages with discard_new')
    })

    describe('WorkQueue', () => {
      it('removes message after ack')
      it('keeps message if not acked')
    })

    describe('Interest', () => {
      it('keeps message while consumers exist')
      it('removes when all consumers ack')
    })
  })

  describe('Consumer State', () => {
    it('creates consumer with config')
    it('tracks deliver_seq')
    it('tracks ack_floor_seq')
    it('applies deliver_policy on create')
  })

  describe('Pull Consumer', () => {
    it('fetches batch of messages')
    it('respects max_messages')
    it('applies filter_subject')
    it('returns empty if no messages')
    it('tracks pending acks')
  })

  describe('Acknowledgments', () => {
    it('ack() removes from pending')
    it('nak() schedules redelivery')
    it('working() extends ack deadline')
    it('term() terminates message')
    it('redelivers after ack_wait')
    it('respects max_deliver limit')
  })

  describe('Deduplication', () => {
    it('rejects duplicate msg_id within window')
    it('returns duplicate: true in PubAck')
    it('accepts msg_id after window expires')
    it('cleans up expired dedup entries')
  })
})
```

---

## Layer 3: RPC Layer (Depends on Layer 2)

### 3.1 RPC Targets (`src/rpc/`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Interface methods, parameter validation | ~40 tests |
| GREEN | NatsRpcTarget, JetStreamRpcTarget, ConsumerRpcTarget | - |
| REFACTOR | Method organization, error handling | - |

### 3.2 JSON-RPC Endpoint (`src/rpc/endpoint.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Request parsing, response formatting, batching | ~30 tests |
| GREEN | Full JSON-RPC 2.0 implementation | - |
| REFACTOR | Error response consistency | - |

### 3.3 RPC Client (`src/rpc/rpc-client.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Batching, deduplication, WebSocket transport | ~35 tests |
| GREEN | Full client implementation | - |
| REFACTOR | Connection pooling, retry logic | - |

---

## Layer 4: Client Library (Depends on Layer 3)

### 4.1 NatsConnection (`src/client/nats-connection.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | connect, publish, subscribe, request, close | ~45 tests |
| GREEN | Full connection implementation | - |
| REFACTOR | Connection state management | - |

### 4.2 Subscription (`src/client/subscription.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Async iteration, unsubscribe, drain | ~25 tests |
| GREEN | Full subscription implementation | - |
| REFACTOR | Backpressure handling | - |

### 4.3 JetStream Client (`src/client/jetstream.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | js.publish, consumers, streams access | ~30 tests |
| GREEN | Full JetStream client | - |
| REFACTOR | Promise pipelining | - |

### 4.4 JetStreamManager (`src/client/jetstream-manager.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Stream/consumer CRUD operations | ~35 tests |
| GREEN | Full manager implementation | - |
| REFACTOR | Bulk operations | - |

### 4.5 Codecs (`src/client/codecs.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | StringCodec, JSONCodec encode/decode | ~15 tests |
| GREEN | Codec implementations | - |
| REFACTOR | Custom codec support | - |

---

## Layer 5: MCP Integration (Depends on Layer 4)

### 5.1 NatsAccess Adapter (`src/mcp/nats-access.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Adapter methods wrapping DO ops | ~25 tests |
| GREEN | Full adapter implementation | - |
| REFACTOR | Method consistency | - |

### 5.2 MCP Server (`src/mcp/server.ts`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | Tool registration, request handling | ~20 tests |
| GREEN | Server factory implementation | - |
| REFACTOR | Tool organization | - |

### 5.3 MCP Tools (`src/mcp/tools/`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | nats_publish, nats_stream, nats_consumer, nats_do | ~40 tests |
| GREEN | All tool implementations | - |
| REFACTOR | Input validation, error messages | - |

### 5.4 Transport (`src/mcp/transport/`)

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| RED | HTTP handler, SSE streaming | ~20 tests |
| GREEN | Transport implementations | - |
| REFACTOR | CORS, auth middleware | - |

---

## Integration Tests

| Phase | Scope | Test Count (Est.) |
|-------|-------|-------------------|
| E2E | Full pub/sub flow | ~15 tests |
| E2E | Full JetStream flow | ~20 tests |
| Compat | nats.js API compatibility | ~30 tests |

---

## Test Coverage Targets

| Layer | Unit Tests | Integration | Target Coverage |
|-------|------------|-------------|-----------------|
| Types/Utils | ~115 | - | 100% |
| Durable Objects | ~180 | 20 | 100% |
| RPC Layer | ~105 | 10 | 100% |
| Client Library | ~150 | 15 | 100% |
| MCP Integration | ~105 | 10 | 100% |
| **TOTAL** | **~655** | **~55** | **100%** |

---

## Dependency Graph

```
Layer 1 (Foundation)
├── types/nats.ts
├── types/jetstream.ts
├── types/rpc.ts
├── utils/subject-matcher.ts
├── utils/nuid.ts
├── utils/errors.ts
└── durable-objects/schema.ts

Layer 2 (Durable Objects) ← Layer 1
├── durable-objects/nats-coordinator.ts
├── durable-objects/nats-pubsub.ts
└── durable-objects/stream-do.ts

Layer 3 (RPC) ← Layer 2
├── rpc/nats-rpc-target.ts
├── rpc/jetstream-rpc-target.ts
├── rpc/endpoint.ts
└── rpc/rpc-client.ts

Layer 4 (Client) ← Layer 3
├── client/nats-connection.ts
├── client/subscription.ts
├── client/jetstream.ts
├── client/jetstream-manager.ts
└── client/codecs.ts

Layer 5 (MCP) ← Layer 4
├── mcp/nats-access.ts
├── mcp/server.ts
├── mcp/tools/*.ts
└── mcp/transport/*.ts
```

---

## Implementation Order

1. **Week 1**: Layer 1 (Foundation) - All RED then GREEN phases
2. **Week 2**: Layer 2 (Durable Objects) - All RED then GREEN phases
3. **Week 3**: Layer 3 (RPC) + Layer 4 (Client) - Parallel development
4. **Week 4**: Layer 5 (MCP) + Integration tests
5. **Week 5**: REFACTOR all layers + Documentation

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific layer
npm test -- --grep "Layer 1"

# Run in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration
```

## Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts']
  }
})
```
