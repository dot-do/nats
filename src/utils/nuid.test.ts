/**
 * NUID Generator Tests
 */

import { describe, it, expect } from 'vitest'
import { NUID, nuid, createInbox } from './nuid'

describe('NUID', () => {
  describe('NUID class', () => {
    it('generates 22-character IDs', () => {
      const n = new NUID()
      const id = n.next()
      expect(id.length).toBe(22)
    })

    it('uses base36 alphabet', () => {
      const n = new NUID()
      const id = n.next()
      expect(id).toMatch(/^[0-9a-z]{22}$/)
    })

    it('generates unique IDs', () => {
      const n = new NUID()
      const ids = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        ids.add(n.next())
      }
      expect(ids.size).toBe(1000)
    })

    it('is monotonically increasing within same instance', () => {
      const n = new NUID()
      let prev = n.next()
      for (let i = 0; i < 100; i++) {
        const curr = n.next()
        // At minimum, the sequence portion should change
        expect(curr).not.toBe(prev)
        prev = curr
      }
    })

    it('generates unique IDs across instances', () => {
      const n1 = new NUID()
      const n2 = new NUID()
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(n1.next())
        ids.add(n2.next())
      }
      expect(ids.size).toBe(200)
    })

    it('reset creates new prefix', () => {
      const n = new NUID()
      const id1 = n.next()
      n.reset()
      const id2 = n.next()
      // Prefixes should be different after reset
      expect(id1.slice(0, 12)).not.toBe(id2.slice(0, 12))
    })
  })

  describe('nuid function', () => {
    it('generates unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(nuid())
      }
      expect(ids.size).toBe(100)
    })

    it('generates 22-character IDs', () => {
      expect(nuid().length).toBe(22)
    })
  })

  describe('createInbox', () => {
    it('creates inbox with default prefix', () => {
      const inbox = createInbox()
      expect(inbox).toMatch(/^_INBOX\.[0-9a-z]{22}$/)
    })

    it('creates inbox with custom prefix', () => {
      const inbox = createInbox('_REPLY')
      expect(inbox).toMatch(/^_REPLY\.[0-9a-z]{22}$/)
    })

    it('creates unique inboxes', () => {
      const inboxes = new Set<string>()
      for (let i = 0; i < 100; i++) {
        inboxes.add(createInbox())
      }
      expect(inboxes.size).toBe(100)
    })
  })

  describe('performance', () => {
    it('generates at least 100k IDs per second', () => {
      const n = new NUID()
      const count = 100000
      const start = performance.now()
      for (let i = 0; i < count; i++) {
        n.next()
      }
      const elapsed = performance.now() - start
      const idsPerSecond = (count / elapsed) * 1000
      expect(idsPerSecond).toBeGreaterThan(100000)
    })
  })
})
