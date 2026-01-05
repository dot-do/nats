import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          durableObjects: {
            NATS_COORDINATOR: 'NatsCoordinator',
            NATS_PUBSUB: 'NatsPubSub',
            STREAM_DO: 'StreamDO',
          },
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
