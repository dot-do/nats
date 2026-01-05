/**
 * Subject Wildcard Matcher
 *
 * Implements NATS subject pattern matching with wildcards:
 *   * (asterisk) - matches exactly one token
 *   > (greater than) - matches one or more tokens (must be last)
 */

// Valid characters for subject tokens (excluding wildcards)
const VALID_TOKEN_CHARS = /^[a-zA-Z0-9_-]+$/

// Wildcard characters
const SINGLE_WILDCARD = '*'
const MULTI_WILDCARD = '>'
const TOKEN_SEPARATOR = '.'

/**
 * Tokenize a subject string into an array of tokens
 */
export function tokenizeSubject(subject: string): string[] {
  return subject.split(TOKEN_SEPARATOR)
}

/**
 * Parse a subject and return metadata about it
 */
export interface ParsedSubject {
  tokens: string[]
  tokenCount: number
  hasWildcard: boolean
  hasGreater: boolean
}

export function parseSubject(subject: string): ParsedSubject {
  const tokens = tokenizeSubject(subject)
  return {
    tokens,
    tokenCount: tokens.length,
    hasWildcard: tokens.includes(SINGLE_WILDCARD),
    hasGreater: tokens.includes(MULTI_WILDCARD),
  }
}

/**
 * Check if a subject (not pattern) is valid
 * Subjects cannot contain wildcards
 */
export function isValidSubject(subject: string): boolean {
  if (!subject || subject.length === 0) {
    return false
  }

  // Check for null bytes
  if (subject.includes('\x00')) {
    return false
  }

  // Check for spaces
  if (subject.includes(' ')) {
    return false
  }

  // Check for leading/trailing dots
  if (subject.startsWith(TOKEN_SEPARATOR) || subject.endsWith(TOKEN_SEPARATOR)) {
    return false
  }

  // Check for double dots
  if (subject.includes('..')) {
    return false
  }

  const tokens = tokenizeSubject(subject)

  for (const token of tokens) {
    // Empty tokens (from double dots) are invalid
    if (token.length === 0) {
      return false
    }

    // Wildcards are not allowed in plain subjects
    if (token === SINGLE_WILDCARD || token === MULTI_WILDCARD) {
      return false
    }

    // Check for valid characters
    if (!VALID_TOKEN_CHARS.test(token)) {
      return false
    }
  }

  return true
}

/**
 * Check if a wildcard pattern is valid
 */
export function isValidWildcard(pattern: string): boolean {
  if (!pattern || pattern.length === 0) {
    return false
  }

  // Check for spaces
  if (pattern.includes(' ')) {
    return false
  }

  // Check for leading/trailing dots
  if (pattern.startsWith(TOKEN_SEPARATOR) || pattern.endsWith(TOKEN_SEPARATOR)) {
    return false
  }

  // Check for double dots
  if (pattern.includes('..')) {
    return false
  }

  const tokens = tokenizeSubject(pattern)
  let foundGreater = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Empty tokens are invalid
    if (token.length === 0) {
      return false
    }

    // > must be the last token
    if (foundGreater) {
      return false
    }

    if (token === MULTI_WILDCARD) {
      foundGreater = true
      continue
    }

    if (token === SINGLE_WILDCARD) {
      continue
    }

    // Check for partial wildcards (e.g., "foo*" or "*foo")
    if (token.includes(SINGLE_WILDCARD) || token.includes(MULTI_WILDCARD)) {
      return false
    }

    // Check for valid characters
    if (!VALID_TOKEN_CHARS.test(token)) {
      return false
    }
  }

  return true
}

/**
 * Match a subject against a pattern
 * Pattern can contain wildcards (* and >)
 * Subject must be a plain subject (no wildcards)
 */
export function matchSubject(pattern: string, subject: string): boolean {
  if (!pattern || !subject) {
    return false
  }

  const patternTokens = tokenizeSubject(pattern)
  const subjectTokens = tokenizeSubject(subject)

  let patternIdx = 0
  let subjectIdx = 0

  while (patternIdx < patternTokens.length && subjectIdx < subjectTokens.length) {
    const patternToken = patternTokens[patternIdx]
    const subjectToken = subjectTokens[subjectIdx]

    if (patternToken === MULTI_WILDCARD) {
      // > must be last token and matches one or more remaining tokens
      return subjectIdx < subjectTokens.length
    }

    if (patternToken === SINGLE_WILDCARD) {
      // * matches exactly one token
      patternIdx++
      subjectIdx++
      continue
    }

    // Exact match required
    if (patternToken !== subjectToken) {
      return false
    }

    patternIdx++
    subjectIdx++
  }

  // Check if we consumed all tokens
  if (patternIdx < patternTokens.length) {
    // Pattern has remaining tokens - only valid if it's just >
    if (patternTokens[patternIdx] === MULTI_WILDCARD && patternIdx === patternTokens.length - 1) {
      // > requires at least one more subject token, which we don't have
      return false
    }
    return false
  }

  if (subjectIdx < subjectTokens.length) {
    // Subject has remaining tokens but pattern doesn't
    return false
  }

  return true
}

/**
 * Convert a subject pattern to a RegExp
 * Useful for filtering subjects in bulk
 */
export function subjectToRegex(pattern: string): RegExp {
  const tokens = tokenizeSubject(pattern)
  const regexParts: string[] = []

  for (const token of tokens) {
    if (token === SINGLE_WILDCARD) {
      // * matches one token (anything except dots)
      regexParts.push('[^.]+')
    } else if (token === MULTI_WILDCARD) {
      // > matches one or more tokens (rest of subject)
      regexParts.push('.+')
    } else {
      // Escape regex special characters
      regexParts.push(escapeRegex(token))
    }
  }

  return new RegExp(`^${regexParts.join('\\.')}$`)
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
