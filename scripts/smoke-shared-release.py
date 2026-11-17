"""Install the actual cPanel artifact in a disposable Home and exercise its public and admin routes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--browser', action='store_true')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
os.chdir(repo)
php = os.environ.get('PHP_BIN', 'php')
password = secrets.token_urlsafe(24)
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
env = dict(os.environ, SALON_TEST_PASSWORD=password, SALON_TEST_SHA=commit)
installer = runpy.run_path(str(repo / 'deploy/shared-host/runtime/sync_release.py'))
payload = args.archive.read_bytes()

with tempfile.TemporaryDirectory(prefix='salon-release-test-') as directory:
    home = Path(directory)
    installer['install'](home, payload, commit, hashlib.sha256(payload).hexdigest(), lambda _: None)
    hashes = subprocess.check_output([php, '-r', '$p=password_hash(stream_get_contents(STDIN), PASSWORD_BCRYPT); echo json_encode(["tina"=>$p,"sonia"=>$p]);'], input=password.encode())
    (home / 'tina-booking-runtime/admin-bootstrap.hash').write_bytes(hashes)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    host = '127.0.0.1:' + str(port)
    origin = 'http://' + host
    with (home / 'php.log').open('w') as log:
        server = subprocess.Popen([php, '-S', host, '-t', str(home / 'public_html')], stdout=log, stderr=log)
        try:
            for _ in range(60):
                try:
                    with urlopen(origin + '/tina-preview/api/booking.php?action=health', timeout=2) as response:
                        if json.load(response).get('enabled') is True:
                            break
                except OSError:
                    pass
                if server.poll() is not None:
                    raise RuntimeError('Local PHP server stopped')
                time.sleep(0.1)
            else:
                raise RuntimeError('The packaged booking service did not start')
            subprocess.run(['node', 'node_modules/tsx/dist/cli.mjs', 'tests/shared-host-http.ts', origin], check=True, env=env)
            subprocess.run(['node', 'tests/installed-booking-flow.mjs', origin], check=True, env=env)
            if args.browser:
                for script, url in [('booking-refresh-browser.mjs', origin + '/tina-preview/'),
                                    ('receipt-refresh-browser.mjs', origin + '/tina-preview/'),
                                    ('receipt-schedule-browser.mjs', origin + '/')]:
                    subprocess.run(['node', 'tests/' + script, url], check=True, env=env)
        finally:
            server.terminate()
            server.wait(timeout=10)
