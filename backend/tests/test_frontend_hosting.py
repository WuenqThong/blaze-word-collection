import tempfile
import unittest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.frontend import FrontendFiles


class FrontendHostingTests(unittest.TestCase):
    def test_same_origin_spa_api_and_missing_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'index.html').write_text('<h1>Blaze</h1>', encoding='utf-8')
            Path(directory, 'asset.js').write_text('export{}', encoding='utf-8')
            app = FastAPI()
            @app.get('/api/health')
            def health(): return {'status': 'ok'}
            app.mount('/', FrontendFiles(directory=directory, html=True))
            with TestClient(app) as client:
                for path in ['/', '/login', '/demo/game/abc', '/demo/reviewer/review', '/demo/admin/dashboard']:
                    self.assertIn('Blaze', client.get(path).text)
                self.assertEqual(client.get('/api/health').json(), {'status': 'ok'})
                self.assertEqual(client.get('/asset.js').status_code, 200)
                for path in ['/api/not-found', '/assets/missing.js', '/.env', '/unknown.json']:
                    self.assertEqual(client.get(path).status_code, 404, path)
