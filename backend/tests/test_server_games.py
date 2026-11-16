import unittest
from copy import deepcopy
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models import User
from app.models.game import GameSession, GameResource
from app.models.dialect import DialectContribution, DialectGameAllocation


class ServerGameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash=hash_password('ServerGame123!')

    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=sessionmaker(bind=self.engine)()
        self.users=[User(email=f'game-{n}@example.com',full_name=f'Game {n}',role=role,password_hash=self.password_hash,account_status='active') for n,role in enumerate(('annotator','annotator','admin'))]
        self.db.add_all(self.users);self.db.commit()
        def database():
            try:yield self.db
            finally:self.db.rollback()
        app.dependency_overrides[get_db]=database
        self.a,self.b,self.other,self.admin=[TestClient(app) for _ in range(4)]
        for client,index in [(self.a,0),(self.b,0),(self.other,1),(self.admin,2)]:
            response=client.post('/api/auth/login',json={'email':self.users[index].email,'password':'ServerGame123!'})
            self.assertEqual(response.status_code,200,response.text)
        response=self.a.get('/api/dialect/game/catalog');self.assertEqual(response.status_code,200,response.text)
        self.catalog=response.json()

    def tearDown(self):
        for client in [self.a,self.b,self.other,self.admin]:client.close()
        app.dependency_overrides.clear();self.db.close();self.engine.dispose()

    def start(self):
        body={'session_ref':str(uuid4()),'exam_id':'dataset1-bank-01','consent':{'collect':True,'train':True,'public':False,'audio':False,'version':'demo-consent-v1'}}
        response=self.a.post('/api/dialect/game/sessions',json=body)
        self.assertEqual(response.status_code,200,response.text)
        return response.json(),body

    def send(self,session,command,client=None,key=None,revision=None):
        return (client or self.a).post(f"/api/dialect/game/sessions/{session['id']}/commands",json={'key':key or str(uuid4()),'expected_revision':revision or session['serverRevision'],'command':command})

    def complete_answers(self, session):
        for index,q in enumerate(self.db.get(GameSession,session['id']).snapshot['questions']):
            answer={'text':'ở đâu','standard':'bản phổ thông tường minh','originalText':'Mi đi mô?' if q['kind']=='OPEN_SENTENCE' else 'mô','meaning':'giải thích có từ gốc giả mạo','context':'ngữ cảnh'}
            if q.get('format')=='choice': answer['selectedOptionId']=q['correctOptionId']
            elif q['kind'] in ('GATE','GOLD'): answer['text']=q['accepted'][0]
            response=self.send(session,{'type':'answer','index':index,'next':index+1,'answer':answer})
            self.assertEqual(response.status_code,200,response.text)
            session=response.json()
        return session

    def test_open_original_required_on_answer_and_submit_drafts_preserved(self):
        session,_=self.start()
        session=self.complete_answers(session)
        for value in ('', '   ', None, 123, 'x'*5001):
            answer={**session['answers'][8],'originalText':value}
            result=self.send(session,{'type':'answer','index':8,'answer':answer})
            self.assertEqual(result.status_code,422,result.text)
        # A valid draft can clear the original without erasing the prior response
        # grade, so submit must independently check the open source again.
        result=self.send(session,{'type':'draftAnswer','index':8,'answer':{**session['answers'][8],'originalText':''}})
        self.assertEqual(result.status_code,200,result.text)
        session=result.json()
        before=deepcopy(self.db.get(GameSession,session['id']).data)
        result=self.send(session,{'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An'})
        self.assertEqual(result.status_code,422,result.text)
        self.assertIn('địa phương gốc',result.json()['detail'])
        self.assertEqual(self.db.query(DialectContribution).count(),0)
        self.assertEqual(self.db.get(GameSession,session['id']).data,before)
        # Explicitly skipped open questions need no source and create no RAW.
        session=self.send(session,{'type':'answer','index':8,'answer':{'skipped':True}}).json()
        result=self.send(session,{'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.db.query(DialectContribution).count(),7)

    def test_legacy_snapshot_derives_without_mutation_or_catalog_lookup(self):
        session,_=self.start()
        row=self.db.get(GameSession,session['id'])
        snapshot=deepcopy(row.snapshot)
        for q in snapshot['questions']: q.pop('originalText',None)
        row.snapshot=snapshot
        # Live catalog changes must never change the already allocated source.
        for q in snapshot['questions']:
            resource=self.db.get(GameResource,('question',q['id']))
            resource.data={**resource.data,'originalText':'không dùng nguồn mới'}
        self.db.commit()
        session=self.complete_answers(session)
        from app.services.game_original import question_original
        result=self.send(session,{'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An'})
        self.assertEqual(result.status_code,200,result.text)
        for item in self.db.query(DialectContribution):
            index=int(item.raw['family'].rsplit(':q',1)[1])-1
            q=snapshot['questions'][index]
            expected=session['answers'][index]['originalText'] if q['kind'].startswith('OPEN_') else question_original(q)
            self.assertEqual(item.raw['original_text'],expected)
            self.assertEqual(item.raw['standard_vi'],'bản phổ thông tường minh')
        self.assertEqual(self.db.get(GameSession,session['id']).snapshot,snapshot)

    def test_ambiguous_legacy_source_blocks_atomic_submit_with_new_session_action(self):
        session,_=self.start()
        row=self.db.get(GameSession,session['id'])
        snapshot=deepcopy(row.snapshot)
        snapshot['questions'][2].pop('originalText',None)
        snapshot['questions'][2]['prompt']='So sánh ‘mô’ và ‘tê’.'
        row.snapshot=snapshot;self.db.commit()
        session=self.complete_answers(session)
        before=deepcopy(self.db.get(GameSession,session['id']).data)
        result=self.send(session,{'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An'})
        self.assertEqual(result.status_code,422,result.text)
        self.assertIn('bắt đầu lượt mới',result.json()['detail'])
        self.assertIn('bản nháp',result.json()['detail'])
        self.assertEqual(self.db.query(DialectContribution).count(),0)
        self.assertEqual(self.db.get(GameSession,session['id']).data,before)
        self.assertEqual(self.db.get(GameSession,session['id']).snapshot,snapshot)

    def test_catalog_original_validated_even_on_draft_and_legacy_save_enriched(self):
        value=deepcopy(self.db.get(GameResource,('question','q4')).data)
        value.update(id='original-source-test',approval='DRAFT')
        for invalid in (None,123,'x'*5001):
            response=self.admin.put('/api/dialect/game/catalog/question/original-source-test',json={'expected_revision':0,'value':{**value,'originalText':invalid}})
            self.assertEqual(response.status_code,422,response.text)
        value.pop('originalText')
        response=self.admin.put('/api/dialect/game/catalog/question/original-source-test',json={'expected_revision':0,'value':value})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.db.get(GameResource,('question','original-source-test')).data['originalText'],'tê')

    def test_catalog_answers_hidden_and_start_idempotent_snapshot_owned(self):
        self.assertTrue(all(not q.get('accepted') and not q.get('correctOptionId') for q in self.catalog['questions']))
        session,body=self.start()
        replay=self.a.post('/api/dialect/game/sessions',json=body)
        self.assertEqual(replay.json(),session)
        self.assertEqual(self.b.get(f"/api/dialect/game/sessions/{session['id']}").json(),session)
        self.assertEqual(self.other.get(f"/api/dialect/game/sessions/{session['id']}").status_code,404)
        self.assertEqual(self.other.post('/api/dialect/game/sessions',json=body).status_code,409)
        self.assertEqual(self.other.get('/api/dialect/game/sessions').json()['items'],[])
        self.assertEqual(self.a.post('/api/dialect/game/sessions',json=body,headers={'X-Account-ID':str(self.users[1].id)}).status_code,409)
        raw=deepcopy(self.db.get(GameSession,session['id']).snapshot)
        exam=self.db.get(GameResource,('exam','dataset1-bank-01'));exam.data={**exam.data,'title':'Updated title'};self.db.commit()
        self.assertEqual(self.db.get(GameSession,session['id']).snapshot,raw)

    def test_cross_device_revision_conflict_duplicate_receipt_and_gate_cannot_be_forged(self):
        session,_=self.start();key=str(uuid4())
        command={'type':'draftAnswer','index':0,'answer':{'text':'nháp','standard':'nháp'}}
        result=self.send(session,command,key=key);self.assertEqual(result.status_code,200,result.text)
        updated=result.json()
        self.assertEqual(self.send(session,command,key=key).json()['serverRevision'],updated['serverRevision'])
        self.assertEqual(self.send(session,{**command,'answer':{'text':'khác'}},key=key).status_code,409)
        conflict=self.send(session,command,client=self.b)
        self.assertEqual(conflict.status_code,409);self.assertEqual(conflict.json()['detail']['code'],'game_conflict')
        self.assertEqual(self.send(updated,{'type':'moveSession','cursor':2}).status_code,422)
        forged={'type':'answer','index':0,'next':2,'answer':{'text':'sai','standard':'sai','attempts':[{'correct':True}]}}
        q=self.db.get(GameSession,session['id']).snapshot['questions'][0]
        if q.get('format')=='choice':forged['answer']['selectedOptionId']=next(o['id'] for o in q['options'] if o['id']!=q['correctOptionId'])
        result=self.send(updated,forged);self.assertEqual(result.status_code,200,result.text)
        self.assertFalse(result.json()['answers'][0]['attempts'][-1]['correct'])
        self.assertEqual(result.json()['cursor'],0)
        self.assertEqual(self.a.post(f"/api/dialect/sessions/{session['id']}/submitted").status_code,409)

    def test_complete_submit_is_atomic_idempotent_and_survives_new_device(self):
        session,_=self.start()
        snapshot=self.db.get(GameSession,session['id']).snapshot
        for index,q in enumerate(snapshot['questions']):
            answer={'text':'mô','originalText':'Mi đi mô?' if q['kind']=='OPEN_SENTENCE' else 'mô','meaning':'đâu; ví dụ: Bạn đi mô?','standard':'ở đâu','context':'' if index >= 8 else 'Bạn đi mô?'}
            if q.get('format')=='choice':answer['selectedOptionId']=q['correctOptionId']
            elif q['kind'] in ('GATE','GOLD'):answer['text']=q['accepted'][0]
            response=self.send(session,{'type':'answer','index':index,'next':index+1,'answer':answer})
            self.assertEqual(response.status_code,200,response.text);session=response.json()
        command={'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An','usage':'TP. Hội An'};key=str(uuid4());revision=session['serverRevision']
        response=self.send(session,command,key=key);self.assertEqual(response.status_code,200,response.text);submitted=response.json()
        self.assertEqual(submitted['state'],'submitted')
        self.assertEqual(self.db.query(DialectContribution).count(),8)
        for item in self.db.query(DialectContribution):
            index=int(item.raw['family'].rsplit(':q',1)[1])-1
            q=snapshot['questions'][index]
            self.assertEqual(item.raw['original_text'],session['answers'][index]['originalText'] if q['kind'].startswith('OPEN_') else q['originalText'])
            self.assertEqual(item.raw['standard_vi'],'ở đâu')
        self.assertEqual(self.send(session,command,key=key,revision=revision).status_code,200)
        self.assertEqual(self.db.query(DialectContribution).count(),8)
        resumed=self.b.get(f"/api/dialect/game/sessions/{session['id']}").json()
        self.assertEqual(resumed['answers'],submitted['answers'])
        self.assertEqual(self.b.get('/api/dialect/statistics').json()['submitted_sessions'],1)
        withdrawn=self.send(submitted,{'type':'withdrawSession'})
        self.assertEqual(withdrawn.status_code,200,withdrawn.text)
        self.assertEqual(self.db.query(DialectContribution).filter(DialectContribution.withdrawn_at.is_(None)).count(),0)
        self.assertEqual(self.b.get(f"/api/dialect/game/sessions/{session['id']}").json()['state'],'withdrawn')

    def test_catalog_admin_only_with_optimistic_revision_and_history(self):
        row=self.db.get(GameResource,('question','q1'))
        data=deepcopy(row.data);data['id']='new-question';data['approval']='DRAFT'
        body={'value':data,'expected_revision':0}
        self.assertEqual(self.a.put('/api/dialect/game/catalog/question/new-question',json=body).status_code,403)
        result=self.admin.put('/api/dialect/game/catalog/question/new-question',json=body)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.admin.put('/api/dialect/game/catalog/question/new-question',json=body).status_code,409)
        self.assertEqual(len(self.admin.get('/api/dialect/game/catalog/question/new-question/versions').json()),1)
        source={'id':'qa-bank-source','title':'Nguồn QA','evidence':'Tư liệu tổng hợp','train':False,'public':False,'audio':False,'demo':True}
        saved=self.admin.put('/api/dialect/game/catalog/bank_source/qa-bank-source',json={'expected_revision':0,'value':source})
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertIn('qa-bank-source',[s['id'] for s in self.b.get('/api/dialect/game/catalog').json()['bankSources']])
        flags=self.admin.put(f'/api/dialect/participants/{self.users[1].id}',json={'verified':True,'expected':{'role':'annotator','verified':False,'risk':'clear'}})
        self.assertEqual(flags.status_code,200,flags.text)
        self.assertEqual(self.admin.put(f'/api/dialect/participants/{self.users[1].id}',json={'verified':False,'expected':{'verified':False}}).status_code,409)

    def test_fourth_wrong_answer_becomes_unverified_proposal_without_faking_correctness(self):
        session,_=self.start()
        snapshot=deepcopy(self.db.get(GameSession,session['id']).snapshot)
        for index in range(2):
            q=snapshot['questions'][index]
            answer={'text':'cách nói khác','standard':'cách nói khác','attempts':[{'correct':False}]*20}
            if q.get('format')=='choice':
                answer['selectedOptionId']=next(o['id'] for o in q['options'] if o['id']!=q['correctOptionId'])
                answer['suggestion']='đáp án mới của tôi'
            for n in range(3):
                before=deepcopy(session);key=str(uuid4())
                command={'type':'answer','index':index,'next':index+1,'answer':answer}
                result=self.send(before,command,key=key)
                self.assertEqual(result.status_code,200,result.text);session=result.json()
                self.assertEqual(len(session['answers'][index]['attempts']),n+1)
                self.assertNotIn('proposal',session['answers'][index]['attempts'][-1])
                replay=self.send(before,command,key=key)
                self.assertEqual(replay.json()['serverRevision'],session['serverRevision'])
            self.assertEqual(self.send(session,{'type':'moveSession','cursor':2}).status_code,422)
            if index==1:
                skipped=self.send(session,{'type':'answer','index':index,'next':2,'answer':{**answer,'skipped':True}})
                session=skipped.json()
                self.assertIsNone(session['answers'][index]['attempts'][-1]['correct'])
                self.assertEqual(session['cursor'],1)
            command={'type':'answer','index':index,'next':index+1,'answer':answer}
            before=deepcopy(session);key=str(uuid4());result=self.send(before,command,key=key)
            self.assertEqual(result.status_code,200,result.text);session=result.json()
            last=session['answers'][index]['attempts'][-1]
            self.assertFalse(last['correct'])
            self.assertEqual(last['proposal'],answer.get('suggestion',answer['text']))
            self.assertEqual(session['cursor'],index+1)
            self.assertEqual(self.send(before,command,key=key).json(),session)
        restored=self.b.get(f"/api/dialect/game/sessions/{session['id']}").json()
        self.assertEqual(restored['answers'],session['answers'])
        self.assertEqual(self.send(session,{'type':'draftAnswer','index':1,'answer':{'text':'nháp mới'}}).status_code,200)
        changed=self.b.get(f"/api/dialect/game/sessions/{session['id']}").json()
        self.assertEqual(self.send(changed,{'type':'moveSession','cursor':2}).status_code,422)
        # Commit the answer again; editing a draft cannot reuse an earlier grade.
        session=self.send(changed,{'type':'answer','index':1,'next':2,'answer':{'text':'cách nói khác'}}).json()
        for index in range(2,10):
            result=self.send(session,{'type':'answer','index':index,'next':index+1,'answer':{'text':'mô','originalText':'mô','meaning':'đâu','standard':'ở đâu','context':'Bạn đi mô?'}})
            self.assertEqual(result.status_code,200,result.text);session=result.json()
        command={'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An','usage':''};key=str(uuid4());before=deepcopy(session)
        result=self.send(before,command,key=key)
        self.assertEqual(result.status_code,200,result.text)
        proposals=[c for c in self.db.query(DialectContribution) if c.raw.get('question_kind')=='GATE']
        self.assertEqual(len(proposals),2)
        self.assertTrue(all(c.status=='HOLD' and 'Đề xuất đáp án mới' in c.raw['source_evidence'] for c in proposals))
        for item in proposals:
            index=int(item.raw['family'].rsplit(':q',1)[1])-1
            self.assertEqual(item.raw['original_text'],snapshot['questions'][index]['originalText'])
            self.assertEqual(item.raw['standard_vi'],session['answers'][index]['attempts'][-1]['proposal'])
            self.assertNotEqual(item.raw['original_text'],item.raw['standard_vi'])
        self.assertEqual(self.db.query(DialectContribution).count(),10)
        self.assertEqual(self.send(before,command,key=key).status_code,200)
        self.assertEqual(self.db.query(DialectContribution).count(),10)
        self.assertEqual(self.admin.get('/api/dialect/releases/preview').json()['eligible_count'],0)
        self.assertEqual(self.db.get(GameSession,session['id']).snapshot,snapshot)

    def test_session_pages_stay_owned_and_snapshot_regions_survive_catalog_edits(self):
        session,_=self.start()
        row=self.db.get(GameSession,session['id'])
        for n in range(105):
            ref=f'page-game-{n:04d}'
            self.db.add(DialectGameAllocation(session_ref=ref,user_id=self.users[0].id,exam_id=row.snapshot['exam']['id']))
            self.db.flush()
            self.db.add(GameSession(session_ref=ref,user_id=self.users[0].id,start_hash='test',revision=1,snapshot=deepcopy(row.snapshot),data=deepcopy(row.data)))
        self.db.commit()
        first=self.b.get('/api/dialect/game/sessions?limit=100').json()
        second=self.b.get('/api/dialect/game/sessions',params={'limit':100,'cursor':first['next_cursor']}).json()
        self.assertEqual(len({p['id'] for p in first['items']+second['items']}),106)
        self.assertEqual(self.other.get('/api/dialect/game/sessions').json()['items'],[])
        taxonomy=self.db.get(GameResource,('taxonomy','default'))
        changed={'regions':['Vùng mới'],'topics':taxonomy.data['topics']}
        self.assertEqual(self.admin.put('/api/dialect/game/catalog/taxonomy/default',json={'expected_revision':1,'value':changed}).status_code,200)
        result=self.send(session,{'type':'sessionMeta','region':'TP. Hội An','upbringing':'TP. Hội An','usage':''})
        self.assertEqual(result.status_code,200,result.text)

    def test_text_only_pilot_rejects_audio_and_published_exam_overwrites(self):
        session,body=self.start()
        audio={**body,'session_ref':str(uuid4()),'consent':{**body['consent'],'audio':True}}
        self.assertEqual(self.a.post('/api/dialect/game/sessions',json=audio).status_code,422)
        response=self.a.post('/api/dialect/contributions',json={'kind':'word','original_text':'mô','meaning':'đâu','standard_vi':'đâu','region':'TP. Hội An','context':'Mi đi mô?','source_evidence':'QA','consent_collect':True,'consent_train':True,'consent_audio':True,'consent_version':'demo-consent-v1','idempotency_key':'audio-outside-pilot','media_ids':['local-audio']})
        self.assertEqual(response.status_code,422)
        exam=self.db.get(GameResource,('exam','dataset1-bank-01'))
        changed={**exam.data,'title':'Không được ghi đè'}
        self.assertEqual(self.admin.put('/api/dialect/game/catalog/exam/dataset1-bank-01',json={'expected_revision':1,'value':changed}).status_code,409)
        self.assertNotEqual(self.a.get(f"/api/dialect/game/sessions/{session['id']}").json()['exam']['title'],'Không được ghi đè')
