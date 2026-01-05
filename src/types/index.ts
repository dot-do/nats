/**
 * Type exports for NatDO
 */

// NATS Core types
export {
  type ConnectionOptions,
  type MsgHdrs,
  type Msg,
  type PublishOptions,
  type SubscriptionOptions,
  type RequestOptions,
  type Subscription,
  type QueuedIterator,
  type StatusType,
  type Status,
  type ServerInfo,
  type NatsConnection,
  type Codec,
  createHeaders,
  StringCodec,
  JSONCodec,
  Empty,
} from './nats'

// JetStream types
export {
  type RetentionPolicy,
  type StorageType,
  type DiscardPolicy,
  type AckPolicy,
  type DeliverPolicy,
  type ReplayPolicy,
  type StreamConfig,
  type StreamInfo,
  type StreamState,
  type ConsumerConfig,
  type ConsumerInfo,
  type SequencePair,
  type PubAck,
  type JsMsgInfo,
  type JsMsg,
  type PullOptions,
  type ConsumeOptions,
  type ConsumerMessages,
  type Stream,
  type StoredMsg,
  type Consumer,
  type PurgeResponse,
  type StreamsAPI,
  type ConsumersAPI,
  type JetStreamManager,
  type ConsumersAccessor,
  type StreamsAccessor,
  type JetStreamPublishOptions,
  type JetStreamClient,
  defaultStreamConfig,
  defaultConsumerConfig,
} from './jetstream'

// RPC types
export {
  type RpcId,
  type RpcRequest,
  type RpcNotification,
  type RpcError,
  type RpcResponse,
  type RpcBatchRequest,
  type RpcBatchResponse,
  RPC_ERROR_CODES,
  isRpcError,
  isRpcSuccess,
  createRpcRequest,
  createRpcError,
  createRpcSuccess,
  resetRequestIdCounter,
} from './rpc'
