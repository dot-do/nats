/**
 * RED Phase Tests: NatsCoordinator Consumer Registry
 *
 * These tests define the expected interface for the consumer registry.
 * All tests should FAIL initially (no implementation exists).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import type { ConsumerConfig } from '../types/jetstream'

// Helper to get the NatsCoordinator stub
function getCoordinatorStub() {
  const id = env.NATS_COORDINATOR.idFromName('test')
  return env.NATS_COORDINATOR.get(id)
}

// Helper to send RPC request to coordinator
async function rpc(stub: DurableObjectStub, method: string, params: Record<string, unknown> = {}) {
  const response = await stub.fetch('http://coordinator/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  })
  return response.json() as Promise<{
    jsonrpc: '2.0'
    result?: unknown
    error?: { code: number; message: string; data?: unknown }
    id: number
  }>
}

describe('NatsCoordinator Consumer Registry', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getCoordinatorStub()
  })

  describe('registerConsumer', () => {
    it('should register a durable consumer', async () => {
      const config: ConsumerConfig = {
        name: 'order-processor',
        durable_name: 'order-processor',
        ack_policy: 'explicit',
        deliver_policy: 'all',
      }

      const response = await rpc(stub, 'consumers.register', {
        streamName: 'ORDERS',
        config,
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toMatchObject({
        stream_name: 'ORDERS',
        name: 'order-processor',
        durable: true,
        config: expect.objectContaining({
          name: 'order-processor',
          ack_policy: 'explicit',
        }),
      })
    })

    it('should register an ephemeral consumer', async () => {
      const config: ConsumerConfig = {
        name: 'temp-consumer',
        ack_policy: 'none',
        deliver_policy: 'new',
      }

      const response = await rpc(stub, 'consumers.register', {
        streamName: 'EVENTS',
        config,
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toMatchObject({
        stream_name: 'EVENTS',
        name: 'temp-consumer',
        durable: false,
      })
    })

    it('should return error if consumer already exists', async () => {
      const config: ConsumerConfig = {
        name: 'existing-consumer',
        durable_name: 'existing-consumer',
        ack_policy: 'explicit',
      }

      // Register first time
      await rpc(stub, 'consumers.register', {
        streamName: 'ORDERS',
        config,
      })

      // Try to register again
      const response = await rpc(stub, 'consumers.register', {
        streamName: 'ORDERS',
        config,
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32007) // CONSUMER_EXISTS
    })

    it('should store created_at timestamp', async () => {
      const config: ConsumerConfig = {
        name: 'timestamped-consumer',
        ack_policy: 'explicit',
      }

      const beforeCreate = Date.now()
      const response = await rpc(stub, 'consumers.register', {
        streamName: 'TEST',
        config,
      })
      const afterCreate = Date.now()

      expect(response.error).toBeUndefined()
      const result = response.result as { created_at: number }
      expect(result.created_at).toBeGreaterThanOrEqual(beforeCreate)
      expect(result.created_at).toBeLessThanOrEqual(afterCreate)
    })

    it('should validate consumer name is provided', async () => {
      const config: ConsumerConfig = {
        ack_policy: 'explicit',
      }

      const response = await rpc(stub, 'consumers.register', {
        streamName: 'TEST',
        config,
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32602) // INVALID_PARAMS
    })
  })

  describe('getConsumer', () => {
    it('should retrieve a registered consumer', async () => {
      const config: ConsumerConfig = {
        name: 'get-test-consumer',
        durable_name: 'get-test-consumer',
        ack_policy: 'explicit',
        filter_subject: 'orders.created',
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'ORDERS',
        config,
      })

      const response = await rpc(stub, 'consumers.get', {
        streamName: 'ORDERS',
        consumerName: 'get-test-consumer',
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toMatchObject({
        stream_name: 'ORDERS',
        name: 'get-test-consumer',
        config: expect.objectContaining({
          filter_subject: 'orders.created',
        }),
      })
    })

    it('should return error if consumer not found', async () => {
      const response = await rpc(stub, 'consumers.get', {
        streamName: 'ORDERS',
        consumerName: 'non-existent',
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32002) // CONSUMER_NOT_FOUND
    })

    it('should return error for wrong stream name', async () => {
      const config: ConsumerConfig = {
        name: 'stream-specific',
        ack_policy: 'explicit',
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'STREAM_A',
        config,
      })

      const response = await rpc(stub, 'consumers.get', {
        streamName: 'STREAM_B',
        consumerName: 'stream-specific',
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32002) // CONSUMER_NOT_FOUND
    })
  })

  describe('deleteConsumer', () => {
    it('should delete an existing consumer', async () => {
      const config: ConsumerConfig = {
        name: 'to-delete',
        ack_policy: 'explicit',
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'ORDERS',
        config,
      })

      const deleteResponse = await rpc(stub, 'consumers.delete', {
        streamName: 'ORDERS',
        consumerName: 'to-delete',
      })

      expect(deleteResponse.error).toBeUndefined()
      expect(deleteResponse.result).toEqual({ success: true })

      // Verify it's deleted
      const getResponse = await rpc(stub, 'consumers.get', {
        streamName: 'ORDERS',
        consumerName: 'to-delete',
      })

      expect(getResponse.error?.code).toBe(-32002) // CONSUMER_NOT_FOUND
    })

    it('should return error when deleting non-existent consumer', async () => {
      const response = await rpc(stub, 'consumers.delete', {
        streamName: 'ORDERS',
        consumerName: 'ghost',
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32002) // CONSUMER_NOT_FOUND
    })
  })

  describe('listConsumers', () => {
    it('should list all consumers for a stream', async () => {
      // Register multiple consumers
      await rpc(stub, 'consumers.register', {
        streamName: 'MULTI',
        config: { name: 'consumer-1', ack_policy: 'explicit' },
      })
      await rpc(stub, 'consumers.register', {
        streamName: 'MULTI',
        config: { name: 'consumer-2', ack_policy: 'all' },
      })
      await rpc(stub, 'consumers.register', {
        streamName: 'MULTI',
        config: { name: 'consumer-3', ack_policy: 'none' },
      })

      const response = await rpc(stub, 'consumers.list', {
        streamName: 'MULTI',
      })

      expect(response.error).toBeUndefined()
      const result = response.result as Array<{ name: string }>
      expect(result).toHaveLength(3)
      expect(result.map(c => c.name).sort()).toEqual(['consumer-1', 'consumer-2', 'consumer-3'])
    })

    it('should return empty array for stream with no consumers', async () => {
      const response = await rpc(stub, 'consumers.list', {
        streamName: 'EMPTY',
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toEqual([])
    })

    it('should only list consumers for specified stream', async () => {
      await rpc(stub, 'consumers.register', {
        streamName: 'STREAM_X',
        config: { name: 'x-consumer', ack_policy: 'explicit' },
      })
      await rpc(stub, 'consumers.register', {
        streamName: 'STREAM_Y',
        config: { name: 'y-consumer', ack_policy: 'explicit' },
      })

      const responseX = await rpc(stub, 'consumers.list', {
        streamName: 'STREAM_X',
      })
      const responseY = await rpc(stub, 'consumers.list', {
        streamName: 'STREAM_Y',
      })

      const resultX = responseX.result as Array<{ name: string }>
      const resultY = responseY.result as Array<{ name: string }>

      expect(resultX).toHaveLength(1)
      expect(resultX[0].name).toBe('x-consumer')
      expect(resultY).toHaveLength(1)
      expect(resultY[0].name).toBe('y-consumer')
    })
  })

  describe('updateConsumerLastActive', () => {
    it('should update last_active_at timestamp', async () => {
      const config: ConsumerConfig = {
        name: 'active-consumer',
        ack_policy: 'explicit',
      }

      const registerResponse = await rpc(stub, 'consumers.register', {
        streamName: 'ACTIVITY',
        config,
      })

      const initialResult = registerResponse.result as { last_active_at: number | null }
      expect(initialResult.last_active_at).toBeNull()

      // Update last active
      const beforeUpdate = Date.now()
      const updateResponse = await rpc(stub, 'consumers.updateLastActive', {
        streamName: 'ACTIVITY',
        consumerName: 'active-consumer',
      })
      const afterUpdate = Date.now()

      expect(updateResponse.error).toBeUndefined()
      const updateResult = updateResponse.result as { last_active_at: number }
      expect(updateResult.last_active_at).toBeGreaterThanOrEqual(beforeUpdate)
      expect(updateResult.last_active_at).toBeLessThanOrEqual(afterUpdate)
    })

    it('should persist updated timestamp', async () => {
      const config: ConsumerConfig = {
        name: 'persist-active',
        ack_policy: 'explicit',
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'PERSIST',
        config,
      })

      await rpc(stub, 'consumers.updateLastActive', {
        streamName: 'PERSIST',
        consumerName: 'persist-active',
      })

      const getResponse = await rpc(stub, 'consumers.get', {
        streamName: 'PERSIST',
        consumerName: 'persist-active',
      })

      const result = getResponse.result as { last_active_at: number }
      expect(result.last_active_at).toBeDefined()
      expect(typeof result.last_active_at).toBe('number')
    })

    it('should return error for non-existent consumer', async () => {
      const response = await rpc(stub, 'consumers.updateLastActive', {
        streamName: 'ACTIVITY',
        consumerName: 'missing',
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32002) // CONSUMER_NOT_FOUND
    })
  })

  describe('Consumer Config Storage', () => {
    it('should store and retrieve full consumer config', async () => {
      const config: ConsumerConfig = {
        name: 'full-config',
        durable_name: 'full-config',
        description: 'A fully configured consumer',
        ack_policy: 'explicit',
        deliver_policy: 'by_start_sequence',
        opt_start_seq: 100,
        filter_subject: 'orders.>',
        max_deliver: 5,
        max_ack_pending: 500,
        ack_wait: 30_000_000_000, // 30 seconds in nanos
        replay_policy: 'instant',
        inactive_threshold: 300_000_000_000, // 5 minutes in nanos
        headers_only: false,
        max_waiting: 256,
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'CONFIG_TEST',
        config,
      })

      const response = await rpc(stub, 'consumers.get', {
        streamName: 'CONFIG_TEST',
        consumerName: 'full-config',
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { config: ConsumerConfig }
      expect(result.config).toMatchObject({
        name: 'full-config',
        durable_name: 'full-config',
        description: 'A fully configured consumer',
        ack_policy: 'explicit',
        deliver_policy: 'by_start_sequence',
        opt_start_seq: 100,
        filter_subject: 'orders.>',
        max_deliver: 5,
        max_ack_pending: 500,
        ack_wait: 30_000_000_000,
        replay_policy: 'instant',
        inactive_threshold: 300_000_000_000,
        headers_only: false,
        max_waiting: 256,
      })
    })

    it('should store filter_subjects array', async () => {
      const config: ConsumerConfig = {
        name: 'multi-filter',
        ack_policy: 'explicit',
        filter_subjects: ['orders.created', 'orders.updated', 'orders.deleted'],
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'FILTER_TEST',
        config,
      })

      const response = await rpc(stub, 'consumers.get', {
        streamName: 'FILTER_TEST',
        consumerName: 'multi-filter',
      })

      const result = response.result as { config: ConsumerConfig }
      expect(result.config.filter_subjects).toEqual([
        'orders.created',
        'orders.updated',
        'orders.deleted',
      ])
    })

    it('should store metadata', async () => {
      const config: ConsumerConfig = {
        name: 'with-metadata',
        ack_policy: 'explicit',
        metadata: {
          team: 'backend',
          environment: 'production',
          version: '1.0.0',
        },
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'META_TEST',
        config,
      })

      const response = await rpc(stub, 'consumers.get', {
        streamName: 'META_TEST',
        consumerName: 'with-metadata',
      })

      const result = response.result as { config: ConsumerConfig }
      expect(result.config.metadata).toEqual({
        team: 'backend',
        environment: 'production',
        version: '1.0.0',
      })
    })
  })

  describe('SQLite Schema', () => {
    it('should persist consumers across requests', async () => {
      const config: ConsumerConfig = {
        name: 'persistent',
        durable_name: 'persistent',
        ack_policy: 'explicit',
      }

      await rpc(stub, 'consumers.register', {
        streamName: 'PERSIST_TEST',
        config,
      })

      // Get a new stub (simulating a new request)
      const newStub = getCoordinatorStub()
      const response = await rpc(newStub, 'consumers.get', {
        streamName: 'PERSIST_TEST',
        consumerName: 'persistent',
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toMatchObject({
        name: 'persistent',
      })
    })

    it('should enforce composite primary key (stream_name, name)', async () => {
      // Same consumer name on different streams should work
      const config: ConsumerConfig = {
        name: 'shared-name',
        ack_policy: 'explicit',
      }

      const response1 = await rpc(stub, 'consumers.register', {
        streamName: 'STREAM_A',
        config,
      })
      const response2 = await rpc(stub, 'consumers.register', {
        streamName: 'STREAM_B',
        config,
      })

      expect(response1.error).toBeUndefined()
      expect(response2.error).toBeUndefined()

      // Both should exist
      const get1 = await rpc(stub, 'consumers.get', {
        streamName: 'STREAM_A',
        consumerName: 'shared-name',
      })
      const get2 = await rpc(stub, 'consumers.get', {
        streamName: 'STREAM_B',
        consumerName: 'shared-name',
      })

      expect(get1.error).toBeUndefined()
      expect(get2.error).toBeUndefined()
    })
  })
})
