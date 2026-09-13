"""Exercises only local, isolated demo identities. No production data."""
import json,uuid,urllib.request,urllib.error,concurrent.futures
base='http://localhost:8788/api/business'
identity='qa-'+str(uuid.uuid4())
def call(method='GET',payload=None,who=identity,path='',extra=None):
    headers={'Content-Type':'application/json'}
    if who: headers.update({'oai-authenticated-user-id':who,'oai-authenticated-user-email':'qa@sites.test'})
    headers.update(extra or {})
    req=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
assert call(who=None)[0]==401
status,b=call();assert status==200,(status,b)
assert len(b['products'])==25
version=b['version'];request_id=str(uuid.uuid4());sale={'version':version,'requestId':request_id,'action':{'type':'sale','items':[{'productId':'p16','quantity':250}],'method':'Efectivo'}}
status,n=call('POST',sale);assert status==200,(status,n)
assert n['products'][15]['stock']==b['products'][15]['stock']-250
assert call('POST',sale)[1]['version']==n['version'],'Duplicate request must not create another sale'
status,_=call('POST',{**sale,'requestId':str(uuid.uuid4())});assert status==409,'Stale writes must fail'
assert call()[1]['version']==n['version'],'Reload must retain changes'
assert call(who=identity+'-other')[1]['version']==0,'Users must be isolated'
status,catalog=call(path='?catalog=1');assert status==200
assert all('cost' not in p for p in catalog['products']);assert 'sales' not in catalog
assert call('POST',{**sale,'requestId':str(uuid.uuid4()),'version':n['version']},extra={'Origin':'https://unexpected.example'})[0]==403
payloads=[{'version':n['version'],'requestId':str(uuid.uuid4()),'action':{'type':'expense','name':'Prueba concurrente','category':'Variable','amount':100,'paid':False}} for _ in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda p:call('POST',p)[0],payloads))
assert sorted(results)==[200,409],results
print('API: autenticación, persistencia, idempotencia, concurrencia, aislamiento, catálogo sin costos y origen: OK')
