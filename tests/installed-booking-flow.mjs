import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = new URL(process.argv[2]).origin;
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Use a disposable local release');
const api = origin + '/tina-preview/api/';
const password = process.env.SALON_TEST_PASSWORD;
assert.ok(password);
const source = process.env.SALON_TEST_SHA;
assert.match(source, /^[a-f0-9]{40}$/);
const jsonHeaders = { 'Content-Type': 'application/json', Origin: origin };
const call = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, body: await response.json(), headers: response.headers };
};
let csrf;
let cookie = '';
async function admin(action, payload) {
  const response = await call(origin + '/tina-administrator/api.php?action=' + action, {
    method: payload ? 'POST' : 'GET', headers: { ...jsonHeaders, Cookie: cookie, 'X-CSRF-Token': csrf ?? '' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const session = response.headers.getSetCookie()[0];
  if (session) cookie = session.split(';')[0];
  if (response.body.csrf) csrf = response.body.csrf;
  return response;
}

function dayAfter(count) {
  const date = new Date(Date.now() + count * 86400000);
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day'].map(k => parts.find(part => part.type === k).value).join('-');
}

const date = dayAfter(20);
const tomorrow = dayAfter(21);
const firstPeriod = '10-12';
const newPeriod = '12-14';
async function reserve(staff, day, period) {
  const requestKey = randomUUID();
  const result = await call(api + 'booking.php', { method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': requestKey },
    body: JSON.stringify({ service: 'pedicure', date: day, period, staff, name: 'مهمان آزمایش محلی',
      phone: '09000000000', consent: true, note: '' }),
  });
  return { ...result, proof: { requestKey, reference: result.body.receipt?.reference } };
}
const readOrChange = (proof, input = {}) => call(api + 'receipt.php', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ ...proof, ...input }) });
const taken = async (staff, day) => (await call(api + 'booking.php?staff=' + staff + '&date=' + day)).body.taken;

const status = await admin('status');
assert.equal(status.status, 200);
assert.equal(status.headers.get('x-tina-api-source'), source);
const health = await call(api + 'booking.php?action=health');
assert.equal(health.headers.get('x-tina-store-source'), source);
assert.equal(health.headers.get('x-tina-api-source'), source);
const receiptEndpoint = await fetch(api + 'receipt.php', { method: 'HEAD' });
assert.equal(receiptEndpoint.status, 204);
assert.equal(receiptEndpoint.headers.get('x-tina-api-source'), source);
assert.equal((await call(api + 'options.php')).headers.get('x-tina-api-source'), source);
assert.equal((await admin('login', { username: 'sonia', password })).body.username, 'sonia');
const initial = await admin('schedule&staff=tina');
assert.equal(initial.status, 200);
const schedule = initial.body;
assert.ok(schedule.week.length === 7 && schedule.week.every(periods => periods.length === 4));

const [tina, sonia] = await Promise.all([reserve('tina', date, firstPeriod), reserve('sonia', date, firstPeriod)]);
assert.equal(tina.status, 201);
assert.equal(sonia.status, 201);
const booked = (await readOrChange(tina.proof)).body.receipt;
assert.ok(booked.version >= 1);
const wrongKey = await readOrChange({ ...tina.proof, requestKey: sonia.proof.requestKey }, { action: 'cancel', version: booked.version });
assert.equal(wrongKey.status, 404);

const conflict = await admin('saveSchedule', { ...schedule, daysOff: [date] });
assert.equal(conflict.status, 409);
assert.equal(conflict.body.code, 'SCHEDULE_CONFLICT');
assert.ok(conflict.body.conflicts.some(a => a.reference === tina.proof.reference));
const saved = await admin('saveSchedule', { ...schedule, daysOff: [tomorrow] });
assert.equal(saved.status, 200);
assert.equal((await taken('tina', tomorrow)).length, 4);
assert.equal((await taken('sonia', tomorrow)).length, 0);
const closed = await readOrChange(tina.proof, { action: 'reschedule', date: tomorrow, period: newPeriod, version: booked.version });
assert.equal(closed.status, 409);
assert.equal(closed.body.code, 'SLOT_TAKEN');
assert.ok((await taken('tina', date)).includes(firstPeriod));
const move = { action: 'reschedule', date, period: newPeriod, version: booked.version };
const [moved, retry] = await Promise.all([readOrChange(tina.proof, move), readOrChange(tina.proof, move)]);
assert.equal(moved.status, 200);
assert.equal(retry.status, 200);
assert.equal(moved.body.receipt.version, retry.body.receipt.version);
assert.equal(moved.body.receipt.period, newPeriod);
assert.deepEqual(await taken('tina', date), [newPeriod]);
assert.deepEqual(await taken('sonia', date), [firstPeriod]);
const search = await admin('search', { reference: tina.proof.reference });
assert.equal(search.status, 200);
assert.equal(search.body.appointment.period, newPeriod);
const stale = await readOrChange(tina.proof, { action: 'cancel', version: booked.version });
assert.equal(stale.status, 409);
const cancelled = await readOrChange(tina.proof, { action: 'cancel', version: moved.body.receipt.version });
assert.equal(cancelled.body.receipt.status, 'CANCELLED');
assert.deepEqual(await taken('tina', date), []);
assert.deepEqual(await taken('sonia', date), [firstPeriod]);
assert.equal((await readOrChange(tina.proof)).body.receipt.status, 'CANCELLED');
assert.equal((await admin('saveSchedule', { ...saved.body, daysOff: [] })).status, 200);
assert.equal((await taken('tina', tomorrow)).length, 0);
assert.equal((await admin('logout', {})).status, 200);
console.log('PASS installed release: private receipts, independent calendars, protected leave, simultaneous retries, lookup, reschedule, cancellation and released slots');
