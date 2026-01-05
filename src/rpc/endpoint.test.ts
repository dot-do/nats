/**
 * RED Phase Tests: RPC Endpoint
 *
 * JSON-RPC 2.0 compliant endpoint tests.
 * Tests request parsing, validation, handling, and response formatting.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseRequest,
  validateRequest,
  handleRequest,
  handleBatch,
  formatError,
  formatSuccess,
  type RpcHandler,
  type RpcHandlers,
} from './endpoint'
import { RPC_ERROR_CODES } from '../types/rpc'

describe('RPC Endpoint', () => {
  describe('parseRequest', () => {
    it('should parse valid JSON-RPC request', async () => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'test.method',
        params: { foo: 'bar' },
        id: 1,
      })
      const result = await parseRequest(body)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          jsonrpc: '2.0',
          method: 'test.method',
          params: { foo: 'bar' },
          id: 1,
        })
      }
    })

    it('should parse batch request', async () => {
      const body = JSON.stringify([
        { jsonrpc: '2.0', method: 'test.a', id: 1 },
        { jsonrpc: '2.0', method: 'test.b', id: 2 },
      ])
      const result = await parseRequest(body)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data).toHaveLength(2)
      }
    })

    it('should return parse error for invalid JSON', async () => {
      const body = 'not valid json {'
      const result = await parseRequest(body)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(RPC_ERROR_CODES.PARSE_ERROR)
        expect(result.error.message).toBe('Parse error')
      }
    })

    it('should return parse error for empty body', async () => {
      const result = await parseRequest('')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(RPC_ERROR_CODES.PARSE_ERROR)
      }
    })

    it('should parse notification (no id)', async () => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notify.event',
        params: { event: 'test' },
      })
      const result = await parseRequest(body)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          jsonrpc: '2.0',
          method: 'notify.event',
          params: { event: 'test' },
        })
      }
    })
  })

  describe('validateRequest', () => {
    it('should validate correct request', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.method',
        id: 1,
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should reject missing jsonrpc field', () => {
      const request = {
        method: 'test.method',
        id: 1,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.code).toBe(RPC_ERROR_CODES.INVALID_REQUEST)
      }
    })

    it('should reject wrong jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        method: 'test.method',
        id: 1,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.code).toBe(RPC_ERROR_CODES.INVALID_REQUEST)
      }
    })

    it('should reject missing method', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.code).toBe(RPC_ERROR_CODES.INVALID_REQUEST)
      }
    })

    it('should reject non-string method', () => {
      const request = {
        jsonrpc: '2.0',
        method: 123,
        id: 1,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
    })

    it('should allow string id', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test',
        id: 'uuid-123',
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should allow numeric id', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test',
        id: 42,
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should allow missing id (notification)', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'notify',
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should reject null as id for requests', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
        id: null,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
    })

    it('should allow object params', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test',
        params: { key: 'value' },
        id: 1,
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should allow array params', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test',
        params: ['a', 'b', 'c'],
        id: 1,
      }
      const result = validateRequest(request)
      expect(result.valid).toBe(true)
    })

    it('should reject primitive params', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
        params: 'invalid',
        id: 1,
      }
      const result = validateRequest(request as any)
      expect(result.valid).toBe(false)
    })
  })

  describe('handleRequest', () => {
    const handlers: RpcHandlers = {
      'test.echo': async (params) => params,
      'test.add': async (params) => {
        const p = params as { a: number; b: number }
        return { sum: p.a + p.b }
      },
      'test.error': async () => {
        throw new Error('Something went wrong')
      },
    }

    it('should dispatch to correct handler', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.echo',
        params: { message: 'hello' },
        id: 1,
      }
      const response = await handleRequest(request, handlers)
      expect(response.result).toEqual({ message: 'hello' })
      expect(response.id).toBe(1)
    })

    it('should return method not found for unknown method', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'unknown.method',
        id: 1,
      }
      const response = await handleRequest(request, handlers)
      expect(response.error?.code).toBe(RPC_ERROR_CODES.METHOD_NOT_FOUND)
      expect(response.id).toBe(1)
    })

    it('should handle handler errors', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.error',
        id: 1,
      }
      const response = await handleRequest(request, handlers)
      expect(response.error?.code).toBe(RPC_ERROR_CODES.INTERNAL_ERROR)
      expect(response.error?.message).toBe('Something went wrong')
    })

    it('should not return response for notification', async () => {
      const notification = {
        jsonrpc: '2.0' as const,
        method: 'test.echo',
        params: { message: 'silent' },
      }
      const response = await handleRequest(notification, handlers)
      expect(response).toBeNull()
    })

    it('should preserve request id in response', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.add',
        params: { a: 2, b: 3 },
        id: 'req-abc-123',
      }
      const response = await handleRequest(request, handlers)
      expect(response?.id).toBe('req-abc-123')
      expect(response?.result).toEqual({ sum: 5 })
    })

    it('should handle undefined params', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.echo',
        id: 1,
      }
      const response = await handleRequest(request, handlers)
      expect(response?.result).toBeUndefined()
    })
  })

  describe('handleBatch', () => {
    const handlers: RpcHandlers = {
      'test.a': async () => ({ result: 'a' }),
      'test.b': async () => ({ result: 'b' }),
      'test.c': async () => ({ result: 'c' }),
    }

    it('should handle batch of requests', async () => {
      const requests = [
        { jsonrpc: '2.0' as const, method: 'test.a', id: 1 },
        { jsonrpc: '2.0' as const, method: 'test.b', id: 2 },
      ]
      const responses = await handleBatch(requests, handlers)
      expect(responses).toHaveLength(2)
      expect(responses[0].id).toBe(1)
      expect(responses[1].id).toBe(2)
    })

    it('should return empty array for empty batch', async () => {
      const responses = await handleBatch([], handlers)
      expect(responses).toEqual([])
    })

    it('should handle mixed requests and notifications', async () => {
      const requests = [
        { jsonrpc: '2.0' as const, method: 'test.a', id: 1 },
        { jsonrpc: '2.0' as const, method: 'test.b' }, // notification
        { jsonrpc: '2.0' as const, method: 'test.c', id: 3 },
      ]
      const responses = await handleBatch(requests, handlers)
      // Only 2 responses (notifications don't get responses)
      expect(responses).toHaveLength(2)
      expect(responses[0].id).toBe(1)
      expect(responses[1].id).toBe(3)
    })

    it('should include errors for failed requests', async () => {
      const requests = [
        { jsonrpc: '2.0' as const, method: 'test.a', id: 1 },
        { jsonrpc: '2.0' as const, method: 'unknown', id: 2 },
      ]
      const responses = await handleBatch(requests, handlers)
      expect(responses).toHaveLength(2)
      expect(responses[0].result).toEqual({ result: 'a' })
      expect(responses[1].error?.code).toBe(RPC_ERROR_CODES.METHOD_NOT_FOUND)
    })

    it('should execute requests concurrently', async () => {
      const order: number[] = []
      const slowHandlers: RpcHandlers = {
        'slow.first': async () => {
          await new Promise((r) => setTimeout(r, 50))
          order.push(1)
          return { first: true }
        },
        'slow.second': async () => {
          await new Promise((r) => setTimeout(r, 10))
          order.push(2)
          return { second: true }
        },
      }
      const requests = [
        { jsonrpc: '2.0' as const, method: 'slow.first', id: 1 },
        { jsonrpc: '2.0' as const, method: 'slow.second', id: 2 },
      ]
      await handleBatch(requests, slowHandlers)
      // Second should complete before first due to concurrent execution
      expect(order).toEqual([2, 1])
    })

    it('should validate each request in batch', async () => {
      const requests = [
        { jsonrpc: '2.0' as const, method: 'test.a', id: 1 },
        { jsonrpc: '1.0', method: 'test.b', id: 2 }, // invalid version
      ]
      const responses = await handleBatch(requests as any, handlers)
      expect(responses).toHaveLength(2)
      expect(responses[0].result).toEqual({ result: 'a' })
      expect(responses[1].error?.code).toBe(RPC_ERROR_CODES.INVALID_REQUEST)
    })
  })

  describe('formatError', () => {
    it('should format error with code and message', () => {
      const response = formatError(
        RPC_ERROR_CODES.PARSE_ERROR,
        'Parse error',
        null
      )
      expect(response).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
        },
        id: null,
      })
    })

    it('should include request id', () => {
      const response = formatError(
        RPC_ERROR_CODES.METHOD_NOT_FOUND,
        'Method not found',
        42
      )
      expect(response.id).toBe(42)
    })

    it('should include optional data', () => {
      const response = formatError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        'Invalid params',
        1,
        { expected: 'string', got: 'number' }
      )
      expect(response.error.data).toEqual({
        expected: 'string',
        got: 'number',
      })
    })

    it('should use null id when id is undefined', () => {
      const response = formatError(
        RPC_ERROR_CODES.PARSE_ERROR,
        'Parse error',
        undefined
      )
      expect(response.id).toBeNull()
    })
  })

  describe('formatSuccess', () => {
    it('should format success with result', () => {
      const response = formatSuccess({ data: 'test' }, 1)
      expect(response).toEqual({
        jsonrpc: '2.0',
        result: { data: 'test' },
        id: 1,
      })
    })

    it('should include request id', () => {
      const response = formatSuccess({ value: 42 }, 'req-xyz')
      expect(response.id).toBe('req-xyz')
    })

    it('should allow null result', () => {
      const response = formatSuccess(null, 1)
      expect(response.result).toBeNull()
    })

    it('should allow undefined result', () => {
      const response = formatSuccess(undefined, 1)
      expect(response.result).toBeUndefined()
    })

    it('should not include error field', () => {
      const response = formatSuccess({ ok: true }, 1)
      expect('error' in response).toBe(false)
    })
  })
})
