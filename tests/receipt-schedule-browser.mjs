import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test, { after, before } from 'node:test';

// Pass the root of a local shared-host release with both exported applications.
const root = new URL(process.argv[2] ?? 'http://127.0.0.1:18232/');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(root.hostname));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const now = '2026-11-03T05:00:00.000Z';
const reference = 'TN-1234567890ABCDEF';
const requestKey = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff101';
const booked = {
  reference, status: 'CONFIRMED', version: 3, name: 'مهمان آزمایشی', staff: 'sonia', service: 'خدمات دست', treatment: 'ژلیش',
  date: '1405-08-14', period: '12-14', startsAt: '2026-11-05T08:30:00.000Z', endsAt: '2026-11-05T10:30:00.000Z',
  issuedAt: now, updatedAt: now,
};
const periods = ['10-12', '12-14', '14-16', '16-18'];
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE }); });
after(async () => { await browser?.close(); });

async function newPage(t) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'fa-IR', timezoneId: 'Asia/Tehran', reducedMotion: 'reduce' });
  t.after(() => page.close());
  page.setDefaultTimeout(4500);
  await page.clock.setFixedTime(new Date(now));
  return page;
}

async function openReceipt(t, current, change) {
  const page = await newPage(t);
  await page.addInitScript(({ reference, requestKey }) => {
    localStorage.setItem('tina-booking-receipt:v1:/tina-preview/:' + reference, JSON.stringify({ requestKey, savedAt: Date.now() }));
  }, { reference, requestKey });
  await page.route('**/api/options.php', route => route.fulfill({ json: { asOf: now, taken: [
    { staff: 'sonia', date: booked.date, period: booked.period },
    { staff: 'sonia', date: booked.date, period: '10-12' },
    { staff: 'tina', date: booked.date, period: '14-16' },
  ] } }));
  const writes = [];
  await page.route('**/api/receipt.php', route => {
    const body = route.request().postDataJSON();
    if (body.action) {
      writes.push(body);
      return change(route, body);
    }
    assert.deepEqual(body, { reference, requestKey });
    return route.fulfill({ json: { receipt: current() } });
  });
  await page.goto(new URL('/tina-preview/', root).href);
  await page.getByRole('article', { name: /رسید/ }).getByText(booked.name).waitFor();
  return { page, writes };
}

test('saved receipt keeps the original time until a same-artist move succeeds, and cancellation needs confirmation', async t => {
  let current = { ...booked };
  let pending;
  const { page, writes } = await openReceipt(t, () => current, (route, body) => {
    if (body.action === 'reschedule') { pending = route; return; }
    current = { ...current, status: 'CANCELLED', version: 5 };
    return route.fulfill({ json: { receipt: current } });
  });
  await page.getByRole('button', { name: 'تغییر زمان نوبت', exact: true }).click();
  await page.getByRole('combobox', { name: 'روز جدید', exact: true }).selectOption(booked.date);
  const times = page.getByRole('combobox', { name: 'ساعت جدید', exact: true });
  assert.deepEqual(await times.locator('option:not([disabled])').evaluateAll(options => options.map(o => o.value)), ['14-16', '16-18']);
  await times.selectOption('14-16');
  const submitted = page.waitForRequest(r => r.url().endsWith('/receipt.php') && r.postDataJSON()?.action === 'reschedule');
  await page.getByRole('button', { name: 'ثبت زمان جدید' }).click();
  await submitted;
  assert.equal(await page.locator('.ticket-time strong').innerText(), '۱۲ تا ۱۴');
  assert.deepEqual(writes, [{ reference, requestKey, action: 'reschedule', version: 3, date: booked.date, period: '14-16' }]);
  current = { ...current, period: '14-16', startsAt: '2026-11-05T10:30:00.000Z', endsAt: '2026-11-05T12:30:00.000Z', version: 4 };
  await pending.fulfill({ json: { receipt: current } });
  await page.locator('.ticket-time').getByText('۱۴ تا ۱۶').waitFor();
  await page.getByRole('button', { name: 'لغو نوبت', exact: true }).click();
  await page.getByRole('button', { name: 'بازگشت به رسید' }).click();
  assert.equal(writes.length, 1);
  await page.getByRole('button', { name: 'لغو نوبت', exact: true }).click();
  await page.getByRole('button', { name: 'بله، نوبتم را لغو کن' }).click();
  await page.getByRole('heading', { name: 'این نوبت لغو شده است.' }).waitFor();
  assert.deepEqual(writes[1], { reference, requestKey, action: 'cancel', version: 4 });
  assert.equal(await page.getByRole('button', { name: 'تغییر زمان نوبت', exact: true }).count(), 0);
  assert.ok(await page.getByRole('button', { name: /چاپ یا ذخیره/ }).isVisible());
});

