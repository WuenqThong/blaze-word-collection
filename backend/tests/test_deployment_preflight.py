import copy
import json
import unittest
from scripts.check_deployment import validate, check_pair


def config(name):
    return {'name':name,'services':{'app':{'image':'registry.invalid/blaze@sha256:'+'a'*64,
        'ports':[{'host_ip':'127.0.0.1','target':7777,'published':'7777'}],
        'volumes':[{'type':'volume','source':'backend_data','target':'/data'}],
        'environment':{'ENVIRONMENT':'production','DEBUG':'false','COOKIE_SECURE':'true','ENABLE_LEGACY':'false',
          'DATABASE_URL':'sqlite:////data/annotator.db','JWT_SECRET':name+'-Z29x!Ks82oP4hC6vNt3bQ7fW1yG9m',
          'CORS_ORIGINS':json.dumps(['https://'+name+'.invalid']),'TRUSTED_PROXY_IPS':'["172.20.0.1/32"]'}}},
        'volumes':{'backend_data':{'name':name+'_backend_data'}}}


class DeploymentPreflightTests(unittest.TestCase):
    def test_distinct_staging_and_production_pass(self):
        check_pair(config('staging'),config('production'))

    def test_rejects_shared_data_credentials_domains_and_project(self):
        first=config('staging')
        for field in ['volume','secret','origin','project']:
            with self.subTest(field=field):
                second=config('production')
                if field=='volume':second['volumes']=copy.deepcopy(first['volumes'])
                if field=='secret':second['services']['app']['environment']['JWT_SECRET']=first['services']['app']['environment']['JWT_SECRET']
                if field=='origin':second['services']['app']['environment']['CORS_ORIGINS']=first['services']['app']['environment']['CORS_ORIGINS']
                if field=='project':second['name']=first['name']
                with self.assertRaises(ValueError):check_pair(first,second)

    def test_rejects_mutable_images_public_ports_and_insecure_proxy(self):
        for field in ['image','port','proxy','cookie']:
            with self.subTest(field=field):
                value=config('staging');app=value['services']['app']
                if field=='image':app['image']='blaze:latest'
                if field=='port':app['ports'][0]['host_ip']='0.0.0.0'
                if field=='proxy':app['environment']['TRUSTED_PROXY_IPS']='["0.0.0.0/0"]'
                if field=='cookie':app['environment']['COOKIE_SECURE']='false'
                with self.assertRaises(ValueError):validate(value)
