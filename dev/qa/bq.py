# 플레이 기록(BigQuery) 조회 — 만든 사람용. 키는 저장소 밖에 둬요 (claude.ai 프로젝트 문서 claude/bigquery-key.json).
#  python3 dev/qa/bq.py "SELECT event_name, COUNT(*) n FROM `sosang-tycoon.analytics_*.events_*` GROUP BY 1"
#  python3 dev/qa/bq.py --ls        데이터 세트·표 목록
#  키 경로: 환경 변수 BQ_KEY (기본 /root/.sosang/bq-key.json) · 필요: pip install google-auth requests
#  bq 명령줄 도구는 이 작업 공간 프록시에서 인증이 안 돼서 이걸 써요.
import json, os, sys
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

PROJECT, LOC = 'sosang-tycoon', 'asia-northeast3'
API = f'https://bigquery.googleapis.com/bigquery/v2/projects/{PROJECT}'
KEY = os.environ.get('BQ_KEY', '/root/.sosang/bq-key.json')


def session():
    c = service_account.Credentials.from_service_account_file(KEY, scopes=['https://www.googleapis.com/auth/bigquery'])
    return AuthorizedSession(c)


def ls(s):
    ds = s.get(f'{API}/datasets').json().get('datasets', [])
    if not ds: print('데이터 세트 없음 (GA4 매일 내보내기는 연결 다음 날부터 생겨요)')
    for d in ds:
        name = d['datasetReference']['datasetId']
        ts = s.get(f'{API}/datasets/{name}/tables', params={'maxResults': 1000}).json().get('tables', [])
        print(name, '·', len(ts), '개 표', [t['tableReference']['tableId'] for t in ts][-5:])


def query(s, sql):
    r = s.post(f'{API}/queries', json={'query': sql, 'useLegacySql': False, 'location': LOC, 'timeoutMs': 60000}).json()
    if 'error' in r: sys.exit(json.dumps(r['error'], ensure_ascii=False, indent=1))
    cols = [f['name'] for f in r['schema']['fields']]
    print('\t'.join(cols))
    for row in r.get('rows', []): print('\t'.join('' if c['v'] is None else str(c['v']) for c in row['f']))


if __name__ == '__main__':
    s = session()
    if len(sys.argv) < 2 or sys.argv[1] == '--ls': ls(s)
    else: query(s, sys.argv[1])