for (const failure of ['STALE_BOOKING', 'SLOT_TAKEN', 'NETWORK']) {
  test('receipt rechecks the actual booking after ' + failure, async t => {
    let current = { ...booked };
    const { page, writes } = await openReceipt(t, () => current, route => {
      current = { ...current, status: failure === 'SLOT_TAKEN' ? 'CONFIRMED' : 'CANCELLED', version: 4, period: '16-18' };
      return failure === 'NETWORK' ? route.abort('failed') : route.fulfill({ status: 409, json: { code: failure } });
    });
    await page.getByRole('button', { name: 'تغییر زمان نوبت', exact: true }).click();
    await page.getByRole('combobox', { name: 'روز جدید', exact: true }).selectOption(booked.date);
    await page.getByRole('combobox', { name: 'ساعت جدید', exact: true }).selectOption('14-16');
    await page.getByRole('button', { name: 'ثبت زمان جدید' }).click();
    if (failure === 'SLOT_TAKEN') {
      await page.locator('.ticket-time').getByText('۱۶ تا ۱۸').waitFor();
      await page.getByRole('status').filter({ hasText: /دیگر آزاد نیست/ }).waitFor();
    } else {
      await page.getByRole('heading', { name: 'این نوبت لغو شده است.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'لغو نوبت', exact: true }).count(), 0);
    }
    assert.equal(writes.length, 1);
  });
}

for (const code of ['TARGET_STARTED', 'BOOKING_STARTED']) {
  test('a server-reported start applies to the correct slot: ' + code, async t => {
    const { page, writes } = await openReceipt(t, () => booked, route => route.fulfill({ status: 409, json: { code } }));
    const move = page.getByRole('button', { name: 'تغییر زمان نوبت', exact: true });
    await move.click();
    await page.getByRole('combobox', { name: 'روز جدید', exact: true }).selectOption('1405-08-12');
    await page.getByRole('combobox', { name: 'ساعت جدید', exact: true }).selectOption('10-12');
    await page.getByRole('button', { name: 'ثبت زمان جدید' }).click();
    if (code === 'TARGET_STARTED') {
      await page.getByRole('status').filter({ hasText: /ساعت انتخابی شروع شده/ }).waitFor();
      assert.ok(await move.isVisible());
      await move.click();
      await page.getByRole('combobox', { name: 'روز جدید', exact: true }).selectOption(booked.date);
      await page.getByRole('combobox', { name: 'ساعت جدید', exact: true }).selectOption('14-16');
      assert.ok(await page.getByRole('button', { name: 'ثبت زمان جدید' }).isEnabled());
    } else {
      await page.getByRole('status').filter({ hasText: /زمان شروع نوبت رسیده/ }).waitFor();
      assert.equal(await move.count(), 0);
      assert.equal(await page.getByRole('button', { name: 'لغو نوبت', exact: true }).count(), 0);
    }
    assert.equal(writes.length, 1);
  });
}

test('past, unversioned and preview receipts stay read-only', async t => {
  let current = { ...booked, startsAt: '2026-11-03T04:59:59.000Z' };
  const { page } = await openReceipt(t, () => current, () => assert.fail('unexpected mutation'));
  const edit = page.getByRole('button', { name: 'تغییر زمان نوبت', exact: true });
  assert.equal(await edit.count(), 0);
  current = { ...booked, version: undefined };
  await page.getByRole('button', { name: /رسیدهای من/ }).click();
  await page.getByRole('article', { name: /رسید/ }).getByText(booked.name).waitFor();
  assert.equal(await edit.count(), 0);
  await page.goto(new URL('/tina-preview/receipt-preview/', root).href);
  await page.getByRole('article', { name: 'نمونهٔ رسید نوبت' }).waitFor();
  assert.equal(await edit.count(), 0);
});

test('the open receipt stays visible while checking the editing version, and dismissing returns keyboard focus', async t => {
  const { page } = await openReceipt(t, () => booked, () => assert.fail('unexpected mutation'));
  let hold;
  const waiting = new Promise(resolve => { hold = resolve; });
  await page.route('**/api/receipt.php', route => { hold(route); }, { times: 1 });
  const trigger = page.getByRole('button', { name: 'لغو نوبت', exact: true });
  await trigger.click();
  const lookup = await waiting;
  assert.ok(await page.locator('.appointment-ticket').isVisible());
  await lookup.fulfill({ json: { receipt: { ...booked, version: 7 } } });
  await page.getByRole('button', { name: 'بازگشت به رسید' }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === 'لغو نوبت');
});

function allOpen(staff) {
  return { staff, version: 1, week: Array.from({ length: 7 }, () => [...periods]), daysOff: [] };
}

async function openAdmin(t, handle) {
  const page = await newPage(t);
  await page.route('**/tina-administrator/api.php?**', route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('action') === 'status') return route.fulfill({ json: { configured: true, authenticated: true, username: 'sonia', csrf: 'test-token', now } });
    if (params.get('action') === 'metrics') return route.fulfill({ json: { days: 30, starts: 0, selections: 0, receipts: 0, medianMs: null } });
    return handle(route, params.get('action'), params);
  });
  await page.goto(new URL('/tina-administrator/', root).href);
  return page;
}

