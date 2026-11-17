"""cPanel cron entry point. Pull tested releases for this salon from its public GitHub repository."""
import fcntl
from email import message_from_bytes
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request
import zipfile

REPO = 'mamadalili/tina-nail-atelier'
API = 'https://api.github.com/repos/' + REPO
SITE = 'https://mrdalili.ir'
RUNTIME = 'tina-booking-runtime'
STATE = RUNTIME + '/.release-sync'
PUBLIC = 'public_html/tina-preview/'
ADMIN = 'public_html/tina-administrator/'
MARKER = PUBLIC + 'preview-release.json'
ENDPOINTS = {'booking.php', 'options.php', 'receipt.php', 'metrics.php', 'services.php'}
REQUIRED = {MARKER, PUBLIC + 'index.html', ADMIN + 'index.html', ADMIN + 'api.php', RUNTIME + '/BookingStore.php'}
REQUIRED.update(PUBLIC + 'api/' + name for name in ENDPOINTS)
ZIP_LIMIT = 24 * 1024 * 1024


def is_code_path(name):
    parts = name.split('/')
    if any(not re.fullmatch(r'[a-zA-Z0-9_.-]+', part) or part in ('.', '..') for part in parts):
        return False
    if parts[0] == RUNTIME:
        return len(parts) == 2 and (parts[1] in {'.htaccess', 'calendar.php', 'sync_release.py', 'tina-run-release.sh'}
                                    or re.fullmatch(r'[A-Z][a-zA-Z0-9]*\.php', parts[1]) is not None)
    if len(parts) < 3 or parts[:2] not in (['public_html', 'tina-preview'], ['public_html', 'tina-administrator']):
        return False
    tail = parts[2:]
    if tail == ['.htaccess']:
        return True
    if any(part.startswith('.') for part in tail):
        return False
    if tail[0] == 'api':
        return parts[1] == 'tina-preview' and len(tail) == 2 and tail[1] in ENDPOINTS
    if tail == ['api.php']:
        return parts[1] == 'tina-administrator'
    suffix = Path(tail[-1]).suffix
    if tail[:2] == ['_next', 'static']:
        return len(tail) >= 3 and suffix in {'.js', '.css', '.woff', '.woff2', '.png', '.webp', '.json'}
    if tail[0] == 'images':
        return len(tail) == 2 and suffix in {'.jpg', '.jpeg', '.png', '.webp'}
    return suffix in {'.html', '.txt'} or name == MARKER


def destination(home, name):
    if not is_code_path(name):
        raise ValueError('Unexpected release path: ' + name)
    target = home
    for part in name.split('/'):
        target = target / part
        if target.is_symlink():
            raise ValueError('Release path is a symbolic link: ' + name)
    if target.exists() and not target.is_file():
        raise ValueError('Release target is not a file: ' + name)
    return target


