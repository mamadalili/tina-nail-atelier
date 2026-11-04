import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:18220');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'This smoke check only targets a local preview.');

for (const path of ['/', '/privacy', '/api/health', '/robots.txt']) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const body = await response.text();
  if (path === '/') {
    assert.match(body, /تینا/);
    assert.match(body, /hero-portrait/);
    assert.match(body, /fetchPriority="high"/i);
    assert.match(body, /lang="fa"/);
  }
  console.log(`PASS ${path}`);
}

const picture = await fetch(new URL('/_next/image?url=%2Fimages%2Ftina-editorial-hands-v6.webp&w=640&q=85', base), { headers: { Accept: 'image/webp' } });
assert.equal(picture.status, 200);
assert.match(picture.headers.get('content-type'), /image\/webp/);
console.log(`PASS optimized hero: ${picture.headers.get('content-type')}, ${(await picture.arrayBuffer()).byteLength} bytes`);

const blocked = await fetch(new URL('/api/appointment-requests', base), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.invalid' }, body: '{}' });
assert.equal(blocked.status, 403);
console.log('PASS foreign-origin request is rejected');

const offline = await fetch(new URL('/api/appointment-requests', base), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: '{}' });
assert.equal(offline.status, 503, 'Run this script only with online booking disabled.');
console.log('PASS offline registration fails honestly; WhatsApp remains the visitor route');
