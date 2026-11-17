import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceIndex } from '../src/features/services/ServiceIndex';
import { ArtistWork } from '../src/features/services/ArtistWork';
import { services, staffMembers } from '../src/content/salon';
import { parseTariffInput } from '../src/features/admin/portfolio-input';

test('both service panels show appointment duration and artist-specific enquiries on the official salon number without portfolio placeholders', () => {
  const html = renderToStaticMarkup(createElement(ServiceIndex));
  assert.equal(html.match(/۲ ساعت/g)?.length, 2);
  assert.doesNotMatch(html, /<img\b/);
  const links = Array.from(html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g), match => new URL(match[1]));
  for (const service of ['خدمات دست', 'خدمات پا']) {
    for (const artist of ['تینا', 'سونیا']) {
      const messages = links.filter(link => link.pathname === '/989353155852').map(link => link.searchParams.get('text') ?? '');
      for (const purpose of ['تعرفه', 'نمونه‌کار']) {
        assert.ok(messages.some(message => [service, artist, purpose].every(part => message.includes(part))), [service, artist, purpose].join(' / '));
      }
    }
  }
  assert.equal(html.match(/href="#appointment-form"/g)?.length, 2);
});

test('a published photo and numeric tariff appear only on the attributed artist and service', () => {
  const photo = { id: 'a'.repeat(64), staff: 'sonia', service: 'pedicure', width: 800, height: 600 } as const;
  const tariff = { staff: 'sonia', service: 'pedicure', minimum: 200000, maximum: 350000 } as const;
  const portfolio = { photos: [photo], tariffs: [tariff] };
  for (const service of services) for (const person of staffMembers) {
    const html = renderToStaticMarkup(createElement(ArtistWork, { person, service, portfolio }));
    if (person.id === 'sonia' && service.id === 'pedicure') {
      assert.match(html, /نمونه‌کار خدمات پا از سونیا/);
      assert.match(html, /<img[^>]*src="[^"]*\/api\/services\.php\?photo=a{64}"/);
      assert.match(html, /۲۰۰٬۰۰۰ تا ۳۵۰٬۰۰۰ تومان/);
      assert.doesNotMatch(html, /درخواست نمونه‌کار/);
    } else {
      assert.doesNotMatch(html, /<img\b|۲۰۰٬۰۰۰/);
      assert.match(html, /درخواست نمونه‌کار/);
    }
  }
});

test('publishing a tariff accepts Persian or Arabic numerals and rejects ambiguous amounts and reversed ranges', () => {
  assert.deepEqual(parseTariffInput('۲۱۰٬۰۰۰', '۳۲۰,۰۰۰'), { minimum: 210000, maximum: 320000 });
  assert.deepEqual(parseTariffInput('٢١٠٠٠٠', ''), { minimum: 210000, maximum: null });
  assert.deepEqual(parseTariffInput('', ''), { minimum: null, maximum: null });
  for (const pair of [['۲۰۰', '۱۰۰'], ['', '۲۰۰'], ['۱۰,۵', ''], ['۱۰۰.۵', ''], ['۰', '']]) {
    assert.throws(() => parseTariffInput(pair[0], pair[1]));
  }
});
