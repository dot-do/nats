/**
 * Utility exports for NatDO
 */

// Subject matching
export {
  matchSubject,
  isValidSubject,
  isValidWildcard,
  parseSubject,
  tokenizeSubject,
  subjectToRegex,
  type ParsedSubject,
} from './subject-matcher'

// NUID generation
export { NUID, nuid, createInbox } from './nuid'

// Error types
export {
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
  type ErrorCode,
} from './errors'
