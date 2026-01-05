/**
 * RED Phase Tests: NatsRpcTarget
 *
 * These tests define the expected interface for NatsRpcTarget.
 * The NatsRpcTarget provides RPC methods for core NATS operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NatsRpcTarget } from './nats-rpc-target'
import type { RpcRequest, RpcResponse } from '../types/rpc'
import type { PublishOptions, SubscriptionOptions, RequestOptions } from '../types/nats'

// Mock Durable Object stub interface
interface MockDOStub {
  fetch: ReturnType<typeof vi.fn>
}

describe('NatsRpcTarget', () => {
  let target: NatsRpcTarget
  let mockStub: MockDOStub

  beforeEach(() => {
    mockStub = {
      fetch: vi.fn(),
    }
    target = new NatsRpcTarget(mockStub as unknown as DurableObjectStub)
  })

  describe('constructor', () => {
    it('should accept a DurableObjectStub', () => {
      expect(target).toBeInstanceOf(NatsRpcTarget)
    })
  })

  describe('publish', () => {
    it('should publish a message to a subject', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const result = await target.publish('test.subject', new Uint8Array([1, 2, 3]))

      expect(mockStub.fetch).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should publish with empty data', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const result = await target.publish('test.subject')

      expect(result.success).toBe(true)
    })

    it('should publish with options', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const opts: PublishOptions = {
        reply: '_INBOX.abc123',
      }
      const result = await target.publish('test.subject', new Uint8Array(), opts)

      expect(result.success).toBe(true)
    })

    it('should send correct RPC request format', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      await target.publish('test.subject', new Uint8Array([72, 101, 108, 108, 111]))

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      const body = await request.clone().json() as RpcRequest

      expect(body.jsonrpc).toBe('2.0')
      expect(body.method).toBe('nats.publish')
      expect(body.params).toHaveProperty('subject', 'test.subject')
      expect(body.params).toHaveProperty('data')
    })

    it('should throw on RPC error response', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32008,
            message: 'Invalid subject',
          },
          id: 1,
        }))
      )

      await expect(target.publish('', new Uint8Array())).rejects.toThrow('Invalid subject')
    })
  })

  describe('subscribe', () => {
    it('should create a subscription', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { sid: 1, subject: 'test.subject' },
          id: 1,
        }))
      )

      const result = await target.subscribe('test.subject')

      expect(result.sid).toBe(1)
      expect(result.subject).toBe('test.subject')
    })

    it('should subscribe with queue group', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { sid: 1, subject: 'test.subject', queue: 'workers' },
          id: 1,
        }))
      )

      const opts: SubscriptionOptions = { queue: 'workers' }
      const result = await target.subscribe('test.subject', opts)

      expect(result.queue).toBe('workers')
    })

    it('should subscribe with max messages', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { sid: 1, subject: 'test.subject', max: 100 },
          id: 1,
        }))
      )

      const opts: SubscriptionOptions = { max: 100 }
      const result = await target.subscribe('test.subject', opts)

      expect(result.max).toBe(100)
    })

    it('should send correct RPC request format', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { sid: 1, subject: 'events.>' },
          id: 1,
        }))
      )

      await target.subscribe('events.>', { queue: 'processors' })

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      const body = await request.clone().json() as RpcRequest

      expect(body.method).toBe('nats.subscribe')
      expect(body.params).toHaveProperty('subject', 'events.>')
      expect(body.params).toHaveProperty('queue', 'processors')
    })

    it('should throw on invalid subject', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32008,
            message: 'Invalid subject',
          },
          id: 1,
        }))
      )

      await expect(target.subscribe('')).rejects.toThrow('Invalid subject')
    })
  })

  describe('request', () => {
    it('should send request and receive reply', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: {
            subject: 'service.response',
            data: 'SGVsbG8=', // base64 "Hello"
            sid: 1,
          },
          id: 1,
        }))
      )

      const result = await target.request('service.ping', new Uint8Array())

      expect(result.subject).toBe('service.response')
      expect(result.data).toBeDefined()
    })

    it('should request with timeout option', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: {
            subject: 'service.response',
            data: 'SGVsbG8=',
            sid: 1,
          },
          id: 1,
        }))
      )

      const opts: RequestOptions = { timeout: 5000 }
      const result = await target.request('service.ping', new Uint8Array(), opts)

      expect(result).toBeDefined()
    })

    it('should send correct RPC request format', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: {
            subject: 'reply',
            data: '',
            sid: 1,
          },
          id: 1,
        }))
      )

      await target.request('service.echo', new Uint8Array([1, 2, 3]), { timeout: 3000 })

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      const body = await request.clone().json() as RpcRequest

      expect(body.method).toBe('nats.request')
      expect(body.params).toHaveProperty('subject', 'service.echo')
      expect(body.params).toHaveProperty('data')
      expect(body.params).toHaveProperty('timeout', 3000)
    })

    it('should throw on timeout', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32004,
            message: 'Timeout',
          },
          id: 1,
        }))
      )

      await expect(target.request('service.slow', new Uint8Array())).rejects.toThrow('Timeout')
    })

    it('should throw on no responders', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'No Responders',
          },
          id: 1,
        }))
      )

      await expect(target.request('service.unknown', new Uint8Array())).rejects.toThrow('No Responders')
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe by sid', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const result = await target.unsubscribe(1)

      expect(result.success).toBe(true)
    })

    it('should unsubscribe with max messages', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const result = await target.unsubscribe(1, 10)

      expect(result.success).toBe(true)
    })

    it('should send correct RPC request format', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      await target.unsubscribe(42, 5)

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      const body = await request.clone().json() as RpcRequest

      expect(body.method).toBe('nats.unsubscribe')
      expect(body.params).toHaveProperty('sid', 42)
      expect(body.params).toHaveProperty('max', 5)
    })

    it('should throw on invalid sid', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid params: sid not found',
          },
          id: 1,
        }))
      )

      await expect(target.unsubscribe(999)).rejects.toThrow('Invalid params')
    })
  })

  describe('RPC transport', () => {
    it('should use POST method', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      await target.publish('test', new Uint8Array())

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      expect(request.method).toBe('POST')
    })

    it('should set Content-Type to application/json', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      await target.publish('test', new Uint8Array())

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      expect(request.headers.get('Content-Type')).toBe('application/json')
    })

    it('should generate unique request IDs', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      await target.publish('test1', new Uint8Array())
      await target.publish('test2', new Uint8Array())

      const call1 = mockStub.fetch.mock.calls[0]
      const call2 = mockStub.fetch.mock.calls[1]
      const body1 = await (call1[0] as Request).clone().json() as RpcRequest
      const body2 = await (call2[0] as Request).clone().json() as RpcRequest

      expect(body1.id).not.toBe(body2.id)
    })

    it('should handle network errors', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Network error'))

      await expect(target.publish('test', new Uint8Array())).rejects.toThrow('Network error')
    })
  })

  describe('data encoding', () => {
    it('should encode Uint8Array data as base64', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: { success: true },
          id: 1,
        }))
      )

      const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      await target.publish('test', data)

      const call = mockStub.fetch.mock.calls[0]
      const request = call[0] as Request
      const body = await request.clone().json() as RpcRequest
      const params = body.params as Record<string, unknown>

      // Data should be base64 encoded
      expect(typeof params.data).toBe('string')
      expect(params.data).toBe('SGVsbG8=')
    })

    it('should decode base64 response data to Uint8Array', async () => {
      mockStub.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          jsonrpc: '2.0',
          result: {
            subject: 'reply',
            data: 'SGVsbG8=', // "Hello" in base64
            sid: 1,
          },
          id: 1,
        }))
      )

      const result = await target.request('test', new Uint8Array())

      expect(result.data).toBeInstanceOf(Uint8Array)
      expect(Array.from(result.data)).toEqual([72, 101, 108, 108, 111])
    })
  })
})
