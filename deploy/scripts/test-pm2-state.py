#!/usr/bin/env python3
"""A status failure must not fall back to a daemon-starting CLI query."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).with_name('codevalley-release.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PM2StateRead(unittest.TestCase):
    def setUp(self):
        self.active = 'active'
        self.file_pid = '4242'
        self.socket_present = True
        self.rpc_error = False
        self.payload = [{'name': 'fixture', 'pm2_env': {'env': {'fixture': 'preserved'}}}]
        self.queries = []

    def command(self, args, timeout=30):
        self.queries.append(args)
        if args == ['systemctl', 'is-active', 'pm2-root']:
            return self.active
        if args == ['systemctl', 'show', 'pm2-root', '-p', 'MainPID', '--value']:
            return '4242'
        if args[0] == '/fixture/node':
            if self.rpc_error:
                raise subprocess.CalledProcessError(2, args)
            return json.dumps(self.payload)
        self.fail('Unexpected process invocation; status reads may not start PM2')

    def read(self):
        with patch.object(publisher, 'command', self.command), \
             patch.object(Path, 'read_text', return_value=self.file_pid), \
             patch.object(Path, 'is_socket', return_value=self.socket_present), \
             patch.object(publisher.os, 'readlink', return_value='/fixture/node'):
            return publisher.read_pm2_state()

    def test_running_state_preserves_release_environment(self):
        self.assertEqual(self.read(), self.payload)

    def test_inactive_service_never_starts_a_client(self):
        self.active = 'inactive'
        with self.assertRaises(RuntimeError):
            self.read()
        self.assertEqual(len(self.queries), 1)

    def test_stale_daemon_identity_is_rejected(self):
        self.file_pid = '4243'
        with self.assertRaises(RuntimeError):
            self.read()
        self.assertFalse(any(a[0] == '/fixture/node' for a in self.queries))

    def test_missing_socket_does_not_spawn_daemon(self):
        self.socket_present = False
        with self.assertRaises(RuntimeError):
            self.read()
        self.assertFalse(any(a[0] == '/fixture/node' for a in self.queries))

    def test_failed_rpc_does_not_fall_back(self):
        self.rpc_error = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.read()
        self.assertEqual(sum(a[0] == '/fixture/node' for a in self.queries), 1)

    def test_non_list_rpc_response_is_rejected(self):
        self.payload = {'unexpected': True}
        with self.assertRaises(RuntimeError):
            self.read()


if __name__ == '__main__':
    unittest.main()