test('weekly periods and leave persist for the selected artist and calendar closures respect their source', async t => {
  const schedules = { tina: allOpen('tina'), sonia: allOpen('sonia') };
  const writes = [];
  const day = '1405-08-12';
  const page = await openAdmin(t, (route, action, params) => {
    const staff = params.get('staff');
    if (action === 'month') return route.fulfill({ json: { month: params.get('month'), staff, appointments: [], blocks: [
      { date: day, staff, period: '10-12', source: 'schedule' }, { date: day, staff, period: '12-14' },
    ] } });
    if (action === 'schedule') return route.fulfill({ json: schedules[staff] });
    assert.equal(action, 'saveSchedule');
    const body = route.request().postDataJSON();
    assert.equal(route.request().headers()['x-csrf-token'], 'test-token');
    writes.push(body);
    schedules[body.staff] = { ...body, version: body.version + 1 };
    return route.fulfill({ json: schedules[body.staff] });
  });
  const schedule = page.getByRole('region', { name: 'ساعت کاری و مرخصی سونیا' });
  const saturday = schedule.getByRole('checkbox', { name: 'شنبه، ساعت ۱۰ تا ۱۲', exact: true });
  await saturday.waitFor();
  assert.equal(await schedule.getByRole('checkbox', { checked: true }).count(), 28);
  assert.equal(await page.locator('.admin-slot').nth(0).getByRole('button', { name: 'باز کردن این ساعت' }).count(), 0);
  assert.ok(await page.locator('.admin-slot').nth(1).getByRole('button', { name: 'باز کردن این ساعت' }).isVisible());
  await saturday.uncheck();
  const leave = schedule.getByRole('group', { name: 'تاریخ مرخصی' });
  await leave.getByRole('combobox', { name: 'روز', exact: true }).selectOption('14');
  await schedule.getByRole('button', { name: 'افزودن روز مرخصی' }).click();
  await schedule.getByRole('button', { name: 'ذخیرهٔ برنامه' }).click();
  await schedule.getByRole('status').filter({ hasText: /ذخیره شد/ }).waitFor();
  assert.deepEqual(writes[0], { staff: 'sonia', version: 1, week: [periods.slice(1), ...Array.from({ length: 6 }, () => periods)], daysOff: ['1405-08-14'] });
  await page.locator('.admin-day-panel[aria-busy="false"]').waitFor();
  await page.locator('.staff-option').getByText('تینا', { exact: true }).click();
  assert.ok(await page.getByRole('region', { name: 'ساعت کاری و مرخصی تینا' }).getByRole('checkbox', { name: 'شنبه، ساعت ۱۰ تا ۱۲', exact: true }).isChecked());
  await page.locator('.admin-day-panel[aria-busy="false"]').waitFor();
  await page.locator('.staff-option').getByText('سونیا', { exact: true }).click();
  assert.equal(await saturday.isChecked(), false);
  await schedule.getByRole('button', { name: /حذف مرخصی.*۱۴ آبان/ }).click();
  await schedule.getByRole('button', { name: 'ذخیرهٔ برنامه' }).click();
  await schedule.getByRole('status').filter({ hasText: /ذخیره شد/ }).waitFor();
  assert.deepEqual(writes[1].daysOff, []);
  assert.equal(writes[1].version, 2);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test('the schedule conflict keeps the draft and takes the artist to the booked day and reference', async t => {
  const appointment = { ...booked, status: 'CONFIRMED', date: '1405-08-14', phone: '09000000000', service: 'manicure', manicureType: 'gel', note: '' };
  const page = await openAdmin(t, (route, action, params) => {
    if (action === 'month') return route.fulfill({ json: { month: params.get('month'), staff: params.get('staff'), appointments: [appointment], blocks: [] } });
    if (action === 'schedule') return route.fulfill({ json: allOpen(params.get('staff')) });
    return route.fulfill({ status: 409, json: { code: 'SCHEDULE_CONFLICT', message: 'این نوبت با برنامه تداخل دارد.', conflicts: [{ reference, date: appointment.date, period: appointment.period }] } });
  });
  const schedule = page.getByRole('region', { name: 'ساعت کاری و مرخصی سونیا' });
  const thursday = schedule.getByRole('checkbox', { name: 'پنجشنبه، ساعت ۱۲ تا ۱۴', exact: true });
  await thursday.uncheck();
  await schedule.getByRole('button', { name: 'ذخیرهٔ برنامه' }).click();
  const conflict = schedule.getByRole('button', { name: new RegExp(reference) });
  await conflict.waitFor();
  assert.equal(await thursday.isChecked(), false);
  await conflict.click();
  await page.waitForFunction(ref => document.activeElement?.id === 'admin-row-' + ref, reference);
  assert.equal(await page.getByRole('heading', { name: '۱۴ آبان ۱۴۰۵', exact: true }).count(), 1);
});

test('a stale schedule cannot overwrite another edit, and a late save stays with its original artist', async t => {
  const schedules = { tina: allOpen('tina'), sonia: allOpen('sonia') };
  let attempts = 0;
  let releaseSave;
  const arrived = new Promise(resolve => { releaseSave = resolve; });
  const page = await openAdmin(t, (route, action, params) => {
    if (action === 'month') return route.fulfill({ json: { month: params.get('month'), staff: params.get('staff'), appointments: [], blocks: [] } });
    if (action === 'schedule') return route.fulfill({ json: schedules[params.get('staff')] });
    const body = route.request().postDataJSON();
    if (++attempts === 1) {
      schedules.sonia = { ...schedules.sonia, version: 2, daysOff: ['1406-01-01'] };
      return route.fulfill({ status: 409, json: { code: 'STALE_SCHEDULE' } });
    }
    assert.equal(body.version, 2);
    schedules[body.staff] = { ...body, version: 3 };
    releaseSave(route);
  });
  const schedule = page.getByRole('region', { name: 'ساعت کاری و مرخصی سونیا' });
  const saturday = schedule.getByRole('checkbox', { name: 'شنبه، ساعت ۱۰ تا ۱۲', exact: true });
  const save = schedule.getByRole('button', { name: 'ذخیرهٔ برنامه' });
  await saturday.uncheck();
  await save.click();
  await schedule.getByRole('button', { name: 'دریافت آخرین برنامه' }).waitFor();
  assert.ok(await save.isDisabled());
  assert.equal(await page.locator('.admin-slot').count(), 4);
  await schedule.getByRole('button', { name: 'دریافت آخرین برنامه' }).click();
  await schedule.getByRole('button', { name: /حذف مرخصی.*۱ فروردین/ }).waitFor();
  assert.ok(await saturday.isChecked());
  await saturday.uncheck();
  await save.click();
  const pending = await arrived;
  await page.locator('.staff-option').getByText('تینا', { exact: true }).click();
  const tina = page.getByRole('region', { name: 'ساعت کاری و مرخصی تینا' });
  await tina.getByRole('checkbox').first().waitFor();
  await pending.fulfill({ json: schedules.sonia });
  assert.equal(await tina.getByRole('checkbox', { checked: true }).count(), 28);
  assert.equal(await tina.getByRole('button', { name: /حذف مرخصی/ }).count(), 0);
  await page.locator('.staff-option').getByText('سونیا', { exact: true }).click();
  await schedule.getByRole('button', { name: /حذف مرخصی.*۱ فروردین/ }).waitFor();
  assert.equal(await saturday.isChecked(), false);
});
