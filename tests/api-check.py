"""Run only against a built local Worker with an isolated test database."""
import concurrent.futures
import json
import urllib.error
import urllib.request
import uuid

ORIGIN = 'http://localhost:8788'
credentials = {'email': 'demo@mostrador.test', 'password': 'Mostrador123!'}

def call(path='/api/business', method='GET', payload=None, cookie=None, extra=None):
    headers = {'Content-Type': 'application/json', 'Origin': ORIGIN}
    if cookie:
        headers['Cookie'] = cookie
    headers.update(extra or {})
    request = urllib.request.Request(ORIGIN + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers, method=method)
    try:
        response = urllib.request.urlopen(request)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read().decode()
        data = json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw
        return response.status, data, response.headers, response.geturl()

def login():
    status, _, headers, _ = call('/api/session', 'POST', credentials)
    assert status == 200
    cookie = headers['Set-Cookie']
    assert 'HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'Max-Age=28800' in cookie
    return cookie.split(';', 1)[0]

assert call()[0] == 401
assert call(extra={'oai-authenticated-user-id': 'legacy-owner', 'oai-authenticated-user-email': 'legacy@example.com'})[0] == 401
assert call(cookie='mostrador_demo_session=' + 'f' * 64)[0] == 401
status, root, _, root_url = call('/')
assert status == 200 and root_url == ORIGIN + '/'
assert 'Tu próxima comida' in root and 'Administración' in root and 'Medallón de pollo' in root
assert '/photos/products/medallon-pollo-jamon-queso.jpg' in root
assert call('/catalogo')[3] == ORIGIN + '/'
assert call('/admin')[3] == ORIGIN + '/admin/login'
assert call('/api/session', 'POST', {**credentials, 'password': 'incorrecta'})[0] == 401
assert call('/api/session', 'POST', credentials, extra={'Origin': 'https://other.example'})[0] == 403

cookie = login()
second_cookie = login()
assert call('/admin', cookie=cookie)[3] == ORIGIN + '/admin'
status, business, _, _ = call(cookie=cookie)
assert status == 200 and len(business['products']) == 25

def save(action, state, request_id=None, cookie_value=cookie):
    return call(method='POST', payload={'version': state['version'],
        'requestId': request_id or str(uuid.uuid4()), 'action': action}, cookie=cookie_value)

product = {**business['products'][0], 'price': 987654, 'imageUrl': 'https://example.com/medallon.jpg'}
request_id = str(uuid.uuid4())
status, updated, _, _ = save({'type': 'product', 'product': product}, business, request_id)
assert status == 200, updated
assert save({'type': 'product', 'product': product}, business, request_id)[1]['version'] == updated['version']
assert save({'type': 'product', 'product': product}, business)[0] == 409
assert call(cookie=second_cookie)[1]['products'][0]['price'] == 987654
status, catalog, _, _ = call('/api/business?catalog=1')
assert status == 200 and set(catalog) == {'settings', 'products'}
catalog_product = next(p for p in catalog['products'] if p['id'] == product['id'])
assert catalog_product['price'] == 987654
assert catalog_product['imageUrl'] == product['imageUrl']
assert all(set(p) <= {'id', 'name', 'variety', 'category', 'unit', 'price', 'stock', 'imageUrl'} for p in catalog['products'])

status, hidden, _, _ = save({'type': 'product', 'product': {**product, 'published': False}}, updated)
assert status == 200
assert not any(p['id'] == product['id'] for p in call('/api/business?catalog=1')[1]['products'])
assert save({'type': 'product', 'product': product}, hidden, cookie_value=None)[0] == 401
assert call(method='POST', payload={}, cookie=cookie, extra={'Origin': 'https://other.example'})[0] == 403

payloads = [{'version': hidden['version'], 'requestId': str(uuid.uuid4()), 'action': {
    'type': 'expense', 'name': 'Prueba concurrente', 'category': 'Variable', 'amount': 100, 'paid': False}} for _ in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    statuses = list(pool.map(lambda p: call(method='POST', payload=p, cookie=cookie)[0], payloads))
assert sorted(statuses) == [200, 409], statuses

assert call('/api/session', 'DELETE', cookie=cookie)[0] == 200
assert call(cookie=cookie)[0] == 401
assert call('/admin', cookie=cookie)[3] == ORIGIN + '/admin/login'
assert call(cookie=second_cookie)[0] == 200
assert call('/api/session', 'DELETE', cookie=second_cookie)[0] == 200
print('OK: catálogo público renderizado, sesión de prueba, edición compartida, fotos, privacidad, idempotencia, concurrencia, origen y revocación.')
