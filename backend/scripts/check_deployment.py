"""Read-only Compose checks. Never prints resolved secrets or deploys anything."""
import argparse
import ipaddress
import json
import re
import subprocess
from urllib.parse import urlsplit


def validate(config):
    services=config.get('services',{})
    if set(services)!={'app'}:raise ValueError('Pilot requires exactly one app service')
    app=services['app'];env=app.get('environment',{})
    if env.get('ENVIRONMENT')!='production' or str(env.get('DEBUG')).lower()!='false':raise ValueError('Strict production configuration required for staging and production')
    if str(env.get('COOKIE_SECURE')).lower()!='true' or str(env.get('ENABLE_LEGACY')).lower()!='false':raise ValueError('Secure cookies and disabled legacy required')
    secret=env.get('JWT_SECRET','')
    if len(secret)<32 or len(set(secret))<12 or any(word in secret.lower() for word in ('change-me','changeme','dev-secret','your-secret','default','example')):raise ValueError('Use an independent strong JWT secret')
    origins=json.loads(env.get('CORS_ORIGINS','[]'))
    if not origins or any(urlsplit(origin).scheme!='https' or not urlsplit(origin).hostname or '*' in origin or urlsplit(origin).path not in ('','/') or urlsplit(origin).username or urlsplit(origin).query or urlsplit(origin).fragment for origin in origins):raise ValueError('Explicit company HTTPS origins required')
    proxies=json.loads(env.get('TRUSTED_PROXY_IPS','[]'))
    if not proxies or any(ipaddress.ip_network(value,strict=False).prefixlen==0 for value in proxies):raise ValueError('Explicit trusted reverse proxy IPs required')
    if not re.search(r'@sha256:[a-f0-9]{64}$',app.get('image','')):raise ValueError('Release image must be pinned by SHA256 digest')
    ports=app.get('ports',[])
    if len(ports)!=1 or ports[0].get('host_ip')!='127.0.0.1' or int(ports[0].get('target',0))!=7777:raise ValueError('Expose only loopback port for the app, behind company HTTPS proxy')
    volumes=config.get('volumes',{})
    data=[v for v in app.get('volumes',[]) if v.get('target')=='/data' and v.get('type')=='volume']
    if len(data)!=1:raise ValueError('Dedicated persistent database volume required')
    volume=volumes.get(data[0]['source'],{})
    if not volume.get('name') or volume.get('external'):raise ValueError('Use a private Compose-managed database volume')
    if env.get('DATABASE_URL')!='sqlite:////data/annotator.db':raise ValueError('This pilot profile requires its dedicated SQLite volume')
    return {'name':config.get('name'), 'origins':origins, 'volume':volume['name'], 'secret':secret}


def check_pair(first,second):
    a,b=validate(first),validate(second)
    if not a['name'] or a['name']==b['name']:raise ValueError('Use separate Compose project names')
    if a['volume']==b['volume']:raise ValueError('Staging and production must not share database volumes')
    if a['secret']==b['secret']:raise ValueError('Staging and production must not share JWT secrets')
    if set(a['origins']) & set(b['origins']):raise ValueError('Use separate HTTPS domains')


def resolve(project,env_file):
    result=subprocess.run(['docker','compose','--project-name',project,'--env-file',env_file,'config','--format','json'],capture_output=True,text=True)
    if result.returncode:raise ValueError('Docker Compose could not resolve the configuration; no secrets printed')
    return json.loads(result.stdout)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',required=True);parser.add_argument('--env-file',required=True)
    parser.add_argument('--peer-project');parser.add_argument('--peer-env-file')
    args=parser.parse_args()
    if bool(args.peer_project)!=bool(args.peer_env_file):parser.error('Supply both peer project and env file')
    try:
        config=resolve(args.project,args.env_file);validate(config)
        if args.peer_project:check_pair(config,resolve(args.peer_project,args.peer_env_file))
    except (ValueError, OSError, KeyError, TypeError):
        parser.exit(1,'Deployment preflight failed. Check digest pinning, HTTPS, independent secrets, proxy IPs and private volumes. Nothing deployed.\n')
    print('Deployment configuration checks passed. Live HTTPS, health, migration, restore and rollback still require company-server validation.')


if __name__=='__main__':main()
