import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isAllowedOrigin } from '../src/server/request-origin';

test('a loopback production preview accepts its original Host despite Next internal URL normalization', () => {
  assert.equal(isAllowedOrigin('http://127.0.0.1:18221', '127.0.0.1:18221', undefined), true);
  assert.equal(isAllowedOrigin('http://localhost:18221', 'localhost:18221', undefined), true);
  assert.equal(isAllowedOrigin('https://foreign.invalid', '127.0.0.1:18221', undefined), false);
  assert.equal(isAllowedOrigin(null, '127.0.0.1:18221', undefined), false);
});

test('a public deployment requires its configured HTTPS origin rather than a forwarded host', () => {
  assert.equal(isAllowedOrigin('https://example.com', 'web:3000', 'https://example.com'), true);
  assert.equal(isAllowedOrigin('http://example.com', 'example.com', 'https://example.com'), false);
  assert.equal(isAllowedOrigin('https://foreign.invalid', 'foreign.invalid', 'https://example.com'), false);
  assert.equal(isAllowedOrigin('https://example.com', 'example.com', undefined), false);
  assert.equal(isAllowedOrigin('https://example.com', 'example.com', 'invalid'), false);
});
