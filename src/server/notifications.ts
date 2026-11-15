import { receiptFor, type ReceiptRecord } from '../features/booking/receipt-model';
import { readableDay } from '../lib/jalali';
import { normalizeMobile, requestMessage, type BookingRequest } from '../features/booking/model';
import { periods } from '../content/salon';

type Config = Record<string, string | undefined>;
type NotificationEvent = { channel: string; request: ReceiptRecord & { phone: string; note: string } };
const e164 = (phone: string) => { const mobile = normalizeMobile(phone); if (!/^09\d{9}$/.test(mobile)) throw new Error('INVALID_NOTIFICATION_RECIPIENT'); return `+98${mobile.slice(1)}`; };

export function configuredChannels(env: Config) {
  const channels: string[] = [];
  if (env.IPPANEL_API_KEY && env.IPPANEL_FROM_NUMBER) {
    if (env.SMS_USER_PATTERN) channels.push('SMS_USER');
    if (env.SMS_ADMIN_PATTERN && env.ADMIN_PHONE) channels.push('SMS_ADMIN');
  }
  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && /^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION ?? '') && env.WHATSAPP_ADMIN_TEMPLATE && env.WHATSAPP_TEMPLATE_LANGUAGE && env.ADMIN_PHONE) channels.push('WHATSAPP_ADMIN');
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) channels.push('TELEGRAM');
  return channels;
}

export async function sendNotification(event: NotificationEvent, env: Config = process.env, transport: typeof fetch = fetch): Promise<string> {
  if (!configuredChannels(env).includes(event.channel)) throw new Error('CHANNEL_NOT_CONFIGURED');
  if (event.channel === 'TELEGRAM') {
    const record = event.request;
    const request: BookingRequest = { name: record.name, phone: record.phone, service: record.service as BookingRequest['service'], manicureType: (record.manicureType ?? '') as BookingRequest['manicureType'], date: record.jalaliDay, period: record.period as BookingRequest['period'], note: record.note, consent: true };
    const response = await transport(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `اطلاع نوبت تینا\nکد: ${record.reference}\n${requestMessage(request)}` }) });
    const body = await response.json();
    if (!response.ok || !body.ok || !body.result?.message_id) throw new Error('TELEGRAM_DELIVERY_FAILED');
    return String(body.result.message_id);
  }
  const receipt = receiptFor(event.request);
  const params = { name: receipt.name, service: `${receipt.service}${receipt.treatment ? ` / ${receipt.treatment}` : ''}`, date: readableDay(receipt.date), time: periods.find(item => item.id === receipt.period)!.label, reference: receipt.reference };
  if (event.channel === 'SMS_USER' || event.channel === 'SMS_ADMIN') {
    const response = await transport('https://edge.ippanel.com/v1/api/send', {
      method: 'POST', headers: { Authorization: env.IPPANEL_API_KEY!, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ sending_type: 'pattern', from_number: env.IPPANEL_FROM_NUMBER, code: event.channel === 'SMS_USER' ? env.SMS_USER_PATTERN : env.SMS_ADMIN_PATTERN, recipients: [e164(event.channel === 'SMS_USER' ? event.request.phone : env.ADMIN_PHONE!)], params }),
    });
    const body = await response.json();
    if (!response.ok || body.meta?.status !== true || !body.data?.message_outbox_ids?.length) throw new Error('SMS_DELIVERY_FAILED');
    return String(body.data.message_outbox_ids[0]);
  }
  if (event.channel === 'WHATSAPP_ADMIN') {
    if (!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID!)) throw new Error('INVALID_WHATSAPP_PHONE_ID');
    const response = await transport(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to: e164(env.ADMIN_PHONE!).slice(1), type: 'template', template: { name: env.WHATSAPP_ADMIN_TEMPLATE, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE }, components: [{ type: 'body', parameters: [...Object.values(params), e164(event.request.phone)].map(text => ({ type: 'text', text })) }] } }),
    });
    const body = await response.json();
    if (!response.ok || !body.messages?.[0]?.id) throw new Error('WHATSAPP_DELIVERY_FAILED');
    return body.messages[0].id;
  }
  throw new Error('UNSUPPORTED_CHANNEL');
}
