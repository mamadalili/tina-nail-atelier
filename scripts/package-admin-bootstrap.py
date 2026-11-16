import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import zipfile

parser = argparse.ArgumentParser(description='Package private administrator credentials for the cPanel account home.')
parser.add_argument('--with-release', action='store_true', help='Include the current public and private application files for a single Home extraction.')
args = parser.parse_args()
os.umask(0o077)
artifacts = Path(__file__).resolve().parent.parent / 'artifacts'
data = (artifacts / 'admin-bootstrap.hash').read_bytes().strip()
hash_pattern = re.compile(r'\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}')
try:
    accounts = json.loads(data)
except ValueError:
    accounts = None
named_accounts = isinstance(accounts, dict) and set(accounts) == {'tina', 'sonia'} and all(isinstance(value, str) and hash_pattern.fullmatch(value) for value in accounts.values())
if not named_accounts and (args.with_release or not hash_pattern.fullmatch(data.decode('ascii'))):
    raise SystemExit('Prepare the administrator accounts with setup-admin-password.php first.')

release = artifacts / 'tina-shared-host-booking-20261104.zip'
target = artifacts / 'tina-admin-bootstrap-20261104.zip'
if args.with_release:
    revision = json.loads((artifacts / 'shared-host-release.json').read_text())['revision']
    if not re.fullmatch(r'[0-9a-f]{7,40}', revision):
        raise SystemExit('Missing release revision.')
    target = artifacts / f'tina-admin-panel-{revision}.zip'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    if args.with_release:
        with zipfile.ZipFile(release) as source:
            if json.loads(source.read('public_html/tina-preview/preview-release.json'))['source_commit'] != revision:
                raise SystemExit('The release archive belongs to a different revision.')
            for item in source.infolist():
                archive.writestr(item, source.read(item))
    entry = zipfile.ZipInfo('tina-booking-runtime/admin-bootstrap.hash', datetime.now().timetuple()[:6])
    entry.create_system = 3
    entry.external_attr = 0o100600 << 16
    archive.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED)
print(f'Private cPanel Home archive: {target}')
