"""Blaze text translation adapter, verified against /openapi.json on 2026-11-11."""
import json
import time
from datetime import datetime, timezone
import httpx
from app.services.dataset_package import checksum
from app.services.translation_evaluation import DIRECTION, RUN_SCHEMA, request_for, validate_cases

ENDPOINT = 'https://api.blaze.vn/v1/translations'


class TranslationCallError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class BlazeTranslation:
    def __init__(self, token, model='blaze-translate-1', transport=None):
        if not token or not token.strip():
            raise ValueError('Chưa cấu hình BLAZE_API_TOKEN ở máy chủ.')
        if not model or not model.strip():
            raise ValueError('Chưa cấu hình phiên bản hệ thống dịch.')
        self._token, self.model = token.strip(), model.strip()
        self._client = httpx.Client(timeout=httpx.Timeout(30, connect=10), follow_redirects=False, transport=transport)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._client.close()

    def translate(self, payload):
        try:
            with self._client.stream('POST', ENDPOINT, headers={'Authorization': 'Bearer ' + self._token}, json={**payload, 'model': self.model}) as response:
                if response.status_code != 200:
                    codes = {401: 'authentication_failed', 403: 'access_denied', 429: 'rate_limited'}
                    raise TranslationCallError(codes.get(response.status_code, 'server_error' if response.status_code >= 500 else 'request_rejected'))
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 65536:
                        raise TranslationCallError('invalid_response')
                result = json.loads(content)
                output = result.get('output_text')
                if not isinstance(output, str) or not output.strip() or len(output) > 4000 or self._token in output:
                    raise TranslationCallError('invalid_response')
                if result.get('model') != self.model:
                    raise TranslationCallError('model_changed')
                return output
        except httpx.TimeoutException:
            raise TranslationCallError('timeout') from None
        except httpx.HTTPError:
            raise TranslationCallError('network_error') from None
        except (ValueError, TypeError, AttributeError):
            raise TranslationCallError('invalid_response') from None


def run_experiment(document, client, augmented=False, progress=None, authorize=None):
    cases_digest = validate_cases(document)
    if document['dataset']['origin'] == 'release' and authorize is None:
        raise ValueError('Phải kiểm tra quyền hiện tại trước khi gửi dữ liệu thật sang hệ thống dịch.')
    rows = []
    for case in document['cases']:
        if authorize:
            authorize()
        payload, hits = request_for(case, document['adaptation'], augmented)
        started = time.monotonic()
        row = {'id': case['id'], 'request_sha256': checksum({**payload, 'model': client.model}), 'glossary_hits': hits}
        try:
            row.update(status='ok', translation=client.translate(payload))
        except TranslationCallError as error:
            # Auth/version errors invalidate the run. Other failures stay in the denominator.
            if error.code in ('authentication_failed', 'access_denied', 'model_changed'):
                raise ValueError('Không chạy được thí nghiệm dịch: ' + error.code) from None
            row.update(status='error', translation='', error_code=error.code)
        row['latency_ms'] = round((time.monotonic() - started) * 1000, 2)
        rows.append(row)
        if progress:
            progress(len(rows), len(document['cases']))
    return {'schema': RUN_SCHEMA, 'direction': DIRECTION, 'cases_sha256': cases_digest,
            'system_version': client.model, 'version_evidence': 'api_model_name_only', 'endpoint': ENDPOINT,
            'created_at': datetime.now(timezone.utc).isoformat(), 'mode': 'augmented' if augmented else 'baseline',
            'adaptation_sha256': document['adaptation_sha256'] if augmented else None, 'items': rows}
