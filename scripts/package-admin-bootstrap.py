from datetime import datetime
from pathlib import Path
import re
import zipfile

repo = Path(__file__).resolve().parent.parent
source = repo / 'artifacts/admin-bootstrap.hash'
data = source.read_bytes().strip()
if not re.fullmatch(rb'\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}', data):
    raise SystemExit('A password must be prepared through the local setup page first.')
target = repo / 'artifacts/tina-admin-bootstrap-20261104.zip'
entry = zipfile.ZipInfo('tina-booking-runtime/admin-bootstrap.hash')
entry.date_time = datetime.now().timetuple()[:6]
entry.create_system = 3
entry.external_attr = 0o100600 << 16
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED)
print('Private administration bootstrap archive prepared; password/hash not displayed.')