def atomic_write(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
            os.fchmod(output.fileno(), mode)
        os.replace(temporary, str(path))
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_package(payload, commit, digest):
    if len(payload) > ZIP_LIMIT or hashlib.sha256(payload).hexdigest() != digest:
        raise ValueError('Release size or SHA-256 does not match GitHub')
    files = {}
    names = set()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        members = archive.infolist()
        if len(members) > 1200 or sum(entry.file_size for entry in members) > 64 * 1024 * 1024:
            raise ValueError('Release exceeds extracted file limits')
        for entry in members:
            name = entry.filename
            if (not is_code_path(name) or name.lower() in names or entry.file_size > ZIP_LIMIT
                    or stat.S_IFMT(entry.external_attr >> 16) != stat.S_IFREG):
                raise ValueError('Unexpected archive entry: ' + name)
            names.add(name.lower())
            files[name] = archive.read(entry)
    if not REQUIRED.issubset(files):
        raise ValueError('Incomplete release')
    marker = json.loads(files[MARKER].decode('utf-8'))
    short = marker.get('source_commit', '')
    if (not re.fullmatch(r'[0-9a-f]{40}', commit) or not re.fullmatch(r'[0-9a-f]{7,40}', short)
            or marker.get('source_sha') != commit or not commit.startswith(short) or marker.get('booking_live') is not True):
        raise ValueError('Release marker does not match main')
    return files


def update_order(name):
    # Old browser tabs keep their hashed assets. Publish entry points and release marker last.
    if name == MARKER:
        return 5
    if name.endswith(('.html', '.txt')):
        return 4
    if name.startswith(RUNTIME + '/'):
        return 2 if name.endswith('BookingStore.php') else 1
    if name.endswith('.php'):
        return 3
    return 0


def state_directory(home):
    state = home / STATE
    if state.is_symlink() or state.parent.is_symlink():
        raise ValueError('Invalid release state directory')
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    return state


def recover(home):
    state = state_directory(home)
    pending = state / 'pending'
    if not pending.exists():
        return
    entries = json.loads((pending / 'files.json').read_text())
    for index, name in enumerate(entries):
        target = destination(home, name)
        backup = pending / str(index)
        if backup.exists():
            atomic_write(target, backup.read_bytes(), stat.S_IMODE(backup.stat().st_mode))
        elif target.exists():
            target.unlink()
    retire(state, pending)


def retire(state, pending):
    # Even an interruption while deleting a finished journal cannot turn it into a partial rollback.
    trash = state / 'finished'
    if trash.exists():
        shutil.rmtree(str(trash))
    pending.rename(trash)
    shutil.rmtree(str(trash))


def install(home, payload, commit, digest, verify):
    files = read_package(payload, commit, digest)
    state = state_directory(home)
    recover(home)
    changed = []
    for name in sorted(files, key=lambda item: (update_order(item), item)):
        target = destination(home, name)
        if not target.exists() or target.read_bytes() != files[name]:
            changed.append(name)
    # Stage all backups before changing the first file. Private customer and account data are outside this list.
    with tempfile.TemporaryDirectory(dir=str(state)) as staging:
        backup = Path(staging) / 'backup'
        backup.mkdir(mode=0o700)
        for index, name in enumerate(changed):
            source = home / name
            if source.is_file():
                shutil.copy2(str(source), str(backup / str(index)))
        (backup / 'files.json').write_text(json.dumps(changed))
        backup.rename(state / 'pending')
    try:
        for name in changed:
            atomic_write(destination(home, name), files[name])
        verify(commit)
    except Exception:
        recover(home)
        raise
    retire(state, state / 'pending')


ALLOWED_HOSTS = {'api.github.com', 'github.com', 'release-assets.githubusercontent.com',
                 'objects.githubusercontent.com', 'mrdalili.ir'}


class HttpsRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme != 'https' or urlsplit(newurl).netloc not in ALLOWED_HOSTS:
            raise ValueError('Unexpected download redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def curl_response(url, limit, method):
    # Some shared hosts expose a working system TLS client but disconnect Python's HTTPS client.
    # Handle redirects ourselves so neither client can leave the same allowlisted HTTPS hosts.
    for _ in range(6):
        if urlsplit(url).scheme != 'https' or urlsplit(url).netloc not in ALLOWED_HOSTS:
            raise ValueError('Unexpected download redirect')
        with tempfile.TemporaryDirectory(prefix='salon-download-') as directory:
            header_file = Path(directory) / 'headers'
            command = ['curl', '-q', '--silent', '--show-error', '--proto', '=https',
                       '--connect-timeout', '10', '--max-time', '50', '--max-filesize', str(limit),
                       '--dump-header', str(header_file), '--user-agent', 'Tina-Atelier-Release',
                       '--header', 'Cache-Control: no-cache']
            if method == 'HEAD':
                command.append('--head')
            elif method != 'GET':
                raise ValueError('Unsupported download method')
            process = subprocess.Popen(command + [url], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                content = process.stdout.read(limit + 1)
                if len(content) > limit:
                    raise ValueError('Download exceeds size limit')
                process.communicate(timeout=60)
                if process.returncode:
                    raise OSError('HTTPS download failed for ' + urlsplit(url).netloc + ' (curl ' + str(process.returncode) + ')')
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate()
            with header_file.open('rb') as stream:
                raw = stream.read(65537)
            if len(raw) > 65536:
                raise ValueError('Response headers exceed size limit')
            blocks = [part for part in raw.replace(b'\r\n', b'\n').split(b'\n\n') if part.startswith(b'HTTP/')]
            if not blocks:
                raise ValueError('Missing HTTPS response status')
            status_line, _, fields = blocks[-1].partition(b'\n')
            status = re.fullmatch(rb'HTTP/\S+ ([0-9]{3})(?: .*)?', status_line)
            if not status:
                raise ValueError('Invalid HTTPS response status')
            code = int(status.group(1))
            headers = message_from_bytes(fields)
            if code in (301, 302, 303, 307, 308):
                if not headers.get('Location'):
                    raise ValueError('Missing download redirect')
                url = urljoin(url, headers['Location'])
                continue
            if not 200 <= code < 300:
                raise HTTPError(url, code, 'HTTPS request failed', headers, None)
            return (b'' if method == 'HEAD' else content), headers
    raise ValueError('Too many download redirects')


def download(url, limit=1024 * 1024, revision=None, store=False, method='GET'):
    if os.environ.get('TINA_RELEASE_CURL') == '1':
        result, headers = curl_response(url, limit, method)
        if revision and (headers.get('X-Tina-Api-Source') != revision or
                         (store and headers.get('X-Tina-Store-Source') != revision)):
            raise ValueError('PHP returned a different release')
        return result
    request = Request(url, method=method, headers={'User-Agent': 'Tina-Atelier-Release', 'Cache-Control': 'no-cache'})
    with build_opener(HttpsRedirects()).open(request, timeout=18) as response:
        if revision and (response.headers.get('X-Tina-Api-Source') != revision or
                         (store and response.headers.get('X-Tina-Store-Source') != revision)):
            raise ValueError('PHP returned a different release')
        result = response.read(limit + 1)
        if len(result) > limit:
            raise ValueError('Download exceeds size limit')
        return result


def read_json(url, **checks):
    return json.loads(download(url, **checks).decode('utf-8'))


def main_commit():
    commit = read_json(API + '/git/ref/heads/main')['object']['sha']
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Invalid main revision')
    return commit


def ci_verified_asset(commit, digest):
    # The job name is set from the tested ZIP's SHA-256 before the package is published.
    runs_url = API + '/actions/workflows/booking-release.yml/runs?branch=main&head_sha=' + commit + '&per_page=30'
    for run in read_json(runs_url)['workflow_runs']:
        if (run['head_sha'] != commit or run['head_branch'] != 'main' or run['event'] not in ('push', 'workflow_dispatch')
                or run['path'] != '.github/workflows/booking-release.yml' or (run.get('head_repository') or {}).get('full_name') != REPO):
            continue
        jobs = read_json(API + '/actions/runs/' + str(int(run['id'])) + '/jobs?filter=all&per_page=100')
        if any(job['name'] == 'Publish tested ZIP ' + digest and job['status'] == 'completed'
               and job['conclusion'] == 'success' for job in jobs['jobs']):
            return True
    return False


def verify_live(commit):
    for attempt in range(3):
        try:
            query = '?verify=' + commit + '-' + str(int(time.time()))
            base = SITE + '/tina-preview/'
            marker = read_json(base + 'preview-release.json' + query)
            if marker.get('source_sha') != commit or marker.get('booking_live') is not True:
                raise ValueError('Domain reports a different revision')
            short = marker['source_commit']
            if not re.fullmatch(r'[0-9a-f]{7,40}', short) or not commit.startswith(short):
                raise ValueError('Domain reports a different source')
            for url, tag in ((base, 'tina-preview-source'), (SITE + '/tina-administrator/', 'tina-admin-source')):
                html = download(url + query).decode('utf-8')
                if 'name="{}" content="{}"'.format(tag, short) not in html:
                    raise ValueError('Page did not load the expected release')
            health = read_json(base + 'api/booking.php?action=health', revision=commit, store=True)
            options = read_json(base + 'api/options.php' + query, revision=commit)
            admin = read_json(SITE + '/tina-administrator/api.php?action=status', revision=commit)
            download(base + 'api/receipt.php' + query, revision=commit, method='HEAD')
            if (health.get('enabled') is not True or not isinstance(options.get('taken'), list) or not options.get('asOf')
                    or admin.get('authenticated') is not False or admin.get('configured') is not True):
                raise ValueError('Live booking and availability check failed')
            return
        except (ValueError, OSError, KeyError):
            if attempt == 2:
                raise
            time.sleep(2)


def wait_for_domain(commit, latest_ref, timeout=15 * 60):
    end = time.monotonic() + timeout
    next_ref_check = 0
    while True:
        try:
            verify_live(commit)
            return True
        except (OSError, ValueError, KeyError):
            now = time.monotonic()
            if now >= next_ref_check:
                # A ref lookup can explain a mismatch, but must never hide the actual domain result.
                next_ref_check = now + 90
                try:
                    latest = latest_ref()
                except OSError:
                    latest = None
                if latest and re.fullmatch(r'[0-9a-f]{40}', latest) and latest != commit:
                    return False
            remaining = end - time.monotonic()
            if remaining <= 0:
                raise
            time.sleep(min(25, remaining))


def sync(home):
    state = state_directory(home)
    with (state / 'lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        recover(home)
        commit = main_commit()
        local = home / MARKER
        verified = state / 'verified'
        if local.exists() and json.loads(local.read_text()).get('source_sha') == commit:
            if not verified.exists() or verified.read_text() != commit:
                verify_live(commit)
                atomic_write(verified, commit.encode(), 0o600)
            return
        tag = 'booking-' + commit
        try:
            release = read_json(API + '/releases/tags/' + tag)
        except HTTPError as error:
            if error.code == 404:  # The build for main has not published an asset yet.
                return
            raise
        if release.get('tag_name') != tag or release.get('draft') or release.get('prerelease'):
            raise ValueError('Unexpected release')
        assets = [a for a in release.get('assets', []) if a.get('name') == 'tina-salon.zip' and a.get('state') == 'uploaded']
        if len(assets) != 1 or not 0 < assets[0]['size'] <= ZIP_LIMIT:
            raise ValueError('Missing or invalid salon release asset')
        digest = re.fullmatch(r'sha256:([a-f0-9]{64})', assets[0].get('digest') or '')
        if not digest:
            raise ValueError('GitHub did not supply the archive SHA-256')
        if not ci_verified_asset(commit, digest.group(1)):
            return  # Wait until this exact asset has passed the main workflow.
        payload = download('https://github.com/' + REPO + '/releases/download/' + tag + '/tina-salon.zip', ZIP_LIMIT)
        if len(payload) != assets[0]['size'] or main_commit() != commit:
            return
        install(home, payload, commit, digest.group(1), verify_live)
        atomic_write(verified, commit.encode(), 0o600)
        print('Published and verified booking release ' + commit)


if __name__ == '__main__':
    runtime = Path(__file__).resolve().parent
    if runtime.name != RUNTIME:
        sys.exit('Install the release script in the private tina-booking-runtime directory')
    try:
        sync(runtime.parent)
    except Exception as error:
        sys.exit('Salon deployment failed: ' + str(error).split('?')[0])
