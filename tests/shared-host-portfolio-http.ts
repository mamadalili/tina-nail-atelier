import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const php = process.env.PHP_BIN ?? 'php';
const root = await mkdtemp(join(tmpdir(), 'tina-portfolio-http-'));
const runtime = join(root, 'tina-booking-runtime');
const publicRoot = join(root, 'public_html');
const publicApi = join(publicRoot, 'tina-preview/api');
const privateApi = join(publicRoot, 'tina-administrator');
await cp('deploy/shared-host/runtime', runtime, { recursive: true });
await cp('deploy/shared-host/public', publicApi, { recursive: true });
await mkdir(privateApi, { recursive: true });
await cp('deploy/shared-host/public/admin.php', join(privateApi, 'api.php'));
const password = randomUUID();
const hashes = spawnSync(php, ['-r', '$hash=password_hash(stream_get_contents(STDIN), PASSWORD_BCRYPT); echo json_encode(["tina"=>$hash,"sonia"=>$hash]);'], { input: password });
assert.equal(hashes.status, 0, 'PHP with PDO SQLite and GD is needed');
await writeFile(join(runtime, 'admin-bootstrap.hash'), hashes.stdout, { mode: 0o600 });
const portProbe = createServer();
await new Promise<void>(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const address = portProbe.address();
assert.ok(address && typeof address === 'object');
await new Promise<void>(resolve => portProbe.close(() => resolve()));
const host = '127.0.0.1:' + address.port;
const origin = 'http://' + host;
const child = spawn(php, ['-S', host, '-t', publicRoot], { stdio: 'ignore' });
const publicUrl = origin + '/tina-preview/api/services.php';
const privateUrl = origin + '/tina-administrator/api.php?action=';
let cookie = '', csrf = '', editorStaff = '';
async function admin(action: string, body?: object, extra: Record<string, string> = {}) {
  const response = await fetch(privateUrl + action, { method: body ? 'POST' : 'GET',
    headers: { Cookie: cookie, ...(body ? { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...extra },
    body: body ? JSON.stringify(action === 'portfolio' ? { staff: editorStaff, ...body } : body) : undefined });
  const session = response.headers.getSetCookie()[0];
  if (session) cookie = session.split(';')[0];
  return response;
}
async function logIn(username: string) {
  csrf = (await (await admin('status')).json()).csrf;
  const response = await admin('login', { username, password });
  assert.equal(response.status, 200);
  csrf = (await response.json()).csrf;
  editorStaff = username;
}
try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(origin); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const empty = await fetch(publicUrl);
  assert.equal(empty.status, 200, 'Public catalogue works before the first photo or tariff');
  assert.deepEqual(await empty.json(), { photos: [], tariffs: [] });
  assert.equal((await fetch(publicUrl, { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await readdir(runtime)).includes('data'), false, 'Public reads create no storage');
  csrf = (await (await admin('status')).json()).csrf;
  const rate = { type: 'tariff', service: 'pedicure', minimum: 210000, maximum: 320000 };
  assert.equal((await admin('portfolio', rate)).status, 401);
  await logIn('sonia');
  assert.equal((await admin('portfolio', rate, { Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await admin('portfolio', rate, { 'X-CSRF-Token': 'forged' })).status, 403);
  assert.equal((await admin('portfolio', { ...rate, staff: 'tina' })).status, 409, 'A stale editor cannot publish under a new session identity');
  assert.equal((await admin('portfolio', { ...rate, type: true })).status, 422);
  assert.equal((await admin('portfolio', { ...rate, maximum: 100000 })).status, 422);
  assert.equal((await admin('portfolio', { ...rate, service: '../private' })).status, 422);
  assert.equal((await admin('portfolio', rate)).status, 200);
  assert.deepEqual((await (await fetch(publicUrl)).json()).tariffs,
    [{ staff: 'sonia', service: 'pedicure', minimum: 210000, maximum: 320000 }]);

  // Synthetic pixels stay in this isolated local test. Inject a JPEG comment and a trailer.
  const jpeg = spawnSync(php, ['-r', 'imagejpeg(imagecreatetruecolor(40, 30));']);
  assert.equal(jpeg.status, 0);
  const marker = Buffer.from('private camera location');
  const comment = Buffer.concat([Buffer.from([255, 254, 0, marker.length + 2]), marker]);
  const source = Buffer.concat([jpeg.stdout.subarray(0, 2), comment, jpeg.stdout.subarray(2), Buffer.from('<?php echo 1; ?>')]);
  const photo = { type: 'photo', service: 'pedicure', jpeg: source.toString('base64') };
  assert.equal((await admin('portfolio', { ...photo, jpeg: 'PGh0bWw+' })).status, 422);
  const largeSide = spawnSync(php, ['-r', 'imagejpeg(imagecreatetruecolor(1441, 10));']);
  assert.equal((await admin('portfolio', { ...photo, jpeg: largeSide.stdout.toString('base64') })).status, 422);
  assert.equal((await admin('portfolio', { ...photo, jpeg: 'A'.repeat(1020000) })).status, 413);
  assert.equal((await admin('portfolio', photo)).status, 200);
  assert.equal((await admin('portfolio', photo)).status, 200, 'Retrying an upload is idempotent');
  const catalogue = await (await fetch(publicUrl)).json();
  assert.equal(catalogue.photos.length, 1);
  const published = catalogue.photos[0];
  assert.deepEqual(published, { id: published.id, staff: 'sonia', service: 'pedicure', width: 40, height: 30 });
  assert.match(published.id, /^[a-f0-9]{64}$/);
  const photoUrl = publicUrl + '?photo=' + published.id;
  const pixels = await fetch(photoUrl);
  assert.equal(pixels.headers.get('content-type'), 'image/jpeg');
  assert.equal(pixels.headers.get('x-content-type-options'), 'nosniff');
  const clean = Buffer.from(await pixels.arrayBuffer());
  assert.deepEqual(clean.subarray(0, 2), Buffer.from([255, 216]));
  assert.deepEqual(clean.subarray(-2), Buffer.from([255, 217]));
  assert.ok(!clean.includes(marker) && !clean.includes('<?php'));
  assert.equal((await fetch(photoUrl, { method: 'HEAD' })).headers.get('content-length'), String(clean.length));
  assert.equal((await fetch(publicUrl + '?photo=../portfolio.sqlite')).status, 404);

  for (const width of [41, 42, 43]) {
    const sample = spawnSync(php, ['-r', 'imagejpeg(imagecreatetruecolor((int)$argv[1], 30));', String(width)]);
    assert.equal((await admin('portfolio', { ...photo, service: 'manicure', jpeg: sample.stdout.toString('base64') })).status, 200);
  }
  assert.equal((await admin('portfolio', { ...photo, service: 'manicure' })).status, 409);
  const handPhotos = (await (await fetch(publicUrl)).json()).photos.filter((item: { service: string }) => item.service === 'manicure');
  assert.equal(handPhotos.length, 3);
  for (const handPhoto of handPhotos) assert.equal((await admin('portfolio', { type: 'remove', service: 'manicure', id: handPhoto.id })).status, 200);

  await logIn('tina');
  assert.equal((await admin('portfolio', { type: 'remove', service: 'pedicure', id: published.id })).status, 404);
  assert.equal((await fetch(photoUrl)).status, 200, 'Another artist cannot unpublish this photo');
  await logIn('sonia');
  assert.equal((await admin('portfolio', { type: 'remove', service: 'pedicure', id: published.id })).status, 200);
  assert.equal((await fetch(photoUrl)).status, 404);
  assert.equal((await admin('portfolio', { ...rate, minimum: null, maximum: null })).status, 200);
  assert.deepEqual(await (await fetch(publicUrl)).json(), { photos: [], tariffs: [] });
  console.log('PASS portfolio HTTP: read-only catalogue, staff attribution, pricing, authenticated image processing, withdrawal and isolation.');
} finally {
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
  await rm(root, { recursive: true, force: true });
}
