/**
 * NatsCoordinator Durable Object
 *
 * Central coordinator for NATS/JetStream operations.
 * Manages consumer registry with SQLite storage.
 */

import { DurableObject } from 'cloudflare:workers'
import type { ConsumerConfig } from '../types/jetstream'
import { RPC_ERROR_CODES, createRpcError, createRpcSuccess } from '../types/rpc'

// Consumer registry entry stored in SQLite
interface ConsumerEntry {
  stream_name: string
  name: string
  config: ConsumerConfig
  durable: boolean
  created_at: number
  last_active_at: number | null
}

// RPC request structure
interface RpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: number | string
}

export class NatsCoordinator extends DurableObject {
  private sql: SqlStorage

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    this.sql = ctx.storage.sql

    // Initialize schema
    this.initSchema()
  }

  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS consumers (
        stream_name TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        durable INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER,
        PRIMARY KEY (stream_name, name)
      )
    `)
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const body = await request.json() as RpcRequest
      const { method, params, id } = body

      const result = await this.handleRpc(method, params || {}, id)
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      const errorResponse = createRpcError(
        RPC_ERROR_CODES.PARSE_ERROR,
        'Invalid JSON',
        null
      )
      return new Response(JSON.stringify(errorResponse), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  private async handleRpc(
    method: string,
    params: Record<string, unknown>,
    id: number | string
  ) {
    switch (method) {
      case 'consumers.register':
        return this.registerConsumer(params, id)
      case 'consumers.get':
        return this.getConsumer(params, id)
      case 'consumers.delete':
        return this.deleteConsumer(params, id)
      case 'consumers.list':
        return this.listConsumers(params, id)
      case 'consumers.updateLastActive':
        return this.updateConsumerLastActive(params, id)
      default:
        return createRpcError(
          RPC_ERROR_CODES.METHOD_NOT_FOUND,
          `Method not found: ${method}`,
          id
        )
    }
  }

  private registerConsumer(params: Record<string, unknown>, id: number | string) {
    const streamName = params.streamName as string
    const config = params.config as ConsumerConfig

    // Validate consumer name
    const consumerName = config.name || config.durable_name
    if (!consumerName) {
      return createRpcError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        'Consumer name is required (name or durable_name)',
        id
      )
    }

    // Check if consumer already exists
    const existing = this.sql
      .exec('SELECT 1 FROM consumers WHERE stream_name = ? AND name = ?', streamName, consumerName)
      .toArray()

    if (existing.length > 0) {
      return createRpcError(
        RPC_ERROR_CODES.CONSUMER_EXISTS,
        `Consumer ${consumerName} already exists on stream ${streamName}`,
        id
      )
    }

    const now = Date.now()
    const isDurable = !!config.durable_name

    // Store the consumer
    this.sql.exec(
      `INSERT INTO consumers (stream_name, name, config, durable, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      streamName,
      consumerName,
      JSON.stringify(config),
      isDurable ? 1 : 0,
      now,
      null
    )

    const entry: ConsumerEntry = {
      stream_name: streamName,
      name: consumerName,
      config,
      durable: isDurable,
      created_at: now,
      last_active_at: null,
    }

    return createRpcSuccess(entry, id)
  }

  private getConsumer(params: Record<string, unknown>, id: number | string) {
    const streamName = params.streamName as string
    const consumerName = params.consumerName as string

    const rows = this.sql
      .exec(
        'SELECT stream_name, name, config, durable, created_at, last_active_at FROM consumers WHERE stream_name = ? AND name = ?',
        streamName,
        consumerName
      )
      .toArray()

    if (rows.length === 0) {
      return createRpcError(
        RPC_ERROR_CODES.CONSUMER_NOT_FOUND,
        `Consumer ${consumerName} not found on stream ${streamName}`,
        id
      )
    }

    const row = rows[0] as {
      stream_name: string
      name: string
      config: string
      durable: number
      created_at: number
      last_active_at: number | null
    }

    const entry: ConsumerEntry = {
      stream_name: row.stream_name,
      name: row.name,
      config: JSON.parse(row.config) as ConsumerConfig,
      durable: row.durable === 1,
      created_at: row.created_at,
      last_active_at: row.last_active_at,
    }

    return createRpcSuccess(entry, id)
  }

  private deleteConsumer(params: Record<string, unknown>, id: number | string) {
    const streamName = params.streamName as string
    const consumerName = params.consumerName as string

    // Check if consumer exists
    const existing = this.sql
      .exec('SELECT 1 FROM consumers WHERE stream_name = ? AND name = ?', streamName, consumerName)
      .toArray()

    if (existing.length === 0) {
      return createRpcError(
        RPC_ERROR_CODES.CONSUMER_NOT_FOUND,
        `Consumer ${consumerName} not found on stream ${streamName}`,
        id
      )
    }

    this.sql.exec(
      'DELETE FROM consumers WHERE stream_name = ? AND name = ?',
      streamName,
      consumerName
    )

    return createRpcSuccess({ success: true }, id)
  }

  private listConsumers(params: Record<string, unknown>, id: number | string) {
    const streamName = params.streamName as string

    const rows = this.sql
      .exec(
        'SELECT stream_name, name, config, durable, created_at, last_active_at FROM consumers WHERE stream_name = ? ORDER BY name',
        streamName
      )
      .toArray()

    const consumers: ConsumerEntry[] = rows.map((row) => {
      const r = row as {
        stream_name: string
        name: string
        config: string
        durable: number
        created_at: number
        last_active_at: number | null
      }
      return {
        stream_name: r.stream_name,
        name: r.name,
        config: JSON.parse(r.config) as ConsumerConfig,
        durable: r.durable === 1,
        created_at: r.created_at,
        last_active_at: r.last_active_at,
      }
    })

    return createRpcSuccess(consumers, id)
  }

  private updateConsumerLastActive(params: Record<string, unknown>, id: number | string) {
    const streamName = params.streamName as string
    const consumerName = params.consumerName as string

    // Check if consumer exists
    const existing = this.sql
      .exec('SELECT 1 FROM consumers WHERE stream_name = ? AND name = ?', streamName, consumerName)
      .toArray()

    if (existing.length === 0) {
      return createRpcError(
        RPC_ERROR_CODES.CONSUMER_NOT_FOUND,
        `Consumer ${consumerName} not found on stream ${streamName}`,
        id
      )
    }

    const now = Date.now()
    this.sql.exec(
      'UPDATE consumers SET last_active_at = ? WHERE stream_name = ? AND name = ?',
      now,
      streamName,
      consumerName
    )

    return createRpcSuccess({ last_active_at: now }, id)
  }
}
