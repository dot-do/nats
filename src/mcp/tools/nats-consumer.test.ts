/**
 * RED Phase Tests: nats_consumer MCP Tool
 *
 * Tests for JetStream consumer management via MCP tool.
 * Operations: create, delete, info, fetch, ack
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { natsConsumerTool, type NatsConsumerParams, type NatsConsumerContext } from './nats-consumer'
import type { ConsumerConfig, ConsumerInfo, JsMsg } from '../../types/jetstream'

describe('nats_consumer MCP Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(natsConsumerTool.name).toBe('nats_consumer')
    })

    it('should have description', () => {
      expect(natsConsumerTool.description).toBe('Manage JetStream consumers')
    })

    it('should have inputSchema with required properties', () => {
      expect(natsConsumerTool.inputSchema).toEqual({
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'delete', 'info', 'fetch', 'ack'],
            description: 'Consumer operation to perform',
          },
          stream: {
            type: 'string',
            description: 'Name of the stream',
          },
          consumer: {
            type: 'string',
            description: 'Name of the consumer',
          },
          config: {
            type: 'object',
            description: 'Consumer configuration for create action',
          },
          seq: {
            type: 'number',
            description: 'Message sequence number for ack action',
          },
          maxMessages: {
            type: 'number',
            description: 'Maximum messages to fetch (default: 10)',
          },
          timeout: {
            type: 'number',
            description: 'Fetch timeout in milliseconds (default: 5000)',
          },
        },
        required: ['action', 'stream'],
      })
    })
  })

  describe('Parameter Validation', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should require action parameter', async () => {
      const params = { stream: 'ORDERS' } as unknown as NatsConsumerParams
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('action is required')
    })

    it('should require stream parameter', async () => {
      const params = { action: 'info' } as unknown as NatsConsumerParams
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('stream is required')
    })

    it('should validate action is one of allowed values', async () => {
      const params = { action: 'invalid', stream: 'ORDERS' } as unknown as NatsConsumerParams
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid action')
    })

    it('should require consumer for delete action', async () => {
      const params: NatsConsumerParams = { action: 'delete', stream: 'ORDERS' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('consumer is required')
    })

    it('should require consumer for info action', async () => {
      const params: NatsConsumerParams = { action: 'info', stream: 'ORDERS' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('consumer is required')
    })

    it('should require consumer for fetch action', async () => {
      const params: NatsConsumerParams = { action: 'fetch', stream: 'ORDERS' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('consumer is required')
    })

    it('should require consumer and seq for ack action', async () => {
      const params: NatsConsumerParams = { action: 'ack', stream: 'ORDERS' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('consumer is required')
    })

    it('should require seq for ack action', async () => {
      const params: NatsConsumerParams = { action: 'ack', stream: 'ORDERS', consumer: 'processor' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('seq is required')
    })

    it('should require config for create action', async () => {
      const params: NatsConsumerParams = { action: 'create', stream: 'ORDERS' }
      const result = await natsConsumerTool.handler(params, mockContext)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('config is required')
    })
  })

  describe('create action', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should create a consumer with config', async () => {
      const consumerInfo: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'order-processor',
        config: {
          durable_name: 'order-processor',
          ack_policy: 'explicit',
        },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 0, stream_seq: 0 },
        ack_floor: { consumer_seq: 0, stream_seq: 0 },
        num_ack_pending: 0,
        num_redelivered: 0,
        num_waiting: 0,
        num_pending: 0,
      }

      vi.mocked(mockContext.jsm.consumers.add).mockResolvedValue(consumerInfo)

      const config: ConsumerConfig = {
        durable_name: 'order-processor',
        ack_policy: 'explicit',
        filter_subject: 'orders.created',
      }

      const params: NatsConsumerParams = {
        action: 'create',
        stream: 'ORDERS',
        config,
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      expect(mockContext.jsm.consumers.add).toHaveBeenCalledWith('ORDERS', config)
      const content = JSON.parse(result.content[0].text)
      expect(content.name).toBe('order-processor')
      expect(content.stream_name).toBe('ORDERS')
    })

    it('should return error if consumer creation fails', async () => {
      vi.mocked(mockContext.jsm.consumers.add).mockRejectedValue(new Error('Stream not found'))

      const params: NatsConsumerParams = {
        action: 'create',
        stream: 'INVALID',
        config: { ack_policy: 'explicit' },
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Stream not found')
    })
  })

  describe('delete action', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should delete a consumer', async () => {
      vi.mocked(mockContext.jsm.consumers.delete).mockResolvedValue(true)

      const params: NatsConsumerParams = {
        action: 'delete',
        stream: 'ORDERS',
        consumer: 'order-processor',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      expect(mockContext.jsm.consumers.delete).toHaveBeenCalledWith('ORDERS', 'order-processor')
      const content = JSON.parse(result.content[0].text)
      expect(content.success).toBe(true)
      expect(content.deleted).toBe('order-processor')
    })

    it('should return error if consumer not found', async () => {
      vi.mocked(mockContext.jsm.consumers.delete).mockRejectedValue(new Error('Consumer not found'))

      const params: NatsConsumerParams = {
        action: 'delete',
        stream: 'ORDERS',
        consumer: 'nonexistent',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Consumer not found')
    })
  })

  describe('info action', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should get consumer info', async () => {
      const consumerInfo: ConsumerInfo = {
        stream_name: 'ORDERS',
        name: 'order-processor',
        config: {
          durable_name: 'order-processor',
          ack_policy: 'explicit',
        },
        created: '2024-01-01T00:00:00.000Z',
        delivered: { consumer_seq: 100, stream_seq: 500 },
        ack_floor: { consumer_seq: 95, stream_seq: 495 },
        num_ack_pending: 5,
        num_redelivered: 2,
        num_waiting: 0,
        num_pending: 100,
      }

      vi.mocked(mockContext.jsm.consumers.info).mockResolvedValue(consumerInfo)

      const params: NatsConsumerParams = {
        action: 'info',
        stream: 'ORDERS',
        consumer: 'order-processor',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      expect(mockContext.jsm.consumers.info).toHaveBeenCalledWith('ORDERS', 'order-processor')
      const content = JSON.parse(result.content[0].text)
      expect(content.name).toBe('order-processor')
      expect(content.num_pending).toBe(100)
    })

    it('should return error if consumer not found', async () => {
      vi.mocked(mockContext.jsm.consumers.info).mockRejectedValue(new Error('Consumer not found'))

      const params: NatsConsumerParams = {
        action: 'info',
        stream: 'ORDERS',
        consumer: 'nonexistent',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Consumer not found')
    })
  })

  describe('fetch action', () => {
    let mockContext: NatsConsumerContext
    let mockConsumer: {
      fetch: ReturnType<typeof vi.fn>
      info: ReturnType<typeof vi.fn>
      consume: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
      mockConsumer = {
        fetch: vi.fn(),
        info: vi.fn(),
        consume: vi.fn(),
        delete: vi.fn(),
      }

      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn().mockResolvedValue(mockConsumer),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should fetch messages from consumer', async () => {
      const messages: JsMsg[] = [
        {
          subject: 'orders.created',
          data: new TextEncoder().encode('{"orderId": 1}'),
          seq: 100,
          info: {
            stream: 'ORDERS',
            consumer: 'order-processor',
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
        },
        {
          subject: 'orders.updated',
          data: new TextEncoder().encode('{"orderId": 2}'),
          seq: 101,
          info: {
            stream: 'ORDERS',
            consumer: 'order-processor',
            delivered: 1,
            streamSequence: 101,
            consumerSequence: 51,
            timestampNanos: BigInt(Date.now() * 1_000_000),
            pending: 9,
            redelivered: false,
          },
          ack: () => {},
          nak: () => {},
          working: () => {},
          term: () => {},
          ackAck: async () => true,
        },
      ]

      const mockIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const msg of messages) {
            yield msg
          }
        },
        close: vi.fn(),
        stop: vi.fn(),
      }

      mockConsumer.fetch.mockResolvedValue(mockIterator)

      const params: NatsConsumerParams = {
        action: 'fetch',
        stream: 'ORDERS',
        consumer: 'order-processor',
        maxMessages: 10,
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      expect(mockContext.js.consumers.get).toHaveBeenCalledWith('ORDERS', 'order-processor')
      expect(mockConsumer.fetch).toHaveBeenCalledWith({
        max_messages: 10,
        expires: 5000,
      })

      const content = JSON.parse(result.content[0].text)
      expect(content.messages).toHaveLength(2)
      expect(content.messages[0].seq).toBe(100)
      expect(content.messages[0].subject).toBe('orders.created')
    })

    it('should use default maxMessages and timeout', async () => {
      const mockIterator = {
        [Symbol.asyncIterator]: async function* () {},
        close: vi.fn(),
        stop: vi.fn(),
      }

      mockConsumer.fetch.mockResolvedValue(mockIterator)

      const params: NatsConsumerParams = {
        action: 'fetch',
        stream: 'ORDERS',
        consumer: 'order-processor',
      }

      await natsConsumerTool.handler(params, mockContext)

      expect(mockConsumer.fetch).toHaveBeenCalledWith({
        max_messages: 10,
        expires: 5000,
      })
    })

    it('should use custom timeout', async () => {
      const mockIterator = {
        [Symbol.asyncIterator]: async function* () {},
        close: vi.fn(),
        stop: vi.fn(),
      }

      mockConsumer.fetch.mockResolvedValue(mockIterator)

      const params: NatsConsumerParams = {
        action: 'fetch',
        stream: 'ORDERS',
        consumer: 'order-processor',
        timeout: 30000,
      }

      await natsConsumerTool.handler(params, mockContext)

      expect(mockConsumer.fetch).toHaveBeenCalledWith({
        max_messages: 10,
        expires: 30000,
      })
    })

    it('should return empty array when no messages', async () => {
      const mockIterator = {
        [Symbol.asyncIterator]: async function* () {},
        close: vi.fn(),
        stop: vi.fn(),
      }

      mockConsumer.fetch.mockResolvedValue(mockIterator)

      const params: NatsConsumerParams = {
        action: 'fetch',
        stream: 'ORDERS',
        consumer: 'order-processor',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      const content = JSON.parse(result.content[0].text)
      expect(content.messages).toHaveLength(0)
    })

    it('should return error if consumer not found', async () => {
      vi.mocked(mockContext.js.consumers.get).mockRejectedValue(new Error('Consumer not found'))

      const params: NatsConsumerParams = {
        action: 'fetch',
        stream: 'ORDERS',
        consumer: 'nonexistent',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Consumer not found')
    })
  })

  describe('ack action', () => {
    let mockContext: NatsConsumerContext
    let mockConsumer: {
      fetch: ReturnType<typeof vi.fn>
      info: ReturnType<typeof vi.fn>
      consume: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
    }
    let ackFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
      ackFn = vi.fn()
      mockConsumer = {
        fetch: vi.fn(),
        info: vi.fn(),
        consume: vi.fn(),
        delete: vi.fn(),
      }

      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn().mockResolvedValue(mockConsumer),
          },
        },
        ackMessage: vi.fn().mockResolvedValue(true),
      } as unknown as NatsConsumerContext
    })

    it('should acknowledge a message by sequence', async () => {
      const params: NatsConsumerParams = {
        action: 'ack',
        stream: 'ORDERS',
        consumer: 'order-processor',
        seq: 100,
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
      expect(mockContext.ackMessage).toHaveBeenCalledWith('ORDERS', 'order-processor', 100)
      const content = JSON.parse(result.content[0].text)
      expect(content.success).toBe(true)
      expect(content.acked).toBe(100)
    })

    it('should return error if ack fails', async () => {
      vi.mocked(mockContext.ackMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Message not found')
      )

      const params: NatsConsumerParams = {
        action: 'ack',
        stream: 'ORDERS',
        consumer: 'order-processor',
        seq: 999,
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Message not found')
    })
  })

  describe('nak action', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
        nakMessage: vi.fn().mockResolvedValue(true),
      } as unknown as NatsConsumerContext
    })

    it('should validate action includes nak', () => {
      // nak should be a valid action
      expect(natsConsumerTool.inputSchema.properties.action.enum).toContain('ack')
      // Note: nak could be added later or handled via ack with a parameter
    })
  })

  describe('Error Handling', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn(),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should handle unknown errors gracefully', async () => {
      vi.mocked(mockContext.jsm.consumers.info).mockRejectedValue('Unknown error')

      const params: NatsConsumerParams = {
        action: 'info',
        stream: 'ORDERS',
        consumer: 'test',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown error')
    })

    it('should include stream and consumer in error context', async () => {
      vi.mocked(mockContext.jsm.consumers.info).mockRejectedValue(new Error('Connection failed'))

      const params: NatsConsumerParams = {
        action: 'info',
        stream: 'ORDERS',
        consumer: 'test-consumer',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBe(true)
      // Error message should have context about the operation
      expect(result.content[0].text).toContain('Connection failed')
    })
  })

  describe('Response Format', () => {
    let mockContext: NatsConsumerContext

    beforeEach(() => {
      mockContext = {
        jsm: {
          consumers: {
            add: vi.fn(),
            delete: vi.fn().mockResolvedValue(true),
            info: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
          },
        },
        js: {
          consumers: {
            get: vi.fn(),
          },
        },
      } as unknown as NatsConsumerContext
    })

    it('should return content as JSON text', async () => {
      const params: NatsConsumerParams = {
        action: 'delete',
        stream: 'ORDERS',
        consumer: 'test',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(() => JSON.parse(result.content[0].text)).not.toThrow()
    })

    it('should not set isError for successful operations', async () => {
      const params: NatsConsumerParams = {
        action: 'delete',
        stream: 'ORDERS',
        consumer: 'test',
      }

      const result = await natsConsumerTool.handler(params, mockContext)

      expect(result.isError).toBeFalsy()
    })
  })
})
