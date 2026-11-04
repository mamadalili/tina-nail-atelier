import json
from pathlib import Path
import zipfile

repo = Path(__file__).resolve().parent.parent
info = json.loads((repo / 'artifacts/shared-host-release.json').read_text())
release = Path(info['release']).resolve()
assert release.parent == repo.parent and release.name.startswith('tina-shared-release-')
files = sorted(path for path in release.rglob('*') if path.is_file())
for path in files:
    parts = path.relative_to(release).parts
    assert parts[0] in ('public_html', 'tina-booking-runtime')
    assert not any(part in ('data', '.git', 'node_modules', 'src') or part.startswith('.env') for part in parts)
    assert path.suffix not in ('.sqlite', '.db', '.zip', '.log')
target = repo / 'artifacts/tina-shared-host-booking-20261104.zip'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        name = path.relative_to(release).as_posix()
        if name.startswith('public_html/'):
            assert name.startswith('public_html/tina-preview/')
        entry = zipfile.ZipInfo(name)
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
print(json.dumps({'archive': str(target), 'files': len(files), 'bytes': target.stat().st_size}))
