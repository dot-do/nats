/**
 * RED Phase Tests: NATS Publish MCP Tool
 *
 * These tests define the expected interface for the nats_publish MCP tool.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  natsPublishTool,
  type NatsPublishParams,
  type NatsPublishResult,
  type McpToolContext,
} from './nats-publish'

describe('nats_publish MCP Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(natsPublishTool.name).toBe('nats_publish')
    })

    it('should have description', () => {
      expect(natsPublishTool.description).toBe('Publish a message to a NATS subject')
    })

    it('should have inputSchema with type object', () => {
      expect(natsPublishTool.inputSchema.type).toBe('object')
    })

    it('should define subject property as string', () => {
      expect(natsPublishTool.inputSchema.properties.subject).toEqual({
        type: 'string',
        description: 'Subject to publish to',
      })
    })

    it('should define data property as string', () => {
      expect(natsPublishTool.inputSchema.properties.data).toEqual({
        type: 'string',
        description: 'Message data',
      })
    })

    it('should define headers property as object', () => {
      expect(natsPublishTool.inputSchema.properties.headers).toEqual({
        type: 'object',
        description: 'Optional headers',
        additionalProperties: { type: 'string' },
      })
    })

    it('should require subject parameter', () => {
      expect(natsPublishTool.inputSchema.required).toContain('subject')
    })

    it('should not require data parameter', () => {
      expect(natsPublishTool.inputSchema.required).not.toContain('data')
    })

    it('should not require headers parameter', () => {
      expect(natsPublishTool.inputSchema.required).not.toContain('headers')
    })
  })

  describe('Parameter Validation', () => {
    it('should validate required subject parameter', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      // Empty subject should be invalid
      const result = await natsPublishTool.handler(
        { subject: '' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('subject')
    })

    it('should validate subject does not contain invalid characters', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      // Subject with spaces should be invalid
      const result = await natsPublishTool.handler(
        { subject: 'invalid subject' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('invalid')
    })

    it('should accept valid subject with tokens', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'orders.created.123' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
    })

    it('should accept optional data parameter', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'test', data: 'hello world' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
    })

    it('should accept optional headers parameter', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        {
          subject: 'test',
          data: 'hello',
          headers: { 'X-Custom': 'value' },
        } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
    })
  })

  describe('Successful Publish', () => {
    it('should return success with publish confirmation', async () => {
      const mockPublish = vi.fn()
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: mockPublish,
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'test.subject', data: 'test message' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).not.toBe(true)
      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
    })

    it('should include subject in success response', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'orders.created' } as NatsPublishParams,
        mockContext
      ) as NatsPublishResult

      expect(result.content[0].text).toContain('orders.created')
    })

    it('should call publish with correct subject', async () => {
      const mockPublish = vi.fn()
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: mockPublish,
        },
      }

      await natsPublishTool.handler(
        { subject: 'events.user.created', data: 'payload' } as NatsPublishParams,
        mockContext
      )

      expect(mockPublish).toHaveBeenCalledWith(
        'events.user.created',
        expect.any(Uint8Array),
        expect.anything()
      )
    })

    it('should encode data as Uint8Array', async () => {
      const mockPublish = vi.fn()
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: mockPublish,
        },
      }

      await natsPublishTool.handler(
        { subject: 'test', data: 'hello' } as NatsPublishParams,
        mockContext
      )

      const [, data] = mockPublish.mock.calls[0]
      expect(data).toBeInstanceOf(Uint8Array)
      expect(new TextDecoder().decode(data)).toBe('hello')
    })

    it('should pass headers when provided', async () => {
      const mockPublish = vi.fn()
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: mockPublish,
        },
      }

      await natsPublishTool.handler(
        {
          subject: 'test',
          data: 'hello',
          headers: { 'X-Request-Id': '12345' },
        } as NatsPublishParams,
        mockContext
      )

      const [, , opts] = mockPublish.mock.calls[0]
      expect(opts.headers).toBeDefined()
      expect(opts.headers.get('X-Request-Id')).toBe('12345')
    })

    it('should publish empty message when no data provided', async () => {
      const mockPublish = vi.fn()
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: mockPublish,
        },
      }

      await natsPublishTool.handler(
        { subject: 'ping' } as NatsPublishParams,
        mockContext
      )

      const [, data] = mockPublish.mock.calls[0]
      expect(data).toBeInstanceOf(Uint8Array)
      expect(data.length).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should return error for invalid subject format', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: '.invalid' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid subject')
    })

    it('should return error when subject ends with dot', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn(),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'test.' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).toBe(true)
    })

    it('should return error when publish throws', async () => {
      const mockContext: McpToolContext = {
        natsConnection: {
          publish: vi.fn().mockImplementation(() => {
            throw new Error('Connection closed')
          }),
        },
      }

      const result = await natsPublishTool.handler(
        { subject: 'test' } as NatsPublishParams,
        mockContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Connection closed')
    })

    it('should return error when no connection available', async () => {
      const mockContext: McpToolContext = {
        natsConnection: null,
      }

      const result = await natsPublishTool.handler(
        { subject: 'test' } as NatsPublishParams,
        mockContext as unknown as McpToolContext
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('connection')
    })
  })
})
