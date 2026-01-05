/**
 * Cloudflare Workers Environment Type
 *
 * Defines the environment bindings for the NatDO worker,
 * including Durable Object namespace bindings.
 */

/**
 * Environment interface for NatDO worker.
 * Contains bindings for Durable Objects used in the application.
 */
export interface Env {
  /**
   * Durable Object namespace for NATS coordination.
   * Manages consumer registry with SQLite storage.
   */
  NATS_COORDINATOR: DurableObjectNamespace

  /**
   * Durable Object namespace for NATS publish/subscribe operations.
   */
  NATS_PUBSUB: DurableObjectNamespace

  /**
   * Durable Object namespace for stream-specific operations.
   * Each stream gets its own instance for fetching and acking messages.
   */
  STREAM_DO: DurableObjectNamespace
}
