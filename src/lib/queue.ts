import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
})

export function createQueue<T>(name: string) {
  return new Queue<T>(name, { connection })
}

export function createWorker<T>(
  name: string,
  processor: (job: { data: T }) => Promise<void>
) {
  return new Worker(name, processor, { connection })
}