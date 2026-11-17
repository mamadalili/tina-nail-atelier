"""Print the hosting setup command for this exact, tested release."""
import hashlib
import json
import re
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1]) as archive:
    commit = json.loads(archive.read('public_html/tina-preview/preview-release.json'))['source_sha']
    scripts = {name: hashlib.sha256(archive.read('tina-booking-runtime/' + name)).hexdigest()
               for name in ('sync_release.py', 'tina-run-release.sh')}
if not re.fullmatch(r'[0-9a-f]{40}', commit):
    raise SystemExit('Invalid source commit.')
base = 'https://raw.githubusercontent.com/mamadalili/tina-nail-atelier/' + commit + '/deploy/shared-host/runtime/'
initializers = []
for name, digest in scripts.items():
    initializers.append('(curl -q -fsSL --proto "=https" ' + base + name +
                        ' -o .sync-initial && echo "' + digest + '  .sync-initial" | sha256sum -c --status && '
                        'mv .sync-initial ' + name + ')')
command = ('cd "$HOME/tina-booking-runtime" && (test -s tina-run-release.sh || (' +
           ' && '.join(initializers) + ')) && /bin/sh tina-run-release.sh')
print('بستهٔ نصب سایت و پنل برای نسخهٔ `' + commit[:7] + '` در فایل `tina-salon.zip` است.')
print('\nبرای فعال‌کردن انتشار خودکار، در **Cron Jobs** سی‌پنل اجرای هر پنج دقیقه (`*/5 * * * *`) را انتخاب کنید و این خط را در **Command** قرار دهید. هاست آخرین بسته‌ای را که آزمون‌های شاخهٔ اصلی را گذرانده باشد نصب می‌کند.')
print('\n```sh\n' + command + '\n```')
print('\nاگر نصب دستی را ترجیح می‌دهید، ZIP را در **Home** حساب هاست استخراج کنید. وضعیت سایت از [شناسهٔ نسخهٔ فعال](https://mrdalili.ir/tina-preview/preview-release.json) قابل بررسی است.')
