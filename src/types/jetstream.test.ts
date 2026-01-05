/**
 * RED Phase Tests: JetStream Types
 *
 * These tests define the expected interface for JetStream types.
 * All tests should FAIL initially (no implementation exists).
 */

import { describe, it, expect } from 'vitest'
import {
  type StreamConfig,
  type StreamInfo,
  type StreamState,
  type ConsumerConfig,
  type ConsumerInfo,
  type PubAck,
  type JsMsg,
  type DeliverPolicy,
  type AckPolicy,
  type ReplayPolicy,
  type RetentionPolicy,
  type StorageType,
  type DiscardPolicy,
  type PullOptions,
  type ConsumeOptions,
  type JetStreamClient,
  type JetStreamManager,
  type Stream,
  type Consumer,
  type ConsumerMessages,
  defaultStreamConfig,
  defaultConsumerConfig,
} from './jetstream'

describe('JetStream Types', () => {
  describe('StreamConfig', () => {
    it('should require name field', () => {
      const config: StreamConfig = {
        name: 'ORDERS',
        subjects: ['orders.>'],
      }
      expect(config.name).toBe('ORDERS')
    })

    it('should require subjects array', () => {
      const config: StreamConfig = {
        name: 'EVENTS',
        subjects: ['events.created', 'events.updated', 'events.deleted'],
      }
      expect(config.subjects).toHaveLength(3)
    })

    it('should default retention to limits', () => {
      const config = defaultStreamConfig('TEST')
      expect(config.retention).toBe('limits')
    })

    it('should default storage to file', () => {
      const config = defaultStreamConfig('TEST')
      expect(config.storage).toBe('file')
    })

    it('should accept max_msgs limit', () => {
      const config: StreamConfig = {
        name: 'LIMITED',
        subjects: ['limited.>'],
        max_msgs: 10000,
      }
      expect(config.max_msgs).toBe(10000)
    })

    it('should accept max_bytes limit', () => {
      const config: StreamConfig = {
        name: 'SIZED',
        subjects: ['sized.>'],
        max_bytes: 1024 * 1024 * 100, // 100MB
      }
      expect(config.max_bytes).toBe(104857600)
    })

    it('should accept max_age in nanoseconds', () => {
      const oneDay = 24 * 60 * 60 * 1_000_000_000
      const config: StreamConfig = {
        name: 'AGED',
        subjects: ['aged.>'],
        max_age: oneDay,
      }
      expect(config.max_age).toBe(oneDay)
    })

    it('should accept max_msg_size', () => {
      const config: StreamConfig = {
        name: 'SMALL',
        subjects: ['small.>'],
        max_msg_size: 1024,
      }
      expect(config.max_msg_size).toBe(1024)
    })

    it('should accept discard policy', () => {
      const config: StreamConfig = {
        name: 'DISCARD',
        subjects: ['discard.>'],
        discard: 'new',
      }
      expect(config.discard).toBe('new')
    })

    it('should accept num_replicas', () => {
      const config: StreamConfig = {
        name: 'REPLICATED',
        subjects: ['rep.>'],
        num_replicas: 3,
      }
      expect(config.num_replicas).toBe(3)
    })

    it('should accept duplicate_window in nanoseconds', () => {
      const twoMinutes = 2 * 60 * 1_000_000_000
      const config: StreamConfig = {
        name: 'DEDUP',
        subjects: ['dedup.>'],
        duplicate_window: twoMinutes,
      }
      expect(config.duplicate_window).toBe(twoMinutes)
    })

    it('should accept deny_delete flag', () => {
      const config: StreamConfig = {
        name: 'IMMUTABLE',
        subjects: ['immutable.>'],
        deny_delete: true,
      }
      expect(config.deny_delete).toBe(true)
    })

    it('should accept deny_purge flag', () => {
      const config: StreamConfig = {
        name: 'NOPURGE',
        subjects: ['nopurge.>'],
        deny_purge: true,
      }
      expect(config.deny_purge).toBe(true)
    })

    it('should accept description', () => {
      const config: StreamConfig = {
        name: 'DOCS',
        subjects: ['docs.>'],
        description: 'Stream for documentation events',
      }
      expect(config.description).toBe('Stream for documentation events')
    })
  })

  describe('StreamInfo', () => {
    it('should have config', () => {
      const info: StreamInfo = {
        config: { name: 'TEST', subjects: ['test.>'] },
        state: {
          messages: 0,
          bytes: 0,
          first_seq: 1,
          last_seq: 0,
          consumer_count: 0,
        },
        created: '2024-01-01T00:00:00.000Z',
      }
      expect(info.config.name).toBe('TEST')
    })

    it('should have state', () => {
      const info: StreamInfo = {
        config: { name: 'TEST', subjects: ['test.>'] },
        state: {
          messages: 100,
          bytes: 5000,
          first_seq: 1,
          last_seq: 100,
          consumer_count: 2,
        },
        created: '2024-01-01T00:00:00.000Z',
      }
      expect(info.state.messages).toBe(100)
      expect(info.state.last_seq).toBe(100)
    })

    it('should have created timestamp', () => {
      const info: StreamInfo = {
        config: { name: 'TEST', subjects: ['test.>'] },
        state: {
          messages: 0,
          bytes: 0,
          first_seq: 1,
          last_seq: 0,
          consumer_count: 0,
        },
        created: '2024-01-01T12:00:00.000Z',
      }
      expect(info.created).toBe('2024-01-01T12:00:00.000Z')
    })

    it('should have optional cluster info', () => {
      const info: StreamInfo = {
        config: { name: 'TEST', subjects: ['test.>'] },
        state: {
          messages: 0,
          bytes: 0,
          first_seq: 1,
          last_seq: 0,
          consumer_count: 0,
        },
        created: '2024-01-01T00:00:00.000Z',
        cluster: {
          leader: 'node1',
        },
      }
      expect(info.cluster?.leader).toBe('node1')
    })
  })

  describe('StreamState', () => {
    it('should have message count', () => {
      const state: StreamState = {
        messages: 1000,
        bytes: 50000,
        first_seq: 1,
        last_seq: 1000,
        consumer_count: 5,
      }
      expect(state.messages).toBe(1000)
    })

    it('should have byte count', () => {
      const state: StreamState = {
        messages: 100,
        bytes: 1024000,
        first_seq: 1,
        last_seq: 100,
        consumer_count: 0,
      }
      expect(state.bytes).toBe(1024000)
    })

    it('should have sequence numbers', () => {
      const state: StreamState = {
        messages: 50,
        bytes: 5000,
        first_seq: 51,
        last_seq: 100,
        consumer_count: 1,
      }
      expect(state.first_seq).toBe(51)
      expect(state.last_seq).toBe(100)
    })

    it('should have optional first/last timestamps', () => {
      const state: StreamState = {
        messages: 100,
        bytes: 10000,
        first_seq: 1,
        first_ts: '2024-01-01T00:00:00.000Z',
        last_seq: 100,
        last_ts: '2024-01-02T00:00:00.000Z',
        consumer_count: 0,
      }
      expect(state.first_ts).toBe('2024-01-01T00:00:00.000Z')
      expect(state.last_ts).toBe('2024-01-02T00:00:00.000Z')
    })

    it('should have optional deleted count', () => {
      const state: StreamState = {
        messages: 90,
        bytes: 9000,
        first_seq: 1,
        last_seq: 100,
        consumer_count: 0,
        num_deleted: 10,
      }
      expect(state.num_deleted).toBe(10)
    })
  })

  describe('ConsumerConfig', () => {
    it('should accept durable_name for durable consumers', () => {
      const config: ConsumerConfig = {
        durable_name: 'my-durable',
        ack_policy: 'explicit',
      }
      expect(config.durable_name).toBe('my-durable')
    })

    it('should require ack_policy', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
      }
      expect(config.ack_policy).toBe('explicit')
    })

    it('should default deliver_policy to all', () => {
      const config = defaultConsumerConfig()
      expect(config.deliver_policy).toBe('all')
    })

    it('should accept filter_subject', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        filter_subject: 'orders.created',
      }
      expect(config.filter_subject).toBe('orders.created')
    })

    it('should accept filter_subjects array', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        filter_subjects: ['orders.created', 'orders.updated'],
      }
      expect(config.filter_subjects).toHaveLength(2)
    })

    it('should accept deliver_policy variants', () => {
      const policies: DeliverPolicy[] = ['all', 'last', 'new', 'by_start_sequence', 'by_start_time', 'last_per_subject']
      policies.forEach(policy => {
        const config: ConsumerConfig = {
          ack_policy: 'explicit',
          deliver_policy: policy,
        }
        expect(config.deliver_policy).toBe(policy)
      })
    })

    it('should accept opt_start_seq for by_start_sequence', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        deliver_policy: 'by_start_sequence',
        opt_start_seq: 100,
      }
      expect(config.opt_start_seq).toBe(100)
    })

    it('should accept opt_start_time for by_start_time', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        deliver_policy: 'by_start_time',
        opt_start_time: '2024-01-01T00:00:00.000Z',
      }
      expect(config.opt_start_time).toBe('2024-01-01T00:00:00.000Z')
    })

    it('should accept ack_wait in nanoseconds', () => {
      const thirtySeconds = 30 * 1_000_000_000
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        ack_wait: thirtySeconds,
      }
      expect(config.ack_wait).toBe(thirtySeconds)
    })

    it('should accept max_deliver', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        max_deliver: 5,
      }
      expect(config.max_deliver).toBe(5)
    })

    it('should accept max_ack_pending', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        max_ack_pending: 1000,
      }
      expect(config.max_ack_pending).toBe(1000)
    })

    it('should accept replay_policy', () => {
      const policies: ReplayPolicy[] = ['instant', 'original']
      policies.forEach(policy => {
        const config: ConsumerConfig = {
          ack_policy: 'explicit',
          replay_policy: policy,
        }
        expect(config.replay_policy).toBe(policy)
      })
    })

    it('should accept max_waiting for pull consumers', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        max_waiting: 512,
      }
      expect(config.max_waiting).toBe(512)
    })

    it('should accept headers_only', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        headers_only: true,
      }
      expect(config.headers_only).toBe(true)
    })

    it('should accept description', () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        description: 'Processes order events',
      }
      expect(config.description).toBe('Processes order events')
    })

    it('should accept inactive_threshold in nanoseconds', () => {
      const fiveMinutes = 5 * 60 * 1_000_000_000
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
        inactive_threshold: fiveMinutes,
      }
      expect(config.inactive_threshold).toBe(fiveMinutes)
    })
  })

  describe('ConsumerInfo', () => {
    it('should have stream_name', () => {
      const info: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'order-processor',
        config: { ack_policy: 'explicit' },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 0, stream_seq: 0 },
        ack_floor: { consumer_seq: 0, stream_seq: 0 },
        num_ack_pending: 0,
        num_redelivered: 0,
        num_waiting: 0,
        num_pending: 0,
      }
      expect(info.stream_name).toBe('ORDERS')
    })

    it('should have consumer name', () => {
      const info: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'my-consumer',
        config: { ack_policy: 'explicit' },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 0, stream_seq: 0 },
        ack_floor: { consumer_seq: 0, stream_seq: 0 },
        num_ack_pending: 0,
        num_redelivered: 0,
        num_waiting: 0,
        num_pending: 0,
      }
      expect(info.name).toBe('my-consumer')
    })

    it('should have delivered sequence tracking', () => {
      const info: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'consumer',
        config: { ack_policy: 'explicit' },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 100, stream_seq: 500 },
        ack_floor: { consumer_seq: 95, stream_seq: 495 },
        num_ack_pending: 5,
        num_redelivered: 2,
        num_waiting: 0,
        num_pending: 100,
      }
      expect(info.delivered.consumer_seq).toBe(100)
      expect(info.delivered.stream_seq).toBe(500)
    })

    it('should have ack_floor tracking', () => {
      const info: ConsumerInfo = {
        stream_name: 'TEST',
        name: 'consumer',
        config: { ack_policy: 'explicit' },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 100, stream_seq: 100 },
        ack_floor: { consumer_seq: 90, stream_seq: 90 },
        num_ack_pending: 10,
        num_redelivered: 0,
        num_waiting: 0,
        num_pending: 50,
      }
      expect(info.ack_floor.consumer_seq).toBe(90)
    })

    it('should have pending counts', () => {
      const info: ConsumerInfo = {
        stream_name: 'TEST',
        name: 'consumer',
        config: { ack_policy: 'explicit' },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 100, stream_seq: 100 },
        ack_floor: { consumer_seq: 90, stream_seq: 90 },
        num_ack_pending: 10,
        num_redelivered: 3,
        num_waiting: 5,
        num_pending: 50,
      }
      expect(info.num_ack_pending).toBe(10)
      expect(info.num_pending).toBe(50)
    })
  })

  describe('PubAck', () => {
    it('should have stream name', () => {
      const ack: PubAck = {
        stream: 'ORDERS',
        seq: 1,
      }
      expect(ack.stream).toBe('ORDERS')
    })

    it('should have sequence number', () => {
      const ack: PubAck = {
        stream: 'ORDERS',
        seq: 12345,
      }
      expect(ack.seq).toBe(12345)
    })

    it('should have optional duplicate flag', () => {
      const ack: PubAck = {
        stream: 'ORDERS',
        seq: 100,
        duplicate: true,
      }
      expect(ack.duplicate).toBe(true)
    })

    it('should have optional domain', () => {
      const ack: PubAck = {
        stream: 'ORDERS',
        seq: 1,
        domain: 'hub',
      }
      expect(ack.domain).toBe('hub')
    })
  })

  describe('JsMsg', () => {
    it('should have base Msg properties', () => {
      const msg: JsMsg = {
        subject: 'orders.created',
        data: new Uint8Array([1, 2, 3]),
        seq: 100,
        info: {
          stream: 'ORDERS',
          consumer: 'processor',
          delivered: 1,
          streamSequence: 100,
          consumerSequence: 50,
          timestampNanos: BigInt(Date.now() * 1_000_000),
          pending: 10,
          redelivered: false,
        },
        ack: () => {},
        nak: () => {},
        working: () => {},
        term: () => {},
        ackAck: async () => true,
      }
      expect(msg.subject).toBe('orders.created')
    })

    it('should have sequence number', () => {
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 42,
        info: {
          stream: 'TEST',
          consumer: 'c',
          delivered: 1,
          streamSequence: 42,
          consumerSequence: 1,
          timestampNanos: BigInt(0),
          pending: 0,
          redelivered: false,
        },
        ack: () => {},
        nak: () => {},
        working: () => {},
        term: () => {},
        ackAck: async () => true,
      }
      expect(msg.seq).toBe(42)
    })

    it('should have ack method', () => {
      let acked = false
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 1,
        info: {
          stream: 'TEST',
          consumer: 'c',
          delivered: 1,
          streamSequence: 1,
          consumerSequence: 1,
          timestampNanos: BigInt(0),
          pending: 0,
          redelivered: false,
        },
        ack: () => { acked = true },
        nak: () => {},
        working: () => {},
        term: () => {},
        ackAck: async () => true,
      }
      msg.ack()
      expect(acked).toBe(true)
    })

    it('should have nak method for negative ack', () => {
      let nakCalled = false
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 1,
        info: {
          stream: 'TEST',
          consumer: 'c',
          delivered: 1,
          streamSequence: 1,
          consumerSequence: 1,
          timestampNanos: BigInt(0),
          pending: 0,
          redelivered: false,
        },
        ack: () => {},
        nak: () => { nakCalled = true },
        working: () => {},
        term: () => {},
        ackAck: async () => true,
      }
      msg.nak()
      expect(nakCalled).toBe(true)
    })

    it('should have working method to extend deadline', () => {
      let workingCalled = false
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 1,
        info: {
          stream: 'TEST',
          consumer: 'c',
          delivered: 1,
          streamSequence: 1,
          consumerSequence: 1,
          timestampNanos: BigInt(0),
          pending: 0,
          redelivered: false,
        },
        ack: () => {},
        nak: () => {},
        working: () => { workingCalled = true },
        term: () => {},
        ackAck: async () => true,
      }
      msg.working()
      expect(workingCalled).toBe(true)
    })

    it('should have term method to terminate redelivery', () => {
      let termCalled = false
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 1,
        info: {
          stream: 'TEST',
          consumer: 'c',
          delivered: 1,
          streamSequence: 1,
          consumerSequence: 1,
          timestampNanos: BigInt(0),
          pending: 0,
          redelivered: false,
        },
        ack: () => {},
        nak: () => {},
        working: () => {},
        term: () => { termCalled = true },
        ackAck: async () => true,
      }
      msg.term()
      expect(termCalled).toBe(true)
    })

    it('should have info with delivery metadata', () => {
      const msg: JsMsg = {
        subject: 'test',
        data: new Uint8Array(),
        seq: 1,
        info: {
          stream: 'ORDERS',
          consumer: 'processor',
          delivered: 3,
          streamSequence: 500,
          consumerSequence: 250,
          timestampNanos: BigInt(1704067200000000000),
          pending: 50,
          redelivered: true,
        },
        ack: () => {},
        nak: () => {},
        working: () => {},
        term: () => {},
        ackAck: async () => true,
      }
      expect(msg.info.stream).toBe('ORDERS')
      expect(msg.info.delivered).toBe(3)
      expect(msg.info.redelivered).toBe(true)
    })
  })

  describe('PullOptions', () => {
    it('should accept max_messages', () => {
      const opts: PullOptions = {
        max_messages: 100,
      }
      expect(opts.max_messages).toBe(100)
    })

    it('should accept max_bytes', () => {
      const opts: PullOptions = {
        max_bytes: 1024 * 1024,
      }
      expect(opts.max_bytes).toBe(1048576)
    })

    it('should accept expires in milliseconds', () => {
      const opts: PullOptions = {
        expires: 30000,
      }
      expect(opts.expires).toBe(30000)
    })

    it('should accept idle_heartbeat', () => {
      const opts: PullOptions = {
        idle_heartbeat: 5000,
      }
      expect(opts.idle_heartbeat).toBe(5000)
    })

    it('should accept batch size', () => {
      const opts: PullOptions = {
        batch: 10,
      }
      expect(opts.batch).toBe(10)
    })
  })

  describe('ConsumeOptions', () => {
    it('should accept max_messages', () => {
      const opts: ConsumeOptions = {
        max_messages: 500,
      }
      expect(opts.max_messages).toBe(500)
    })

    it('should accept callback', () => {
      const callback = (_msg: JsMsg) => {}
      const opts: ConsumeOptions = {
        callback,
      }
      expect(opts.callback).toBe(callback)
    })
  })

  describe('Policy Enums', () => {
    it('should support retention policies', () => {
      const policies: RetentionPolicy[] = ['limits', 'interest', 'workqueue']
      expect(policies).toHaveLength(3)
    })

    it('should support storage types', () => {
      const types: StorageType[] = ['file', 'memory']
      expect(types).toHaveLength(2)
    })

    it('should support discard policies', () => {
      const policies: DiscardPolicy[] = ['old', 'new']
      expect(policies).toHaveLength(2)
    })

    it('should support ack policies', () => {
      const policies: AckPolicy[] = ['none', 'all', 'explicit']
      expect(policies).toHaveLength(3)
    })

    it('should support deliver policies', () => {
      const policies: DeliverPolicy[] = ['all', 'last', 'new', 'by_start_sequence', 'by_start_time', 'last_per_subject']
      expect(policies).toHaveLength(6)
    })

    it('should support replay policies', () => {
      const policies: ReplayPolicy[] = ['instant', 'original']
      expect(policies).toHaveLength(2)
    })
  })

  describe('JetStreamClient', () => {
    it('should have publish method', async () => {
      const js: JetStreamClient = {
        publish: async () => ({ stream: 'TEST', seq: 1 }),
        consumers: {
          get: async () => ({} as Consumer),
        },
        streams: {
          get: async () => ({} as Stream),
        },
      }
      const ack = await js.publish('test', new Uint8Array())
      expect(ack.stream).toBe('TEST')
    })

    it('should have consumers accessor', async () => {
      const js: JetStreamClient = {
        publish: async () => ({ stream: 'TEST', seq: 1 }),
        consumers: {
          get: async () => ({
            consume: async () => ({} as ConsumerMessages),
            fetch: async () => ({} as ConsumerMessages),
            info: async () => ({} as ConsumerInfo),
          } as Consumer),
        },
        streams: {
          get: async () => ({} as Stream),
        },
      }
      expect(js.consumers).toBeDefined()
    })

    it('should have streams accessor', async () => {
      const js: JetStreamClient = {
        publish: async () => ({ stream: 'TEST', seq: 1 }),
        consumers: {
          get: async () => ({} as Consumer),
        },
        streams: {
          get: async () => ({
            info: async () => ({} as StreamInfo),
          } as Stream),
        },
      }
      expect(js.streams).toBeDefined()
    })
  })

  describe('JetStreamManager', () => {
    it('should have streams CRUD', async () => {
      const jsm: JetStreamManager = {
        streams: {
          add: async () => ({} as StreamInfo),
          update: async () => ({} as StreamInfo),
          delete: async () => true,
          get: async () => ({} as Stream),
          list: async function* () {},
          info: async () => ({} as StreamInfo),
          names: async function* () {},
          purge: async () => ({ success: true, purged: 0 }),
        },
        consumers: {
          add: async () => ({} as ConsumerInfo),
          update: async () => ({} as ConsumerInfo),
          delete: async () => true,
          list: async function* () {},
          info: async () => ({} as ConsumerInfo),
        },
      }
      expect(jsm.streams).toBeDefined()
    })

    it('should have consumers CRUD', async () => {
      const jsm: JetStreamManager = {
        streams: {
          add: async () => ({} as StreamInfo),
          update: async () => ({} as StreamInfo),
          delete: async () => true,
          get: async () => ({} as Stream),
          list: async function* () {},
          info: async () => ({} as StreamInfo),
          names: async function* () {},
          purge: async () => ({ success: true, purged: 0 }),
        },
        consumers: {
          add: async () => ({} as ConsumerInfo),
          update: async () => ({} as ConsumerInfo),
          delete: async () => true,
          list: async function* () {},
          info: async () => ({} as ConsumerInfo),
        },
      }
      expect(jsm.consumers).toBeDefined()
    })
  })

  describe('Stream', () => {
    it('should have info method', async () => {
      const stream: Stream = {
        info: async () => ({
          config: { name: 'TEST', subjects: ['test.>'] },
          state: {
            messages: 100,
            bytes: 5000,
            first_seq: 1,
            last_seq: 100,
            consumer_count: 2,
          },
          created: '2024-01-01T00:00:00.000Z',
        }),
        getMessage: async () => null,
        deleteMessage: async () => true,
      }
      const info = await stream.info()
      expect(info.config.name).toBe('TEST')
    })

    it('should have getMessage method', async () => {
      const stream: Stream = {
        info: async () => ({} as StreamInfo),
        getMessage: async () => ({
          subject: 'test',
          data: new Uint8Array(),
          seq: 1,
          time: '2024-01-01T00:00:00.000Z',
        }),
        deleteMessage: async () => true,
      }
      const msg = await stream.getMessage({ seq: 1 })
      expect(msg?.seq).toBe(1)
    })

    it('should have deleteMessage method', async () => {
      const stream: Stream = {
        info: async () => ({} as StreamInfo),
        getMessage: async () => null,
        deleteMessage: async () => true,
      }
      const result = await stream.deleteMessage(1)
      expect(result).toBe(true)
    })
  })

  describe('Consumer', () => {
    it('should have fetch method', async () => {
      const consumer: Consumer = {
        consume: async () => ({
          [Symbol.asyncIterator]: function() { return this },
          next: async () => ({ done: true, value: undefined }),
          close: async () => {},
          stop: async () => {},
        } as ConsumerMessages),
        fetch: async () => ({
          [Symbol.asyncIterator]: function() { return this },
          next: async () => ({ done: true, value: undefined }),
          close: async () => {},
          stop: async () => {},
        } as ConsumerMessages),
        info: async () => ({} as ConsumerInfo),
        delete: async () => true,
      }
      const messages = await consumer.fetch()
      expect(messages).toBeDefined()
    })

    it('should have consume method', async () => {
      const consumer: Consumer = {
        consume: async () => ({
          [Symbol.asyncIterator]: function() { return this },
          next: async () => ({ done: true, value: undefined }),
          close: async () => {},
          stop: async () => {},
        } as ConsumerMessages),
        fetch: async () => ({} as ConsumerMessages),
        info: async () => ({} as ConsumerInfo),
        delete: async () => true,
      }
      const messages = await consumer.consume()
      expect(messages).toBeDefined()
    })

    it('should have info method', async () => {
      const consumer: Consumer = {
        consume: async () => ({} as ConsumerMessages),
        fetch: async () => ({} as ConsumerMessages),
        info: async () => ({
          stream_name: 'TEST',
          name: 'consumer',
          config: { ack_policy: 'explicit' },
          created: '2024-01-01T00:00:00.000Z',
          delivered: { consumer_seq: 0, stream_seq: 0 },
          ack_floor: { consumer_seq: 0, stream_seq: 0 },
          num_ack_pending: 0,
          num_redelivered: 0,
          num_waiting: 0,
          num_pending: 0,
        }),
        delete: async () => true,
      }
      const info = await consumer.info()
      expect(info.stream_name).toBe('TEST')
    })

    it('should have delete method', async () => {
      const consumer: Consumer = {
        consume: async () => ({} as ConsumerMessages),
        fetch: async () => ({} as ConsumerMessages),
        info: async () => ({} as ConsumerInfo),
        delete: async () => true,
      }
      const result = await consumer.delete()
      expect(result).toBe(true)
    })
  })

  describe('ConsumerMessages', () => {
    it('should be async iterable', async () => {
      const messages: ConsumerMessages = {
        [Symbol.asyncIterator]: function() { return this },
        next: async () => ({ done: true, value: undefined }),
        close: async () => {},
        stop: async () => {},
      }
      expect(typeof messages[Symbol.asyncIterator]).toBe('function')
    })

    it('should have close method', async () => {
      let closed = false
      const messages: ConsumerMessages = {
        [Symbol.asyncIterator]: function() { return this },
        next: async () => ({ done: true, value: undefined }),
        close: async () => { closed = true },
        stop: async () => {},
      }
      await messages.close()
      expect(closed).toBe(true)
    })

    it('should have stop method', async () => {
      let stopped = false
      const messages: ConsumerMessages = {
        [Symbol.asyncIterator]: function() { return this },
        next: async () => ({ done: true, value: undefined }),
        close: async () => {},
        stop: async () => { stopped = true },
      }
      await messages.stop()
      expect(stopped).toBe(true)
    })
  })
})
