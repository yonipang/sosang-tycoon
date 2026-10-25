# 클라우드 저장 시험 (Firebase 대신 가짜 클라우드 window.__cloudMock): 로그인 → 올리기 → 다른 기기에서 이어하기 → 더 최근 세이브 고르기 → 다른 가게 고르기
# 사용법: python3 dev/build.py && python3 dev/qa/cloud.py   (약 30초, 사진은 dev/qa/out/cloud-*.png)
import os, json
from playwright.sync_api import sync_playwright
QA = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(QA, 'out'); os.makedirs(OUT, exist_ok=True)
GAME = 'file://' + os.path.abspath(os.path.join(QA, '..', 'index.html'))
# 가짜 클라우드: 문서는 localStorage 'mock-cloud'에 (기기를 바꾼 척하려고 게임 세이브만 지우고 이건 남겨요)
MOCK = """
(() => {
  const subs = [];
  const user = () => localStorage.getItem('mock-user') ? { uid: 'u1', displayName: '시험 계정' } : null;
  window.__cloudMock = {
    onAuth: cb => { subs.push(cb); setTimeout(() => cb(user()), 50); },
    google: async () => { localStorage.setItem('mock-user', '1'); subs.forEach(f => f(user())); },
    out: async () => { localStorage.removeItem('mock-user'); subs.forEach(f => f(null)); },
    get: async uid => JSON.parse(localStorage.getItem('mock-cloud') || 'null'),
    put: async (uid, d) => { localStorage.setItem('mock-cloud', JSON.stringify(d)); window.__puts = (window.__puts || 0) + 1; },
  };
})();
"""
errs = []
def shot(pg, n): pg.wait_for_timeout(250); pg.screenshot(path=os.path.join(OUT, 'cloud-' + n + '.png'))
def cloud(pg): return pg.evaluate("JSON.parse(localStorage.getItem('mock-cloud') || 'null')")
def check(ok, what):
    print(('  ok  ' if ok else '  !!  ') + what)
    if not ok: errs.append(what)
