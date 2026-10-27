# 클라우드 저장 시험 (Firebase 대신 가짜 클라우드 window.__cloudMock): 로그인 → 올리기 → 다른 기기에서 저절로 이어하기 → 더 최근 세이브 저절로 → 영업 중엔 기다림 → 새 가게 백업
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

    def bump(day, ahead=60000):
        """클라우드 세이브를 다른 기기에서 더 한 것처럼 바꿔요"""
        pg.evaluate("""([day, ahead]) => { const d = JSON.parse(localStorage.getItem('mock-cloud')); const o = JSON.parse(d.data); o.day = day; o.meta.at = Date.now() + ahead; d.data = JSON.stringify(o); d.day = day; d.at = o.meta.at; localStorage.setItem('mock-cloud', JSON.stringify(d)); }""", [day, ahead])
    local_day = lambda: pg.evaluate("(JSON.parse(localStorage.getItem('sosang-tycoon-save-v1') || 'null') || {}).day")

    print('1. 로그인 안 한 처음 화면 → 구글 로그인 버튼 하나')
    check(pg.locator('[data-act=cloudLogin]').count() == 1, '처음 화면에 구글 로그인 버튼')
    shot(pg, '1-title-out')
    pg.click('[data-act=cloudLogin]'); pg.wait_for_timeout(300)
    check(pg.evaluate('__T.CLOUD.st') == 'in', '로그인됨')
    check(pg.locator('.cl-title').count() == 1, '처음 화면에 「클라우드에 자동 저장」')
    check(cloud(pg) is None, '세이브가 없으면 아무것도 안 올림')

    print('2. 새로 시작 → 준비 화면 저장 → 3초 뒤 올라감')
    pg.click('[data-act=new]'); skip_cut(pg)
    pg.wait_for_timeout(3600)
    c = cloud(pg)
    check(c is not None and c.get('day') == 1, '클라우드에 1일차 세이브')
    first_id = pg.evaluate("JSON.parse(localStorage.getItem('sosang-tycoon-save-v1')).meta.id")
    check(c is not None and c.get('id') == first_id, '같은 가게 번호')

    print('3. 다른 기기(세이브 없음)에서 열면 클라우드 세이브를 저절로 가져옴')
    pg.evaluate("localStorage.removeItem('sosang-tycoon-save-v1')"); bump(3)
    pg.reload(); pg.wait_for_timeout(700)
    check(local_day() == 3, '이 기기에 3일차가 들어옴')
    check(pg.locator('[data-act=continue]').count() == 1, '처음 화면에 「이어하기」')
    shot(pg, '3-title-took')
    pg.click('[data-act=continue]'); pg.wait_for_timeout(400)
    check(pg.evaluate('__T.G.day') == 3, '이어하기 → 3일차'); skip_cut(pg)

    print('4. 클라우드가 더 최근이면(처음 화면) 저절로 바꿈, 이 기기 것은 백업')
    bump(5); pg.reload(); pg.wait_for_timeout(700)
    check(local_day() == 5, '이 기기 세이브가 5일차로')
    check(pg.evaluate("JSON.parse(localStorage.getItem('sosang-tycoon-backup')).day") == 3, '바꾸기 전 3일차는 백업')
    pg.click('[data-act=continue]'); pg.wait_for_timeout(400); skip_cut(pg)

    print('5. 준비 화면에서 앱으로 돌아왔을 때 다른 기기가 더 했으면 바로 바꿈')
    pg.wait_for_timeout(3500)  # 이어하기 때 저장한 걸 올리고 나서
    bump(7, 120000)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(600)
    check(pg.evaluate('__T.G.day') == 7 and pg.evaluate('__T.G.phase') == 'prep', '준비 화면이 7일차로')
    shot(pg, '5-prep-took'); skip_cut(pg)

    print('6. 영업 중이면 다음 준비 화면까지 기다림 (그 사이 올리지 않음)')
    pg.click('[data-act=open]'); pg.wait_for_timeout(300)
    if pg.evaluate("!document.getElementById('dawnUI').hidden"): pg.click('[data-dawn=open]')
    pg.wait_for_timeout(3500)
    bump(9, 300000); puts = pg.evaluate('window.__puts || 0')
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(400)
    check(pg.evaluate('__T.G.phase') == 'day' and pg.evaluate('!!__T.CLOUD.pending'), '영업은 그대로, 클라우드 세이브는 기다림')
    pg.evaluate("__T.runCmd('closeEarly'); __T.runFor(600)"); pg.wait_for_timeout(500)
    for _ in range(5):
        if pg.locator('[data-act=afterReceipt]:visible').count(): pg.locator('[data-act=afterReceipt]:visible').first.click(); pg.wait_for_timeout(400); break
        pg.evaluate("__T.runFor(300)"); pg.wait_for_timeout(300)
    if pg.locator('[data-act=afterWeekly]').count(): pg.click('[data-act=afterWeekly]')
    skip_cut(pg); pg.wait_for_timeout(600)
    check(pg.evaluate('__T.G.day') == 9, '준비 화면이 되자 클라우드 9일차로')
    c = cloud(pg)
    check(c['day'] == 9, '옛 세이브로 클라우드를 덮어쓰지 않음')

    print('7. 새로 시작 → 이 기기가 더 최근: 올리고, 클라우드 옛 가게는 백업')
    pg.click('#bSet'); pg.wait_for_timeout(300); shot(pg, '7-settings-in')
    pg.click('[data-act=restart]'); pg.click('[data-ask=yes]'); pg.wait_for_timeout(300)
    pg.click('[data-act=new]'); skip_cut(pg); pg.wait_for_timeout(3600)
    c = cloud(pg)
    check(c['day'] == 1 and c.get('prev', {}).get('day') == 9, '새 가게 1일차 올림 · 9일차는 클라우드 백업')

    print('7b. 설정 「백업 불러오기」 → 9일차로 돌아가고, 1일차가 대신 백업 (v0.55 사용자 요청)')
    pg.click('#bSet'); pg.wait_for_timeout(300)
    check(pg.locator('[data-act=cloudRestore]').count() == 1, '설정에 백업 불러오기 버튼')
    pg.locator('[data-act=cloudRestore]').scroll_into_view_if_needed(); shot(pg, '7b-settings-backup')
    pg.click('[data-act=cloudRestore]'); pg.wait_for_timeout(800); skip_cut(pg)
    c = cloud(pg)
    check(c['day'] == 9 and c.get('prev', {}).get('day') == 1, '클라우드 9일차 · 1일차는 백업')
    check(local_day() == 9 and pg.evaluate('__T.G.day') == 9, '게임이 9일차로 돌아감')
    pg.wait_for_timeout(3600)
    check(cloud(pg)['day'] == 9, '불러온 뒤 다시 덮이지 않음')

    print('8. 로그아웃')
    pg.click('#bSet'); pg.wait_for_timeout(300)
    pg.click('[data-act=cloudLogout]'); pg.wait_for_timeout(300)
    check(pg.evaluate('__T.CLOUD.st') == 'out', '로그아웃됨')
    check(pg.locator('.scr-settings [data-act=cloudLogin]').count() == 1, '설정에 다시 로그인 버튼')
    shot(pg, '8-settings-out')

    print('8b. 로그아웃한 채 처음부터 → 다시 로그인: 서로 다른 게임이면 고르기 창, 덮지 않음 (v0.56 사용자 제보)')
    pg.locator('[data-act=restart]').scroll_into_view_if_needed(); pg.click('[data-act=restart]'); pg.click('[data-ask=yes]'); pg.wait_for_timeout(300)
    check(pg.evaluate("(JSON.parse(localStorage.getItem('sosang-tycoon-backup') || 'null') || {}).day") == 9, '처음부터 전 9일차가 이 기기 백업으로')
    pg.click('[data-act=new]'); skip_cut(pg); pg.wait_for_timeout(500)
    pg.click('#bSet'); pg.wait_for_timeout(300)
    pg.click('[data-act=cloudLogin]'); pg.wait_for_timeout(800)
    check(pg.locator('.pick-save').count() == 2, '「어느 세이브로 할까요?」 창')
    shot(pg, '8b-pick')
    check(cloud(pg)['day'] == 9, '고르기 전엔 클라우드를 덮지 않음')
    pg.click('[data-ask=cloud]'); pg.wait_for_timeout(800); skip_cut(pg)
    check(local_day() == 9 and pg.evaluate('__T.G.day') == 9, '클라우드 9일차를 고르면 그걸로')
    check(pg.evaluate("(JSON.parse(localStorage.getItem('sosang-tycoon-backup') || 'null') || {}).day") == 1, '이 기기 1일차는 이 기기 백업으로')
    pg.click('#bSet'); pg.wait_for_timeout(300)
    check(pg.locator('[data-act=localRestore]').count() == 1, '설정에 이 기기 백업 불러오기')
    pg.locator('[data-act=localRestore]').scroll_into_view_if_needed(); shot(pg, '8c-settings-local-backup')

    print('9. 미리보기(파일 주소)에서도 버튼은 보이고, 누르면 웹앱 안내')
    pg2 = b.new_page(viewport={'width': 390, 'height': 760}); pg2.goto(GAME); pg2.wait_for_timeout(600)
    check(pg2.evaluate('__T.CLOUD.st') == 'na', '가짜 클라우드 없으면 na')
    check(pg2.locator('[data-act=cloudLogin]').count() == 1, '처음 화면에 구글 로그인 버튼')
    pg2.click('[data-act=cloudLogin]'); pg2.wait_for_timeout(300)
    check('웹앱' in pg2.inner_text('#toasts'), '누르면 웹앱 안내')
    pg2.click('[data-act=settings]'); pg2.wait_for_timeout(300); pg2.screenshot(path=os.path.join(OUT, 'cloud-9-settings-na.png'))
    b.close()
print('오류:', errs if errs else '없음')
raise SystemExit(1 if errs else 0)
