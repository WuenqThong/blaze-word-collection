"""Verify pilot route removal independently of cached app/settings imports."""
import os
import subprocess
import sys
import unittest


class PilotScopeTests(unittest.TestCase):
    def test_legacy_api_requires_explicit_enablement(self):
        for enabled in ('false', 'true'):
            with self.subTest(enabled=enabled):
                code = '''
import os
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.main import app
enabled = os.environ['ENABLE_LEGACY'] == 'true'
client = TestClient(app)
paths = client.get('/openapi.json').json()['paths']
assert '/api/auth/me' in paths and '/api/dialect/contributions' in paths
assert client.get('/api/health').status_code == 200
assert ('/api/projects' in paths) == enabled
if not enabled:
    for prefix in ('/api/projects', '/api/roleplay', '/api/me/', '/api/admin/', '/api/users'):
        assert not any(p.startswith(prefix) for p in paths), prefix
    for path in ('/api/projects', '/api/projects/1/tasks', '/api/projects/1/tasks/1/presigned',
                 '/api/projects/1/tasks/1/annotators', '/api/roleplay/tasks', '/api/me/withdrawals',
                 '/api/admin/withdrawals', '/api/admin/reports', '/api/users'):
        for method in ('GET', 'POST', 'DELETE'):
            assert client.request(method, path).status_code == 404, (method, path)
    try:
        with client.websocket_connect('/api/roleplay/tasks/1/ws'):
            raise AssertionError('Legacy WebSocket accepted in pilot')
    except WebSocketDisconnect:
        pass
'''
                result = subprocess.run([sys.executable, '-c', code],
                                        env=dict(os.environ, ENABLE_LEGACY=enabled, DATABASE_URL='sqlite://'),
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
