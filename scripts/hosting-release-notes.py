"""Print the hosting setup command for this exact, tested release."""
import hashlib
import json
import re
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1]) as archive:
    commit = json.loads(archive.read('public_html/tina-preview/preview-release.json'))['source_sha']
    digest = hashlib.sha256(archive.read('tina-booking-runtime/sync_release.py')).hexdigest()
if not re.fullmatch(r'[0-9a-f]{40}', commit):
    raise SystemExit('Invalid source commit.')
url = 'https://raw.githubusercontent.com/mamadalili/tina-nail-atelier/' + commit + '/deploy/shared-host/runtime/sync_release.py'
command = ('cd "$HOME/tina-booking-runtime" && (test -s sync_release.py || '
           '(curl -fsSL --proto "=https" ' + url + ' -o .sync-initial && '
           'echo "' + digest + '  .sync-initial" | sha256sum -c --status && '
           'mv .sync-initial sync_release.py)) && /usr/bin/python3 sync_release.py')
print('بستهٔ نصب سایت و پنل برای نسخهٔ `' + commit[:7] + '` در فایل `tina-salon.zip` است.')
print('\nبرای فعال‌کردن انتشار خودکار، در **Cron Jobs** سی‌پنل اجرای هر پنج دقیقه (`*/5 * * * *`) را انتخاب کنید و این خط را در **Command** قرار دهید. هاست آخرین بسته‌ای را که آزمون‌های شاخهٔ اصلی را گذرانده باشد نصب می‌کند.')
print('\n```sh\n' + command + '\n```')
print('\nاگر نصب دستی را ترجیح می‌دهید، ZIP را در **Home** حساب هاست استخراج کنید. وضعیت سایت از [شناسهٔ نسخهٔ فعال](https://mrdalili.ir/tina-preview/preview-release.json) قابل بررسی است.')
