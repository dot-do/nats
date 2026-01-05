/**
 * NatsAccess Adapter
 *
 * Bridges MCP tools to Durable Object operations.
 * Routes operations to the appropriate Durable Objects:
 * - NATS_PUBSUB: for publish/subscribe operations
 * - NATS_COORDINATOR: for stream and consumer management
 * - STREAM_DO: for stream-specific operations (fetching, acking)
 */

import type { StreamConfig, StreamInfo, ConsumerConfig, ConsumerInfo, PubAck, JsMsg, PullOptions } from '../types/jetstream'
import type { PublishOptions } from '../types/nats'
import type { Env } from '../types/env'

/**
 * Interface for the NatsPubSub Durable Object stub
 */
interface NatsPubSubStub {
  publish(subject: string, data: Uint8Array, opts?: PublishOptions): Promise<PubAck>
}

/**
 * Interface for the NatsCoordinator Durable Object stub
 */
interface NatsCoordinatorStub {
  createStream(config: StreamConfig): Promise<StreamInfo>
  deleteStream(name: string): Promise<boolean>
  getStreamInfo(name: string): Promise<StreamInfo>
  createConsumer(stream: string, config: ConsumerConfig): Promise<ConsumerInfo>
}

/**
 * Interface for the StreamDO Durable Object stub
 */
interface StreamDOStub {
  fetchMessages(consumer: string, opts?: PullOptions): Promise<JsMsg[]>
  ackMessage(consumer: string, seq: number): Promise<boolean>
}

/**
 * NatsAccess adapter class that bridges MCP tools to Durable Object operations.
 */
export class NatsAccess {
  constructor(private env: Env) {}

  /**
   * Publishes a message to a subject via the NatsPubSub Durable Object.
   *
   * @param subject - The subject to publish to
   * @param data - The message data
   * @param opts - Optional publish options
   * @returns The publish acknowledgment
   */
  async publish(subject: string, data: Uint8Array, opts?: PublishOptions): Promise<PubAck> {
    const id = this.env.NATS_PUBSUB.idFromName('global')
    const stub = this.env.NATS_PUBSUB.get(id) as unknown as NatsPubSubStub
    return stub.publish(subject, data, opts)
  }

  /**
   * Creates a new stream via the NatsCoordinator Durable Object.
   *
   * @param config - The stream configuration
   * @returns The created stream info
   */
  async createStream(config: StreamConfig): Promise<StreamInfo> {
    const id = this.env.NATS_COORDINATOR.idFromName('global')
    const stub = this.env.NATS_COORDINATOR.get(id) as unknown as NatsCoordinatorStub
    return stub.createStream(config)
  }

  /**
   * Deletes a stream via the NatsCoordinator Durable Object.
   *
   * @param name - The name of the stream to delete
   * @returns True if the stream was deleted
   */
  async deleteStream(name: string): Promise<boolean> {
    const id = this.env.NATS_COORDINATOR.idFromName('global')
    const stub = this.env.NATS_COORDINATOR.get(id) as unknown as NatsCoordinatorStub
    return stub.deleteStream(name)
  }

  /**
   * Gets information about a stream via the NatsCoordinator Durable Object.
   *
   * @param name - The name of the stream
   * @returns The stream info
   */
  async getStreamInfo(name: string): Promise<StreamInfo> {
    const id = this.env.NATS_COORDINATOR.idFromName('global')
    const stub = this.env.NATS_COORDINATOR.get(id) as unknown as NatsCoordinatorStub
    return stub.getStreamInfo(name)
  }

  /**
   * Creates a consumer on a stream via the NatsCoordinator Durable Object.
   *
   * @param stream - The name of the stream
   * @param config - The consumer configuration
   * @returns The created consumer info
   */
  async createConsumer(stream: string, config: ConsumerConfig): Promise<ConsumerInfo> {
    const id = this.env.NATS_COORDINATOR.idFromName('global')
    const stub = this.env.NATS_COORDINATOR.get(id) as unknown as NatsCoordinatorStub
    return stub.createConsumer(stream, config)
  }

  /**
   * Fetches messages from a stream's consumer via the StreamDO Durable Object.
   * Routes to the specific stream's Durable Object instance.
   *
   * @param stream - The name of the stream
   * @param consumer - The name of the consumer
   * @param opts - Optional fetch options
   * @returns Array of messages
   */
  async fetchMessages(stream: string, consumer: string, opts?: PullOptions): Promise<JsMsg[]> {
    const id = this.env.STREAM_DO.idFromName(stream)
    const stub = this.env.STREAM_DO.get(id) as unknown as StreamDOStub
    return stub.fetchMessages(consumer, opts)
  }

  /**
   * Acknowledges a message via the StreamDO Durable Object.
   * Routes to the specific stream's Durable Object instance.
   *
   * @param stream - The name of the stream
   * @param consumer - The name of the consumer
   * @param seq - The sequence number of the message to acknowledge
   * @returns True if the message was acknowledged
   */
  async ackMessage(stream: string, consumer: string, seq: number): Promise<boolean> {
    const id = this.env.STREAM_DO.idFromName(stream)
    const stub = this.env.STREAM_DO.get(id) as unknown as StreamDOStub
    return stub.ackMessage(consumer, seq)
  }
}
