import json
import unittest
from collections import Counter
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from app.core.database import Base
from app.models.user import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectContributionMeta as M, DialectVote as V, DialectSourceRights as SR
from app.services.dataset_release import build_release, validate_download, RULE_VERSION


class DatasetReleaseTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        @event.listens_for(self.engine, "connect")
        def enforce_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        for uid in (100, 101):
            self.seed_user(uid, "reviewer")
        self.db.flush()
        self.items = []

    def seed_user(self, uid, role="annotator"):
        if not self.db.get(User, uid):
            self.db.add(User(id=uid, email=f"qa-{uid}@example.test", full_name=f"QA {uid}",
                             password_hash="not-a-real-password", role=role))
            self.db.flush()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add(self, owner=None, evidence=None, **raw):
        cid = len(self.items) + 1
        self.seed_user(owner or cid)
        source = S(owner_id=owner or cid, evidence=evidence or f"source {cid}", rights_confirmed=True)
        self.db.add(source)
        self.db.flush()
        item = C(owner_id=owner or cid, source_id=source.id, idempotency_key=str(cid), request_hash="x",
                 status="VERIFIED", raw={"original_text": f"word {cid}", "consent_collect": True,
                 "consent_train": True, "consent_version": "dialect-2026-11-v1", **raw})
        self.db.add(item)
        self.db.flush()
        self.db.add(M(contribution_id=item.id, curated={"text": f"word {cid}", "meaning": "meaning", "standard": "standard", "context": "context"}))
        for reviewer in (100, 101):
            self.db.add(V(contribution_id=item.id, reviewer_id=reviewer, verdict="accept", rubric={}, note=""))
        self.db.flush()
        self.items.append(item)
        return item

    def test_deterministic_ignores_client_splits(self):
        for _ in range(12):
            self.add()
        a = build_release(self.db, self.items)
        b = build_release(self.db, reversed(self.items), client_splits={str(c.id): "test" for c in self.items})
        self.assertEqual(a, b)
        self.assertEqual(set(a["splits"].values()), {"train", "dev", "test"})
        self.assertEqual(json.loads(a["data_card"])["rule_version"], RULE_VERSION)

    def test_nonselected_intermediate_provenance_normalized(self):
        a = self.add(evidence="  BOOK   A ")
        self.add(owner=2, evidence="book a")
        c = self.add(owner=2)
        result = build_release(self.db, self.items, [a.id, c.id])
        card = json.loads(result["data_card"])
        self.assertEqual(card["counts"]["groups"], 1)
        self.assertEqual(set(result["splits"].values()), {"train"})
        self.assertTrue(result["warnings"])

    def test_subset_keeps_global_assignment_including_holdouts(self):
        for _ in range(12):
            self.add()
        full = build_release(self.db, self.items)
        for cid, split in full["splits"].items():
            single = build_release(self.db, self.items, [int(cid)])
            self.assertEqual(single["splits"], {cid: split})
            self.assertTrue(single["warnings"])
            self.assertNotIn("chỉ train", " ".join(single["warnings"]))
            validate_download(self.db, single["records"], self.items, single["data_card"])
        pair = build_release(self.db, self.items, [1, 2])
        self.assertEqual(pair["splits"], {str(cid): full["splits"][str(cid)] for cid in (1, 2)})

    def test_same_group_across_repeated_exports(self):
        a = self.add(owner=1)
        b = self.add(owner=1)
        for _ in range(8):
            self.add()
        full = build_release(self.db, self.items)
        expected = full["splits"][str(a.id)]
        for ids in ([a.id], [b.id], [a.id, b.id], [a.id, 3, 4], [b.id, 5, 6]):
            with self.subTest(ids=ids):
                result = build_release(self.db, reversed(self.items), ids)
                for cid in set(ids) & {a.id, b.id}:
                    self.assertEqual(result["splits"][str(cid)], expected)

    def test_universe_change_can_invalidate_old_split_with_409(self):
        self.add()
        self.add()
        old = build_release(self.db, self.items)
        self.add()
        current = build_release(self.db, self.items)
        moved = next(cid for cid in (1, 2) if current["splits"][str(cid)] != "train")
        old_record = next(r for r in old["records"] if r["id"] == moved)
        with self.assertRaises(HTTPException) as caught:
            validate_download(self.db, [old_record], self.items, old["data_card"])
        self.assertEqual(caught.exception.status_code, 409)

    def test_all_relationships_bridge(self):
        for relation in ("parent", "duplicate", "sense", "family", "variant"):
            with self.subTest(relation=relation):
                a = self.add()
                b = self.add()
                ma, mb = self.db.get(M, a.id), self.db.get(M, b.id)
                if relation == "parent":
                    b.parent_id = a.id
                elif relation == "duplicate":
                    mb.duplicate_of = a.id
                elif relation == "sense":
                    ma.sense_id = mb.sense_id = f"sense {a.id}"
                elif relation == "family":
                    a.raw = {**a.raw, "family": f"family {a.id}"}
                    b.raw = {**b.raw, "family": f"family {a.id}"}
                else:
                    a.raw = {**a.raw, "variants": b.raw["original_text"]}
                self.db.flush()
                card = json.loads(build_release(self.db, self.items, [a.id, b.id])["data_card"])
                self.assertEqual(card["counts"]["groups"], 1)

    def test_curated_and_votes_required_even_if_parent_passes(self):
        item = self.add()
        self.db.get(M, item.id).curated = None
        with self.assertRaises(HTTPException):
            build_release(self.db, self.items, [item.id])
        self.db.get(M, item.id).curated = {k: "x" for k in ("text", "meaning", "standard", "context")}
        self.db.query(V).filter_by(reviewer_id=101).delete()
        with self.assertRaises(HTTPException):
            build_release(self.db, self.items)

    def test_download_rechecks_consent_rights_and_curated(self):
        item = self.add()
        result = build_release(self.db, self.items)
        self.assertEqual(validate_download(self.db, result["records"], self.items, result["data_card"]), result)
        for change in ("consent", "rights", "curated", "parent_eligibility"):
            with self.subTest(change=change):
                m, source = self.db.get(M, item.id), self.db.get(S, item.source_id)
                old_curated = dict(m.curated)
                if change == "consent":
                    m.consent = {"collect": True, "train": False, "version": "dialect-2026-11-v1"}
                elif change == "rights":
                    source.rights_confirmed = False
                elif change == "curated":
                    m.curated = {**m.curated, "text": "changed"}
                with self.assertRaises(HTTPException) as caught:
                    validate_download(self.db, result["records"], [] if change == "parent_eligibility" else self.items, result["data_card"])
                self.assertEqual(caught.exception.status_code, 409)
                m.consent, m.curated, source.rights_confirmed = None, old_curated, True

    def test_legacy_rejected_and_card_privacy(self):
        self.add(evidence="private-person@example.com")
        result = build_release(self.db, self.items)
        self.assertNotIn("private-person@example.com", result["data_card"])
        self.assertNotIn("owner_id", result["data_card"])
        self.assertFalse(json.loads(result["data_card"])["provenance"][0]["scopes"]["public"])
        with self.assertRaises(HTTPException) as caught:
            validate_download(self.db, result["records"], self.items, "legacy")
        self.assertEqual(caught.exception.status_code, 409)

    def test_scope_narrowing_blocks_old_download(self):
        item = self.add(consent_public=True, consent_audio=True)
        rights = SR(source_id=item.source_id, public=True, audio=True)
        self.db.add(rights)
        self.db.flush()
        result = build_release(self.db, self.items)
        self.assertTrue(json.loads(result["data_card"])["provenance"][0]["scopes"]["public"])
        rights.public = False
        with self.assertRaises(HTTPException) as caught:
            validate_download(self.db, result["records"], self.items, result["data_card"])
        self.assertEqual(caught.exception.status_code, 409)

    def test_uncurated_eligible_bridge_is_still_grouped(self):
        a = self.add(evidence="same origin")
        bridge = self.add(evidence="same origin", owner=2)
        c = self.add(owner=2)
        self.db.get(M, bridge.id).curated = None
        result = build_release(self.db, self.items, [a.id, c.id])
        self.assertEqual(json.loads(result["data_card"])["counts"]["groups"], 1)

    def test_legacy_uncurated_saved_records_fail_closed(self):
        self.add()
        result = build_release(self.db, self.items)
        records = [{k: v for k, v in r.items() if k != "curated"} for r in result["records"]]
        with self.assertRaises(HTTPException) as caught:
            validate_download(self.db, records, self.items, result["data_card"])
        self.assertEqual(caught.exception.status_code, 409)

    def test_exact_curated_duplicates_removed_without_merging_distinct_variants_or_meanings(self):
        import unicodedata
        a, b, c = self.add(), self.add(), self.add()
        payload = {'text': 'mô', 'meaning': 'đâu', 'standard': 'đâu', 'context': 'Đi mô?'}
        self.db.get(M, a.id).curated = payload
        self.db.get(M, b.id).curated = {k: '  ' + unicodedata.normalize('NFD', v.upper()) + ' ' for k, v in payload.items()}
        self.db.get(M, c.id).curated = {**payload, 'variants': 'mồ'}
        result = build_release(self.db, self.items)
        self.assertEqual([r['id'] for r in result['records']], [a.id, c.id])
        self.assertEqual(json.loads(result['data_card'])['deduplication']['excluded'], [{'id': b.id, 'representative_id': a.id}])
        self.assertIn(b.id, [item.id for item in self.items])  # No row was deleted or edited.
        with self.assertRaises(HTTPException):
            build_release(self.db, self.items, [b.id])
        self.db.get(M, b.id).curated = {**payload, 'meaning': 'nghĩa khác'}
        self.assertEqual(len(build_release(self.db, self.items)['records']), 3)

    def test_portable_package_reproduces_frozen_splits_and_detects_tampering(self):
        from copy import deepcopy
        from app.core.database import utcnow
        from app.services.dataset_package import make_package, verify_package, checksum
        for _ in range(12):
            self.add()
        plan = build_release(self.db, self.items)
        package = make_package(1, utcnow(), plan['records'], plan['data_card'])
        result = verify_package(package)
        self.assertEqual(result['records'], 12)
        self.assertFalse(result['benchmark'])
        self.assertEqual(set(result['splits']), {'train', 'dev', 'test'})
        self.assertEqual(package, make_package(1, datetime.fromisoformat(package['manifest']['created_at'].rstrip('Z')), plan['records'], plan['data_card']))
        for mutation in ('content', 'card', 'allocation', 'scope', 'expert'):
            broken = deepcopy(package)
            if mutation == 'content':
                broken['records'][0]['curated']['text'] = 'changed'
            else:
                card = json.loads(broken['manifest']['data_card'])
                if mutation == 'card':
                    card['counts']['records'] += 1
                elif mutation == 'allocation':
                    # Even recomputing every digest cannot disguise a false split.
                    broken['records'][0]['split'] = 'test' if broken['records'][0]['split'] != 'test' else 'train'
                    card['counts']['splits'] = dict(Counter(r['split'] for r in broken['records']))
                    broken['manifest']['sha256'] = card['records_sha256'] = checksum(broken['records'])
                elif mutation == 'scope':
                    card['provenance'][0]['effective_consent']['train'] = False
                else:
                    card['benchmark'] = True
                broken['manifest']['data_card'] = json.dumps(card, ensure_ascii=False, sort_keys=True)
                unsigned = {'manifest': {k: v for k, v in broken['manifest'].items() if k != 'package_sha256'}, 'records': broken['records']}
                broken['manifest']['package_sha256'] = checksum(unsigned)
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                verify_package(broken)

    def test_full_card_changes_block_download_and_verifier_runs_without_database(self):
        import os
        import subprocess
        import sys
        import tempfile
        from pathlib import Path
        from app.core.database import utcnow
        from app.services.dataset_package import make_package
        self.add()
        plan = build_release(self.db, self.items)
        card = json.loads(plan['data_card'])
        card['benchmark'] = True
        with self.assertRaises(HTTPException):
            validate_download(self.db, plan['records'], self.items, json.dumps(card))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'dataset.json'
            path.write_text(json.dumps(make_package(1, utcnow(), plan['records'], plan['data_card'])), encoding='utf-8')
            env = {**os.environ, 'DATABASE_URL': 'no-database-allowed://'}
            root = Path(__file__).resolve().parents[1]
            for flags in ([], ['-O']):
                passed = subprocess.run([sys.executable, *flags, '-m', 'scripts.verify_dataset', str(path)], cwd=root, env=env, capture_output=True, text=True)
                self.assertEqual(passed.returncode, 0, passed.stderr)
                self.assertIn('at_export_only', passed.stdout)
            path.write_text('{}', encoding='utf-8')
            failed = subprocess.run([sys.executable, '-O', '-m', 'scripts.verify_dataset', str(path)], cwd=root, env=env, capture_output=True)
            self.assertNotEqual(failed.returncode, 0)

    def test_marked_duplicate_keeps_contributor_bridge_without_being_exported(self):
        from app.routers.dialect import release_plan
        from app.core.database import utcnow
        from app.services.dataset_package import make_package, verify_package
        a = self.add(owner=1)
        bridge = self.add(owner=2)
        b = self.add(owner=2)
        self.db.get(M, bridge.id).duplicate_of = a.id
        for _ in range(8):
            self.add()
        plan = release_plan(self.db)
        self.assertNotIn(bridge.id, [r['id'] for r in plan['records']])
        card = json.loads(plan['data_card'])
        groups = {p['id']: p['group'] for p in card['provenance']}
        self.assertEqual(groups[a.id], groups[b.id])
        self.assertEqual(card['counts']['grouping_universe'], len(self.items))
        self.assertEqual(card['counts']['eligible_universe'], len(self.items) - 1)
        self.assertEqual(verify_package(make_package(1, utcnow(), plan['records'], plan['data_card']))['records'], len(self.items) - 1)


if __name__ == "__main__":
    unittest.main()
