import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = dirname(repo);
const stage = await mkdtemp(join(parent, 'tina-shared-stage-'));
const release = await mkdtemp(join(parent, 'tina-shared-release-'));
for (const name of ['src', 'public', 'prisma', 'prisma.config.ts', 'tsconfig.json', 'next-env.d.ts', 'package.json', 'package-lock.json']) {
  if (existsSync(join(repo, name))) await cp(join(repo, name), join(stage, name), { recursive: true });
}
await symlink(join(repo, 'node_modules'), join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
await cp(join(repo, 'deploy/shared-host/next.config.ts'), join(stage, 'next.config.ts'));
await cp(join(repo, 'deploy/shared-host/PreviewImage.tsx'), join(stage, 'src/components/PreviewImage.tsx'));
// The staging tree has static pages and PHP routes; the source tree keeps its Node routes.
const { rm } = await import('node:fs/promises');
await rm(join(stage, 'src/app/api'), { recursive: true, force: true });
async function transform(file, edits) {
  let text = await readFile(join(stage, file), 'utf8');
  for (const [before, after] of edits) {
    if (!text.includes(before)) throw new Error(`Missing export anchor: ${file}: ${before}`);
    text = text.replace(before, after);
  }
  await writeFile(join(stage, file), text);
}
await transform('src/app/page.tsx', [["export const dynamic = 'force-dynamic';", "export const dynamic = 'force-static';"], ["import Image from 'next/image';", "import Image from '@/components/PreviewImage';"], ['href="/"', 'href="/tina-preview/"']]);
await transform('src/features/home/CinematicHero.tsx', [["import Image from 'next/image';", "import Image from '@/components/PreviewImage';"]]);
await transform('src/components/Header.tsx', [['href="/"', 'href="/tina-preview/"']]);
await transform('src/app/receipt-preview/page.tsx', [["export const dynamic = 'force-dynamic';", "export const dynamic = 'force-static';"]]);
await transform('src/app/robots.ts', [["export default", "export const dynamic = 'force-static';\n\nexport default"]]);
const revision = spawnSync('git', ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, 'rev-parse', '--short', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
await transform('src/app/layout.tsx', [['export const metadata: Metadata = {', `export const metadata: Metadata = {\n  other: { 'tina-preview-release': 'booking-20261104', 'tina-preview-source': '${revision}' },`]]);
const env = { ...process.env, DATABASE_URL: '', SITE_URL: '', NEXT_PUBLIC_BOOKING_ADAPTER: 'shared-host', NEXT_PUBLIC_BASE_PATH: '/tina-preview', RECEIPT_PREVIEW_ENABLED: 'true', NEXT_TELEMETRY_DISABLED: '1' };
for (const [binary, args] of [['node', ['node_modules/prisma/build/index.js', 'generate']], ['node', ['node_modules/next/dist/bin/next', 'build', '--webpack']]]) {
  const result = spawnSync(binary, args, { cwd: stage, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const publicDir = join(release, 'public_html/tina-preview');
await cp(join(stage, 'out'), publicDir, { recursive: true, filter: path => !['.gitkeep', 'burgundy-colour-study.png'].includes(path.split(/[\\/]/).at(-1)) });
await mkdir(join(publicDir, 'api'), { recursive: true });
await cp(join(repo, 'deploy/shared-host/public/booking.php'), join(publicDir, 'api/booking.php'));
await cp(join(repo, 'deploy/shared-host/runtime'), join(release, 'tina-booking-runtime'), { recursive: true });
await writeFile(join(release, 'tina-booking-runtime/.htaccess'), 'Require all denied\n');
await writeFile(join(publicDir, '.htaccess'), `Options -Indexes\nDirectoryIndex index.html\n<IfModule mime_module>\nAddHandler application/x-httpd-ea-php84 .php\n</IfModule>\n<IfModule mod_headers.c>\nHeader always set X-Robots-Tag "noindex, nofollow"\nHeader always set X-Tina-Preview-Release "booking-20261104"\n<FilesMatch "\\.(html|txt|json)$">\nHeader set Cache-Control "no-cache, must-revalidate"\n</FilesMatch>\n</IfModule>\n`);
await writeFile(join(publicDir, 'preview-release.json'), JSON.stringify({ source_commit: revision, release: 'booking-20261104', booking_live: true, notifications: false }));
await mkdir(join(repo, 'artifacts'), { recursive: true });
await writeFile(join(repo, 'artifacts/shared-host-release.json'), JSON.stringify({ stage, release, revision }, null, 2));
console.log(JSON.stringify({ stage, release, revision }));
