import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.audit import request_id_context
from app.core.config import Settings
from app.core.database import get_db
from app.core.http_security import HttpSecurityMiddleware, consume, throttles


def production(**overrides):
    values = dict(environment="production", debug=False, cookie_secure=True,
                  jwt_secret="fd74b285e9310dacc8684a7c39bb6fa205f1e8a98e627445",
                  cors_origins=["https://pilot.company.test"])
    values.update(overrides)
    return Settings(_env_file=None, **values)


class ConfigTest(unittest.TestCase):
    def test_validation_error_does_not_echo_secrets(self):
        secret = "startup-private-secret-value-48392"
        for overrides in ({"debug": True}, {"rate_limit_auth": "invalid"}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError) as caught:
                production(jwt_secret=secret, **overrides)
            rendered = str(caught.exception)
            self.assertNotIn(secret, rendered)
            self.assertNotIn("input_value=", rendered)

    def test_valid(self):
        self.assertEqual(production().environment, "production")
        self.assertFalse(Settings(_env_file=None).enable_legacy)

    def test_rejected(self):
        for change in ({"debug": True}, {"cookie_secure": False}, {"jwt_secret": "dev-secret-change-me"},
                       {"jwt_secret": "a" * 64}, {"enable_legacy": True}, {"rate_limit_enabled": False},
                       {"cors_origins": ["*"]}, {"cors_origins": ["http://app.test"]},
                       {"cors_origins": ["https://*.test"]}, {"trusted_proxy_ips": ["0.0.0.0/0"]}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                production(**change)


class HttpSecurityTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine("sqlite:///" + str(Path(self.temp.name) / "test.db"), connect_args={"check_same_thread": False})
        throttles.metadata.create_all(self.engine)
        sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        def database():
            with sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = database
        self.now = 120
        @self.app.post("/api/auth/login")
        def login():
            return {"request_id": request_id_context.get()}
        @self.app.post("/api/auth/reset-password")
        def reset():
            return {}
        @self.app.post("/api/dialect/contributions/{cid}/consent")
        def contribution(cid: str):
            return {}
        @self.app.get("/explode")
        def explode():
            raise ValueError("password=secret-token")
        self.app.add_middleware(HttpSecurityMiddleware, settings=Settings(_env_file=None, environment="test", rate_limit_auth=2, rate_limit_password=1, rate_limit_contributions=1), clock=lambda: self.now)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()
        self.temp.cleanup()

    def test_persistent_limit_window_cookie_and_forwarded_spoof(self):
        self.assertEqual(self.client.post("/api/auth/login").status_code, 200)
        with TestClient(self.app) as other:
            self.assertEqual(other.post("/api/auth/login").status_code, 200)
            response = other.post("/api/auth/login", headers={"cookie": "access_token=fake", "x-forwarded-for": "1.2.3.4"})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers["retry-after"], "60")
            self.now = 180
            self.assertEqual(other.post("/api/auth/login").status_code, 200)

    def test_normalized_groups(self):
        for path in ("/api/auth/reset-password", "/api/dialect/contributions/1/consent"):
            self.assertEqual(self.client.post(path).status_code, 200)
            self.assertEqual(self.client.post(path.replace("/1/", "/999/")).status_code, 429)

    def test_safe_logs_and_context(self):
        with self.assertLogs("app.http_security", level="INFO") as logs:
            response = self.client.get("/explode?token=query-secret", headers={"authorization": "Bearer header-secret", "x-request-id": "attacker"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Internal server error"})
        record = json.loads(logs.records[0].message)
        self.assertEqual(record["exception_class"], "ValueError")
        self.assertEqual(record["request_id"], response.headers["x-request-id"])
        self.assertNotIn("secret", logs.records[0].message)
        self.assertNotIn("attacker", logs.records[0].message)
        result = self.client.post("/api/auth/login")
        self.assertEqual(result.json()["request_id"], result.headers["x-request-id"])

    def test_atomic_concurrency(self):
        with ThreadPoolExecutor(max_workers=8) as workers:
            results = list(workers.map(lambda _: consume({"app": self.app}, "a" * 64, 1, 5), range(20)))
        self.assertEqual(sum(results), 5)

    def test_https_boundary(self):
        app = FastAPI()
        @app.get("/")
        def index():
            return {}
        app.add_middleware(HttpSecurityMiddleware, settings=production())
        with TestClient(app) as client:
            self.assertEqual(client.get("/", headers={"x-forwarded-proto": "https"}).status_code, 400)
        with TestClient(app, base_url="https://testserver") as client:
            result = client.get("/")
            self.assertEqual(result.status_code, 200)
            self.assertIn("strict-transport-security", result.headers)
