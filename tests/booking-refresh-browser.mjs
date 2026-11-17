import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test, { before, after } from 'node:test';

// Run against a local booking-enabled preview with Playwright and Chromium.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:18220/');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const options = /\/api\/(?:booking-options|options\.php)$/;
const asOf = '2026-11-03T05:00:00.000Z';
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE }); });
after(async () => { await browser?.close(); });

async function openForm(availability) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'fa-IR', timezoneId: 'Asia/Tehran', reducedMotion: 'reduce' });
  page.setDefaultTimeout(4000);
  await page.clock.install({ time: new Date(asOf) });
  await page.route(options, availability);
  await page.route(/\/api\/(?:booking-metrics|metrics\.php)$/, route => route.fulfill({ status: 204 }));
  await page.route(/\/api\/(?:appointment-requests|booking\.php)$/, route => route.abort());
  await page.goto(base.href);
  await page.locator('.quick-time:enabled').first().waitFor();
  return page;
}

async function backgroundRefresh(page) {
  await page.clock.fastForward(2000);
  const requested = page.waitForRequest(options);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await requested;
}

test('Continue offers actual conflict alternatives if a refresh has occupied a chosen quick time', async () => {
  let taken = [];
  const page = await openForm(route => route.fulfill({ json: { asOf, taken } }));
  try {
    const tina = page.getByRole('button', { name: /اولین وقت آزاد با تینا/ });
    const next = page.locator('.booking-next button');
    await tina.click();
    await next.click();
    await page.locator('#name').fill('مهمان آزمایشی');
    await page.locator('#phone').fill('۰۹۰۰۰۰۰۰۰۰۰');
    await page.locator('#note').fill('یادداشت');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'تغییر وقت' }).click();
    await tina.click();

    taken = [{ staff: 'tina', date: '1405-08-12', period: '10-12' }];
    await backgroundRefresh(page);
    await page.getByRole('button', { name: /اولین وقت آزاد با تینا.*۱۲ تا ۱۴/ }).waitFor();
    await next.click();
    await page.getByRole('button', { name: /نزدیک‌ترین وقت با تینا.*۱۲ تا ۱۴/ }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'conflict-heading');
    assert.match(await page.locator('.selected-appointment').innerText(), /تینا/);
    assert.ok(await page.getByRole('button', { name: /رزرو نهایی/ }).isDisabled());
    await page.getByRole('button', { name: /همان ساعت با سونیا.*۱۰ تا ۱۲/ }).click();
    assert.match(await page.locator('.selected-appointment').innerText(), /سونیا/);
    assert.equal(await page.locator('#name').inputValue(), 'مهمان آزمایشی');
    assert.equal(await page.locator('#phone').inputValue(), '۰۹۰۰۰۰۰۰۰۰۰');
    assert.equal(await page.locator('#note').inputValue(), 'یادداشت');
    assert.ok(await page.getByRole('checkbox').isChecked());
  } finally { await page.close(); }
});

test('a background read preserves a focused manual radio until a real error invalidates availability', async () => {
  let hold;
  const nextRead = () => new Promise(resolve => { hold = resolve; });
  const page = await openForm(route => {
    if (hold) { hold(route); hold = undefined; return; }
    return route.fulfill({ json: { asOf, taken: [] } });
  });
  try {
    await page.getByRole('button', { name: 'انتخاب روز و ساعت از تقویم' }).click();
    await page.locator('.calendar-day[aria-current="date"]').click();
    const radio = page.getByRole('radio', { name: 'ساعت ۱۰ تا ۱۲' });
    await radio.focus();
    await radio.press('Space');
    assert.ok(await radio.evaluate(el => el === document.activeElement && el.checked));
    const unchanged = nextRead();
    await backgroundRefresh(page);
    const held = await unchanged;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('name')), 'period');
    const completed = page.waitForResponse(options);
    await held.fulfill({ json: { asOf, taken: [] } });
    await completed;
    assert.ok(await radio.evaluate(el => el === document.activeElement && el.checked && !el.disabled));

    const failing = nextRead();
    await backgroundRefresh(page);
    await (await failing).fulfill({ status: 503, json: {} });
    await page.getByRole('button', { name: 'بررسی دوبارهٔ ساعت‌ها' }).waitFor();
    assert.equal(await page.locator('.quick-time:enabled, .time-choice input:enabled').count(), 0);
  } finally { await page.close(); }
});
