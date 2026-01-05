/**
 * RED Phase Tests: Core NATS Types
 *
 * These tests define the expected interface for NATS types.
 * All tests should FAIL initially (no implementation exists).
 */

import { describe, it, expect } from 'vitest'
import {
  type NatsConnection,
  type Msg,
  type Subscription,
  type PublishOptions,
  type SubscriptionOptions,
  type RequestOptions,
  type MsgHdrs,
  type QueuedIterator,
  type ConnectionOptions,
  type Status,
  type ServerInfo,
  createHeaders,
  Empty,
  StringCodec,
  JSONCodec,
} from './nats'

describe('NATS Core Types', () => {
  describe('ConnectionOptions', () => {
    it('should accept servers as string', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
      }
      expect(opts.servers).toBe('https://natdo.example.com')
    })

    it('should accept servers as string array', () => {
      const opts: ConnectionOptions = {
        servers: ['https://a.example.com', 'https://b.example.com'],
      }
      expect(opts.servers).toHaveLength(2)
    })

    it('should accept optional name', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
        name: 'my-client',
      }
      expect(opts.name).toBe('my-client')
    })

    it('should accept optional token auth', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
        token: 'secret-token',
      }
      expect(opts.token).toBe('secret-token')
    })

    it('should accept optional user/pass auth', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
        user: 'admin',
        pass: 'password',
      }
      expect(opts.user).toBe('admin')
      expect(opts.pass).toBe('password')
    })

    it('should accept optional timeout', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
        timeout: 5000,
      }
      expect(opts.timeout).toBe(5000)
    })

    it('should accept optional reconnect options', () => {
      const opts: ConnectionOptions = {
        servers: 'https://natdo.example.com',
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      }
      expect(opts.reconnect).toBe(true)
      expect(opts.maxReconnectAttempts).toBe(10)
      expect(opts.reconnectTimeWait).toBe(2000)
    })
  })

  describe('Msg', () => {
    it('should have subject property', () => {
      const msg = {
        subject: 'test.subject',
        data: new Uint8Array([1, 2, 3]),
        sid: 1,
      } as Msg
      expect(msg.subject).toBe('test.subject')
    })

    it('should have data as Uint8Array', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111])
      const msg = { subject: 'test', data, sid: 1 } as Msg
      expect(msg.data).toBeInstanceOf(Uint8Array)
    })

    it('should have optional reply subject', () => {
      const msg = {
        subject: 'request.subject',
        data: new Uint8Array(),
        reply: '_INBOX.abc123',
        sid: 1,
      } as Msg
      expect(msg.reply).toBe('_INBOX.abc123')
    })

    it('should have optional headers', () => {
      const headers = createHeaders()
      headers.set('X-Custom', 'value')
      const msg = {
        subject: 'test',
        data: new Uint8Array(),
        headers,
        sid: 1,
      } as Msg
      expect(msg.headers?.get('X-Custom')).toBe('value')
    })

    it('should have respond method for request/reply', () => {
      const msg = {
        subject: 'test',
        data: new Uint8Array(),
        reply: '_INBOX.123',
        sid: 1,
        respond: () => true,
      } as Msg
      expect(typeof msg.respond).toBe('function')
    })

    it('should have string method for decoded string', () => {
      const msg = {
        subject: 'test',
        data: new TextEncoder().encode('hello'),
        sid: 1,
        string: () => 'hello',
      } as Msg
      expect(msg.string()).toBe('hello')
    })

    it('should have json method for decoded object', () => {
      const msg = {
        subject: 'test',
        data: new TextEncoder().encode('{"foo":"bar"}'),
        sid: 1,
        json: <T>() => ({ foo: 'bar' } as T),
      } as Msg
      expect(msg.json()).toEqual({ foo: 'bar' })
    })
  })

  describe('MsgHdrs', () => {
    it('should create empty headers', () => {
      const headers = createHeaders()
      expect(headers).toBeDefined()
    })

    it('should set and get single value', () => {
      const headers = createHeaders()
      headers.set('X-Header', 'value')
      expect(headers.get('X-Header')).toBe('value')
    })

    it('should append multiple values', () => {
      const headers = createHeaders()
      headers.append('X-Multi', 'value1')
      headers.append('X-Multi', 'value2')
      expect(headers.values('X-Multi')).toEqual(['value1', 'value2'])
    })

    it('should check if header exists', () => {
      const headers = createHeaders()
      headers.set('X-Exists', 'yes')
      expect(headers.has('X-Exists')).toBe(true)
      expect(headers.has('X-Missing')).toBe(false)
    })

    it('should delete header', () => {
      const headers = createHeaders()
      headers.set('X-Delete', 'value')
      headers.delete('X-Delete')
      expect(headers.has('X-Delete')).toBe(false)
    })

    it('should iterate over keys', () => {
      const headers = createHeaders()
      headers.set('A', '1')
      headers.set('B', '2')
      const keys = [...headers.keys()]
      // Keys are stored lowercase for case-insensitive matching
      expect(keys).toContain('a')
      expect(keys).toContain('b')
    })

    it('should handle case-insensitive header names', () => {
      const headers = createHeaders()
      headers.set('Content-Type', 'application/json')
      expect(headers.get('content-type')).toBe('application/json')
    })

    it('should track status code for NATS headers', () => {
      const headers = createHeaders()
      headers.code = 503
      headers.description = 'No Responders'
      expect(headers.code).toBe(503)
      expect(headers.description).toBe('No Responders')
    })
  })

  describe('PublishOptions', () => {
    it('should accept optional reply subject', () => {
      const opts: PublishOptions = {
        reply: '_INBOX.123',
      }
      expect(opts.reply).toBe('_INBOX.123')
    })

    it('should accept optional headers', () => {
      const headers = createHeaders()
      const opts: PublishOptions = { headers }
      expect(opts.headers).toBe(headers)
    })
  })

  describe('SubscriptionOptions', () => {
    it('should accept optional queue group', () => {
      const opts: SubscriptionOptions = {
        queue: 'workers',
      }
      expect(opts.queue).toBe('workers')
    })

    it('should accept optional max messages', () => {
      const opts: SubscriptionOptions = {
        max: 100,
      }
      expect(opts.max).toBe(100)
    })

    it('should accept optional callback', () => {
      const callback = (_err: Error | null, _msg: Msg) => {}
      const opts: SubscriptionOptions = {
        callback,
      }
      expect(opts.callback).toBe(callback)
    })

    it('should accept optional timeout', () => {
      const opts: SubscriptionOptions = {
        timeout: 5000,
      }
      expect(opts.timeout).toBe(5000)
    })
  })

  describe('RequestOptions', () => {
    it('should accept timeout', () => {
      const opts: RequestOptions = {
        timeout: 3000,
      }
      expect(opts.timeout).toBe(3000)
    })

    it('should accept headers', () => {
      const opts: RequestOptions = {
        headers: createHeaders(),
      }
      expect(opts.headers).toBeDefined()
    })

    it('should accept noMux option', () => {
      const opts: RequestOptions = {
        noMux: true,
      }
      expect(opts.noMux).toBe(true)
    })
  })

  describe('Subscription', () => {
    it('should be async iterable', async () => {
      // Subscription should implement AsyncIterable<Msg>
      const sub = {
        [Symbol.asyncIterator]: () => ({
          async next() {
            return { done: true, value: undefined }
          },
        }),
        getSubject: () => 'test',
        unsubscribe: () => {},
        drain: async () => {},
        isClosed: () => false,
        getReceived: () => 0,
        getMax: () => undefined,
      } as unknown as Subscription

      expect(typeof sub[Symbol.asyncIterator]).toBe('function')
    })

    it('should have getSubject method', () => {
      const sub = {
        getSubject: () => 'foo.bar',
      } as Subscription
      expect(sub.getSubject()).toBe('foo.bar')
    })

    it('should have unsubscribe method', () => {
      let unsubscribed = false
      const sub = {
        unsubscribe: () => { unsubscribed = true },
      } as Subscription
      sub.unsubscribe()
      expect(unsubscribed).toBe(true)
    })

    it('should have drain method', async () => {
      const sub = {
        drain: async () => {},
      } as Subscription
      await expect(sub.drain()).resolves.toBeUndefined()
    })

    it('should track closed state', () => {
      const sub = {
        isClosed: () => false,
      } as Subscription
      expect(sub.isClosed()).toBe(false)
    })

    it('should track received count', () => {
      const sub = {
        getReceived: () => 42,
      } as Subscription
      expect(sub.getReceived()).toBe(42)
    })
  })

  describe('NatsConnection', () => {
    it('should have publish method', () => {
      const nc = {
        publish: () => {},
      } as unknown as NatsConnection
      expect(typeof nc.publish).toBe('function')
    })

    it('should have subscribe method', () => {
      const nc = {
        subscribe: () => ({} as Subscription),
      } as unknown as NatsConnection
      expect(typeof nc.subscribe).toBe('function')
    })

    it('should have request method', () => {
      const nc = {
        request: async () => ({} as Msg),
      } as unknown as NatsConnection
      expect(typeof nc.request).toBe('function')
    })

    it('should have flush method', () => {
      const nc = {
        flush: async () => {},
      } as unknown as NatsConnection
      expect(typeof nc.flush).toBe('function')
    })

    it('should have drain method', () => {
      const nc = {
        drain: async () => {},
      } as unknown as NatsConnection
      expect(typeof nc.drain).toBe('function')
    })

    it('should have close method', () => {
      const nc = {
        close: async () => {},
      } as unknown as NatsConnection
      expect(typeof nc.close).toBe('function')
    })

    it('should have closed promise', async () => {
      const nc = {
        closed: () => Promise.resolve(undefined),
      } as unknown as NatsConnection
      expect(typeof nc.closed).toBe('function')
    })

    it('should have status iterator', () => {
      const nc = {
        status: () => ({
          [Symbol.asyncIterator]: () => ({
            async next() { return { done: true, value: undefined } },
          }),
        }),
      } as unknown as NatsConnection
      expect(typeof nc.status).toBe('function')
    })

    it('should have isClosed method', () => {
      const nc = {
        isClosed: () => false,
      } as unknown as NatsConnection
      expect(nc.isClosed()).toBe(false)
    })

    it('should have isDraining method', () => {
      const nc = {
        isDraining: () => false,
      } as unknown as NatsConnection
      expect(nc.isDraining()).toBe(false)
    })

    it('should have getServer method', () => {
      const nc = {
        getServer: () => 'https://natdo.example.com',
      } as unknown as NatsConnection
      expect(nc.getServer()).toBe('https://natdo.example.com')
    })

    it('should have info getter', () => {
      const nc = {
        info: { server_id: 'abc', version: '1.0.0' },
      } as unknown as NatsConnection
      expect(nc.info?.server_id).toBe('abc')
    })
  })

  describe('Status', () => {
    it('should have type property', () => {
      const status: Status = {
        type: 'disconnect',
        data: 'connection lost',
      }
      expect(status.type).toBe('disconnect')
    })

    it('should support reconnecting type', () => {
      const status: Status = {
        type: 'reconnecting',
        data: 'https://server.example.com',
      }
      expect(status.type).toBe('reconnecting')
    })

    it('should support reconnect type', () => {
      const status: Status = {
        type: 'reconnect',
        data: 'https://server.example.com',
      }
      expect(status.type).toBe('reconnect')
    })

    it('should support update type', () => {
      const status: Status = {
        type: 'update',
        data: { added: ['server1'], deleted: [] },
      }
      expect(status.type).toBe('update')
    })

    it('should support ldm type', () => {
      const status: Status = {
        type: 'ldm',
        data: undefined,
      }
      expect(status.type).toBe('ldm')
    })

    it('should support error type', () => {
      const status: Status = {
        type: 'error',
        data: new Error('connection error'),
      }
      expect(status.type).toBe('error')
    })
  })

  describe('ServerInfo', () => {
    it('should have server_id', () => {
      const info: ServerInfo = {
        server_id: 'NATDO123',
        server_name: 'natdo-server',
        version: '1.0.0',
        proto: 1,
        host: '0.0.0.0',
        port: 443,
        max_payload: 1048576,
      }
      expect(info.server_id).toBe('NATDO123')
    })

    it('should have version', () => {
      const info: ServerInfo = {
        server_id: 'id',
        server_name: 'name',
        version: '2.10.0',
        proto: 1,
        host: '0.0.0.0',
        port: 443,
        max_payload: 1048576,
      }
      expect(info.version).toBe('2.10.0')
    })

    it('should have jetstream capability flag', () => {
      const info: ServerInfo = {
        server_id: 'id',
        server_name: 'name',
        version: '2.10.0',
        proto: 1,
        host: '0.0.0.0',
        port: 443,
        max_payload: 1048576,
        jetstream: true,
      }
      expect(info.jetstream).toBe(true)
    })
  })

  describe('Codecs', () => {
    describe('StringCodec', () => {
      it('should encode string to Uint8Array', () => {
        const sc = StringCodec()
        const encoded = sc.encode('hello')
        expect(encoded).toBeInstanceOf(Uint8Array)
      })

      it('should decode Uint8Array to string', () => {
        const sc = StringCodec()
        const data = new TextEncoder().encode('hello')
        expect(sc.decode(data)).toBe('hello')
      })

      it('should roundtrip correctly', () => {
        const sc = StringCodec()
        const original = 'Hello, NATS!'
        expect(sc.decode(sc.encode(original))).toBe(original)
      })

      it('should handle unicode', () => {
        const sc = StringCodec()
        const original = '你好世界 🌍'
        expect(sc.decode(sc.encode(original))).toBe(original)
      })
    })

    describe('JSONCodec', () => {
      it('should encode object to Uint8Array', () => {
        const jc = JSONCodec<{ foo: string }>()
        const encoded = jc.encode({ foo: 'bar' })
        expect(encoded).toBeInstanceOf(Uint8Array)
      })

      it('should decode Uint8Array to object', () => {
        const jc = JSONCodec<{ foo: string }>()
        const data = new TextEncoder().encode('{"foo":"bar"}')
        expect(jc.decode(data)).toEqual({ foo: 'bar' })
      })

      it('should roundtrip correctly', () => {
        const jc = JSONCodec<{ nested: { value: number } }>()
        const original = { nested: { value: 42 } }
        expect(jc.decode(jc.encode(original))).toEqual(original)
      })

      it('should handle arrays', () => {
        const jc = JSONCodec<number[]>()
        const original = [1, 2, 3, 4, 5]
        expect(jc.decode(jc.encode(original))).toEqual(original)
      })
    })
  })

  describe('Empty', () => {
    it('should be an empty Uint8Array', () => {
      expect(Empty).toBeInstanceOf(Uint8Array)
      expect(Empty.length).toBe(0)
    })
  })

  describe('QueuedIterator', () => {
    it('should be async iterable', () => {
      const qi: QueuedIterator<Msg> = {
        [Symbol.asyncIterator]: function() { return this },
        next: async () => ({ done: true, value: undefined }),
        stop: () => {},
      }
      expect(typeof qi[Symbol.asyncIterator]).toBe('function')
    })

    it('should have stop method', () => {
      const qi: QueuedIterator<Msg> = {
        [Symbol.asyncIterator]: function() { return this },
        next: async () => ({ done: true, value: undefined }),
        stop: () => {},
      }
      expect(typeof qi.stop).toBe('function')
    })
  })
})
