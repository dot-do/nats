/**
 * RED Phase Tests: NatsAccess Adapter
 *
 * Tests for the NatsAccess adapter that bridges MCP tools to Durable Object operations.
 * This adapter routes operations to the appropriate Durable Objects:
 * - NATS_PUBSUB: for publish/subscribe operations
 * - NATS_COORDINATOR: for stream and consumer management
 * - STREAM_DO: for stream-specific operations (fetching, acking)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NatsAccess } from './nats-access'
import type { StreamConfig, StreamInfo, ConsumerConfig, ConsumerInfo, PubAck, JsMsg } from '../types/jetstream'
import type { PublishOptions } from '../types/nats'

// Mock Durable Object stub interface
interface MockDOStub {
  publish: ReturnType<typeof vi.fn>
  createStream: ReturnType<typeof vi.fn>
  deleteStream: ReturnType<typeof vi.fn>
  getStreamInfo: ReturnType<typeof vi.fn>
  createConsumer: ReturnType<typeof vi.fn>
  fetchMessages: ReturnType<typeof vi.fn>
  ackMessage: ReturnType<typeof vi.fn>
}

// Mock environment interface
interface MockEnv {
  NATS_PUBSUB: {
    idFromName: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }
  NATS_COORDINATOR: {
    idFromName: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }
  STREAM_DO: {
    idFromName: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }
}

describe('NatsAccess Adapter', () => {
  let mockEnv: MockEnv
  let mockPubSubStub: MockDOStub
  let mockCoordinatorStub: MockDOStub
  let mockStreamStub: MockDOStub
  let natsAccess: NatsAccess

  beforeEach(() => {
    // Create mock stubs for each DO type
    mockPubSubStub = {
      publish: vi.fn(),
      createStream: vi.fn(),
      deleteStream: vi.fn(),
      getStreamInfo: vi.fn(),
      createConsumer: vi.fn(),
      fetchMessages: vi.fn(),
      ackMessage: vi.fn(),
    }

    mockCoordinatorStub = {
      publish: vi.fn(),
      createStream: vi.fn(),
      deleteStream: vi.fn(),
      getStreamInfo: vi.fn(),
      createConsumer: vi.fn(),
      fetchMessages: vi.fn(),
      ackMessage: vi.fn(),
    }

    mockStreamStub = {
      publish: vi.fn(),
      createStream: vi.fn(),
      deleteStream: vi.fn(),
      getStreamInfo: vi.fn(),
      createConsumer: vi.fn(),
      fetchMessages: vi.fn(),
      ackMessage: vi.fn(),
    }

    // Create mock environment
    mockEnv = {
      NATS_PUBSUB: {
        idFromName: vi.fn().mockReturnValue('pubsub-id'),
        get: vi.fn().mockReturnValue(mockPubSubStub),
      },
      NATS_COORDINATOR: {
        idFromName: vi.fn().mockReturnValue('coordinator-id'),
        get: vi.fn().mockReturnValue(mockCoordinatorStub),
      },
      STREAM_DO: {
        idFromName: vi.fn().mockReturnValue('stream-id'),
        get: vi.fn().mockReturnValue(mockStreamStub),
      },
    }

    natsAccess = new NatsAccess(mockEnv as unknown as Env)
  })

  describe('publish()', () => {
    it('should route publish to NatsPubSub DO', async () => {
      const subject = 'orders.created'
      const data = new TextEncoder().encode('{"orderId": 123}')
      const expectedAck: PubAck = { stream: 'ORDERS', seq: 1 }

      mockPubSubStub.publish.mockResolvedValue(expectedAck)

      const result = await natsAccess.publish(subject, data)

      expect(mockEnv.NATS_PUBSUB.idFromName).toHaveBeenCalledWith('global')
      expect(mockEnv.NATS_PUBSUB.get).toHaveBeenCalledWith('pubsub-id')
      expect(mockPubSubStub.publish).toHaveBeenCalledWith(subject, data, undefined)
      expect(result).toEqual(expectedAck)
    })

    it('should pass publish options to DO', async () => {
      const subject = 'events.updated'
      const data = new TextEncoder().encode('test')
      const opts: PublishOptions = {
        reply: 'reply.subject',
      }
      const expectedAck: PubAck = { stream: 'EVENTS', seq: 42 }

      mockPubSubStub.publish.mockResolvedValue(expectedAck)

      const result = await natsAccess.publish(subject, data, opts)

      expect(mockPubSubStub.publish).toHaveBeenCalledWith(subject, data, opts)
      expect(result).toEqual(expectedAck)
    })

    it('should handle publish errors', async () => {
      const subject = 'test.subject'
      const data = new Uint8Array()

      mockPubSubStub.publish.mockRejectedValue(new Error('Publish failed'))

      await expect(natsAccess.publish(subject, data)).rejects.toThrow('Publish failed')
    })
  })

  describe('createStream()', () => {
    it('should route createStream to NatsCoordinator DO', async () => {
      const config: StreamConfig = {
        name: 'ORDERS',
        subjects: ['orders.>'],
        retention: 'limits',
        storage: 'file',
      }
      const expectedInfo: StreamInfo = {
        config,
        state: {
          messages: 0,
          bytes: 0,
          first_seq: 1,
          last_seq: 0,
          consumer_count: 0,
        },
        created: '2024-01-01T00:00:00.000Z',
      }

      mockCoordinatorStub.createStream.mockResolvedValue(expectedInfo)

      const result = await natsAccess.createStream(config)

      expect(mockEnv.NATS_COORDINATOR.idFromName).toHaveBeenCalledWith('global')
      expect(mockEnv.NATS_COORDINATOR.get).toHaveBeenCalledWith('coordinator-id')
      expect(mockCoordinatorStub.createStream).toHaveBeenCalledWith(config)
      expect(result).toEqual(expectedInfo)
    })

    it('should handle stream creation errors', async () => {
      const config: StreamConfig = {
        name: 'EXISTING',
        subjects: ['existing.>'],
      }

      mockCoordinatorStub.createStream.mockRejectedValue(new Error('Stream already exists'))

      await expect(natsAccess.createStream(config)).rejects.toThrow('Stream already exists')
    })
  })

  describe('deleteStream()', () => {
    it('should route deleteStream to NatsCoordinator DO', async () => {
      const streamName = 'ORDERS'

      mockCoordinatorStub.deleteStream.mockResolvedValue(true)

      const result = await natsAccess.deleteStream(streamName)

      expect(mockEnv.NATS_COORDINATOR.idFromName).toHaveBeenCalledWith('global')
      expect(mockEnv.NATS_COORDINATOR.get).toHaveBeenCalledWith('coordinator-id')
      expect(mockCoordinatorStub.deleteStream).toHaveBeenCalledWith(streamName)
      expect(result).toBe(true)
    })

    it('should handle stream not found error', async () => {
      mockCoordinatorStub.deleteStream.mockRejectedValue(new Error('Stream not found'))

      await expect(natsAccess.deleteStream('NONEXISTENT')).rejects.toThrow('Stream not found')
    })
  })

  describe('getStreamInfo()', () => {
    it('should route getStreamInfo to NatsCoordinator DO', async () => {
      const streamName = 'ORDERS'
      const expectedInfo: StreamInfo = {
        config: {
          name: 'ORDERS',
          subjects: ['orders.>'],
        },
        state: {
          messages: 100,
          bytes: 5000,
          first_seq: 1,
          last_seq: 100,
          consumer_count: 2,
        },
        created: '2024-01-01T00:00:00.000Z',
      }

      mockCoordinatorStub.getStreamInfo.mockResolvedValue(expectedInfo)

      const result = await natsAccess.getStreamInfo(streamName)

      expect(mockEnv.NATS_COORDINATOR.idFromName).toHaveBeenCalledWith('global')
      expect(mockEnv.NATS_COORDINATOR.get).toHaveBeenCalledWith('coordinator-id')
      expect(mockCoordinatorStub.getStreamInfo).toHaveBeenCalledWith(streamName)
      expect(result).toEqual(expectedInfo)
    })

    it('should handle stream info not found error', async () => {
      mockCoordinatorStub.getStreamInfo.mockRejectedValue(new Error('Stream not found'))

      await expect(natsAccess.getStreamInfo('NONEXISTENT')).rejects.toThrow('Stream not found')
    })
  })

  describe('createConsumer()', () => {
    it('should route createConsumer to NatsCoordinator DO', async () => {
      const streamName = 'ORDERS'
      const config: ConsumerConfig = {
        name: 'order-processor',
        ack_policy: 'explicit',
        deliver_policy: 'all',
      }
      const expectedInfo: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'order-processor',
        config,
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 0, stream_seq: 0 },
        ack_floor: { consumer_seq: 0, stream_seq: 0 },
        num_ack_pending: 0,
        num_redelivered: 0,
        num_waiting: 0,
        num_pending: 0,
      }

      mockCoordinatorStub.createConsumer.mockResolvedValue(expectedInfo)

      const result = await natsAccess.createConsumer(streamName, config)

      expect(mockEnv.NATS_COORDINATOR.idFromName).toHaveBeenCalledWith('global')
      expect(mockEnv.NATS_COORDINATOR.get).toHaveBeenCalledWith('coordinator-id')
      expect(mockCoordinatorStub.createConsumer).toHaveBeenCalledWith(streamName, config)
      expect(result).toEqual(expectedInfo)
    })

    it('should handle consumer creation on non-existent stream', async () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
      }

      mockCoordinatorStub.createConsumer.mockRejectedValue(new Error('Stream not found'))

      await expect(natsAccess.createConsumer('NONEXISTENT', config)).rejects.toThrow('Stream not found')
    })
  })

  describe('fetchMessages()', () => {
    it('should route fetchMessages to STREAM_DO for the specific stream', async () => {
      const streamName = 'ORDERS'
      const consumerName = 'order-processor'
      const opts = { max_messages: 10 }
      const expectedMessages: JsMsg[] = [
        {
          subject: 'orders.created',
          data: new TextEncoder().encode('{}'),
          seq: 1,
          info: {
            stream: 'ORDERS',
            consumer: 'order-processor',
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
          term: () => {},
          ackAck: async () => true,
        },
      ]

      mockStreamStub.fetchMessages.mockResolvedValue(expectedMessages)

      const result = await natsAccess.fetchMessages(streamName, consumerName, opts)

      expect(mockEnv.STREAM_DO.idFromName).toHaveBeenCalledWith(streamName)
      expect(mockEnv.STREAM_DO.get).toHaveBeenCalledWith('stream-id')
      expect(mockStreamStub.fetchMessages).toHaveBeenCalledWith(consumerName, opts)
      expect(result).toEqual(expectedMessages)
    })

    it('should work without options', async () => {
      mockStreamStub.fetchMessages.mockResolvedValue([])

      const result = await natsAccess.fetchMessages('ORDERS', 'consumer')

      expect(mockStreamStub.fetchMessages).toHaveBeenCalledWith('consumer', undefined)
      expect(result).toEqual([])
    })

    it('should handle fetch errors', async () => {
      mockStreamStub.fetchMessages.mockRejectedValue(new Error('Consumer not found'))

      await expect(natsAccess.fetchMessages('ORDERS', 'nonexistent')).rejects.toThrow('Consumer not found')
    })
  })

  describe('ackMessage()', () => {
    it('should route ackMessage to STREAM_DO for the specific stream', async () => {
      const streamName = 'ORDERS'
      const consumerName = 'order-processor'
      const seq = 42

      mockStreamStub.ackMessage.mockResolvedValue(true)

      const result = await natsAccess.ackMessage(streamName, consumerName, seq)

      expect(mockEnv.STREAM_DO.idFromName).toHaveBeenCalledWith(streamName)
      expect(mockEnv.STREAM_DO.get).toHaveBeenCalledWith('stream-id')
      expect(mockStreamStub.ackMessage).toHaveBeenCalledWith(consumerName, seq)
      expect(result).toBe(true)
    })

    it('should handle ack for already acked message', async () => {
      mockStreamStub.ackMessage.mockResolvedValue(false)

      const result = await natsAccess.ackMessage('ORDERS', 'consumer', 1)

      expect(result).toBe(false)
    })

    it('should handle ack errors', async () => {
      mockStreamStub.ackMessage.mockRejectedValue(new Error('Invalid sequence'))

      await expect(natsAccess.ackMessage('ORDERS', 'consumer', -1)).rejects.toThrow('Invalid sequence')
    })
  })

  describe('Routing', () => {
    it('should use global instance for NATS_PUBSUB', async () => {
      mockPubSubStub.publish.mockResolvedValue({ stream: 'TEST', seq: 1 })

      await natsAccess.publish('test', new Uint8Array())

      expect(mockEnv.NATS_PUBSUB.idFromName).toHaveBeenCalledWith('global')
    })

    it('should use global instance for NATS_COORDINATOR', async () => {
      mockCoordinatorStub.createStream.mockResolvedValue({
        config: { name: 'TEST', subjects: [] },
        state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
        created: '',
      })

      await natsAccess.createStream({ name: 'TEST', subjects: [] })

      expect(mockEnv.NATS_COORDINATOR.idFromName).toHaveBeenCalledWith('global')
    })

    it('should use stream name as instance ID for STREAM_DO', async () => {
      mockStreamStub.fetchMessages.mockResolvedValue([])

      await natsAccess.fetchMessages('MY_STREAM', 'consumer')

      expect(mockEnv.STREAM_DO.idFromName).toHaveBeenCalledWith('MY_STREAM')
    })

    it('should route different streams to different STREAM_DO instances', async () => {
      mockStreamStub.fetchMessages.mockResolvedValue([])

      await natsAccess.fetchMessages('STREAM_A', 'consumer')
      await natsAccess.fetchMessages('STREAM_B', 'consumer')

      expect(mockEnv.STREAM_DO.idFromName).toHaveBeenCalledWith('STREAM_A')
      expect(mockEnv.STREAM_DO.idFromName).toHaveBeenCalledWith('STREAM_B')
    })
  })
})
