"""Adversarial phase gate: role conflicts, stale releases, concurrent requests."""
from concurrent.futures import ThreadPoolExecutor


class FinalScenarios:
    def __init__(self, runner):
        self.r = runner

    def new(self, sid, owner='contributor-a'):
        sample = dict(id=sid, case='valid', text=f'Câu kiểm chứng cuối {sid}.', standard=f'Đáp án thử {sid}.')
        body = self.r.body(sample)
        item = self.r.request(owner, 'POST', '/contributions', 201, json=body)
        self.r.items[sid] = item['id']
        return item, sample

    def dispute(self, item, actors=('reviewer-a', 'reviewer-b')):
        for index, actor in enumerate(actors):
            result = self.r.request(actor, 'POST', f"/reviews/{item['id']}/votes", json=dict(
                verdict='VERIFIED' if index == 0 else 'REJECT', meaning_ok=True, region_ok=True,
                context_ok=True, translation_ok=index == 0, note='Synthetic conflicting vote'))
        self.r.check(result['status'] == 'REVIEW', 'REVIEW after conflicting votes', result['status'])

    def adjudication(self):
        r = self.r
        decision = dict(verdict='VERIFIED', note='Independent final audit decision')
        voter, _ = self.new('audit-admin-voter')
        r.request('admin', 'POST', f"/reviews/{voter['id']}/finalize", 409, json=decision)
        self.dispute(voter, ('reviewer-a', 'admin'))
        r.request('admin', 'POST', f"/reviews/{voter['id']}/finalize", 403, json=decision)
        authored, _ = self.new('audit-admin-author', 'admin')
        self.dispute(authored)
        r.request('admin', 'POST', f"/reviews/{authored['id']}/finalize", 403, json=decision)
        held, _ = self.new('audit-adjudicated-hold')
        self.dispute(held)
        held = r.request('admin', 'POST', f"/reviews/{held['id']}/finalize", json={**decision, 'verdict': 'HOLD'})
        r.check(held['status'] == 'HOLD', 'HOLD after adjudication', held['status'])
        r.release([held['id']], 409)
        r.request('admin', 'POST', '/reviews/bulk', 409, json=dict(
            ids=[held['id']], action='REQUEUE', reason='Attempt to reuse old votes'))

    def invalidation(self):
        r = self.r
        item, sample = self.new('audit-release-invalidation')
        item = r.votes(item)
        r.rights(item)
        r.curate(item, sample)
        initial = r.release([item['id']])
        path = f"/releases/{initial['id']}"
        r.request('contributor-a', 'GET', path, 403)
        r.request('admin', 'GET', path)
        r.request('admin', 'POST', f"/sources/{item['source_id']}/rights", json=dict(
            rights_confirmed=False, note='Source permission revoked for synthetic audit'))
        r.request('admin', 'GET', path, 409)
        r.release([item['id']], 409)
        r.rights(item)
        changed = {**sample, 'standard': sample['standard'] + ' Đã chỉnh sửa.'}
        r.curate(item, changed)
        r.request('admin', 'GET', path, 409)
        updated = r.release([item['id']])
        fresh = r.request('admin', 'GET', f"/releases/{updated['id']}")
        r.check(fresh['records'][0]['curated']['standard'] == changed['standard'],
                'new release uses changed CURATED', fresh['records'][0]['curated']['standard'])
        # Intentionally corrupt only the disposable simulator DB: verify checksum enforcement.
        from app.core.database import SessionLocal
        from app.models.dialect import DialectRelease
        with SessionLocal() as db:
            db.get(DialectRelease, updated['id']).checksum = '0' * 64
            db.commit()
        r.request('admin', 'GET', f"/releases/{updated['id']}", 409)

    def concurrent(self):
        r = self.r
        sample = dict(id='audit-concurrent-retry', case='valid', text='Câu gửi đồng thời để kiểm retry.', standard='Đáp án giả kiểm retry.')
        body = r.body(sample)
        def submit(payload):
            response = r.clients['contributor-a'].post('/api/dialect/contributions', json=payload)
            return response.status_code, response.json()
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(submit, [body] * 4))
        r.check(all(code == 201 for code, _ in responses), 'four concurrent retries accepted', [code for code, _ in responses])
        ids = {result['id'] for _, result in responses}
        r.check(len(ids) == 1, 'all retries return one persisted ID', sorted(ids))
        item = responses[0][1]
        r.items[sample['id']] = item['id']
        def vote(actor):
            response = r.clients[actor].post(f"/api/dialect/reviews/{item['id']}/votes", json=dict(
                verdict='VERIFIED', meaning_ok=True, region_ok=True, context_ok=True,
                translation_ok=True, note='Concurrent independent vote'))
            return response.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes = list(pool.map(vote, ('reviewer-a', 'reviewer-b')))
        r.check(codes == [200, 200], 'concurrent independent reviewers accepted', codes)
        state = r.request('contributor-a', 'GET', f"/contributions/{item['id']}")
        r.check(state['status'] == 'VERIFIED' and state['vote_count'] == 2,
                'two votes persisted with VERIFIED state', [state['status'], state['vote_count']])
        conflict = r.body({**sample, 'id': 'audit-concurrent-conflict'})
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(submit, [conflict, {**conflict, 'original_text': 'Nội dung cạnh tranh khác.'}]))
        r.check(sorted(code for code, _ in responses) == [201, 409],
                'same key with different contents has one winner and one conflict', sorted(code for code, _ in responses))
        from app.core.database import SessionLocal
        from app.models.dialect import DialectContribution
        with SessionLocal() as db:
            counts = [db.query(DialectContribution).filter_by(idempotency_key=b['idempotency_key']).count()
                      for b in (body, conflict)]
        r.check(counts == [1, 1], 'one row per idempotency key after races', counts)

    def execute(self):
        for sid, label, operation in (
            ('adjudication_guards', 'Admin là tác giả/người bỏ phiếu, HOLD và chặn tái dùng phiếu', self.adjudication),
            ('release_invalidation', 'Thu hồi quyền nguồn, sửa CURATED, sửa checksum phải chặn bản cũ', self.invalidation),
            ('concurrent_requests', 'Gửi trùng/khác nội dung và bỏ phiếu đồng thời', self.concurrent),
        ):
            self.r.scenario(sid, label, 'real-api', operation)
