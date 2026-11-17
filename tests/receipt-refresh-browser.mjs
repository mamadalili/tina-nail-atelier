import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Run with a local preview, Playwright, and its Chromium browser.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:18220/');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
const reference = 'TN-1234567890ABCDEF';
const requestKey = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff101';
const initial = {
  reference, status: 'CONFIRMED', name: 'مهمان آزمایشی', staff: 'tina', service: 'خدمات دست', treatment: '',
  date: '1405-08-14', period: '12-14', startsAt: '2026-11-05T08:30:00Z', endsAt: '2026-11-05T10:30:00Z',
  issuedAt: '2026-11-04T08:00:00Z', updatedAt: '2026-11-04T08:00:00Z',
};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran' });
  page.setDefaultTimeout(5000);
  const prefix = base.pathname.replace(/\/$/, '');
  await page.addInitScript(({ key, requestKey }) => {
    localStorage.setItem(key, JSON.stringify({ requestKey, savedAt: Date.now() }));
  }, { key: `tina-booking-receipt:v1:${prefix}/:${reference}`, requestKey });
  let current = { ...initial };
  let status = 200;
  let downloads = 0;
  page.on('download', () => { downloads++; });
  const endpoint = /\/api\/receipt(?:\.php)?$/;
  await page.route(endpoint, route => {
    assert.equal(route.request().method(), 'POST');
    assert.deepEqual(route.request().postDataJSON(), { reference, requestKey });
    return route.fulfill({ status, json: status === 200 ? { receipt: current } : {} });
  });
  await page.goto(base.href);
  await page.locator('.appointment-ticket').getByText(initial.name).waitFor();

  // Keep the same page, selected reference and browser focus for every change.
  const reopen = () => page.getByRole('button', { name: /رسیدهای من/ }).click();
  const calendar = page.getByText('افزودن به تقویم گوشی', { exact: true });
  current = { ...current, name: 'نام به‌روز' };
  await reopen();
  await page.locator('.appointment-ticket').getByText(current.name).waitFor();

  current = { ...current, date: '1405-08-15', period: '16-18', staff: 'sonia', startsAt: '2026-11-06T12:30:00Z', endsAt: '2026-11-06T14:30:00Z', updatedAt: '2026-11-04T09:00:00Z' };
  const [download] = await Promise.all([page.waitForEvent('download'), calendar.click()]);
  const file = (await readFile(await download.path(), 'utf8')).replace(/\r\n /g, '');
  assert.match(file, /DTSTART:20261106T123000Z\r\nDTEND:20261106T143000Z/);
  assert.ok(file.includes('سونیا'));
  await page.locator('.appointment-ticket').getByText('سونیا', { exact: true }).waitFor();

  status = 503;
  await calendar.click();
  await page.getByRole('button', { name: 'دریافت دوبارهٔ رسید' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('.receipt-lookup [role="status"]'));
  assert.equal(await page.locator('.appointment-ticket:visible').count(), 0);
  assert.equal(downloads, 1);
  status = 200;
  await reopen();
  await calendar.waitFor();
  current = { ...current, status: 'CANCELLED' };
  await calendar.click();
  await page.getByRole('heading', { name: 'این نوبت لغو شده است.' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('.receipt-experience [role="status"]'));
  assert.equal(await calendar.count(), 0);
  assert.equal(downloads, 1);
  console.log('PASS visible receipt: same-reference refresh, moved calendar time and staff, failed lookup and cancellation without stale downloads');
} finally {
  await browser.close();
}
