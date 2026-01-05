/**
 * Error Hierarchy
 *
 * NATS-compatible error types for NatDO.
 */

/**
 * Base NATS error
 */
export class NatsError extends Error {
  readonly code: string
  readonly name = 'NatsError'

  constructor(message: string, code: string) {
    super(message)
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * JetStream-specific error
 */
export class JetStreamError extends NatsError {
  readonly name = 'JetStreamError'
  readonly stream?: string
  readonly consumer?: string

  constructor(
    message: string,
    code: string,
    opts?: { stream?: string; consumer?: string }
  ) {
    super(message, code)
    this.stream = opts?.stream
    this.consumer = opts?.consumer
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends NatsError {
  readonly name = 'TimeoutError'
  readonly timeout: number

  constructor(timeout: number, message?: string) {
    super(message || `Operation timed out after ${timeout}ms`, 'TIMEOUT')
    this.timeout = timeout
  }
}

/**
 * No responders error
 */
export class NoRespondersError extends NatsError {
  readonly name = 'NoRespondersError'
  readonly subject: string

  constructor(subject: string) {
    super(`No responders for subject "${subject}"`, 'NO_RESPONDERS')
    this.subject = subject
  }
}

/**
 * Connection error
 */
export class ConnectionError extends NatsError {
  readonly name = 'ConnectionError'

  constructor(message: string) {
    super(message, 'CONNECTION_ERROR')
  }
}

/**
 * Permission error
 */
export class PermissionError extends NatsError {
  readonly name = 'PermissionError'
  readonly operation?: string
  readonly subject?: string

  constructor(message: string, opts?: { operation?: string; subject?: string }) {
    super(message, 'PERMISSION_DENIED')
    this.operation = opts?.operation
    this.subject = opts?.subject
  }
}

/**
 * Stream not found error
 */
export class StreamNotFoundError extends JetStreamError {
  readonly name = 'StreamNotFoundError'

  constructor(stream: string) {
    super(`Stream "${stream}" not found`, 'STREAM_NOT_FOUND', { stream })
  }
}

/**
 * Consumer not found error
 */
export class ConsumerNotFoundError extends JetStreamError {
  readonly name = 'ConsumerNotFoundError'

  constructor(stream: string, consumer: string) {
    super(
      `Consumer "${consumer}" not found on stream "${stream}"`,
      'CONSUMER_NOT_FOUND',
      { stream, consumer }
    )
  }
}

/**
 * Message not found error
 */
export class MessageNotFoundError extends JetStreamError {
  readonly name = 'MessageNotFoundError'
  readonly seq: number

  constructor(stream: string, seq: number) {
    super(`Message ${seq} not found in stream "${stream}"`, 'MESSAGE_NOT_FOUND', {
      stream,
    })
    this.seq = seq
  }
}

/**
 * Stream already exists error
 */
export class StreamExistsError extends JetStreamError {
  readonly name = 'StreamExistsError'

  constructor(stream: string) {
    super(`Stream "${stream}" already exists`, 'STREAM_EXISTS', { stream })
  }
}

/**
 * Consumer already exists error
 */
export class ConsumerExistsError extends JetStreamError {
  readonly name = 'ConsumerExistsError'

  constructor(stream: string, consumer: string) {
    super(
      `Consumer "${consumer}" already exists on stream "${stream}"`,
      'CONSUMER_EXISTS',
      { stream, consumer }
    )
  }
}

/**
 * Invalid subject error
 */
export class InvalidSubjectError extends NatsError {
  readonly name = 'InvalidSubjectError'
  readonly subject: string

  constructor(subject: string) {
    super(`Invalid subject: "${subject}"`, 'INVALID_SUBJECT')
    this.subject = subject
  }
}

/**
 * Max payload exceeded error
 */
export class MaxPayloadError extends NatsError {
  readonly name = 'MaxPayloadError'
  readonly size: number
  readonly maxSize: number

  constructor(size: number, maxSize: number) {
    super(
      `Message size ${size} exceeds maximum allowed ${maxSize}`,
      'MAX_PAYLOAD_EXCEEDED'
    )
    this.size = size
    this.maxSize = maxSize
  }
}

/**
 * Error codes for RPC responses
 */
export const ErrorCodes = {
  TIMEOUT: 'TIMEOUT',
  NO_RESPONDERS: 'NO_RESPONDERS',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  CONSUMER_NOT_FOUND: 'CONSUMER_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  STREAM_EXISTS: 'STREAM_EXISTS',
  CONSUMER_EXISTS: 'CONSUMER_EXISTS',
  INVALID_SUBJECT: 'INVALID_SUBJECT',
  MAX_PAYLOAD_EXCEEDED: 'MAX_PAYLOAD_EXCEEDED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
