import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await cp(fileURLToPath(new URL('public/', root)), fileURLToPath(new URL('.next/standalone/public/', root)), { recursive: true });
await cp(fileURLToPath(new URL('.next/static/', root)), fileURLToPath(new URL('.next/standalone/.next/static/', root)), { recursive: true });
console.log('Standalone assets prepared.');
