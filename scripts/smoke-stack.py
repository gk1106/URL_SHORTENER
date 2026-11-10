"""Exercise the full local Compose stack. Never print credentials or access tokens."""
import json
import secrets
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = build_opener(NoRedirect)


def call(method, url, data=None, token=None, form=False):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
        data = (urlencode(data) if form else json.dumps(data)).encode()
    try:
        response = opener.open(Request(url, data=data, headers=headers, method=method), timeout=15)
    except HTTPError as ex:
        response = ex
    raw = response.read()
    return response.status, response.headers, json.loads(raw) if raw and response.headers.get_content_type().endswith('json') else raw


def main():
    env = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines() if line and not line.startswith('#'))
    oidc = 'http://localhost:8180'
    api = 'http://127.0.0.1:' + env.get('APP_PORT', '8090')
    status, _, _ = call('GET', api + '/actuator/health')
    assert status == 200, f'Backend health failed: {status}'
    def admin_token():
        status, _, result = call('POST', oidc + '/realms/master/protocol/openid-connect/token', {
            'client_id': 'admin-cli', 'grant_type': 'password', 'username': 'admin',
            'password': env['KEYCLOAK_ADMIN_PASSWORD'],
        }, form=True)
        assert status == 200, f'Admin authentication failed: {status}'
        return result['access_token']

    admin = admin_token()
    admin_url = oidc + '/admin/realms/shortener/clients'
    created = []
    link = None
    tokens = []
    try:
        for _ in range(2):
            client_id = 'smoke-' + secrets.token_hex(8)
            secret = secrets.token_urlsafe(32)
            status, headers, _ = call('POST', admin_url, {
                'clientId': client_id, 'secret': secret, 'enabled': True,
                'publicClient': False, 'serviceAccountsEnabled': True,
                'standardFlowEnabled': False, 'directAccessGrantsEnabled': False,
                'protocolMappers': [{
                    'name': 'audience', 'protocol': 'openid-connect', 'protocolMapper': 'oidc-audience-mapper',
                    'config': {'included.custom.audience': 'shortener-api', 'access.token.claim': 'true'},
                }],
            }, admin)
            assert status == 201, f'Temporary client creation failed: {status}'
            created.append(headers['Location'])
            status, _, result = call('POST', oidc + '/realms/shortener/protocol/openid-connect/token', {
                'client_id': client_id, 'client_secret': secret, 'grant_type': 'client_credentials',
            }, form=True)
            assert status == 200, f'Client token failed: {status}'
            tokens.append(result['access_token'])
        assert call('GET', api + '/api/v1/urls')[0] == 401
        status, _, link = call('POST', api + '/api/v1/urls', {'longUrl': 'https://example.com/smoke'}, tokens[0])
        assert status == 201, f'Creation failed: {status}'
        path = api + '/api/v1/urls/' + link['id']
        assert call('GET', path, token=tokens[1])[0] == 404
        for _ in range(2):
            status, headers, _ = call('GET', link['shortUrl'])
            assert status == 302 and headers['Location'] == 'https://example.com/smoke'
        assert call('HEAD', link['shortUrl'])[0] == 302
        for _ in range(30):
            status, _, stats = call('GET', path + '/stats', token=tokens[0])
            if status == 200 and stats['clickCount'] == 2:
                break
            time.sleep(0.1)
        assert status == 200 and stats['clickCount'] == 2, 'Atomic click recording failed'
        assert call('PATCH', path, {'active': False}, tokens[0])[0] == 200
        assert call('GET', link['shortUrl'])[0] == 410, 'Cached disabled link must not redirect'
        for _ in range(65):
            status, _, _ = call('GET', api + '/api/v1/urls', token=tokens[0])
            if status == 429:
                break
        assert status == 429, 'Distributed rate limiting did not enforce quota'
        print('PASS: Oracle persistence, real Keycloak JWTs, ownership, Redis lookup, redirects, HEAD, click counts, disable, rate limits.')
    finally:
        admin = admin_token()
        for location in created:
            status, _, _ = call('DELETE', location, token=admin)
            if status != 204:
                print('Temporary smoke-test client cleanup failed; check Keycloak clients.')


if __name__ == '__main__':
    main()
