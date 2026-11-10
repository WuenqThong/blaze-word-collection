import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.routers.deps import get_current_user

VOTE = dict(verdict="VERIFIED", meaning_ok=True, region_ok=True, context_ok=True, translation_ok=True, note="Đã đối chiếu")
CONSENT = dict(collect=True, train=True, public=False, audio=False, version="demo-consent-v1")


class WorkspaceTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        roles = ["annotator", "reviewer", "reviewer", "admin", "annotator"]
        self.users = [User(email=f"w{i}@example.test", full_name=f"W {i}", password_hash="x", role=r, account_status="active") for i, r in enumerate(roles)]
        self.db.add_all(self.users)
        self.db.commit()
        self.as_user(0)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.current
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def as_user(self, i):
        self.current = self.users[i]

    def contribute(self, key, **extra):
        body = dict(kind="word", original_text="mô", meaning="đâu", standard_vi="đâu", region="Hội An", context="đi mô rứa",
                    source_evidence="nghe ở nhà", consent_collect=True, consent_train=True, consent_version="demo-consent-v1",
                    idempotency_key=key)
        body.update(extra)
        r = self.client.post("/api/dialect/contributions", json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def verify(self, cid):
        for i in (1, 2):
            self.as_user(i)
            self.assertEqual(self.client.post(f"/api/dialect/reviews/{cid}/votes", json=VOTE).status_code, 200)

    def make_eligible(self, cid, source_id):
        self.verify(cid)
        self.as_user(3)
        self.assertEqual(self.client.post(f"/api/dialect/sources/{source_id}/rights", json={"rights_confirmed": True, "note": "ok", "title": "Gia đình", "public": True}).status_code, 200)
        r = self.client.post(f"/api/dialect/reviews/{cid}/curate", json={"raw": {"text": "mô", "meaning": "đâu", "standard": "đâu", "context": "đi mô rứa"}, "sense_id": "mo-1"})
        self.assertEqual(r.status_code, 200, r.text)

    def allocate(self, ref, exams, played=()):
        r = self.client.post("/api/dialect/allocation", json={"session_ref": ref, "exam_ids": list(exams), "played": list(played)})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_allocation_balances_plays_across_accounts(self):
        exams = [f"dataset1-bank-{n:02d}" for n in range(1, 4)]
        picked = []
        for i, ref in enumerate(["a", "b", "c"]):
            self.as_user([0, 4, 1][i])
            picked.append(self.allocate(ref, exams)["exam_id"])
        self.assertEqual(sorted(picked), exams)  # three different accounts get three different exams
        self.as_user(0)
        again = self.allocate("a", exams)
        self.assertEqual(again["exam_id"], picked[0])  # same session ref is idempotent
        self.as_user(4)
        self.assertEqual(self.client.post("/api/dialect/allocation", json={"session_ref": "a", "exam_ids": exams}).status_code, 409)
        # Withdrawing a session frees its slot for the next player.
        self.as_user(1)
        self.assertEqual(self.client.post("/api/dialect/sessions/c/withdraw").status_code, 200)
        self.as_user(2)
        self.assertEqual(self.allocate("d", exams)["exam_id"], picked[2])

    def test_allocation_skips_exams_finished_on_any_device(self):
        exams = ["exam-x", "exam-y"]
        first = self.allocate("s1", exams)["exam_id"]
        self.contribute("session-s1:q3", method="game", session_ref="s1")  # submitted from device one
        other = [e for e in exams if e != first][0]
        # Another account plays the other exam twice, so it is now the busier one.
        self.as_user(4)
        for ref in ("o1", "o2"):
            self.allocate(ref, [other])
        self.as_user(0)
        second = self.allocate("s2", exams)
        self.assertEqual(second["exam_id"], other)
        self.assertFalse(second["repeat"])
        # Locally finished exams are skipped too, then the pool repeats.
        third = self.allocate("s3", exams, played=[other])
        self.assertTrue(third["repeat"])
        self.assertEqual(third["exam_id"], first)

    def test_game_answers_are_partial_and_duplicates_held(self):
        first = self.contribute("game-session-1:q1", method="game", meaning="", standard_vi="", context="", session_ref="session-1")
        self.assertEqual(first["status"], "RAW")
        self.assertEqual(first["meta"]["session_ref"], "session-1")
        self.assertEqual(first["client_ref"], "game-session-1:q1")
        # A direct entry still needs every descriptive field.
        bad = self.client.post("/api/dialect/contributions", json=dict(kind="word", original_text="mô", region="Hội An", consent_collect=True, consent_version="demo-consent-v1", idempotency_key="direct-missing"))
        self.assertEqual(bad.status_code, 422)
        self.as_user(4)
        dup = self.contribute("game-session-2:q1", method="game", meaning="", standard_vi="", context="", session_ref="session-2")
        self.assertEqual(dup["status"], "HOLD")
        self.assertEqual(dup["meta"]["duplicate_of"], first["id"])
        self.as_user(1)
        self.assertEqual(self.client.post(f"/api/dialect/reviews/{dup['id']}/votes", json=VOTE).status_code, 409)
        # Withdrawing a session only touches the caller's own items.
        self.as_user(0)
        self.assertEqual(self.client.post("/api/dialect/sessions/session-2/withdraw").json()["withdrawn"], 0)
        self.assertEqual(self.client.post("/api/dialect/sessions/session-1/withdraw").json()["withdrawn"], 1)

    def test_workspace_visibility(self):
        item = self.contribute("visible-1")
        self.as_user(4)
        ws = self.client.get("/api/dialect/workspace").json()
        self.assertEqual(ws["contributions"], [])
        self.assertEqual([p["id"] for p in ws["people"]], [self.users[4].id])
        self.assertEqual(ws["releases"], [])
        self.as_user(1)
        ws = self.client.get("/api/dialect/workspace").json()
        self.assertEqual(ws["contributions"][0]["id"], item["id"])
        self.assertEqual(ws["contributions"][0]["votes"], [])
        self.as_user(3)
        self.assertEqual(len(self.client.get("/api/dialect/workspace").json()["people"]), 5)

    def test_consent_override_controls_eligibility(self):
        item = self.contribute("consent-1")
        self.make_eligible(item["id"], item["source_id"])
        self.assertEqual(self.client.get("/api/dialect/releases/preview").json()["eligible_count"], 1)
        self.as_user(0)
        r = self.client.post(f"/api/dialect/contributions/{item['id']}/consent", json={"consent": {**CONSENT, "train": False}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["consent"]["train"])
        self.as_user(3)
        self.assertEqual(self.client.get("/api/dialect/releases/preview").json()["eligible_count"], 0)
        self.as_user(4)
        self.assertEqual(self.client.post(f"/api/dialect/contributions/{item['id']}/consent", json={"consent": CONSENT}).status_code, 403)
        self.as_user(0)
        self.client.post(f"/api/dialect/contributions/{item['id']}/consent", json={"consent": CONSENT, "withdraw": True})
        self.assertEqual(self.client.post(f"/api/dialect/contributions/{item['id']}/consent", json={"consent": CONSENT}).status_code, 409)

    def test_owner_cannot_curate_own_item(self):
        self.as_user(3)
        item = self.contribute("own-curate")
        self.verify(item["id"])
        self.as_user(3)
        r = self.client.post(f"/api/dialect/reviews/{item['id']}/curate", json={"raw": {"text": "mô"}})
        self.assertEqual(r.status_code, 403)

    def test_curated_release_with_splits(self):
        item = self.contribute("release-1")
        self.as_user(3)
        self.assertEqual(self.client.post("/api/dialect/releases", json={"ids": [item["id"]]}).status_code, 409)
        self.make_eligible(item["id"], item["source_id"])
        r = self.client.post("/api/dialect/releases", json={"ids": [item["id"]], "splits": {str(item["id"]): "dev"}, "data_card": "Thử nghiệm"})
        self.assertEqual(r.status_code, 201, r.text)
        listed = self.client.get("/api/dialect/releases").json()[0]
        self.assertEqual(listed["splits"], {str(item["id"]): "dev"})
        self.assertTrue(listed["curated"])
        download = self.client.get(f"/api/dialect/releases/{r.json()['id']}").json()
        self.assertEqual(download["records"][0]["curated"]["text"], "mô")
        self.assertEqual(download["manifest"]["data_card"], "Thử nghiệm")

    def test_credit_rules(self):
        item = self.contribute("credit-1")
        self.make_eligible(item["id"], item["source_id"])
        grant = lambda: self.client.post("/api/dialect/credits", json={"contribution_id": item["id"]})
        self.assertEqual(grant().status_code, 409)  # policy off
        self.client.put("/api/dialect/rewards/policy", json={"enabled": True})
        self.assertEqual(grant().status_code, 409)  # owner not verified
        self.client.put(f"/api/dialect/participants/{self.users[0].id}", json={"verified": True})
        r = grant()
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(grant().status_code, 409)  # once per contribution
        self.as_user(0)
        self.assertEqual(self.client.post("/api/dialect/credits/spend", json={"amount": 6}).status_code, 409)
        self.assertEqual(self.client.post("/api/dialect/credits/spend", json={"amount": 2}).status_code, 200)
        self.assertEqual(self.client.get("/api/dialect/workspace").json()["credits"][0]["used"], 2)
        self.assertEqual(self.client.post(f"/api/dialect/credits/{r.json()['id']}/revoke").status_code, 403)

    def test_feedback_and_participants(self):
        self.as_user(4)
        fb = self.client.post("/api/dialect/feedback", json={"entity": "c:1", "text": "Cần thêm ngữ cảnh"}).json()
        self.assertEqual(self.client.post(f"/api/dialect/feedback/{fb['id']}/resolve").status_code, 403)
        self.as_user(1)
        self.assertEqual(self.client.post(f"/api/dialect/feedback/{fb['id']}/resolve").json()["status"], "resolved")
        self.as_user(3)
        r = self.client.put(f"/api/dialect/participants/{self.users[1].id}", json={"review_region": "Đà Nẵng", "risk": "hold"})
        self.assertEqual(r.json()["review_region"], "Đà Nẵng")
        self.assertEqual(self.client.put(f"/api/dialect/participants/{self.users[3].id}", json={"role": "reviewer"}).status_code, 409)
        # A reviewer limited to another region cannot vote here.
        self.as_user(0)
        item = self.contribute("region-1")
        self.as_user(1)
        self.assertEqual(self.client.post(f"/api/dialect/reviews/{item['id']}/votes", json=VOTE).status_code, 403)
        self.as_user(4)
        self.assertEqual(self.client.post("/api/dialect/me/appeal", json={"text": "Xin rà soát lại"}).json()["appeal"], "Xin rà soát lại")


if __name__ == "__main__":
    unittest.main()
