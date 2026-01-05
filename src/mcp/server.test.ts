/**
 * RED Phase Tests: MCP Server Factory
 *
 * These tests define the expected interface for the MCP server factory.
 * All tests should FAIL initially (no implementation exists).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer, type McpServerOptions } from './server'

describe('MCP Server', () => {
  describe('createMcpServer', () => {
    it('should create an MCP server instance', () => {
      const server = createMcpServer({})
      expect(server).toBeDefined()
    })

    it('should accept custom server name', () => {
      const server = createMcpServer({ name: 'custom-natdo-mcp' })
      expect(server).toBeDefined()
    })

    it('should accept custom version', () => {
      const server = createMcpServer({ version: '1.0.0' })
      expect(server).toBeDefined()
    })

    it('should use default name if not provided', () => {
      const server = createMcpServer({})
      expect(server.serverInfo.name).toBe('natdo-mcp')
    })

    it('should use default version if not provided', () => {
      const server = createMcpServer({})
      expect(server.serverInfo.version).toBe('0.1.0')
    })
  })

  describe('Tool Registration', () => {
    it('should register nats_publish tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const publishTool = tools.find((t) => t.name === 'nats_publish')
      expect(publishTool).toBeDefined()
    })

    it('should register nats_subscribe tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const subscribeTool = tools.find((t) => t.name === 'nats_subscribe')
      expect(subscribeTool).toBeDefined()
    })

    it('should register nats_request tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const requestTool = tools.find((t) => t.name === 'nats_request')
      expect(requestTool).toBeDefined()
    })

    it('should register jetstream_publish tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const jsPubTool = tools.find((t) => t.name === 'jetstream_publish')
      expect(jsPubTool).toBeDefined()
    })

    it('should register jetstream_stream_create tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const streamCreateTool = tools.find((t) => t.name === 'jetstream_stream_create')
      expect(streamCreateTool).toBeDefined()
    })

    it('should register jetstream_stream_info tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const streamInfoTool = tools.find((t) => t.name === 'jetstream_stream_info')
      expect(streamInfoTool).toBeDefined()
    })

    it('should register jetstream_consumer_create tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const consumerCreateTool = tools.find((t) => t.name === 'jetstream_consumer_create')
      expect(consumerCreateTool).toBeDefined()
    })

    it('should register jetstream_consumer_fetch tool', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const fetchTool = tools.find((t) => t.name === 'jetstream_consumer_fetch')
      expect(fetchTool).toBeDefined()
    })

    it('should return all registered tools', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      expect(tools.length).toBeGreaterThanOrEqual(8)
    })
  })

  describe('Tool Metadata', () => {
    it('should have descriptions for all tools', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      for (const tool of tools) {
        expect(tool.description).toBeDefined()
        expect(tool.description.length).toBeGreaterThan(0)
      }
    })

    it('should have input schemas for tools with parameters', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const publishTool = tools.find((t) => t.name === 'nats_publish')
      expect(publishTool?.inputSchema).toBeDefined()
      expect(publishTool?.inputSchema.properties).toHaveProperty('subject')
    })

    it('nats_publish should require subject parameter', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const publishTool = tools.find((t) => t.name === 'nats_publish')
      expect(publishTool?.inputSchema.required).toContain('subject')
    })

    it('nats_subscribe should require subject parameter', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const subscribeTool = tools.find((t) => t.name === 'nats_subscribe')
      expect(subscribeTool?.inputSchema.required).toContain('subject')
    })

    it('jetstream_stream_create should require name and subjects', async () => {
      const server = createMcpServer({})
      const tools = await server.listTools()
      const streamCreateTool = tools.find((t) => t.name === 'jetstream_stream_create')
      expect(streamCreateTool?.inputSchema.required).toContain('name')
      expect(streamCreateTool?.inputSchema.required).toContain('subjects')
    })
  })

  describe('Tool Invocation', () => {
    it('should call nats_publish tool with correct arguments', async () => {
      const mockNatsAccess = {
        publish: vi.fn().mockResolvedValue({ success: true }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('nats_publish', {
        subject: 'test.subject',
        data: 'Hello, NATS!',
      })

      expect(mockNatsAccess.publish).toHaveBeenCalledWith(
        'test.subject',
        'Hello, NATS!',
        expect.any(Object)
      )
      expect(result.content).toBeDefined()
    })

    it('should call nats_request tool and return response', async () => {
      const mockNatsAccess = {
        request: vi.fn().mockResolvedValue({
          subject: 'test.subject',
          data: 'response data',
        }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('nats_request', {
        subject: 'test.subject',
        data: 'request data',
        timeout: 5000,
      })

      expect(mockNatsAccess.request).toHaveBeenCalled()
      expect(result.content).toBeDefined()
    })

    it('should call jetstream_publish tool and return ack', async () => {
      const mockNatsAccess = {
        jsPublish: vi.fn().mockResolvedValue({
          stream: 'ORDERS',
          seq: 42,
          duplicate: false,
        }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('jetstream_publish', {
        subject: 'orders.created',
        data: '{"orderId": 123}',
      })

      expect(mockNatsAccess.jsPublish).toHaveBeenCalled()
      expect(result.content).toBeDefined()
    })

    it('should call jetstream_stream_create tool', async () => {
      const mockNatsAccess = {
        createStream: vi.fn().mockResolvedValue({
          name: 'ORDERS',
          subjects: ['orders.>'],
          retention: 'limits',
        }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('jetstream_stream_create', {
        name: 'ORDERS',
        subjects: ['orders.>'],
      })

      expect(mockNatsAccess.createStream).toHaveBeenCalled()
      expect(result.content).toBeDefined()
    })

    it('should handle tool not found error', async () => {
      const server = createMcpServer({})

      await expect(
        server.callTool('nonexistent_tool', {})
      ).rejects.toThrow()
    })

    it('should handle tool execution error', async () => {
      const mockNatsAccess = {
        publish: vi.fn().mockRejectedValue(new Error('Connection failed')),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('nats_publish', {
        subject: 'test.subject',
        data: 'test',
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('Tool Result Format', () => {
    it('should return MCP-compliant tool result', async () => {
      const mockNatsAccess = {
        publish: vi.fn().mockResolvedValue({ success: true }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('nats_publish', {
        subject: 'test.subject',
        data: 'test',
      })

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    it('should include text content in result', async () => {
      const mockNatsAccess = {
        publish: vi.fn().mockResolvedValue({ success: true }),
      }
      const server = createMcpServer({ natsAccess: mockNatsAccess })

      const result = await server.callTool('nats_publish', {
        subject: 'test.subject',
        data: 'test',
      })

      const textContent = result.content.find((c: { type: string }) => c.type === 'text')
      expect(textContent).toBeDefined()
    })
  })

  describe('Server Capabilities', () => {
    it('should advertise tools capability', () => {
      const server = createMcpServer({})
      expect(server.capabilities.tools).toBeDefined()
    })

    it('should not advertise resources capability by default', () => {
      const server = createMcpServer({})
      expect(server.capabilities.resources).toBeUndefined()
    })

    it('should not advertise prompts capability by default', () => {
      const server = createMcpServer({})
      expect(server.capabilities.prompts).toBeUndefined()
    })
  })

  describe('Server Info', () => {
    it('should provide server name', () => {
      const server = createMcpServer({ name: 'test-server' })
      expect(server.serverInfo.name).toBe('test-server')
    })

    it('should provide server version', () => {
      const server = createMcpServer({ version: '2.0.0' })
      expect(server.serverInfo.version).toBe('2.0.0')
    })
  })
})
