/**
 * RED Phase Tests: RPC Client
 *
 * HTTP-based JSON-RPC 2.0 client tests.
 * Tests single calls, batching, notifications, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RpcClient, type RpcClientOptions, RpcError } from './rpc-client'
import { RPC_ERROR_CODES } from '../types/rpc'

// Mock fetch for tests
const mockFetch = vi.fn()

describe('RPC Client', () => {
  let client: RpcClient

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    client = new RpcClient({ url: 'https://api.example.com/rpc' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor', () => {
    it('should create client with URL', () => {
      const c = new RpcClient({ url: 'https://example.com/rpc' })
      expect(c).toBeInstanceOf(RpcClient)
    })

    it('should accept custom headers', () => {
      const c = new RpcClient({
        url: 'https://example.com/rpc',
        headers: { Authorization: 'Bearer token' },
      })
      expect(c).toBeInstanceOf(RpcClient)
    })

    it('should accept custom fetch implementation', () => {
      const customFetch = vi.fn()
      const c = new RpcClient({
        url: 'https://example.com/rpc',
        fetch: customFetch,
      })
      expect(c).toBeInstanceOf(RpcClient)
    })
  })

  describe('call', () => {
    it('should make single RPC call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          result: { message: 'hello' },
          id: 1,
        }),
      })

      const result = await client.call('test.echo', { message: 'hello' })
      expect(result).toEqual({ message: 'hello' })
    })

    it('should send correct request format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          result: null,
          id: 1,
        }),
      })

      await client.call('test.method', { key: 'value' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/rpc',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.jsonrpc).toBe('2.0')
      expect(body.method).toBe('test.method')
      expect(body.params).toEqual({ key: 'value' })
      expect(typeof body.id).toBe('number')
    })

    it('should throw RpcError on error response', async () => {
      const errorResponse = {
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          error: {
            code: RPC_ERROR_CODES.METHOD_NOT_FOUND,
            message: 'Method not found',
          },
          id: 1,
        }),
      }
      mockFetch.mockResolvedValueOnce(errorResponse)
      mockFetch.mockResolvedValueOnce(errorResponse)

      await expect(client.call('unknown.method')).rejects.toThrow(RpcError)
      await expect(client.call('unknown.method')).rejects.toMatchObject({
        code: RPC_ERROR_CODES.METHOD_NOT_FOUND,
        message: 'Method not found',
      })
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.call('test.method')).rejects.toThrow('Network error')
    })

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(client.call('test.method')).rejects.toThrow()
    })

    it('should include custom headers', async () => {
      const clientWithHeaders = new RpcClient({
        url: 'https://api.example.com/rpc',
        headers: { Authorization: 'Bearer token123' },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
      })

      await clientWithHeaders.call('test.method')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      )
    })

    it('should handle null result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: null, id: 1 }),
      })

      const result = await client.call('test.method')
      expect(result).toBeNull()
    })

    it('should call without params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: 'ok', id: 1 }),
      })

      const result = await client.call('test.method')
      expect(result).toBe('ok')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.params).toBeUndefined()
    })
  })

  describe('batch', () => {
    it('should batch multiple calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { jsonrpc: '2.0', result: { a: 1 }, id: 1 },
          { jsonrpc: '2.0', result: { b: 2 }, id: 2 },
        ],
      })

      const results = await client.batch([
        { method: 'test.a', params: {} },
        { method: 'test.b', params: {} },
      ])

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ a: 1 })
      expect(results[1]).toEqual({ b: 2 })
    })

    it('should send array of requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { jsonrpc: '2.0', result: 'a', id: 1 },
          { jsonrpc: '2.0', result: 'b', id: 2 },
        ],
      })

      await client.batch([
        { method: 'test.a' },
        { method: 'test.b', params: { x: 1 } },
      ])

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(Array.isArray(body)).toBe(true)
      expect(body).toHaveLength(2)
      expect(body[0].method).toBe('test.a')
      expect(body[1].method).toBe('test.b')
    })

    it('should handle partial errors in batch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { jsonrpc: '2.0', result: 'success', id: 1 },
          {
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: 2,
          },
        ],
      })

      const results = await client.batch([
        { method: 'test.valid' },
        { method: 'test.invalid' },
      ])

      expect(results[0]).toBe('success')
      expect(results[1]).toBeInstanceOf(RpcError)
    })

    it('should return empty array for empty batch', async () => {
      const results = await client.batch([])
      expect(results).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should preserve order of results', async () => {
      // Server returns out of order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { jsonrpc: '2.0', result: 'second', id: 2 },
          { jsonrpc: '2.0', result: 'first', id: 1 },
          { jsonrpc: '2.0', result: 'third', id: 3 },
        ],
      })

      const results = await client.batch([
        { method: 'test.first' },
        { method: 'test.second' },
        { method: 'test.third' },
      ])

      // Results should be reordered to match request order
      expect(results[0]).toBe('first')
      expect(results[1]).toBe('second')
      expect(results[2]).toBe('third')
    })
  })

  describe('notify', () => {
    it('should send notification without id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      })

      await client.notify('event.happened', { event: 'test' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.jsonrpc).toBe('2.0')
      expect(body.method).toBe('event.happened')
      expect(body.params).toEqual({ event: 'test' })
      expect(body.id).toBeUndefined()
    })

    it('should not expect response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      })

      const result = await client.notify('event.fire')
      expect(result).toBeUndefined()
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.notify('event.fire')).rejects.toThrow('Network error')
    })
  })

  describe('automatic request ID generation', () => {
    it('should generate unique IDs for each call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: 'ok', id: 1 }),
      })

      await client.call('test.a')
      await client.call('test.b')
      await client.call('test.c')

      const ids = mockFetch.mock.calls.map(
        (call) => JSON.parse(call[1].body).id
      )
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })

    it('should generate unique IDs in batch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { jsonrpc: '2.0', result: 'a', id: 1 },
          { jsonrpc: '2.0', result: 'b', id: 2 },
          { jsonrpc: '2.0', result: 'c', id: 3 },
        ],
      })

      await client.batch([
        { method: 'test.a' },
        { method: 'test.b' },
        { method: 'test.c' },
      ])

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const ids = body.map((req: any) => req.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })

  describe('RpcError', () => {
    it('should have code, message, and optional data', () => {
      const error = new RpcError(-32600, 'Invalid Request', { detail: 'test' })
      expect(error.code).toBe(-32600)
      expect(error.message).toBe('Invalid Request')
      expect(error.data).toEqual({ detail: 'test' })
    })

    it('should be instanceof Error', () => {
      const error = new RpcError(-32600, 'Invalid Request')
      expect(error).toBeInstanceOf(Error)
    })

    it('should have name RpcError', () => {
      const error = new RpcError(-32600, 'Invalid Request')
      expect(error.name).toBe('RpcError')
    })
  })

  describe('timeout handling', () => {
    it('should support timeout option', async () => {
      const clientWithTimeout = new RpcClient({
        url: 'https://api.example.com/rpc',
        timeout: 5000,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: 'ok', id: 1 }),
      })

      await clientWithTimeout.call('test.method')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      )
    })
  })
})
