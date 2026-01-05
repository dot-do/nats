/**
 * NatDO - NATS/JetStream on Cloudflare Durable Objects
 *
 * This is the main entry point for the worker.
 */

export { NatsCoordinator } from './durable-objects/nats-coordinator'

export default {
  async fetch(_request: Request, _env: unknown): Promise<Response> {
    return new Response('NatDO - Not yet implemented', { status: 501 })
  },
}
