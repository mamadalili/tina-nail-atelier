import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy/shared-host/runtime/sync_release.py'
spec = importlib.util.spec_from_file_location('salon_release', SCRIPT)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

SHA = 'a91f7cd' + 'b' * 33
PUBLIC = 'public_html/tina-preview/'
ADMIN = 'public_html/tina-administrator/'
STORE = 'tina-booking-runtime/BookingStore.php'


def package(extra=None, marker=SHA):
    files = {
        PUBLIC + 'preview-release.json': json.dumps({'source_sha': marker, 'source_commit': marker[:7], 'booking_live': True}),
        PUBLIC + 'index.html': '<meta name="tina-preview-source" content="' + marker[:7] + '">',
        ADMIN + 'index.html': '<meta name="tina-admin-source" content="' + marker[:7] + '">',
        ADMIN + 'api.php': '<?php',
        STORE: '<?php // new',
        PUBLIC + '_next/static/chunks/page-1234.js': 'new asset',
    }
    for endpoint in ('options', 'booking', 'receipt', 'services', 'metrics'):
        files[PUBLIC + 'api/' + endpoint + '.php'] = '<?php'
    files.update(extra or {})
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        for name, text in files.items():
            info = zipfile.ZipInfo(name)
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, text)
    return output.getvalue()


class ReleaseSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.store = self.home / STORE
        self.store.parent.mkdir()
        self.store.write_text('original code')
        self.private = self.store.parent / 'data' / 'appointments.sqlite'
        self.private.parent.mkdir()
        self.private.write_bytes(b'existing appointments')
        self.marker = self.home / PUBLIC / 'preview-release.json'
        self.marker.parent.mkdir(parents=True)
        self.marker.write_text('{"source_commit":"previous"}')

    def install(self, payload, check, digest=None):
        sync.install(self.home, payload, SHA, digest or hashlib.sha256(payload).hexdigest(), check)

    def test_validated_install_preserves_records_and_previous_immutable_assets(self):
        old = self.home / PUBLIC / '_next/static/chunks/old.js'
        old.parent.mkdir(parents=True)
        old.write_text('old asset')
        checked = []
        def verify_live(commit):
            self.assertEqual(commit, SHA)
            self.assertEqual(json.loads(self.marker.read_text())['source_sha'], SHA)
            checked.append(commit)
        self.install(package(), verify_live)
        self.assertEqual(checked, [SHA])
        self.assertEqual(self.private.read_bytes(), b'existing appointments')
        self.assertEqual(old.read_text(), 'old asset')

    def test_failed_live_check_restores_previous_files_and_keeps_reservations_made_during_install(self):
        def unavailable(_):
            self.private.write_bytes(b'appointment booked during update')
            raise ValueError('public domain still has the previous release')
        with self.assertRaises(ValueError):
            self.install(package(), unavailable)
        self.assertEqual(self.store.read_text(), 'original code')
        self.assertEqual(json.loads(self.marker.read_text())['source_commit'], 'previous')
        self.assertFalse((self.home / ADMIN / 'api.php').exists())
        self.assertEqual(self.private.read_bytes(), b'appointment booked during update')

    def test_interrupted_install_recovers_from_disk(self):
        def interrupted(_):
            raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            self.install(package(), interrupted)
        sync.recover(self.home)
        self.assertEqual(self.store.read_text(), 'original code')
        self.assertEqual(json.loads(self.marker.read_text())['source_commit'], 'previous')

    def test_rejects_untrusted_paths_hidden_files_and_symlinks_before_any_write(self):
        names = ['../escape', PUBLIC + '../index.php', 'public_html/index.php', STORE + '/x',
                 'tina-booking-runtime/data/appointments.sqlite', 'tina-booking-runtime/admin-bootstrap.hash',
                 PUBLIC + 'other.php', ADMIN + 'backdoor.php', PUBLIC + 'images/.htaccess',
                 PUBLIC + '_next/static/chunks/unexpected.php', 'tina-booking-runtime/.release-sync/journal']
        for path in names:
            with self.subTest(path=path), self.assertRaises((ValueError, OSError)):
                self.install(package({path: 'invalid'}), self.fail)
            self.assertEqual(self.store.read_text(), 'original code')
        external = self.home / 'elsewhere'
        external.mkdir()
        (self.home / PUBLIC / 'images').symlink_to(external, target_is_directory=True)
        with self.assertRaises((ValueError, OSError)):
            self.install(package({PUBLIC + 'images/photo.webp': 'test'}), self.fail)
        self.assertEqual(list(external.iterdir()), [])

    def test_rejects_digest_or_revision_mismatch(self):
        with self.assertRaises(ValueError):
            self.install(package(), self.fail, 'f' * 64)
        with self.assertRaises(ValueError):
            self.install(package(marker='c' * 40), self.fail)
        self.assertEqual(self.store.read_text(), 'original code')

    def test_pulls_only_the_tested_asset_for_current_main_and_deduplicates_completed_runs(self):
        payload = package()
        asset = {'name': 'tina-salon.zip', 'state': 'uploaded', 'size': len(payload),
                 'digest': 'sha256:' + hashlib.sha256(payload).hexdigest()}
        release = {'tag_name': 'booking-' + SHA, 'draft': False, 'prerelease': False, 'assets': [asset]}
        with patch.object(sync, 'main_commit', return_value=SHA), patch.object(sync, 'read_json', return_value=release) as api, \
             patch.object(sync, 'ci_verified_asset', return_value=True), \
             patch.object(sync, 'download', return_value=payload) as archive, patch.object(sync, 'verify_live') as verify:
            sync.sync(self.home)
            sync.sync(self.home)
        api.assert_called_once_with(sync.API + '/releases/tags/booking-' + SHA)
        archive.assert_called_once_with('https://github.com/' + sync.REPO + '/releases/download/booking-' + SHA + '/tina-salon.zip', sync.ZIP_LIMIT)
        verify.assert_called_once_with(SHA)

    def test_waits_for_build_and_skips_a_superseded_candidate(self):
        with patch.object(sync, 'main_commit', return_value=SHA), \
             patch.object(sync, 'read_json', side_effect=HTTPError('test', 404, 'not released', {}, None)), \
             patch.object(sync, 'download') as archive:
            sync.sync(self.home)
            archive.assert_not_called()
        payload = package()
        release = {'tag_name': 'booking-' + SHA, 'assets': [{'name': 'tina-salon.zip', 'state': 'uploaded',
                   'size': len(payload), 'digest': 'sha256:' + hashlib.sha256(payload).hexdigest()}]}
        with patch.object(sync, 'main_commit', side_effect=[SHA, 'c' * 40]), patch.object(sync, 'read_json', return_value=release), \
             patch.object(sync, 'ci_verified_asset', return_value=True), \
             patch.object(sync, 'download', return_value=payload), patch.object(sync, 'verify_live') as verify:
            sync.sync(self.home)
            verify.assert_not_called()
        self.assertEqual(self.store.read_text(), 'original code')

    def test_a_release_asset_needs_the_matching_successful_main_job(self):
        digest = 'd' * 64
        run = {'id': 17, 'head_sha': SHA, 'head_branch': 'main', 'event': 'push', 'path': '.github/workflows/booking-release.yml', 'head_repository': {'full_name': sync.REPO}}
        for result, name, expected in [('success', 'Publish tested ZIP ' + digest, True),
                                       ('success', 'Publish tested ZIP ' + 'c' * 64, False),
                                       ('failure', 'Publish tested ZIP ' + digest, False)]:
            with patch.object(sync, 'read_json', side_effect=[{'workflow_runs': [run]}, {'jobs': [{'name': name, 'conclusion': result, 'status': 'completed'}]}]):
                self.assertEqual(sync.ci_verified_asset(SHA, digest), expected)
        with patch.object(sync, 'read_json', return_value={'workflow_runs': [dict(run, head_branch='other')]}):
            self.assertFalse(sync.ci_verified_asset(SHA, digest))

    def test_healthy_old_php_cannot_confirm_a_new_frontend(self):
        class Reply(io.BytesIO):
            headers = {'X-Tina-Api-Source': SHA, 'X-Tina-Store-Source': 'old'}
        with patch.object(sync, 'build_opener') as opener:
            opener.return_value.open.return_value = Reply(b'{"enabled":true}')
            with self.assertRaises(ValueError):
                sync.download(sync.SITE + '/tina-preview/api/booking.php?action=health', revision=SHA, store=True)

    def test_domain_confirmation_is_independent_of_github_quota(self):
        limited = Mock(side_effect=OSError('HTTP 403: rate limit exceeded'))
        with patch.object(sync, 'verify_live') as verify:
            self.assertTrue(sync.wait_for_domain(SHA, limited, timeout=0))
        verify.assert_called_once_with(SHA)
        limited.assert_not_called()

    def test_delayed_domain_retries_after_ref_outage_and_preserves_domain_error(self):
        limited = Mock(side_effect=OSError('HTTP 403: rate limit exceeded'))
        with patch.object(sync, 'verify_live', side_effect=[ValueError('previous release'), None]), patch.object(sync.time, 'sleep'):
            self.assertTrue(sync.wait_for_domain(SHA, limited))
        limited.assert_called_once_with()
        with patch.object(sync, 'verify_live', side_effect=ValueError('previous release')):
            with self.assertRaisesRegex(ValueError, 'previous release'):
                sync.wait_for_domain(SHA, limited, timeout=0)
            self.assertFalse(sync.wait_for_domain(SHA, lambda: 'c' * 40, timeout=0))

    def curl_process(self, headers, body):
        def start(command, **kwargs):
            self.assertEqual(command[:2], ['curl', '-q'], 'Do not inherit account curlrc redirects or TLS settings')
            self.assertNotIn('--insecure', command)
            self.assertNotIn('--location', command)
            self.assertEqual(command[command.index('--proto') + 1], '=https')
            Path(command[command.index('--dump-header') + 1]).write_bytes(headers)
            return Mock(stdout=io.BytesIO(body), communicate=Mock(return_value=(b'', b'')),
                        returncode=0, poll=Mock(return_value=0))
        return start

    def test_host_curl_checks_php_headers_without_disabling_tls(self):
        headers = ('HTTP/2 200\r\nX-Tina-Api-Source: ' + SHA + '\r\nX-Tina-Store-Source: ' + SHA + '\r\n\r\n').encode()
        with patch.dict(os.environ, {'TINA_RELEASE_CURL': '1'}), patch.object(sync, 'build_opener') as urllib, \
             patch('subprocess.Popen', side_effect=self.curl_process(headers, b'{"enabled":true}')):
            self.assertEqual(sync.read_json(sync.SITE + '/tina-preview/api/booking.php?action=health', revision=SHA, store=True), {'enabled': True})
            urllib.assert_not_called()
            with self.assertRaisesRegex(ValueError, 'different release'):
                sync.download(sync.SITE, revision='c' * 40)

    def test_host_curl_bounds_content_and_checks_each_redirect(self):
        with patch.dict(os.environ, {'TINA_RELEASE_CURL': '1'}), \
             patch.object(sync, 'build_opener', side_effect=AssertionError('Host selected the system TLS client')):
            for target in ('http://github.com/archive', 'https://unexpected.example/archive'):
                headers = ('HTTP/2 302\r\nLocation: ' + target + '\r\n\r\n').encode()
                with patch('subprocess.Popen', side_effect=self.curl_process(headers, b'')) as request:
                    with self.assertRaisesRegex(ValueError, 'redirect'):
                        sync.download(sync.API)
                    self.assertEqual(request.call_count, 1)
            with patch('subprocess.Popen', side_effect=self.curl_process(b'HTTP/2 200\r\n\r\n', b'oversized')):
                with self.assertRaisesRegex(ValueError, 'size limit'):
                    sync.download(sync.API, limit=4)
            with patch('subprocess.Popen', side_effect=self.curl_process(b'HTTP/2 404\r\n\r\n', b'not published')):
                with self.assertRaises(HTTPError) as error:
                    sync.download(sync.API)
                self.assertEqual(error.exception.code, 404)

    def test_host_curl_follows_allowed_asset_redirect_and_uses_final_headers(self):
        replies = iter([
            (b'HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 302\r\nLocation: https://release-assets.githubusercontent.com/salon.zip\r\n\r\n', b''),
            (b'HTTP/2 200\r\nContent-Type: application/zip\r\n\r\n', b'verified-package'),
        ])
        def request(command, **kwargs):
            return self.curl_process(*next(replies))(command, **kwargs)
        with patch.dict(os.environ, {'TINA_RELEASE_CURL': '1'}), patch('subprocess.Popen', side_effect=request) as client:
            self.assertEqual(sync.download('https://github.com/salon.zip'), b'verified-package')
        self.assertEqual(client.call_args_list[-1].args[0][-1], 'https://release-assets.githubusercontent.com/salon.zip')

    def test_installs_only_the_named_private_shell_runner(self):
        self.install(package({'tina-booking-runtime/tina-run-release.sh': '#!/bin/sh\n'}), lambda _: None)
        self.assertEqual((self.home / 'tina-booking-runtime/tina-run-release.sh').read_text(), '#!/bin/sh\n')
        self.assertFalse(sync.is_code_path('tina-booking-runtime/other.sh'))
        self.assertFalse(sync.is_code_path(PUBLIC + 'tina-run-release.sh'))


if __name__ == '__main__':
    unittest.main()
