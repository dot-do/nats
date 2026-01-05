/**
 * Error Hierarchy Tests
 */

import { describe, it, expect } from 'vitest'
import {
  NatsError,
  JetStreamError,
  TimeoutError,
  NoRespondersError,
  ConnectionError,
  PermissionError,
  StreamNotFoundError,
  ConsumerNotFoundError,
  MessageNotFoundError,
  StreamExistsError,
  ConsumerExistsError,
  InvalidSubjectError,
  MaxPayloadError,
  ErrorCodes,
} from './errors'

describe('Error Hierarchy', () => {
  describe('NatsError', () => {
    it('extends Error', () => {
      const error = new NatsError('test message', 'TEST_CODE')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(NatsError)
    })

    it('includes code property', () => {
      const error = new NatsError('test', 'MY_CODE')
      expect(error.code).toBe('MY_CODE')
    })

    it('includes name property', () => {
      const error = new NatsError('test', 'CODE')
      expect(error.name).toBe('NatsError')
    })

    it('includes message', () => {
      const error = new NatsError('custom message', 'CODE')
      expect(error.message).toBe('custom message')
    })
  })

  describe('JetStreamError', () => {
    it('extends NatsError', () => {
      const error = new JetStreamError('test', 'JS_ERROR')
      expect(error).toBeInstanceOf(NatsError)
      expect(error).toBeInstanceOf(JetStreamError)
    })

    it('includes stream name when relevant', () => {
      const error = new JetStreamError('test', 'CODE', { stream: 'ORDERS' })
      expect(error.stream).toBe('ORDERS')
    })

    it('includes consumer name when relevant', () => {
      const error = new JetStreamError('test', 'CODE', {
        stream: 'ORDERS',
        consumer: 'processor',
      })
      expect(error.consumer).toBe('processor')
    })

    it('has JetStreamError name', () => {
      const error = new JetStreamError('test', 'CODE')
      expect(error.name).toBe('JetStreamError')
    })
  })

  describe('TimeoutError', () => {
    it('includes timeout duration', () => {
      const error = new TimeoutError(5000)
      expect(error.timeout).toBe(5000)
    })

    it('has default message', () => {
      const error = new TimeoutError(3000)
      expect(error.message).toBe('Operation timed out after 3000ms')
    })

    it('accepts custom message', () => {
      const error = new TimeoutError(5000, 'Request timeout')
      expect(error.message).toBe('Request timeout')
    })

    it('has TIMEOUT code', () => {
      const error = new TimeoutError(1000)
      expect(error.code).toBe('TIMEOUT')
    })
  })

  describe('NoRespondersError', () => {
    it('includes subject', () => {
      const error = new NoRespondersError('orders.get')
      expect(error.subject).toBe('orders.get')
    })

    it('has descriptive message', () => {
      const error = new NoRespondersError('my.subject')
      expect(error.message).toBe('No responders for subject "my.subject"')
    })

    it('has NO_RESPONDERS code', () => {
      const error = new NoRespondersError('test')
      expect(error.code).toBe('NO_RESPONDERS')
    })
  })

  describe('ConnectionError', () => {
    it('extends NatsError', () => {
      const error = new ConnectionError('connection lost')
      expect(error).toBeInstanceOf(NatsError)
    })

    it('has CONNECTION_ERROR code', () => {
      const error = new ConnectionError('failed')
      expect(error.code).toBe('CONNECTION_ERROR')
    })
  })

  describe('PermissionError', () => {
    it('includes operation and subject', () => {
      const error = new PermissionError('not allowed', {
        operation: 'publish',
        subject: 'admin.>',
      })
      expect(error.operation).toBe('publish')
      expect(error.subject).toBe('admin.>')
    })

    it('has PERMISSION_DENIED code', () => {
      const error = new PermissionError('denied')
      expect(error.code).toBe('PERMISSION_DENIED')
    })
  })

  describe('StreamNotFoundError', () => {
    it('extends JetStreamError', () => {
      const error = new StreamNotFoundError('ORDERS')
      expect(error).toBeInstanceOf(JetStreamError)
    })

    it('includes stream name', () => {
      const error = new StreamNotFoundError('EVENTS')
      expect(error.stream).toBe('EVENTS')
    })

    it('has descriptive message', () => {
      const error = new StreamNotFoundError('ORDERS')
      expect(error.message).toBe('Stream "ORDERS" not found')
    })

    it('has STREAM_NOT_FOUND code', () => {
      const error = new StreamNotFoundError('TEST')
      expect(error.code).toBe('STREAM_NOT_FOUND')
    })
  })

  describe('ConsumerNotFoundError', () => {
    it('includes stream and consumer names', () => {
      const error = new ConsumerNotFoundError('ORDERS', 'processor')
      expect(error.stream).toBe('ORDERS')
      expect(error.consumer).toBe('processor')
    })

    it('has descriptive message', () => {
      const error = new ConsumerNotFoundError('ORDERS', 'my-consumer')
      expect(error.message).toBe(
        'Consumer "my-consumer" not found on stream "ORDERS"'
      )
    })

    it('has CONSUMER_NOT_FOUND code', () => {
      const error = new ConsumerNotFoundError('S', 'C')
      expect(error.code).toBe('CONSUMER_NOT_FOUND')
    })
  })

  describe('MessageNotFoundError', () => {
    it('includes stream and sequence', () => {
      const error = new MessageNotFoundError('ORDERS', 42)
      expect(error.stream).toBe('ORDERS')
      expect(error.seq).toBe(42)
    })

    it('has descriptive message', () => {
      const error = new MessageNotFoundError('EVENTS', 100)
      expect(error.message).toBe('Message 100 not found in stream "EVENTS"')
    })
  })

  describe('StreamExistsError', () => {
    it('includes stream name', () => {
      const error = new StreamExistsError('ORDERS')
      expect(error.stream).toBe('ORDERS')
    })

    it('has STREAM_EXISTS code', () => {
      const error = new StreamExistsError('TEST')
      expect(error.code).toBe('STREAM_EXISTS')
    })
  })

  describe('ConsumerExistsError', () => {
    it('includes stream and consumer', () => {
      const error = new ConsumerExistsError('ORDERS', 'processor')
      expect(error.stream).toBe('ORDERS')
      expect(error.consumer).toBe('processor')
    })

    it('has CONSUMER_EXISTS code', () => {
      const error = new ConsumerExistsError('S', 'C')
      expect(error.code).toBe('CONSUMER_EXISTS')
    })
  })

  describe('InvalidSubjectError', () => {
    it('includes invalid subject', () => {
      const error = new InvalidSubjectError('foo..bar')
      expect(error.subject).toBe('foo..bar')
    })

    it('has INVALID_SUBJECT code', () => {
      const error = new InvalidSubjectError('.bad')
      expect(error.code).toBe('INVALID_SUBJECT')
    })
  })

  describe('MaxPayloadError', () => {
    it('includes size and max size', () => {
      const error = new MaxPayloadError(2000000, 1048576)
      expect(error.size).toBe(2000000)
      expect(error.maxSize).toBe(1048576)
    })

    it('has descriptive message', () => {
      const error = new MaxPayloadError(2000, 1000)
      expect(error.message).toBe(
        'Message size 2000 exceeds maximum allowed 1000'
      )
    })

    it('has MAX_PAYLOAD_EXCEEDED code', () => {
      const error = new MaxPayloadError(100, 50)
      expect(error.code).toBe('MAX_PAYLOAD_EXCEEDED')
    })
  })

  describe('ErrorCodes', () => {
    it('has all error codes', () => {
      expect(ErrorCodes.TIMEOUT).toBe('TIMEOUT')
      expect(ErrorCodes.NO_RESPONDERS).toBe('NO_RESPONDERS')
      expect(ErrorCodes.CONNECTION_ERROR).toBe('CONNECTION_ERROR')
      expect(ErrorCodes.PERMISSION_DENIED).toBe('PERMISSION_DENIED')
      expect(ErrorCodes.STREAM_NOT_FOUND).toBe('STREAM_NOT_FOUND')
      expect(ErrorCodes.CONSUMER_NOT_FOUND).toBe('CONSUMER_NOT_FOUND')
      expect(ErrorCodes.MESSAGE_NOT_FOUND).toBe('MESSAGE_NOT_FOUND')
      expect(ErrorCodes.STREAM_EXISTS).toBe('STREAM_EXISTS')
      expect(ErrorCodes.CONSUMER_EXISTS).toBe('CONSUMER_EXISTS')
      expect(ErrorCodes.INVALID_SUBJECT).toBe('INVALID_SUBJECT')
      expect(ErrorCodes.MAX_PAYLOAD_EXCEEDED).toBe('MAX_PAYLOAD_EXCEEDED')
    })
  })
})
