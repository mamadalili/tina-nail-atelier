import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { getDb } from './db';
import { requestMessage, type BookingRequest } from '../features/booking/model';

const redisUrl = process.env.REDIS_URL;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!redisUrl || !telegramToken || !chatId || !process.env.DATABASE_URL) {
  throw new Error('Notification worker needs configured database, Redis and Telegram credentials.');
}

const redis = new URL(redisUrl);
const connection = { host: redis.hostname, port: Number(redis.port || 6379), password: redis.password ? decodeURIComponent(redis.password) : undefined, ...(redis.protocol === 'rediss:' ? { tls: {} } : {}) };
const queue = new Queue('tina-notifications', { connection });
const db = getDb();

const worker = new Worker('tina-notifications', async job => {
  const event = await db.outboxEvent.findUnique({ where: { id: job.data.eventId }, include: { request: true } });
  if (!event || event.sentAt) return;
  if (event.channel !== 'TELEGRAM') throw new Error('UNSUPPORTED_CHANNEL');
  const request: BookingRequest = { name: event.request.name, phone: event.request.phone, service: event.request.service as BookingRequest['service'], manicureType: (event.request.manicureType ?? '') as BookingRequest['manicureType'], date: event.request.jalaliDay, period: event.request.period as BookingRequest['period'], note: event.request.note, consent: true };
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ chat_id: chatId, text: `درخواست جدید سایت تینا\nکد: ${event.request.id.slice(0, 8).toUpperCase()}\n${requestMessage(request)}` })
    });
  } catch { throw new Error('TELEGRAM_CONNECTION_FAILED'); }
  const body = await response.json() as { ok?: boolean };
  if (!response.ok || !body.ok) throw new Error('TELEGRAM_DELIVERY_FAILED');
  await db.outboxEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } });
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
    const events = await db.outboxEvent.findMany({ where: { sentAt: null, channel: 'TELEGRAM', retryAt: { lte: new Date() } }, take: 50, orderBy: { createdAt: 'asc' } });
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
