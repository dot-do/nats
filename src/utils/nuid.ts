/**
 * NUID Generator
 *
 * Generates unique identifiers compatible with NATS NUIDs.
 * Format: 22 characters using base36 alphabet.
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
const BASE = 36
const PREFIX_LENGTH = 12
const SEQ_LENGTH = 10
const MAX_SEQ = Math.pow(BASE, SEQ_LENGTH)

/**
 * NUID generator class
 */
export class NUID {
  private prefix: string
  private seq: number
  private inc: number

  constructor() {
    this.prefix = this.randomPrefix()
    this.seq = Math.floor(Math.random() * MAX_SEQ)
    this.inc = Math.floor(Math.random() * 33) + 22 // Random increment between 22-54
  }

  /**
   * Generate the next NUID
   */
  next(): string {
    this.seq += this.inc
    if (this.seq >= MAX_SEQ) {
      this.prefix = this.randomPrefix()
      this.seq = Math.floor(Math.random() * MAX_SEQ)
    }
    return this.prefix + this.formatSeq(this.seq)
  }

  /**
   * Generate a random prefix
   */
  private randomPrefix(): string {
    const bytes = new Uint8Array(PREFIX_LENGTH)
    crypto.getRandomValues(bytes)
    let result = ''
    for (let i = 0; i < PREFIX_LENGTH; i++) {
      result += DIGITS[bytes[i] % BASE]
    }
    return result
  }

  /**
   * Format sequence number as fixed-length base36
   */
  private formatSeq(n: number): string {
    let result = ''
    for (let i = 0; i < SEQ_LENGTH; i++) {
      result = DIGITS[n % BASE] + result
      n = Math.floor(n / BASE)
    }
    return result
  }

  /**
   * Reset with new random state
   */
  reset(): void {
    this.prefix = this.randomPrefix()
    this.seq = Math.floor(Math.random() * MAX_SEQ)
    this.inc = Math.floor(Math.random() * 33) + 22
  }
}

// Global instance for convenience
const globalNuid = new NUID()

/**
 * Generate the next NUID using global instance
 */
export function nuid(): string {
  return globalNuid.next()
}

/**
 * Create a new inbox subject
 */
export function createInbox(prefix = '_INBOX'): string {
  return `${prefix}.${nuid()}`
}
