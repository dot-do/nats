/**
 * RED Phase Tests: NATS Stream MCP Tool
 *
 * These tests define the expected interface for the nats_stream MCP tool.
 * Supports stream management operations: create, delete, info, list
 */

import { describe, it, expect, vi } from 'vitest'
import {
  natsStreamTool,
  type NatsStreamParams,
  type NatsStreamResult,
  type McpToolContext,
  type StreamOperation,
} from './nats-stream'

describe('nats_stream MCP Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(natsStreamTool.name).toBe('nats_stream')
    })

    it('should have description', () => {
      expect(natsStreamTool.description).toBe('Manage NATS JetStream streams (create, delete, info, list)')
    })

    it('should have inputSchema with type object', () => {
      expect(natsStreamTool.inputSchema.type).toBe('object')
    })

    it('should define operation property as enum', () => {
      expect(natsStreamTool.inputSchema.properties.operation).toEqual({
        type: 'string',
        enum: ['create', 'delete', 'info', 'list'],
        description: 'Operation to perform on stream',
      })
    })

    it('should define name property as string', () => {
      expect(natsStreamTool.inputSchema.properties.name).toEqual({
        type: 'string',
        description: 'Stream name (required for create, delete, info)',
      })
    })

    it('should define subjects property as array', () => {
      expect(natsStreamTool.inputSchema.properties.subjects).toEqual({
        type: 'array',
        items: { type: 'string' },
        description: 'Subjects to bind to stream (required for create)',
      })
    })

    it('should define config property as object', () => {
      expect(natsStreamTool.inputSchema.properties.config).toEqual({
        type: 'object',
        description: 'Optional stream configuration',
        properties: {
          retention: {
            type: 'string',
            enum: ['limits', 'interest', 'workqueue'],
          },
          storage: {
            type: 'string',
            enum: ['file', 'memory'],
          },
          max_msgs: { type: 'number' },
          max_bytes: { type: 'number' },
          max_age: { type: 'number' },
          max_msg_size: { type: 'number' },
          max_consumers: { type: 'number' },
          discard: {
            type: 'string',
            enum: ['old', 'new'],
          },
          num_replicas: { type: 'number' },
        },
      })
    })

    it('should require operation parameter', () => {
      expect(natsStreamTool.inputSchema.required).toContain('operation')
    })

    it('should not require name parameter (list operation does not need it)', () => {
      expect(natsStreamTool.inputSchema.required).not.toContain('name')
    })
  })

  describe('Parameter Validation', () => {
    it('should validate required operation parameter', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        {} as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('operation')
    })

    it('should validate operation is valid enum value', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'invalid' as StreamOperation } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('operation')
    })

    it('should require name for create operation', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'create', subjects: ['test.>'] } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name')
    })

    it('should require subjects for create operation', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'create', name: 'ORDERS' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('subjects')
    })

    it('should require name for delete operation', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'delete' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name')
    })

    it('should require name for info operation', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'info' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name')
    })

    it('should not require name for list operation', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'list' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
    })

    it('should validate stream name format', async () => {
      const mockContext = createMockContext()

      const result = await natsStreamTool.handler(
        { operation: 'info', name: 'invalid stream name!' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid stream name')
    })
  })

  describe('Create Operation', () => {
    it('should create stream with name and subjects', async () => {
      const mockAdd = vi.fn().mockResolvedValue({
        config: { name: 'ORDERS', subjects: ['orders.>'] },
        state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
        created: new Date().toISOString(),
      })
      const mockContext = createMockContext({ streamsAdd: mockAdd })

      const result = await natsStreamTool.handler(
        {
          operation: 'create',
          name: 'ORDERS',
          subjects: ['orders.>'],
        } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ORDERS',
          subjects: ['orders.>'],
        })
      )
    })

    it('should include stream info in success response', async () => {
      const streamInfo = {
        config: { name: 'EVENTS', subjects: ['events.>'] },
        state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
        created: '2024-01-01T00:00:00.000Z',
      }
      const mockAdd = vi.fn().mockResolvedValue(streamInfo)
      const mockContext = createMockContext({ streamsAdd: mockAdd })

      const result = await natsStreamTool.handler(
        {
          operation: 'create',
          name: 'EVENTS',
          subjects: ['events.>'],
        } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      const responseText = result.content[0].text
      expect(responseText).toContain('EVENTS')
      expect(responseText).toContain('created')
    })

    it('should pass optional config parameters', async () => {
      const mockAdd = vi.fn().mockResolvedValue({
        config: { name: 'TEST', subjects: ['test.>'], retention: 'workqueue' },
        state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
        created: new Date().toISOString(),
      })
      const mockContext = createMockContext({ streamsAdd: mockAdd })

      await natsStreamTool.handler(
        {
          operation: 'create',
          name: 'TEST',
          subjects: ['test.>'],
          config: {
            retention: 'workqueue',
            storage: 'memory',
            max_msgs: 1000,
          },
        } as NatsStreamParams,
        mockContext
      )

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TEST',
          subjects: ['test.>'],
          retention: 'workqueue',
          storage: 'memory',
          max_msgs: 1000,
        })
      )
    })

    it('should return error when stream already exists', async () => {
      const mockAdd = vi.fn().mockRejectedValue(new Error('stream already exists'))
      const mockContext = createMockContext({ streamsAdd: mockAdd })

      const result = await natsStreamTool.handler(
        {
          operation: 'create',
          name: 'EXISTING',
          subjects: ['existing.>'],
        } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('already exists')
    })
  })

  describe('Delete Operation', () => {
    it('should delete stream by name', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true)
      const mockContext = createMockContext({ streamsDelete: mockDelete })

      const result = await natsStreamTool.handler(
        { operation: 'delete', name: 'ORDERS' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
      expect(mockDelete).toHaveBeenCalledWith('ORDERS')
    })

    it('should return success message on delete', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true)
      const mockContext = createMockContext({ streamsDelete: mockDelete })

      const result = await natsStreamTool.handler(
        { operation: 'delete', name: 'ORDERS' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      expect(result.content[0].text).toContain('ORDERS')
      expect(result.content[0].text).toContain('deleted')
    })

    it('should return error when stream not found', async () => {
      const mockDelete = vi.fn().mockRejectedValue(new Error('stream not found'))
      const mockContext = createMockContext({ streamsDelete: mockDelete })

      const result = await natsStreamTool.handler(
        { operation: 'delete', name: 'NONEXISTENT' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('Info Operation', () => {
    it('should return stream info', async () => {
      const streamInfo = {
        config: { name: 'ORDERS', subjects: ['orders.>'] },
        state: { messages: 100, bytes: 5000, first_seq: 1, last_seq: 100, consumer_count: 2 },
        created: '2024-01-01T00:00:00.000Z',
      }
      const mockInfo = vi.fn().mockResolvedValue(streamInfo)
      const mockContext = createMockContext({ streamsInfo: mockInfo })

      const result = await natsStreamTool.handler(
        { operation: 'info', name: 'ORDERS' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      expect(result.isError).not.toBe(true)
      expect(mockInfo).toHaveBeenCalledWith('ORDERS')
    })

    it('should include stream details in response', async () => {
      const streamInfo = {
        config: { name: 'EVENTS', subjects: ['events.>'] },
        state: { messages: 50, bytes: 2500, first_seq: 1, last_seq: 50, consumer_count: 1 },
        created: '2024-01-01T12:00:00.000Z',
      }
      const mockInfo = vi.fn().mockResolvedValue(streamInfo)
      const mockContext = createMockContext({ streamsInfo: mockInfo })

      const result = await natsStreamTool.handler(
        { operation: 'info', name: 'EVENTS' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      const responseText = result.content[0].text
      expect(responseText).toContain('EVENTS')
      expect(responseText).toContain('50') // messages
      expect(responseText).toContain('events.>')
    })

    it('should return error when stream not found', async () => {
      const mockInfo = vi.fn().mockRejectedValue(new Error('stream not found'))
      const mockContext = createMockContext({ streamsInfo: mockInfo })

      const result = await natsStreamTool.handler(
        { operation: 'info', name: 'NONEXISTENT' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('List Operation', () => {
    it('should list all streams', async () => {
      const streams = [
        {
          config: { name: 'ORDERS', subjects: ['orders.>'] },
          state: { messages: 100, bytes: 5000, first_seq: 1, last_seq: 100, consumer_count: 2 },
          created: '2024-01-01T00:00:00.000Z',
        },
        {
          config: { name: 'EVENTS', subjects: ['events.>'] },
          state: { messages: 50, bytes: 2500, first_seq: 1, last_seq: 50, consumer_count: 1 },
          created: '2024-01-02T00:00:00.000Z',
        },
      ]
      async function* mockList() {
        for (const stream of streams) {
          yield stream
        }
      }
      const mockContext = createMockContext({ streamsList: mockList })

      const result = await natsStreamTool.handler(
        { operation: 'list' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      expect(result.isError).not.toBe(true)
      expect(result.content[0].text).toContain('ORDERS')
      expect(result.content[0].text).toContain('EVENTS')
    })

    it('should return empty list when no streams exist', async () => {
      async function* mockList() {
        // Empty generator
      }
      const mockContext = createMockContext({ streamsList: mockList })

      const result = await natsStreamTool.handler(
        { operation: 'list' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      expect(result.isError).not.toBe(true)
      expect(result.content[0].text).toContain('No streams found')
    })

    it('should include stream count in response', async () => {
      const streams = [
        {
          config: { name: 'STREAM1', subjects: ['s1.>'] },
          state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
          created: '2024-01-01T00:00:00.000Z',
        },
        {
          config: { name: 'STREAM2', subjects: ['s2.>'] },
          state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
          created: '2024-01-02T00:00:00.000Z',
        },
        {
          config: { name: 'STREAM3', subjects: ['s3.>'] },
          state: { messages: 0, bytes: 0, first_seq: 1, last_seq: 0, consumer_count: 0 },
          created: '2024-01-03T00:00:00.000Z',
        },
      ]
      async function* mockList() {
        for (const stream of streams) {
          yield stream
        }
      }
      const mockContext = createMockContext({ streamsList: mockList })

      const result = await natsStreamTool.handler(
        { operation: 'list' } as NatsStreamParams,
        mockContext
      ) as NatsStreamResult

      expect(result.content[0].text).toContain('3')
    })
  })

  describe('Error Handling', () => {
    it('should return error when no connection available', async () => {
      const mockContext = {
        jetStreamManager: null,
      } as unknown as McpToolContext

      const result = await natsStreamTool.handler(
        { operation: 'list' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('connection')
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockInfo = vi.fn().mockRejectedValue(new Error('Internal error'))
      const mockContext = createMockContext({ streamsInfo: mockInfo })

      const result = await natsStreamTool.handler(
        { operation: 'info', name: 'TEST' } as NatsStreamParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Internal error')
    })
  })
})

// Helper function to create mock context
function createMockContext(options: {
  streamsAdd?: ReturnType<typeof vi.fn>
  streamsDelete?: ReturnType<typeof vi.fn>
  streamsInfo?: ReturnType<typeof vi.fn>
  streamsList?: () => AsyncGenerator<unknown>
} = {}): McpToolContext {
  return {
    jetStreamManager: {
      streams: {
        add: options.streamsAdd ?? vi.fn().mockResolvedValue({}),
        delete: options.streamsDelete ?? vi.fn().mockResolvedValue(true),
        info: options.streamsInfo ?? vi.fn().mockResolvedValue({}),
        list: options.streamsList ?? (async function* () {}),
      },
    },
  } as unknown as McpToolContext
}