def skip_cut(pg):
    pg.wait_for_timeout(300)
    if pg.evaluate("!document.getElementById('cut').hidden"): pg.click('#cutSkip')
    pg.wait_for_timeout(300)
    for _ in range(80):  # 이어지는 대화도 넘겨요
        if pg.evaluate("document.getElementById('talk').hidden"): return
        pg.click('#talk'); pg.wait_for_timeout(30)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 760})
    pg.add_init_script(MOCK)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)

    print('1. 로그인 안 한 처음 화면')
    check(pg.locator('[data-act=cloudLogin]').count() == 1, '처음 화면에 구글 로그인 버튼')
    shot(pg, '1-title-out')
    pg.click('[data-act=cloudLogin]'); pg.wait_for_timeout(300)
    check(pg.evaluate('__T.CLOUD.st') == 'in', '로그인됨')
    check(cloud(pg) is None, '세이브가 없으면 아무것도 안 올림')

    print('2. 새로 시작 → 준비 화면 저장 → 3초 뒤 올라감')
    pg.click('[data-act=new]'); skip_cut(pg)
    pg.wait_for_timeout(3600)
    c = cloud(pg)
    check(c is not None and c.get('day') == 1, '클라우드에 1일차 세이브')
    local_id = pg.evaluate("JSON.parse(localStorage.getItem('sosang-tycoon-save-v1')).meta.id")
    check(c is not None and c.get('id') == local_id, '같은 가게 번호')

    print('3. 다른 기기(세이브 없음)에서 열기 → 클라우드에서 이어하기')
    pg.evaluate("localStorage.removeItem('sosang-tycoon-save-v1')")
    # 클라우드 세이브를 3일차로 바꿔 둬요 (진짜 다른 기기에서 놀았던 것처럼)
    pg.evaluate("""(() => { const d = JSON.parse(localStorage.getItem('mock-cloud')); const o = JSON.parse(d.data); o.day = 3; o.meta.at += 60000; d.data = JSON.stringify(o); d.day = 3; d.at = o.meta.at; localStorage.setItem('mock-cloud', JSON.stringify(d)); })()""")
    pg.reload(); pg.wait_for_timeout(700)
    check(pg.locator('.cl-ask [data-act=cloudTake]').count() == 1, '처음 화면에 「클라우드에서 이어하기」')
    shot(pg, '3-title-only')
    pg.click('.cl-ask [data-act=cloudTake]'); pg.wait_for_timeout(500)
    check(pg.evaluate('__T.G.day') == 3 and pg.evaluate('__T.G.phase') == 'prep', '3일차 준비 화면으로')
    skip_cut(pg)

    print('4. 이 기기가 옛것이고 클라우드가 더 최근 → 고르기')
    pg.evaluate("""(() => { const d = JSON.parse(localStorage.getItem('mock-cloud')); const o = JSON.parse(d.data); o.day = 5; o.meta.at = Date.now() + 99999; d.data = JSON.stringify(o); d.day = 5; d.at = o.meta.at; localStorage.setItem('mock-cloud', JSON.stringify(d)); })()""")
    pg.reload(); pg.wait_for_timeout(700)
    check(pg.evaluate('__T.CLOUD.ask') == 'newer', '「더 최근 세이브」로 알아봄')
    shot(pg, '4-title-newer')
    puts = pg.evaluate('window.__puts || 0')
    pg.click('[data-act=continue]'); skip_cut(pg); pg.wait_for_timeout(3500)
    check(pg.evaluate('window.__puts || 0') == puts, '고르기 전에는 이 기기 것을 올리지 않음')
    pg.click('#bSet'); pg.wait_for_timeout(300)
    check(pg.locator('.scr-settings .cl-ask').count() == 1, '설정에도 고르는 상자')
    shot(pg, '4-settings-newer')
    pg.click('.scr-settings [data-act=cloudKeep]'); pg.wait_for_timeout(500)
    c = cloud(pg)
    check(c['day'] == 3 and c.get('prev', {}).get('day') == 5, '「이 기기 것」 → 3일차 올리고 5일차는 클라우드 백업')
    shot(pg, '4-settings-kept')
    pg.click('[data-act=settingsClose]')

    print('5. 클라우드 것이 남아 있는데 새로 시작 → 다른 가게로 알아봄')
    pg.evaluate("localStorage.removeItem('sosang-tycoon-save-v1')"); pg.reload(); pg.wait_for_timeout(700)
    check(pg.evaluate('__T.CLOUD.ask') == 'only', '이 기기엔 없고 클라우드에만')
    pg.click('[data-act=new]'); skip_cut(pg); pg.wait_for_timeout(3500)
    check(pg.evaluate('__T.CLOUD.ask') == 'other', '새 가게를 시작하면 「다른 가게」로 물어봄')
    check(cloud(pg)['day'] == 3, '클라우드 3일차는 그대로')
    pg.click('#bSet'); pg.wait_for_timeout(300); shot(pg, '5-settings-other')
    pg.click('.scr-settings [data-act=cloudTake]'); pg.wait_for_timeout(600)
    check(pg.evaluate('__T.G.day') == 3, '「클라우드 것」 → 3일차로')
    check(pg.evaluate("!!localStorage.getItem('sosang-tycoon-backup')"), '바꾸기 전 이 기기 세이브는 백업')
    skip_cut(pg)

    print('6. 로그아웃')
    pg.click('#bSet'); pg.wait_for_timeout(300)
    pg.click('[data-act=cloudLogout]'); pg.wait_for_timeout(300)
    check(pg.evaluate('__T.CLOUD.st') == 'out', '로그아웃됨')
    check(pg.locator('.scr-settings [data-act=cloudLogin]').count() == 1, '설정에 다시 로그인 버튼')
    shot(pg, '6-settings-out')

    print('7. 미리보기(파일 주소)에서는 꺼짐')
    pg2 = b.new_page(viewport={'width': 390, 'height': 760}); pg2.goto(GAME); pg2.wait_for_timeout(600)
    check(pg2.evaluate('__T.CLOUD.st') == 'na', '가짜 클라우드 없으면 na')
    pg2.click('[data-act=settings]'); pg2.wait_for_timeout(300); pg2.screenshot(path=os.path.join(OUT, 'cloud-7-settings-na.png'))
    b.close()
print('오류:', errs if errs else '없음')
raise SystemExit(1 if errs else 0)
