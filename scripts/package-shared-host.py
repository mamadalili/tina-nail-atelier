import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
import runpy
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--versioned', action='store_true', help='Name the public installation ZIP after its source revision.')
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
info = json.loads((repo / 'artifacts/shared-host-release.json').read_text())
release = Path(info['release']).resolve()
assert release.parent == repo.parent and release.name.startswith('tina-shared-release-')
files = sorted(path for path in release.rglob('*') if path.is_file())
for path in files:
    parts = path.relative_to(release).parts
    assert parts[0] in ('public_html', 'tina-booking-runtime')
    assert not any(part in ('data', '.git', 'node_modules', 'src') or part.startswith('.env') for part in parts)
    assert path.suffix not in ('.sqlite', '.db', '.zip', '.log', '.hash')
target = repo / 'artifacts' / (f"tina-{info['revision']}.zip" if args.versioned else 'tina-shared-host-booking-20261104.zip')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        name = path.relative_to(release).as_posix()
        if name.startswith('public_html/'):
            assert name.startswith(('public_html/tina-preview/', 'public_html/tina-administrator/'))
        entry = zipfile.ZipInfo(name)
        entry.date_time = datetime.now().timetuple()[:6]
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
payload = target.read_bytes()
digest = hashlib.sha256(payload).hexdigest()
if args.versioned:
    # Enforce the same private-data exclusions and release marker checks as the hosting account.
    installer = runpy.run_path(str(repo / 'deploy/shared-host/runtime/sync_release.py'))
    installer['read_package'](payload, info['commit'], digest)
print(json.dumps({'archive': str(target), 'files': len(files), 'bytes': len(payload), 'sha256': digest}))
