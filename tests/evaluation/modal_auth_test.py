"""Offline SDK-auth regression; never imports the real Modal client."""
import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


class ModalAuthTest(unittest.TestCase):
    def load(self, reject):
        calls = []
        class Client:
            @staticmethod
            def from_env():
                calls.append('initialize')
                return Client()
            def hello(self):
                calls.append('authenticate')
                if reject:
                    raise RuntimeError('synthetic malformed credentials')
        class App:
            def __init__(self, *args): pass
            def function(self, **kwargs): return lambda fn: fn
        fake = types.SimpleNamespace(Client=Client, App=App, __version__='mock',
                                    Image=types.SimpleNamespace(debian_slim=lambda **kwargs: None))
        source = Path(__file__).resolve().parents[2] / 'scripts/evaluation-modal.py'
        spec = importlib.util.spec_from_file_location('modal_eval_auth', source)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'modal': fake}):
            spec.loader.exec_module(module)
        return module, calls

    def test_failed_handshake_never_claims_authenticated(self):
        module, calls = self.load(True)
        output = io.StringIO()
        with patch.object(sys, 'argv', ['evaluation-modal.py', 'metadata']), contextlib.redirect_stdout(output):
            with self.assertRaisesRegex(RuntimeError, 'malformed'):
                module.main()
        self.assertEqual(calls, ['initialize', 'authenticate'])
        self.assertNotIn('authenticated', output.getvalue())

    def test_success_requires_actual_handshake(self):
        module, calls = self.load(False)
        output = io.StringIO()
        with patch.object(sys, 'argv', ['evaluation-modal.py', 'metadata']), contextlib.redirect_stdout(output):
            module.main()
        self.assertEqual(calls, ['initialize', 'authenticate'])
        self.assertIn('"authenticated": true', output.getvalue())


if __name__ == '__main__': unittest.main()
