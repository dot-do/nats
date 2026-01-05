/**
 * RED Phase Tests: Subject Wildcard Matcher
 *
 * Tests for NATS subject pattern matching with wildcards.
 * Supports:
 *   * (asterisk) - matches exactly one token
 *   > (greater than) - matches one or more tokens (must be last)
 */

import { describe, it, expect } from 'vitest'
import {
  matchSubject,
  isValidSubject,
  isValidWildcard,
  parseSubject,
  tokenizeSubject,
  subjectToRegex,
} from './subject-matcher'

describe('Subject Matcher', () => {
  describe('matchSubject', () => {
    describe('exact matches', () => {
      it('matches identical subjects', () => {
        expect(matchSubject('foo.bar', 'foo.bar')).toBe(true)
      })

      it('matches single token subjects', () => {
        expect(matchSubject('foo', 'foo')).toBe(true)
      })

      it('matches multi-token subjects', () => {
        expect(matchSubject('foo.bar.baz.qux', 'foo.bar.baz.qux')).toBe(true)
      })

      it('rejects non-matching subjects', () => {
        expect(matchSubject('foo.bar', 'foo.baz')).toBe(false)
      })

      it('rejects different token counts', () => {
        expect(matchSubject('foo.bar', 'foo.bar.baz')).toBe(false)
        expect(matchSubject('foo.bar.baz', 'foo.bar')).toBe(false)
      })

      it('rejects empty subject against pattern', () => {
        expect(matchSubject('foo.bar', '')).toBe(false)
      })

      it('is case sensitive', () => {
        expect(matchSubject('Foo.Bar', 'foo.bar')).toBe(false)
        expect(matchSubject('foo.bar', 'FOO.BAR')).toBe(false)
      })
    })

    describe('single-token wildcard (*)', () => {
      it('matches any single token at end', () => {
        expect(matchSubject('foo.*', 'foo.bar')).toBe(true)
        expect(matchSubject('foo.*', 'foo.baz')).toBe(true)
        expect(matchSubject('foo.*', 'foo.123')).toBe(true)
      })

      it('matches any single token in middle', () => {
        expect(matchSubject('foo.*.baz', 'foo.bar.baz')).toBe(true)
        expect(matchSubject('foo.*.baz', 'foo.qux.baz')).toBe(true)
      })

      it('matches any single token at start', () => {
        expect(matchSubject('*.bar', 'foo.bar')).toBe(true)
        expect(matchSubject('*.bar', 'baz.bar')).toBe(true)
      })

      it('does not match multiple tokens', () => {
        expect(matchSubject('foo.*', 'foo.bar.baz')).toBe(false)
        expect(matchSubject('foo.*.qux', 'foo.bar.baz.qux')).toBe(false)
      })

      it('does not match zero tokens', () => {
        expect(matchSubject('foo.*', 'foo')).toBe(false)
        expect(matchSubject('*.bar', 'bar')).toBe(false)
      })

      it('matches multiple wildcards', () => {
        expect(matchSubject('foo.*.*.qux', 'foo.bar.baz.qux')).toBe(true)
        expect(matchSubject('*.*.baz', 'foo.bar.baz')).toBe(true)
        expect(matchSubject('*.bar.*', 'foo.bar.baz')).toBe(true)
      })

      it('wildcard matches any characters including special', () => {
        expect(matchSubject('foo.*', 'foo.bar-baz')).toBe(true)
        expect(matchSubject('foo.*', 'foo.bar_baz')).toBe(true)
        expect(matchSubject('foo.*', 'foo.123abc')).toBe(true)
      })
    })

    describe('multi-token wildcard (>)', () => {
      it('matches one token', () => {
        expect(matchSubject('foo.>', 'foo.bar')).toBe(true)
      })

      it('matches multiple tokens', () => {
        expect(matchSubject('foo.>', 'foo.bar.baz')).toBe(true)
        expect(matchSubject('foo.>', 'foo.bar.baz.qux')).toBe(true)
      })

      it('matches deep nesting', () => {
        expect(matchSubject('foo.>', 'foo.a.b.c.d.e.f.g.h.i.j')).toBe(true)
      })

      it('matches at start', () => {
        expect(matchSubject('>', 'foo')).toBe(true)
        expect(matchSubject('>', 'foo.bar')).toBe(true)
        expect(matchSubject('>', 'foo.bar.baz')).toBe(true)
      })

      it('does not match zero tokens', () => {
        expect(matchSubject('foo.>', 'foo')).toBe(false)
        expect(matchSubject('foo.bar.>', 'foo.bar')).toBe(false)
      })

      it('works with exact prefix', () => {
        expect(matchSubject('orders.created.>', 'orders.created.us.east')).toBe(true)
        expect(matchSubject('orders.created.>', 'orders.updated.us.east')).toBe(false)
      })
    })

    describe('combined wildcards', () => {
      it('supports * before >', () => {
        expect(matchSubject('foo.*.>', 'foo.bar.baz')).toBe(true)
        expect(matchSubject('foo.*.>', 'foo.bar.baz.qux')).toBe(true)
      })

      it('supports multiple * before >', () => {
        expect(matchSubject('*.*.>', 'foo.bar.baz')).toBe(true)
        expect(matchSubject('*.*.>', 'a.b.c.d.e')).toBe(true)
      })

      it('* before > requires minimum tokens', () => {
        expect(matchSubject('foo.*.>', 'foo.bar')).toBe(false) // needs at least foo.bar.X
        expect(matchSubject('*.*.>', 'foo.bar')).toBe(false) // needs at least foo.bar.X
      })
    })

    describe('edge cases', () => {
      it('handles single-char tokens', () => {
        expect(matchSubject('a.b.c', 'a.b.c')).toBe(true)
        expect(matchSubject('a.*', 'a.x')).toBe(true)
      })

      it('handles numeric tokens', () => {
        expect(matchSubject('orders.123', 'orders.123')).toBe(true)
        expect(matchSubject('orders.*', 'orders.456')).toBe(true)
      })

      it('handles hyphenated tokens', () => {
        expect(matchSubject('my-service.events', 'my-service.events')).toBe(true)
        expect(matchSubject('my-service.*', 'my-service.created')).toBe(true)
      })

      it('handles underscored tokens', () => {
        expect(matchSubject('my_service.events', 'my_service.events')).toBe(true)
        expect(matchSubject('my_service.*', 'my_service.updated')).toBe(true)
      })
    })
  })

  describe('isValidSubject', () => {
    describe('valid subjects', () => {
      it('accepts simple subject', () => {
        expect(isValidSubject('foo')).toBe(true)
      })

      it('accepts multi-token subject', () => {
        expect(isValidSubject('foo.bar.baz')).toBe(true)
      })

      it('accepts alphanumeric tokens', () => {
        expect(isValidSubject('foo123.bar456')).toBe(true)
      })

      it('accepts hyphens and underscores', () => {
        expect(isValidSubject('foo-bar.baz_qux')).toBe(true)
      })

      it('accepts uppercase', () => {
        expect(isValidSubject('FOO.BAR')).toBe(true)
        expect(isValidSubject('Foo.Bar')).toBe(true)
      })
    })

    describe('invalid subjects', () => {
      it('rejects empty subject', () => {
        expect(isValidSubject('')).toBe(false)
      })

      it('rejects leading dot', () => {
        expect(isValidSubject('.foo')).toBe(false)
        expect(isValidSubject('.foo.bar')).toBe(false)
      })

      it('rejects trailing dot', () => {
        expect(isValidSubject('foo.')).toBe(false)
        expect(isValidSubject('foo.bar.')).toBe(false)
      })

      it('rejects double dots', () => {
        expect(isValidSubject('foo..bar')).toBe(false)
        expect(isValidSubject('foo...bar')).toBe(false)
      })

      it('rejects spaces', () => {
        expect(isValidSubject('foo bar')).toBe(false)
        expect(isValidSubject('foo. bar')).toBe(false)
        expect(isValidSubject(' foo.bar')).toBe(false)
        expect(isValidSubject('foo.bar ')).toBe(false)
      })

      it('rejects wildcards in plain subjects', () => {
        expect(isValidSubject('foo.*')).toBe(false)
        expect(isValidSubject('foo.>')).toBe(false)
        expect(isValidSubject('*')).toBe(false)
        expect(isValidSubject('>')).toBe(false)
      })

      it('rejects special characters', () => {
        expect(isValidSubject('foo/bar')).toBe(false)
        expect(isValidSubject('foo\\bar')).toBe(false)
        expect(isValidSubject('foo@bar')).toBe(false)
        expect(isValidSubject('foo#bar')).toBe(false)
      })

      it('rejects null bytes', () => {
        expect(isValidSubject('foo\x00bar')).toBe(false)
      })
    })
  })

  describe('isValidWildcard', () => {
    describe('valid wildcard patterns', () => {
      it('accepts single *', () => {
        expect(isValidWildcard('*')).toBe(true)
      })

      it('accepts single >', () => {
        expect(isValidWildcard('>')).toBe(true)
      })

      it('accepts * at end', () => {
        expect(isValidWildcard('foo.*')).toBe(true)
      })

      it('accepts * in middle', () => {
        expect(isValidWildcard('foo.*.bar')).toBe(true)
      })

      it('accepts * at start', () => {
        expect(isValidWildcard('*.foo')).toBe(true)
      })

      it('accepts multiple *', () => {
        expect(isValidWildcard('*.*.*')).toBe(true)
        expect(isValidWildcard('foo.*.bar.*')).toBe(true)
      })

      it('accepts > at end', () => {
        expect(isValidWildcard('foo.>')).toBe(true)
        expect(isValidWildcard('foo.bar.>')).toBe(true)
      })

      it('accepts * before >', () => {
        expect(isValidWildcard('foo.*.>')).toBe(true)
        expect(isValidWildcard('*.>')).toBe(true)
      })

      it('accepts exact subject as valid pattern', () => {
        expect(isValidWildcard('foo.bar.baz')).toBe(true)
      })
    })

    describe('invalid wildcard patterns', () => {
      it('rejects > not at end', () => {
        expect(isValidWildcard('foo.>.bar')).toBe(false)
        expect(isValidWildcard('>.bar')).toBe(false)
      })

      it('rejects multiple >', () => {
        expect(isValidWildcard('foo.>.>')).toBe(false)
        expect(isValidWildcard('>.>')).toBe(false)
      })

      it('rejects empty pattern', () => {
        expect(isValidWildcard('')).toBe(false)
      })

      it('rejects leading dot', () => {
        expect(isValidWildcard('.*')).toBe(false)
        expect(isValidWildcard('.>')).toBe(false)
      })

      it('rejects trailing dot', () => {
        expect(isValidWildcard('foo.*.')).toBe(false)
      })

      it('rejects double dots', () => {
        expect(isValidWildcard('foo..*.bar')).toBe(false)
      })

      it('rejects partial wildcards', () => {
        expect(isValidWildcard('foo*.bar')).toBe(false)
        expect(isValidWildcard('foo*')).toBe(false)
        expect(isValidWildcard('*foo')).toBe(false)
        expect(isValidWildcard('foo>.bar')).toBe(false)
      })

      it('rejects spaces', () => {
        expect(isValidWildcard('foo. *')).toBe(false)
        expect(isValidWildcard('foo.* ')).toBe(false)
      })
    })
  })

  describe('parseSubject', () => {
    it('parses simple subject', () => {
      const result = parseSubject('foo.bar.baz')
      expect(result.tokens).toEqual(['foo', 'bar', 'baz'])
      expect(result.hasWildcard).toBe(false)
      expect(result.hasGreater).toBe(false)
    })

    it('parses subject with *', () => {
      const result = parseSubject('foo.*.baz')
      expect(result.tokens).toEqual(['foo', '*', 'baz'])
      expect(result.hasWildcard).toBe(true)
      expect(result.hasGreater).toBe(false)
    })

    it('parses subject with >', () => {
      const result = parseSubject('foo.>')
      expect(result.tokens).toEqual(['foo', '>'])
      expect(result.hasWildcard).toBe(false)
      expect(result.hasGreater).toBe(true)
    })

    it('parses subject with both wildcards', () => {
      const result = parseSubject('foo.*.>')
      expect(result.tokens).toEqual(['foo', '*', '>'])
      expect(result.hasWildcard).toBe(true)
      expect(result.hasGreater).toBe(true)
    })

    it('returns token count', () => {
      expect(parseSubject('foo').tokenCount).toBe(1)
      expect(parseSubject('foo.bar').tokenCount).toBe(2)
      expect(parseSubject('foo.bar.baz').tokenCount).toBe(3)
    })
  })

  describe('tokenizeSubject', () => {
    it('splits by dot', () => {
      expect(tokenizeSubject('foo.bar.baz')).toEqual(['foo', 'bar', 'baz'])
    })

    it('handles single token', () => {
      expect(tokenizeSubject('foo')).toEqual(['foo'])
    })

    it('preserves wildcards', () => {
      expect(tokenizeSubject('foo.*.>')).toEqual(['foo', '*', '>'])
    })

    it('handles empty string', () => {
      expect(tokenizeSubject('')).toEqual([''])
    })
  })

  describe('subjectToRegex', () => {
    it('converts exact subject to regex', () => {
      const regex = subjectToRegex('foo.bar')
      expect(regex.test('foo.bar')).toBe(true)
      expect(regex.test('foo.baz')).toBe(false)
    })

    it('converts * to single token pattern', () => {
      const regex = subjectToRegex('foo.*')
      expect(regex.test('foo.bar')).toBe(true)
      expect(regex.test('foo.baz')).toBe(true)
      expect(regex.test('foo.bar.baz')).toBe(false)
    })

    it('converts > to multi-token pattern', () => {
      const regex = subjectToRegex('foo.>')
      expect(regex.test('foo.bar')).toBe(true)
      expect(regex.test('foo.bar.baz')).toBe(true)
      expect(regex.test('foo')).toBe(false)
    })

    it('escapes regex special characters in tokens', () => {
      const regex = subjectToRegex('foo.bar-baz')
      expect(regex.test('foo.bar-baz')).toBe(true)
    })

    it('handles combined wildcards', () => {
      const regex = subjectToRegex('foo.*.>')
      expect(regex.test('foo.bar.baz')).toBe(true)
      expect(regex.test('foo.bar.baz.qux')).toBe(true)
      expect(regex.test('foo.bar')).toBe(false)
    })
  })

  describe('real-world patterns', () => {
    it('matches NATS system subjects', () => {
      expect(matchSubject('$SYS.>', '$SYS.server.abc.statsz')).toBe(true)
      expect(matchSubject('$SYS.server.*.statsz', '$SYS.server.abc.statsz')).toBe(true)
    })

    it('matches JetStream API subjects', () => {
      expect(matchSubject('$JS.API.>', '$JS.API.STREAM.CREATE.ORDERS')).toBe(true)
      expect(matchSubject('$JS.API.STREAM.*.ORDERS', '$JS.API.STREAM.CREATE.ORDERS')).toBe(true)
    })

    it('matches inbox patterns', () => {
      expect(matchSubject('_INBOX.>', '_INBOX.abc123.1')).toBe(true)
      expect(matchSubject('_INBOX.*.*', '_INBOX.abc123.1')).toBe(true)
    })

    it('matches event patterns', () => {
      expect(matchSubject('events.*.created', 'events.orders.created')).toBe(true)
      expect(matchSubject('events.*.created', 'events.users.created')).toBe(true)
      expect(matchSubject('events.orders.>', 'events.orders.created')).toBe(true)
      expect(matchSubject('events.orders.>', 'events.orders.updated.v2')).toBe(true)
    })

    it('matches user-specific patterns', () => {
      expect(matchSubject('user.*.notifications', 'user.12345.notifications')).toBe(true)
      expect(matchSubject('user.*.>', 'user.12345.settings.theme')).toBe(true)
    })
  })
})
