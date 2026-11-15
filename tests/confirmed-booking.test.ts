import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { slotTimes, receiptFor, receiptSchema } from '../src/features/booking/receipt-model';
import { sendNotification, configuredChannels } from '../src/server/notifications';

test('a Jalali appointment becomes exactly two hours in Tehran time', () => {
  const slot = slotTimes('1405-08-14', '12-14');
  assert.equal(slot.startsAt.toISOString(), '2026-11-05T08:30:00.000Z');
  assert.equal(slot.endsAt.getTime() - slot.startsAt.getTime(), 2 * 3600000);
  assert.throws(() => slotTimes('1405-08-14', 'night'));
});

const record = { reference: 'TN-1234567890ABCDEF', status: 'CONFIRMED', name: 'مهمان آزمایشی', service: 'manicure', manicureType: 'gel', jalaliDay: '1405-08-14', period: '12-14', createdAt: new Date('2026-11-04T08:00:00Z') };

test('only a confirmed database record produces a final receipt', () => {
  const receipt = receiptFor(record);
  assert.equal(receipt.status, 'CONFIRMED');
  assert.equal(receipt.date, '1405-08-14');
  assert.equal(receipt.treatment, 'ژلیش');
  assert.equal(receiptSchema.safeParse(receipt).success, true);
  assert.throws(() => receiptFor({ ...record, status: 'PENDING' }));
  assert.equal(receiptSchema.safeParse({ ...receipt, status: 'PENDING' }).success, false);
});

test('missing providers are not treated as configured or delivered', () => {
  assert.deepEqual(configuredChannels({}), []);
  assert.deepEqual(configuredChannels({ IPPANEL_API_KEY: 'test', IPPANEL_FROM_NUMBER: '+9830000', SMS_USER_PATTERN: 'guest' }), ['SMS_USER']);
});

test('guest SMS and manager SMS use separate recipients and approved patterns', async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const transport = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ meta: { status: true }, data: { message_outbox_ids: [42] } }), { status: 200 });
  };
  const env = { IPPANEL_API_KEY: 'test-not-a-real-key', IPPANEL_FROM_NUMBER: '+9830000', SMS_USER_PATTERN: 'guest', SMS_ADMIN_PATTERN: 'manager', ADMIN_PHONE: '09353155852' };
  const event = { channel: 'SMS_USER', request: { ...record, phone: '09120000000', note: '' } };
  assert.equal(await sendNotification(event, env, transport), '42');
  await sendNotification({ ...event, channel: 'SMS_ADMIN' }, env, transport);
  assert.equal(calls[0].url, 'https://edge.ippanel.com/v1/api/send');
  assert.deepEqual(calls[0].body.recipients, ['+989120000000']);
  assert.deepEqual(calls[1].body.recipients, ['+989353155852']);
  assert.equal(calls[0].body.code, 'guest');
  assert.equal(calls[1].body.code, 'manager');
  assert.equal(calls[0].body.params.reference, record.reference);
  assert.equal(calls[0].body.phonebook, undefined);
});

test('provider failure throws rather than marking a queued message sent', async () => {
  const env = { IPPANEL_API_KEY: 'test', IPPANEL_FROM_NUMBER: '+9830000', SMS_USER_PATTERN: 'guest' };
  await assert.rejects(sendNotification({ channel: 'SMS_USER', request: { ...record, phone: '09120000000', note: '' } }, env, async () => new Response(JSON.stringify({ meta: { status: false } }), { status: 200 })), /DELIVERY_FAILED/);
});

test('WhatsApp manager notification is a backend template without a customer handoff', async () => {
  let sent: any;
  const env = { WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_API_VERSION: 'v99.0', WHATSAPP_ADMIN_TEMPLATE: 'appointment', WHATSAPP_TEMPLATE_LANGUAGE: 'en_US', ADMIN_PHONE: '09353155852' };
  const id = await sendNotification({ channel: 'WHATSAPP_ADMIN', request: { ...record, phone: '09120000000', note: '' } }, env, async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 });
  });
  assert.equal(id, 'wamid.test');
  assert.equal(sent.to, '989353155852');
  assert.equal(sent.type, 'template');
  assert.equal(sent.template.name, 'appointment');
});
