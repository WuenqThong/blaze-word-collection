import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.routers.deps import get_current_user


class DialectFlowTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.users = [User(email=f"u{i}@example.test", full_name=f"User {i}", password_hash="test", role=role, account_status="active") for i, role in enumerate(["annotator", "reviewer", "reviewer", "admin", "annotator"])]
        self.db.add_all(self.users)
        self.db.commit()
        self.current = self.users[0]
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.current
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def create(self, train=True):
        body = dict(kind="word", original_text="từ thử nghiệm", meaning="nghĩa thử", standard_vi="bản phổ thông", region="Quảng Nam", context="ví dụ trong gia đình", source_evidence="nghe từ nhỏ", consent_collect=True, consent_train=train, consent_public=False, consent_version="dialect-2026-11-v1", idempotency_key="test-idempotency-123")
        r = self.client.post("/api/dialect/contributions", json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json(), body

    def review(self, cid):
        vote = dict(verdict="VERIFIED", meaning_ok=True, region_ok=True, context_ok=True, translation_ok=True, note="Đã đối chiếu phù hợp")
        for user in self.users[1:3]:
            self.current = user
            r = self.client.post(f"/api/dialect/reviews/{cid}/votes", json=vote)
            self.assertEqual(r.status_code, 200, r.text)

    def test_lifecycle_and_permissions(self):
        item, body = self.create()
        cid = item["id"]
        self.assertEqual(self.client.post("/api/dialect/contributions", json=body).json()["id"], cid)
        body["meaning"] = "changed"
        self.assertEqual(self.client.post("/api/dialect/contributions", json=body).status_code, 409)
        self.current = self.users[4]
        self.assertEqual(self.client.get(f"/api/dialect/contributions/{cid}").status_code, 403)
        self.assertEqual(self.client.post("/api/dialect/releases").status_code, 403)
        self.current = self.users[1]
        self.assertEqual(self.client.get(f"/api/dialect/contributions/{cid}").json()["votes"], [])
        self.review(cid)
        self.current = self.users[3]
        self.assertEqual(self.client.post("/api/dialect/releases").status_code, 409)
        self.assertEqual(self.client.post(f"/api/dialect/sources/{item['source_id']}/rights", json={"rights_confirmed": True, "note": "Đã rà soát bằng chứng"}).status_code, 200)
        release = self.client.post("/api/dialect/releases")
        self.assertEqual(release.status_code, 201, release.text)
        rid = release.json()["id"]
        self.assertEqual(self.client.get(f"/api/dialect/releases/{rid}").json()["manifest"]["count"], 1)
        self.current = self.users[0]
        self.assertEqual(self.client.post(f"/api/dialect/contributions/{cid}/withdraw").status_code, 200)
        self.current = self.users[3]
        self.assertEqual(self.client.get(f"/api/dialect/releases/{rid}").status_code, 409)
        self.assertEqual(self.client.post("/api/dialect/releases").status_code, 409)

    def test_training_opt_out_is_excluded(self):
        item, _ = self.create(train=False)
        self.review(item["id"])
        self.current = self.users[3]
        self.client.post(f"/api/dialect/sources/{item['source_id']}/rights", json={"rights_confirmed": True, "note": "Đủ quyền nguồn"})
        self.assertEqual(self.client.post("/api/dialect/releases").status_code, 409)

    def test_release_preview_and_stale_confirmation(self):
        item, _ = self.create()
        cid = item["id"]
        # A contributor cannot inspect other participants' export candidates.
        self.assertEqual(self.client.get("/api/dialect/releases/preview").status_code, 403)
        self.current = self.users[3]
        preview = self.client.get("/api/dialect/releases/preview").json()
        self.assertEqual(preview["eligible_count"], 0)
        self.assertIn("Chưa xác nhận quyền nguồn", preview["items"][0]["reasons"])
        stale_digest = preview["preview_digest"]
        self.review(cid)
        self.current = self.users[3]
        self.client.post(f"/api/dialect/sources/{item['source_id']}/rights", json={"rights_confirmed": True, "note": "Confirmed source"})
        self.assertEqual(self.client.post("/api/dialect/releases", json={"preview_digest": stale_digest}).status_code, 409)
        preview = self.client.get("/api/dialect/releases/preview").json()
        self.assertEqual(preview["eligible_count"], 1)
        self.assertTrue(preview["items"][0]["eligible"])
        result = self.client.post("/api/dialect/releases", json={"preview_digest": preview["preview_digest"]})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(self.client.get("/api/dialect/releases").json()[0]["affected_count"], 0)
        self.current = self.users[0]
        self.client.post(f"/api/dialect/contributions/{cid}/withdraw")
        self.current = self.users[3]
        self.assertEqual(self.client.get("/api/dialect/releases").json()[0]["affected_count"], 1)

    def test_review_filters_and_hold_visibility(self):
        item, _ = self.create()
        cid = item["id"]
        self.current = self.users[1]
        self.assertEqual(self.client.get("/api/dialect/reviews?region=Đà Nẵng").json()["total"], 0)
        self.assertEqual(self.client.get("/api/dialect/reviews?region=Quảng Nam&source_rights=pending").json()["total"], 1)
        self.assertEqual(self.client.get("/api/dialect/reviews?source_rights=confirmed").json()["total"], 0)
        for user in self.users[1:3]:
            self.current = user
            result = self.client.post(f"/api/dialect/reviews/{cid}/votes", json=dict(verdict="HOLD", meaning_ok=False, region_ok=False, context_ok=False, translation_ok=False, note="Need context"))
            self.assertEqual(result.status_code, 200)
        self.current = self.users[3]
        self.assertEqual(self.client.get("/api/dialect/reviews?view=hold").json()["items"][0]["id"], cid)
        self.assertEqual(self.client.get("/api/dialect/reviews?view=pending").json()["total"], 0)

    def test_source_and_participant_filters(self):
        item, _ = self.create()
        self.current = self.users[3]
        sources = self.client.get("/api/dialect/sources?query=nghe&rights_status=pending").json()
        self.assertEqual(sources["total"], 1)
        self.assertEqual(sources["items"][0]["contributions"][0]["id"], item["id"])
        self.assertEqual(self.client.get("/api/dialect/sources?rights_status=confirmed").json()["total"], 0)
        self.assertEqual(self.client.get("/api/dialect/participants?role=reviewer").json()["total"], 2)
        self.assertEqual(self.client.get("/api/dialect/participants?role=reviewer&query=User 1").json()["total"], 1)


if __name__ == "__main__":
    unittest.main()
