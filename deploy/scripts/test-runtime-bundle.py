#!/usr/bin/env python3
"""Negative checks for the deployment archive trust boundary."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import unittest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).with_name('codevalley-release.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class BundleValidation(unittest.TestCase):
    def bundle(self, extra=None, family='xianglin', tamper=False, duplicate=False):
        payload = {'package-lock.json': b'{}', 'dist/src/main.js': b'console.log(1)'}
        manifest = {'schema': 1, 'family': family, 'node_major': 24,
                    'dependency_lock_sha256': hashlib.sha256(payload['package-lock.json']).hexdigest(),
                    'files': {k: hashlib.sha256(v).hexdigest() for k, v in payload.items()}}
        if tamper:
            payload['dist/src/main.js'] = b'console.log(2)'
        payload['release-manifest.json'] = json.dumps(manifest).encode()
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            for name, data in payload.items():
                member = tarfile.TarInfo(name); member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
                if duplicate:
                    archive.addfile(member, io.BytesIO(data)); duplicate = False
            if extra:
                archive.addfile(extra, io.BytesIO(b''))
        stream.seek(0)
        return tarfile.open(fileobj=stream, mode='r:gz')

    def test_valid(self):
        with self.bundle() as archive:
            self.assertEqual(publisher.read_bundle(archive, 'xianglin')['family'], 'xianglin')

    def test_changed_content(self):
        with self.bundle(tamper=True) as archive, self.assertRaises(RuntimeError):
            publisher.read_bundle(archive, 'xianglin')

    def test_wrong_family(self):
        with self.bundle(family='zhimeng') as archive, self.assertRaises(RuntimeError):
            publisher.read_bundle(archive, 'xianglin')

    def test_duplicate(self):
        with self.bundle(duplicate=True) as archive, self.assertRaises(RuntimeError):
            publisher.read_bundle(archive, 'xianglin')

    def test_escape(self):
        for name in ('../escape', '/etc/escape', 'dist/../../escape'):
            with self.subTest(name=name), self.bundle(extra=tarfile.TarInfo(name)) as archive, self.assertRaises(RuntimeError):
                publisher.read_bundle(archive, 'xianglin')

    def test_secret_or_dependencies(self):
        for name in ('.env', 'src/.env', 'node_modules/a.js'):
            with self.subTest(name=name), self.bundle(extra=tarfile.TarInfo(name)) as archive, self.assertRaises(RuntimeError):
                publisher.read_bundle(archive, 'xianglin')

    def test_links_and_devices(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE):
            member = tarfile.TarInfo('dist/bad'); member.type = kind; member.linkname = '/etc/escape'
            with self.subTest(kind=kind), self.bundle(extra=member) as archive, self.assertRaises(RuntimeError):
                publisher.read_bundle(archive, 'xianglin')

    def test_unlisted_file(self):
        with self.bundle(extra=tarfile.TarInfo('dist/unlisted.js')) as archive, self.assertRaises(RuntimeError):
            publisher.read_bundle(archive, 'xianglin')


if __name__ == '__main__':
    unittest.main()
