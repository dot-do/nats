/**
 * RED Phase Tests: RPC Types
 *
 * These tests define the expected interface for RPC types.
 * All tests should FAIL initially (no implementation exists).
 */

import { describe, it, expect } from 'vitest'
import {
  type RpcRequest,
  type RpcResponse,
  type RpcError,
  type RpcBatchRequest,
  type RpcBatchResponse,
  type RpcNotification,
  RPC_ERROR_CODES,
  isRpcError,
  isRpcSuccess,
  createRpcRequest,
  createRpcError,
  createRpcSuccess,
} from './rpc'

describe('RPC Types', () => {
  describe('RpcRequest', () => {
    it('should have jsonrpc version 2.0', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.publish',
        id: 1,
      }
      expect(request.jsonrpc).toBe('2.0')
    })

    it('should have method string', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.publish',
        id: 1,
      }
      expect(request.method).toBe('jetstream.publish')
    })

    it('should have numeric or string id', () => {
      const numericId: RpcRequest = {
        jsonrpc: '2.0',
        method: 'test',
        id: 42,
      }
      const stringId: RpcRequest = {
        jsonrpc: '2.0',
        method: 'test',
        id: 'req-123',
      }
      expect(numericId.id).toBe(42)
      expect(stringId.id).toBe('req-123')
    })

    it('should accept optional params as object', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.publish',
        params: { subject: 'test', data: 'hello' },
        id: 1,
      }
      expect(request.params).toEqual({ subject: 'test', data: 'hello' })
    })

    it('should accept optional params as array', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.publish',
        params: ['test', 'hello'],
        id: 1,
      }
      expect(request.params).toEqual(['test', 'hello'])
    })
  })

  describe('RpcNotification', () => {
    it('should have no id field', () => {
      const notification: RpcNotification = {
        jsonrpc: '2.0',
        method: 'nats.publish',
        params: { subject: 'test' },
      }
      expect('id' in notification).toBe(false)
    })

    it('should have method and optional params', () => {
      const notification: RpcNotification = {
        jsonrpc: '2.0',
        method: 'nats.subscribe',
        params: { subject: 'events.>' },
      }
      expect(notification.method).toBe('nats.subscribe')
    })
  })

  describe('RpcResponse', () => {
    it('should have jsonrpc version 2.0', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: { success: true },
        id: 1,
      }
      expect(response.jsonrpc).toBe('2.0')
    })

    it('should have result on success', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: { stream: 'ORDERS', seq: 100 },
        id: 1,
      }
      expect(response.result).toEqual({ stream: 'ORDERS', seq: 100 })
    })

    it('should have error on failure', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
        id: 1,
      }
      expect(response.error?.code).toBe(-32600)
    })

    it('should have matching id from request', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: null,
        id: 'req-abc-123',
      }
      expect(response.id).toBe('req-abc-123')
    })

    it('should have null id for parse errors', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
        },
        id: null,
      }
      expect(response.id).toBeNull()
    })
  })

  describe('RpcError', () => {
    it('should have code', () => {
      const error: RpcError = {
        code: -32600,
        message: 'Invalid Request',
      }
      expect(error.code).toBe(-32600)
    })

    it('should have message', () => {
      const error: RpcError = {
        code: -32601,
        message: 'Method not found',
      }
      expect(error.message).toBe('Method not found')
    })

    it('should accept optional data', () => {
      const error: RpcError = {
        code: -32602,
        message: 'Invalid params',
        data: { param: 'subject', expected: 'string' },
      }
      expect(error.data).toEqual({ param: 'subject', expected: 'string' })
    })
  })

  describe('RPC_ERROR_CODES', () => {
    it('should have PARSE_ERROR (-32700)', () => {
      expect(RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700)
    })

    it('should have INVALID_REQUEST (-32600)', () => {
      expect(RPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
    })

    it('should have METHOD_NOT_FOUND (-32601)', () => {
      expect(RPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
    })

    it('should have INVALID_PARAMS (-32602)', () => {
      expect(RPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602)
    })

    it('should have INTERNAL_ERROR (-32603)', () => {
      expect(RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
    })

    // NATS-specific error codes
    it('should have STREAM_NOT_FOUND (-32001)', () => {
      expect(RPC_ERROR_CODES.STREAM_NOT_FOUND).toBe(-32001)
    })

    it('should have CONSUMER_NOT_FOUND (-32002)', () => {
      expect(RPC_ERROR_CODES.CONSUMER_NOT_FOUND).toBe(-32002)
    })

    it('should have NO_RESPONDERS (-32003)', () => {
      expect(RPC_ERROR_CODES.NO_RESPONDERS).toBe(-32003)
    })

    it('should have TIMEOUT (-32004)', () => {
      expect(RPC_ERROR_CODES.TIMEOUT).toBe(-32004)
    })

    it('should have MESSAGE_NOT_FOUND (-32005)', () => {
      expect(RPC_ERROR_CODES.MESSAGE_NOT_FOUND).toBe(-32005)
    })

    it('should have STREAM_EXISTS (-32006)', () => {
      expect(RPC_ERROR_CODES.STREAM_EXISTS).toBe(-32006)
    })

    it('should have CONSUMER_EXISTS (-32007)', () => {
      expect(RPC_ERROR_CODES.CONSUMER_EXISTS).toBe(-32007)
    })

    it('should have INVALID_SUBJECT (-32008)', () => {
      expect(RPC_ERROR_CODES.INVALID_SUBJECT).toBe(-32008)
    })

    it('should have PERMISSION_DENIED (-32009)', () => {
      expect(RPC_ERROR_CODES.PERMISSION_DENIED).toBe(-32009)
    })

    it('should have MAX_PAYLOAD_EXCEEDED (-32010)', () => {
      expect(RPC_ERROR_CODES.MAX_PAYLOAD_EXCEEDED).toBe(-32010)
    })
  })

  describe('RpcBatchRequest', () => {
    it('should be an array of RpcRequests', () => {
      const batch: RpcBatchRequest = [
        { jsonrpc: '2.0', method: 'nats.publish', params: { subject: 'a' }, id: 1 },
        { jsonrpc: '2.0', method: 'nats.publish', params: { subject: 'b' }, id: 2 },
        { jsonrpc: '2.0', method: 'nats.publish', params: { subject: 'c' }, id: 3 },
      ]
      expect(batch).toHaveLength(3)
      expect(batch[0].id).toBe(1)
    })

    it('should support mixed requests and notifications', () => {
      const batch: RpcBatchRequest = [
        { jsonrpc: '2.0', method: 'nats.publish', params: { subject: 'a' }, id: 1 },
        { jsonrpc: '2.0', method: 'nats.publish', params: { subject: 'b' } } as RpcNotification,
      ]
      expect(batch).toHaveLength(2)
    })
  })

  describe('RpcBatchResponse', () => {
    it('should be an array of RpcResponses', () => {
      const batch: RpcBatchResponse = [
        { jsonrpc: '2.0', result: { seq: 1 }, id: 1 },
        { jsonrpc: '2.0', result: { seq: 2 }, id: 2 },
        { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 3 },
      ]
      expect(batch).toHaveLength(3)
    })

    it('should not include responses for notifications', () => {
      const batch: RpcBatchResponse = [
        { jsonrpc: '2.0', result: { seq: 1 }, id: 1 },
        // notification response would not be included
      ]
      expect(batch).toHaveLength(1)
    })
  })

  describe('isRpcError', () => {
    it('should return true for error responses', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: 1,
      }
      expect(isRpcError(response)).toBe(true)
    })

    it('should return false for success responses', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: { success: true },
        id: 1,
      }
      expect(isRpcError(response)).toBe(false)
    })
  })

  describe('isRpcSuccess', () => {
    it('should return true for success responses', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: { data: 'test' },
        id: 1,
      }
      expect(isRpcSuccess(response)).toBe(true)
    })

    it('should return false for error responses', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: 1,
      }
      expect(isRpcSuccess(response)).toBe(false)
    })

    it('should return true for null result (valid JSON-RPC)', () => {
      const response: RpcResponse = {
        jsonrpc: '2.0',
        result: null,
        id: 1,
      }
      expect(isRpcSuccess(response)).toBe(true)
    })
  })

  describe('createRpcRequest', () => {
    it('should create request with auto-incrementing id', () => {
      const req1 = createRpcRequest('test.method')
      const req2 = createRpcRequest('test.method')
      expect(typeof req1.id).toBe('number')
      expect(req2.id).toBeGreaterThan(req1.id as number)
    })

    it('should create request with provided id', () => {
      const req = createRpcRequest('test.method', { id: 'custom-id' })
      expect(req.id).toBe('custom-id')
    })

    it('should create request with params', () => {
      const req = createRpcRequest('nats.publish', {
        params: { subject: 'test', data: 'hello' },
      })
      expect(req.params).toEqual({ subject: 'test', data: 'hello' })
    })

    it('should always have jsonrpc 2.0', () => {
      const req = createRpcRequest('any.method')
      expect(req.jsonrpc).toBe('2.0')
    })
  })

  describe('createRpcError', () => {
    it('should create error response with code and message', () => {
      const response = createRpcError(
        RPC_ERROR_CODES.METHOD_NOT_FOUND,
        'Method not found',
        1
      )
      expect(response.error?.code).toBe(-32601)
      expect(response.error?.message).toBe('Method not found')
    })

    it('should include id from request', () => {
      const response = createRpcError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        'Invalid params',
        'req-abc'
      )
      expect(response.id).toBe('req-abc')
    })

    it('should include optional data', () => {
      const response = createRpcError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        'Invalid params',
        1,
        { expected: 'string', received: 'number' }
      )
      expect(response.error?.data).toEqual({ expected: 'string', received: 'number' })
    })

    it('should have null id for parse errors', () => {
      const response = createRpcError(
        RPC_ERROR_CODES.PARSE_ERROR,
        'Parse error'
      )
      expect(response.id).toBeNull()
    })
  })

  describe('createRpcSuccess', () => {
    it('should create success response with result', () => {
      const response = createRpcSuccess({ stream: 'ORDERS', seq: 100 }, 1)
      expect(response.result).toEqual({ stream: 'ORDERS', seq: 100 })
    })

    it('should include id from request', () => {
      const response = createRpcSuccess({ success: true }, 'req-xyz')
      expect(response.id).toBe('req-xyz')
    })

    it('should accept null result', () => {
      const response = createRpcSuccess(null, 1)
      expect(response.result).toBeNull()
    })

    it('should not have error field', () => {
      const response = createRpcSuccess({ data: 'test' }, 1)
      expect(response.error).toBeUndefined()
    })
  })

  describe('RPC Methods (type-safe)', () => {
    it('should define nats.publish method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.publish',
        params: {
          subject: 'test.subject',
          data: 'base64-encoded-data',
          headers: { 'X-Custom': 'value' },
          reply: '_INBOX.abc123',
        },
        id: 1,
      }
      expect(request.method).toBe('nats.publish')
    })

    it('should define nats.subscribe method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.subscribe',
        params: {
          subject: 'events.>',
          queue: 'workers',
          max: 100,
        },
        id: 1,
      }
      expect(request.method).toBe('nats.subscribe')
    })

    it('should define nats.request method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'nats.request',
        params: {
          subject: 'service.ping',
          data: '',
          timeout: 5000,
        },
        id: 1,
      }
      expect(request.method).toBe('nats.request')
    })

    it('should define jetstream.publish method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.publish',
        params: {
          subject: 'orders.created',
          data: 'eyJvcmRlcklkIjoxMjN9', // base64
          msgId: 'order-123',
          expectedLastSeq: 99,
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.publish')
    })

    it('should define jetstream.streams.add method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.streams.add',
        params: {
          config: {
            name: 'ORDERS',
            subjects: ['orders.>'],
            retention: 'limits',
            max_msgs: 1000000,
          },
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.streams.add')
    })

    it('should define jetstream.streams.delete method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.streams.delete',
        params: {
          stream: 'ORDERS',
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.streams.delete')
    })

    it('should define jetstream.consumers.add method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.consumers.add',
        params: {
          stream: 'ORDERS',
          config: {
            durable_name: 'order-processor',
            ack_policy: 'explicit',
            filter_subject: 'orders.created',
          },
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.consumers.add')
    })

    it('should define jetstream.consumers.fetch method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.consumers.fetch',
        params: {
          stream: 'ORDERS',
          consumer: 'order-processor',
          max_messages: 10,
          expires: 30000,
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.consumers.fetch')
    })

    it('should define jetstream.ack method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.ack',
        params: {
          stream: 'ORDERS',
          consumer: 'order-processor',
          seq: 100,
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.ack')
    })

    it('should define jetstream.nak method signature', () => {
      const request: RpcRequest = {
        jsonrpc: '2.0',
        method: 'jetstream.nak',
        params: {
          stream: 'ORDERS',
          consumer: 'order-processor',
          seq: 100,
          delay: 5000, // optional delay before redelivery
        },
        id: 1,
      }
      expect(request.method).toBe('jetstream.nak')
    })
  })
})
