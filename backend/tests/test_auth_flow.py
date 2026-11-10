"""Real password/cookie flow against an isolated temporary database."""
import os
import subprocess
import sys
import tempfile
import unittest


class AuthFlowTests(unittest.TestCase):
    def test_registration_login_session_and_logout(self):
        with tempfile.TemporaryDirectory() as directory:
            env = dict(os.environ, DATABASE_URL='sqlite:///' + directory.replace('\\', '/') + '/auth.db')
            code = '''
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import engine
with TestClient(app) as client:
    assert client.get('/api/auth/me').status_code == 401
    payload = {'email': 'qa-auth@example.com', 'full_name': 'QA Auth', 'password': 'Temporary-auth-123'}
    response = client.post('/api/auth/register', json=payload)
    assert response.status_code == 201, response.text
    assert response.json()['user']['role'] == 'annotator'
    assert 'HttpOnly' in response.headers['set-cookie']
    assert client.get('/api/auth/me').status_code == 200
    assert client.post('/api/auth/register', json=payload).status_code == 409
    assert client.post('/api/auth/logout').status_code == 204
    assert client.get('/api/auth/me').status_code == 401
    assert client.post('/api/auth/login', json={'email': payload['email'], 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': payload['email'], 'password': payload['password']}).status_code == 200
    me = client.get('/api/auth/me')
    assert me.json()['email'] == payload['email']
    assert 'set-cookie' not in me.headers  # fresh token: no renewal
    # A token past half its lifetime is renewed on use (sliding session).
    import time
    from jose import jwt
    from app.core.config import get_settings
    s = get_settings()
    old = jwt.encode({'sub': str(me.json()['id']), 'role': 'annotator', 'iat': int(time.time()) - s.access_token_ttl_min * 45,
                      'exp': int(time.time()) + s.access_token_ttl_min * 15}, s.jwt_secret, algorithm=s.jwt_alg)
    client.cookies.set(s.cookie_name, old)
    renewed = client.get('/api/auth/me')
    assert renewed.status_code == 200 and s.cookie_name + '=' in renewed.headers.get('set-cookie', ''), renewed.headers
    # Profile: rename (whitespace collapsed), blank rejected.
    assert client.patch('/api/auth/me', json={'full_name': '  Ngọc   Anh '}).json()['full_name'] == 'Ngọc Anh'
    assert client.patch('/api/auth/me', json={'full_name': '   '}).status_code == 422
    # Password: wrong current is 400 (not 401), same password refused, then old one stops working.
    assert client.post('/api/auth/password', json={'current_password': 'nope', 'new_password': 'Another-pass-456'}).status_code == 400
    assert client.post('/api/auth/password', json={'current_password': payload['password'], 'new_password': payload['password']}).status_code == 400
    changed = client.post('/api/auth/password', json={'current_password': payload['password'], 'new_password': 'Another-pass-456'})
    assert changed.status_code == 204 and s.cookie_name + '=' in changed.headers.get('set-cookie', '')
    assert client.get('/api/auth/me').status_code == 200
    client.cookies.clear()  # also drops the hand-made cookie set above
    assert client.patch('/api/auth/me', json={'full_name': 'x'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': payload['email'], 'password': payload['password']}).status_code == 401
    assert client.post('/api/auth/login', json={'email': payload['email'], 'password': 'Another-pass-456'}).status_code == 200
engine.dispose()
'''
            result = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)


if __name__ == '__main__':
    unittest.main()
