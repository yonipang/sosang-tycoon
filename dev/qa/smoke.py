# 연기 시험: 처음 화면 → 새 게임 → 준비 → 봇이 이틀 영업 → 영수증·주간 정산까지. 화면 사진은 dev/qa/out/
# 사용법: python3 dev/build.py && python3 dev/qa/smoke.py
import os, sys, json
from playwright.sync_api import sync_playwright
QA = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(QA, 'out'); os.makedirs(OUT, exist_ok=True)
GAME = 'file://' + os.path.abspath(os.path.join(QA, '..', 'index.html'))
BOT = open(os.path.join(QA, 'bot.js'), encoding='utf-8').read()
errs = []
def shot(pg, name): pg.wait_for_timeout(250); pg.screenshot(path=os.path.join(OUT, name + '.png'))
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)  # 아이폰처럼
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(GAME); pg.wait_for_function('window.__T && window.__T.viewReady()')
    shot(pg, '1-title')
    pg.click('[data-act=new]'); shot(pg, '2-prep')
    pg.click('[data-act=price][data-m=tteok][data-d="1"]'); pg.click('[data-act=price][data-m=tteok][data-d="-1"]')
    pg.click('[data-act=open]'); pg.add_script_tag(content=BOT)
    pg.evaluate('__bot.play(130)'); pg.wait_for_timeout(1300); shot(pg, '3-lunch'); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, '3b-shop.png'))
    # 실제 탭으로 조리 미니게임 열어 보기
    # 메뉴마다 다른 조리 미니게임을 실제 탭으로 열어 보기
    for m, (x, y), name in (('tteok', (1, 1), 'stir'), ('kimbap', (2, 1), 'roll'), ('twigim', (4, 1), 'fry')):
        pg.evaluate("(([m,x,y])=>{const r=__T.G.run; __T.G.day0=__T.G.day; __T.G.day=3; r.cook=null; r.hands=[]; r.tickets.push({cid:-1,menu:m,table:1}); r.player.x=x; r.player.y=3; r.player.path=[]; __T.runCmd('tap',{x:x+.5,y:y+.5}); __T.runFor(0.7); if(m==='kimbap'){__T.runCmd('cookTap');__T.runCmd('cookTap');}})", [m, x, y])
        pg.wait_for_timeout(120); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, f'4-cook-{name}.png'))
        pg.evaluate("(()=>{const r=__T.G.run; __T.runCmd('cookTap'); r.cook=null; r.tickets=r.tickets.filter(t=>t.cid!==-1); r.hands=[]; __T.G.day=__T.G.day0;})()")
    phase = pg.evaluate('__bot.play(1000)')
    shot(pg, '5-receipt')
    rec = pg.evaluate('JSON.stringify(__T.G.lastReceipt)')
    for d in range(2, 8):
        pg.click('[data-act=afterReceipt]'); pg.click('[data-act=open]')
        pg.evaluate('__bot.play(1000)')
    shot(pg, '6-receipt7')
    r7 = pg.evaluate('JSON.stringify({foot:__T.G.lastReceipt.foot, entered:__T.G.lastReceipt.entered, served:__T.G.lastReceipt.served})')
    pg.click('[data-act=afterReceipt]'); shot(pg, '7-weekly')
    pg.click('[data-act=afterWeekly]')
    bot0 = pg.evaluate('({problems: __bot.problems, games: __bot.games})')
    hist = pg.evaluate('JSON.stringify(__T.G.history.map(h=>[h.day,h.revenue,h.net,h.served,h.missed,+(h.rating||0).toFixed(2)]))')
    state = pg.evaluate('JSON.stringify({day:__T.G.day,cash:__T.G.cash,loan:__T.G.loan,rating:__T.G.rating,phase:__T.G.phase})')
    # 다시 열면 준비 화면부터
    pg.reload(); pg.wait_for_function('window.__T && window.__T.viewReady()')
    pg.click('[data-act=continue]'); after = pg.evaluate('JSON.stringify({day:__T.G.day,phase:__T.G.phase})')
    bot = pg.evaluate('({problems: __bot.problems, games: __bot.games})') if False else bot0
    b.close()
r = json.loads(rec)
print('1일차 받은 메뉴:', {m: r['sales'][m]['n'] for m in r['sales']})
print('1일차:', {k: r[k] for k in ('revenue', 'tips', 'ingredientCost', 'net', 'served', 'missed', 'avgSpend', 'rating')})
print('리뷰:', [v['text'] for v in r['reviews']])
print('7일 기록 [일, 매출, 순이익, 손님, 놓침, 별]:', hist)
print('7일차 유동인구·들어옴·받음:', r7)
print('주간 뒤:', state, '· 다시 열기:', after)
print('봇 확인:', bot['problems'][:5] or '문제 없음')
print('오류:', errs or '없음')
sys.exit(1 if errs or bot['problems'] else 0)
