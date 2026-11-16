"""Real HTTP load + backup/restore drill on a disposable synthetic SQLite DB.

Never accepts a live DB URL or existing account. Results are evidence for this
machine/workload, not a production capacity guarantee. Run from backend/.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
import hashlib
import json
import os
import platform
from pathlib import Path
import secrets
import socket
import statistics
import subprocess
import sys
import tempfile
import time


def fingerprint(path):
    import sqlite3
    from contextlib import closing
    with closing(sqlite3.connect(path)) as db:
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        digest = hashlib.sha256()
        counts = {}
        for table in tables:
            rows = db.execute('SELECT * FROM "' + table.replace('"','""') + '"').fetchall()
            counts[table] = len(rows)
            digest.update(json.dumps([table, sorted(rows, key=repr)], default=str, ensure_ascii=False).encode())
        return {'integrity': db.execute('PRAGMA integrity_check').fetchone()[0], 'counts': counts, 'digest': digest.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--users', type=int, default=20)
    parser.add_argument('--samples', type=int, default=1000)
    parser.add_argument('--rounds', type=int, default=10)
    parser.add_argument('--skip-submit', action='store_true', help='Read/draft-only diagnostic; default also completes and submits every game')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if not 1 <= args.users <= 50 or not 0 <= args.samples <= 10000 or not 1 <= args.rounds <= 100:
        parser.error('Use 1-50 users, 0-10000 synthetic samples and 1-100 rounds')
    output = Path(args.output).resolve()
    if output.exists(): parser.error('Refusing to overwrite a report')
    with tempfile.TemporaryDirectory(prefix='blaze-load-') as temporary:
        root = Path(temporary)
        database = root/'load.db'
        os.environ.update(DATABASE_URL='sqlite:///'+database.as_posix(), ENVIRONMENT='test',
                          DEBUG='false', ENABLE_LEGACY='false', FRONTEND_DIST='', JWT_SECRET=secrets.token_urlsafe(48),
                          RATE_LIMIT_AUTH='1000', RATE_LIMIT_CONTRIBUTIONS='100000')
        # Environment is bound before importing any application/database module.
        from app.core.database import Base, engine, SessionLocal
        from app import models
        from app.models import User
        from app.models.dialect import DialectSource, DialectContribution
        from app.core.security import hash_password
        Base.metadata.create_all(engine)
        password = secrets.token_urlsafe(24)
        password_hash = hash_password(password)
        with SessionLocal() as db:
            users = [User(email=f'load-{i}@qa.example.com', full_name=f'Synthetic {i}', role='annotator', password_hash=password_hash, account_status='active') for i in range(args.users)]
            db.add_all(users); db.flush()
            db.add(User(email='load-admin@qa.example.com',full_name='Synthetic admin',role='admin',password_hash=password_hash,account_status='active'))
            for i in range(args.samples):
                source = DialectSource(owner_id=users[i % len(users)].id,evidence='Synthetic load fixture')
                db.add(source);db.flush()
                db.add(DialectContribution(owner_id=source.owner_id,source_id=source.id,idempotency_key=f'load-fixture-{i}',request_hash=hashlib.sha256(str(i).encode()).hexdigest(),raw={'kind':'word','original_text':f'từ tải {i}','meaning':'Nghĩa thử tải','standard_vi':'ở đâu','context':'Ngữ cảnh thử tải','region':'TP. Hội An','consent_collect':True,'consent_train':True,'consent_public':False,'consent_audio':False,'consent_version':'demo-consent-v1','method':'game'}))
            db.commit()
        with socket.socket() as probe:
            probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        import httpx
        with (root/'server.log').open('wb') as log:
            process=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],cwd=Path(__file__).resolve().parents[1],env=os.environ.copy(),stdout=log,stderr=log)
            clients=[]
            try:
                for _ in range(100):
                    if process.poll() is not None: raise RuntimeError('Disposable server exited; inspect benchmark code/environment')
                    try:
                        if httpx.get(base+'/api/health',timeout=1).status_code==200: break
                    except httpx.HTTPError: pass
                    time.sleep(.1)
                else: raise RuntimeError('Disposable server did not become ready')
                sessions=[]
                for i in range(args.users):
                    client=httpx.Client(base_url=base,timeout=60);clients.append(client)
                    client.post('/api/auth/login',json={'email':f'load-{i}@qa.example.com','password':password}).raise_for_status()
                    started=client.post('/api/dialect/game/sessions',json={'session_ref':secrets.token_hex(16),'exam_id':'dataset1-bank-01','consent':{'collect':True,'train':True,'public':False,'audio':False,'version':'demo-consent-v1'}})
                    started.raise_for_status();sessions.append(started.json())
                def workload(i):
                    rows=[];session=sessions[i];client=clients[i]
                    for n in range(args.rounds):
                        kind=['workspace','catalog','draft','session','health'][n%5]
                        tick=time.perf_counter()
                        try:
                            if kind=='draft':
                                response=client.post(f"/api/dialect/game/sessions/{session['id']}/commands",json={'key':secrets.token_hex(16),'expected_revision':session['serverRevision'],'command':{'type':'draftAnswer','index':1,'answer':{'text':f'nháp tải {n}'}}})
                                if response.status_code==200:session=response.json()
                            else:
                                path={'workspace':'/api/dialect/workspace?limit=25','catalog':'/api/dialect/game/catalog','session':f"/api/dialect/game/sessions/{session['id']}",'health':'/api/health'}[kind]
                                response=client.get(path)
                            rows.append((kind,response.status_code,(time.perf_counter()-tick)*1000,len(response.content)))
                        except httpx.HTTPError:
                            rows.append((kind,0,(time.perf_counter()-tick)*1000,0))
                    sessions[i]=session
                    return rows
                tick=time.perf_counter()
                with ThreadPoolExecutor(max_workers=args.users) as pool:
                    measurements=[row for rows in pool.map(workload,range(args.users)) for row in rows]
                if not args.skip_submit:
                    from app.models.game import GameSession
                    with SessionLocal() as db:
                        snapshots=[db.get(GameSession, session['id']).snapshot for session in sessions]
                    def finish(i):
                        rows=[];session=sessions[i];client=clients[i]
                        for index,q in enumerate(snapshots[i]['questions']):
                            answer={'text':f'cách nói tải {i}-{index}','meaning':'Giải thích thử tải','standard':'Cách nói phổ thông thử tải','context':'Ví dụ thử tải'}
                            if q.get('format')=='choice':answer['selectedOptionId']=q['correctOptionId']
                            elif q['kind'] in ('GATE','GOLD'):answer['text']=q['accepted'][0]
                            tick=time.perf_counter()
                            response=client.post(f"/api/dialect/game/sessions/{session['id']}/commands",json={'key':secrets.token_hex(16),'expected_revision':session['serverRevision'],'command':{'type':'answer','index':index,'next':index+1,'answer':answer}})
                            rows.append(('answer',response.status_code,(time.perf_counter()-tick)*1000,len(response.content)))
                            if response.status_code!=200:return rows
                            session=response.json()
                        sessions[i]=session
                        return rows
                    with ThreadPoolExecutor(max_workers=args.users) as pool:
                        measurements.extend(row for rows in pool.map(finish,range(args.users)) for row in rows)
                    def submit(i):
                        session=sessions[i];tick=time.perf_counter()
                        response=clients[i].post(f"/api/dialect/game/sessions/{session['id']}/commands",json={'key':secrets.token_hex(16),'expected_revision':session['serverRevision'],'command':{'type':'submit','region':'TP. Hội An','upbringing':'TP. Hội An','usage':'TP. Hội An'}})
                        return ('submit',response.status_code,(time.perf_counter()-tick)*1000,len(response.content))
                    with ThreadPoolExecutor(max_workers=args.users) as pool:
                        measurements.extend(pool.map(submit,range(args.users)))
                duration=time.perf_counter()-tick
                staff=httpx.Client(base_url=base,timeout=120);clients.append(staff)
                staff.post('/api/auth/login',json={'email':'load-admin@qa.example.com','password':password}).raise_for_status()
                tick=time.perf_counter();operations=staff.get('/api/dialect/operations/summary');operations.raise_for_status()
                operations_ms=(time.perf_counter()-tick)*1000
                final_samples=operations.json()['samples']
                completed_games=operations.json()['submitted']
                grouped=defaultdict(list)
                for kind,status,ms,size in measurements: grouped[kind].append((status,ms,size))
                routes={}
                for kind,rows in grouped.items():
                    times=sorted(r[1] for r in rows)
                    routes[kind]={'requests':len(rows),'statuses':dict(Counter(r[0] for r in rows)),'p50_ms':round(statistics.median(times),2),'p95_ms':round(times[max(0,int(len(times)*.95)-1)],2),'mean_response_bytes':round(statistics.mean(r[2] for r in rows))}
            finally:
                for client in clients:client.close()
                process.terminate()
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired:process.kill();process.wait()
        engine.dispose()
        from scripts.db_sqlite import snapshot as copy_database
        before=fingerprint(database)
        copy_database(database,root/'backup.db');copy_database(root/'backup.db',root/'restored.db')
        restored=fingerprint(root/'restored.db')
        import sqlite3
        from contextlib import closing
        with closing(sqlite3.connect(database)) as db:
            journal_mode=db.execute('PRAGMA journal_mode').fetchone()[0]
            query_plans = {name: [list(row) for row in db.execute('EXPLAIN QUERY PLAN '+sql)] for name,sql in {
                'owner_samples':'SELECT id FROM dialect_contributions WHERE owner_id=1 ORDER BY id DESC LIMIT 25',
                'owner_games':'SELECT session_ref FROM dialect_game_sessions WHERE user_id=1 ORDER BY session_ref LIMIT 100',
                'review_votes':'SELECT reviewer_id FROM dialect_votes WHERE contribution_id=1',
            }.items()}
        errors=sum(status != 200 for _,status,_,_ in measurements)
        result={'schema':'pilot-load-evidence-v1','created_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                'synthetic_only':True,'users':args.users,'seed_samples':args.samples,'rounds_per_user':args.rounds,
                'includes_complete_and_submit':not args.skip_submit,
                'completed_games':completed_games,'final_samples':final_samples,'journal_mode':journal_mode,
                'server_processes':1,'database':'SQLite','database_bytes':database.stat().st_size,
                'runtime':{'python':platform.python_version(),'system':platform.system(),'logical_cpus':os.cpu_count()},
                'query_plans':query_plans,
                'rate_limit_profile':'Benchmark raises auth/contribution limits; does not establish production rate-limit capacity.',
                'elapsed_seconds':round(duration,2),'requests_per_second':round(len(measurements)/duration,2),
                'non_200':errors,'routes':routes,'admin_summary_ms':round(operations_ms,2),
                'restore':{'logical_fingerprint_equal':before==restored,'integrity':restored['integrity'],'tables':len(restored['counts'])},
                'sqlite_decision':'retain-for-measured-single-instance-pilot' if not errors and max(r['p95_ms'] for r in routes.values()) <= 2000 else 'needs-tuning-and-retest-before-database-decision',
                'limits':['Local synthetic workload, not company infrastructure.','No expert quality evaluation.','No production HTTPS/proxy or Docker validation.','Offline client drafts cannot be measured by this server benchmark.']}
        output.parent.mkdir(parents=True,exist_ok=True)
        with output.open('x',encoding='utf-8') as stream:json.dump(result,stream,ensure_ascii=False,indent=2)
        print(json.dumps(result,ensure_ascii=True))
        if errors or before != restored:raise SystemExit(1)


if __name__=='__main__':main()
