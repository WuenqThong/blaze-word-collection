"""API-only extended scenarios; expected groups are known independently of splitter."""
import json
from collections import defaultdict


class ExtendedScenarios:
    def __init__(self, runner, stack):
        self.r, self.stack = runner, stack
        self.members = {}
        self.specs = {}
        self.configuration = json.loads((runner.directory / 'extended_fixtures.json').read_text(encoding='utf-8'))
        if self.configuration.get('synthetic') is not True:
            raise RuntimeError('Extended fixtures must be synthetic')

    def account(self, name):
        from fastapi.testclient import TestClient
        from app.main import app
        import secrets
        client = self.stack.enter_context(TestClient(app))
        response = client.post('/api/auth/register', json=dict(
            email=f'{name}@simulator.example.com', password=secrets.token_urlsafe(24), full_name='SYNTHETIC ' + name))
        self.r.check(response.status_code == 201, 'synthetic contributor registered', response.status_code)
        self.r.clients[name] = client
        return name

    def add(self, owner, sid, **extra):
        sample = dict(id=sid, case='valid', text=f'Câu tổng hợp riêng biệt {sid}.',
                      standard=f'Bản chuẩn tổng hợp riêng biệt {sid}.')
        sample.update(extra.pop('sample', {}))
        body = {**self.r.body(sample), **extra}
        item = self.r.request(owner, 'POST', '/contributions', 201, json=body)
        self.r.items[sid] = item['id']
        self.specs[item['id']] = dict(owner=owner, body=body)
        (self.r.directory / 'extended-samples.json').write_text(
            json.dumps(dict(synthetic=True, usage='Software tests only; not training data', samples=self.specs),
                       ensure_ascii=False, indent=2), encoding='utf-8')
        self.r.check(item['status'] == 'RAW', 'RAW', item['status'])
        item = self.r.votes(item)
        self.r.rights(item)
        self.r.curate(item, sample)
        return item

    def independent(self):
        count = self.configuration['independent_groups']
        for group in range(count):
            owner = self.account(f'independent-{group:02d}')
            ids = []
            for sample in range(self.configuration['samples_per_group']):
                item = self.add(owner, f'independent-{group:02d}-{sample:02d}')
                ids.append(item['id'])
            self.members[f'independent-{group:02d}'] = ids
        self.r.check(len(self.members) == 12, '12 known independent groups created', len(self.members))

    def relation(self, relation):
        owners = [self.account(f'relation-{relation}-{i}') for i in range(2)]
        sid_a, sid_b = f'relation-{relation}-a', f'relation-{relation}-b'
        options = [{}, {}]
        if relation == 'source':
            options = [dict(source_evidence='SYNTHETIC exclusive shared provenance for source pair')] * 2
        elif relation == 'variant':
            options[0] = dict(sample=dict(variants=f'Câu tổng hợp riêng biệt {sid_b}.'))
        elif relation == 'family':
            options = [dict(family='exclusive-family-pair')] * 2
        items = [self.add(owner, sid, **option) for owner, sid, option in zip(owners, (sid_a, sid_b), options)]
        if relation == 'sense':
            for item in items:
                curated = item['raw']
                self.r.request('admin', 'POST', f"/reviews/{item['id']}/curate", json=dict(
                    raw=dict(text=curated['original_text'], meaning=curated['meaning'],
                             standard=curated['standard_vi'], context=curated['context'], region='Hội An'),
                    sense_id='exclusive-sense-pair'))
        ids = [item['id'] for item in items]
        self.members['relation-' + relation] = ids
        created = self.r.release(ids)
        exported = self.r.request('admin', 'GET', f"/releases/{created['id']}")
        card = json.loads(exported['manifest']['data_card'])
        self.r.check(len({p['group'] for p in card['provenance']}) == 1,
                     f'{relation} alone joins two different owners', [p['group'] for p in card['provenance']])
        self.r.check(len({record['split'] for record in exported['records']}) == 1,
                     f'{relation} pair remains in one split', [record['split'] for record in exported['records']])

    def split_audit(self):
        r = self.r
        selected = []
        offset = 0
        while True:
            page = r.request('admin', 'GET', f'/releases/preview?offset={offset}')
            selected.extend(row['id'] for row in page['items'] if row['eligible'])
            offset += len(page['items'])
            if offset >= page['total']:
                break
            r.check(bool(page['items']), 'pagination progresses', len(page['items']))
        created = r.release(selected)
        exported = r.request('admin', 'GET', f"/releases/{created['id']}")
        card = json.loads(exported['manifest']['data_card'])
        records = {row['id']: row for row in exported['records']}
        provenance = {row['id']: row for row in card['provenance']}
        r.check(set(records) == set(selected), 'all eligible IDs exported exactly', sorted(records))
        r.check({row['split'] for row in records.values()} == {'train', 'dev', 'test'},
                'all three splits present', dict(card['counts']['splits']))
        expected_groups = {}
        for name, ids in self.members.items():
            groups = {provenance[cid]['group'] for cid in ids}
            splits = {records[cid]['split'] for cid in ids}
            r.check(len(groups) == 1 and len(splits) == 1, f'{name} is one indivisible group',
                    dict(groups=sorted(groups), splits=sorted(splits)))
            expected_groups[name] = next(iter(groups))
        r.check(len(set(expected_groups.values())) == len(self.members),
                'all 16 fixture groups remain independent of each other', len(set(expected_groups.values())))
        known_ids = {cid for ids in self.members.values() for cid in ids}
        base_groups = {row['group'] for cid, row in provenance.items() if cid not in known_ids}
        r.check(not (base_groups & set(expected_groups.values())),
                'extended groups remain independent from base fixtures',
                sorted(base_groups & set(expected_groups.values())))
        # Independent oracle: read raw identities, never call the production grouping helper.
        from app.core.database import SessionLocal
        from app.models.dialect import DialectContribution, DialectSource
        from app.services.dataset_release import normalize
        observed = defaultdict(set)
        with SessionLocal() as db:
            for cid, row in records.items():
                contribution = db.get(DialectContribution, cid)
                source = db.get(DialectSource, contribution.source_id)
                keys = [('owner', contribution.owner_id), ('source', contribution.source_id),
                        ('provenance', normalize(source.evidence))]
                for payload in (row['raw'], row['curated']):
                    keys.append(('text', normalize(payload.get('text') or payload.get('original_text'))))
                for key in keys:
                    observed[key].add(row['split'])
        r.check(all(len(splits) == 1 for splits in observed.values()),
                'no owner/source/provenance/exact-text overlaps across splits',
                [str(key) for key, splits in observed.items() if len(splits) > 1])
        # A client-supplied split map cannot move samples, even when reversing ID order.
        again = r.release(list(reversed(selected)))
        repeated = r.request('admin', 'GET', f"/releases/{again['id']}")
        r.check(exported['records'] == repeated['records'], 'repeat export keeps identical assignments and order',
                exported['records'] == repeated['records'])
        # Check one selected record from each holdout and train without shifting global assignment.
        for split in ('train', 'dev', 'test'):
            cid = next(cid for cid, row in records.items() if row['split'] == split)
            subset = r.release([cid])
            result = r.request('admin', 'GET', f"/releases/{subset['id']}")
            r.check(result['records'][0]['split'] == split, f'subset preserves global {split} assignment',
                    result['records'][0]['split'])
        r.check(card['benchmark'] is False, 'synthetic split is never expert benchmark', card['benchmark'])
        audit = dict(synthetic=True, eligible_records=len(records), known_fixture_groups=len(self.members),
                     universe_groups=card['counts']['universe_groups'], split_counts=card['counts']['splits'],
                     expected_groups=expected_groups, no_leakage=True, benchmark=False)
        (r.directory / 'split-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')

    def execute(self):
        self.r.scenario('independent_groups', 'Tạo 12 nhóm độc lập, mỗi nhóm hai mẫu cùng người góp', 'real-api', self.independent)
        for relation in self.configuration['isolated_relations']:
            self.r.scenario('relation_' + relation, 'Kiểm riêng quan hệ nhóm: ' + relation, 'real-api',
                            lambda relation=relation: self.relation(relation))
        self.r.scenario('split_audit', 'Xuất đủ train/dev/test và kiểm rò rỉ, lặp lại, subset', 'real-api', self.split_audit)
