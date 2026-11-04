import { writeFile } from 'node:fs/promises';
import * as jalaali from 'jalaali-js';

const rows = [];
for (let year = 1400; year <= 1500; year++) {
  const { gy, gm, gd } = jalaali.toGregorian(year, 1, 1);
  rows.push(`    ${year} => ['${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}', ${jalaali.isLeapJalaaliYear(year) ? 'true' : 'false'}],`);
}
await writeFile(new URL('../deploy/shared-host/runtime/calendar.php', import.meta.url), `<?php\n// Generated from jalaali-js by scripts/generate-host-calendar.mjs.\nreturn [\n${rows.join('\n')}\n];\n`);
