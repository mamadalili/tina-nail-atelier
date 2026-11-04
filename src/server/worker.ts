import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { getDb } from './db';
import { configuredChannels, sendNotification } from './notifications';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl || !process.env.DATABASE_URL) {
  throw new Error('Notification worker needs a configured database and Redis.');
}

const redis = new URL(redisUrl);
const connection = { host: redis.hostname, port: Number(redis.port || 6379), password: redis.password ? decodeURIComponent(redis.password) : undefined, ...(redis.protocol === 'rediss:' ? { tls: {} } : {}) };
const queue = new Queue('tina-notifications', { connection });
const db = getDb();

const worker = new Worker('tina-notifications', async job => {
  const event = await db.outboxEvent.findUnique({ where: { id: job.data.eventId }, include: { request: true } });
  if (!event || event.sentAt || event.skippedAt) return;
  if (event.kind === 'CONFIRMED' && event.request.status !== 'CONFIRMED') {
    await db.outboxEvent.update({ where: { id: event.id }, data: { skippedAt: new Date() } });
    return;
  }
  const providerMessageId = await sendNotification(event);
  await db.outboxEvent.update({ where: { id: event.id }, data: { sentAt: new Date(), providerMessageId } });
}, { connection, concurrency: 2 });

worker.on('failed', (job) => {
  if (!job) return;
  void db.outboxEvent.update({ where: { id: job.data.eventId }, data: { attempts: { increment: 1 }, retryAt: new Date(Date.now() + 3600000) } }).catch(() => { console.error('Could not update outbox delivery status.'); });
  console.error('Notification delivery failed; queued retry applies.');
});
worker.on('error', () => console.error('Notification worker connection failed.'));

let dispatching = false;
async function dispatch() {
  if (dispatching) return;
  dispatching = true;
  try {
    const channels = configuredChannels(process.env);
    if (!channels.length) return;
    const events = await db.outboxEvent.findMany({ where: { sentAt: null, skippedAt: null, channel: { in: channels }, retryAt: { lte: new Date() } }, take: 50, orderBy: { createdAt: 'asc' } });
    for (const event of events) {
      const previous = await queue.getJob(event.id);
      if (previous && await previous.getState() === 'failed') { await previous.retry(); continue; }
      await queue.add('send', { eventId: event.id }, { jobId: event.id, attempts: 5, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: 500, removeOnFail: false });
    }
  } catch { console.error('Could not dispatch pending notifications.'); }
  finally { dispatching = false; }
}

await dispatch();
const timer = setInterval(() => void dispatch(), 15000);
async function shutdown() { clearInterval(timer); await worker.close(); await queue.close(); await db.$disconnect(); process.exit(0); }
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
