# 연기 시험: 처음 화면 → 새 게임(프롤로그 연출·대화) → 봇이 8일 영업 → 영수증·주간 정산·이야기(1장 끝 골목 신문)까지. 화면 사진은 dev/qa/out/
# 사용법: python3 dev/build.py && python3 dev/qa/smoke.py
import os, sys, json
from playwright.sync_api import sync_playwright
QA = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(QA, 'out'); os.makedirs(OUT, exist_ok=True)
GAME = 'file://' + os.path.abspath(os.path.join(QA, '..', 'index.html'))
BOT = open(os.path.join(QA, 'bot.js'), encoding='utf-8').read()
errs = []; seen = []
def shot(pg, name): pg.wait_for_timeout(250); pg.screenshot(path=os.path.join(OUT, name + '.png'))
SHOT_SCENES = {'intro', 'handover', 'paper0', 'ch1', 'note', 'choi', 'paper1', 'paper1b'}
def cut(pg):
    """연출이 열려 있으면 끝까지 봐요 (대화 창은 눌러 넘기고, 첫 대화와 중간 사진)"""
    for i in range(400):
        if not pg.evaluate("!document.getElementById('cut').hidden"): return
        if pg.evaluate("!document.getElementById('talk').hidden"):
            k = 'cut%d' % sum(1 for x in seen if x.startswith('cut'))
            if not seen or not seen[-1].startswith('cut'): seen.append(k); shot(pg, 'talk-' + k)
            elif len([x for x in seen if x.startswith('cut')]) == 2 and 'cut1-think' not in seen and pg.locator('.talk.think').count(): seen.append('cut1-think'); shot(pg, 'talk-cut1-think')
            pg.click('#talk')
        else:
            if i == 12: shot(pg, 'cut-pan')
            pg.wait_for_timeout(200)
    raise RuntimeError('연출이 끝나지 않아요')
def talk(pg):
    """열린 대화 장면을 끝까지 넘겨요 (장면마다 첫 화면 사진, 가게 이름은 「떡집」)"""
    cut(pg)
    for _ in range(80):
        if not pg.evaluate("!document.getElementById('talk').hidden"): return
        sid = pg.evaluate('__T.G.story.queue[0]')
        if sid not in seen:
            seen.append(sid)
            if sid in SHOT_SCENES: shot(pg, 'talk-' + sid)
        if pg.locator('#talkName').count():
            shot(pg, 'talk-name'); pg.fill('#talkName', '떡집'); pg.click('[data-talk=name]')
        else: pg.click('#talk')
    raise RuntimeError('대화가 끝나지 않아요')
def to_prep(pg):
    pg.click('[data-act=afterReceipt]')
    if pg.locator('[data-act=afterWeekly]').count():
        shot(pg, '7-weekly'); pg.click('[data-act=afterWeekly]')
    talk(pg)
    if pg.locator('[data-act=questPay]').count():
        shot(pg, '8-prep-pay'); pg.click('[data-act=questPay]'); talk(pg)
    if pg.locator('[data-act=buyTool]').count():  # 장사 도구는 보이면 다 사요
        shot(pg, '8b-prep-tools')
        while pg.locator('[data-act=buyTool]').count(): pg.locator('[data-act=buyTool]').first.click()
    if pg.locator('[data-act=buyTool]').count():  # 장사 도구는 보이면 다 사요
        shot(pg, '8b-prep-tools')
        while pg.locator('[data-act=buyTool]').count(): pg.locator('[data-act=buyTool]').first.click()
    if pg.locator('[data-act=buyTool]').count():  # 장사 도구는 보이면 다 사요
        shot(pg, '8b-prep-tools')
        while pg.locator('[data-act=buyTool]').count(): pg.locator('[data-act=buyTool]').first.click()
    # 봇은 재료를 넉넉히 시켜요 (「재료가 떨어지지 않은 날」 퀘스트가 운에 맡겨지지 않게)
    for btn in pg.locator('[data-act=prep][data-d="1"]').all(): btn.click(); btn.click()
def play(pg):
    pg.evaluate('__bot.play(1000)'); talk(pg)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)  # 아이폰처럼
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(GAME); pg.wait_for_function('window.__T && window.__T.viewReady()')
    shot(pg, '1-title')
    pg.click('[data-act=new]'); talk(pg); shot(pg, '2-prep')
    pg.click('[data-act=price][data-m=tteok][data-d="1"]'); pg.click('[data-act=price][data-m=tteok][data-d="-1"]')
    pg.click('[data-act=open]'); pg.add_script_tag(content=BOT)
    pg.evaluate('__bot.play(130)'); pg.wait_for_timeout(1300); shot(pg, '3-lunch'); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, '3b-shop.png'))
    # 메뉴마다 다른 조리 미니게임을 실제 탭으로 열어 보기 (잠깐 세 메뉴를 다 열어요)
    for m, (x, y), name in (('tteok', (1, 1), 'stir'), ('kimbap', (2, 1), 'roll'), ('twigim', (4, 1), 'fry')):
        pg.evaluate("(([m,x,y])=>{const r=__T.G.run, S=__T.G.story; S.menus0=S.menus0||S.menus.slice(); S.menus=['tteok','kimbap','twigim']; r.cook=null; r.hands=[]; r.tickets.push({cid:-1,menu:m,table:1}); r.player.x=x; r.player.y=3; r.player.path=[]; __T.runCmd('tap',{x:x+.5,y:y+.5}); __T.runFor(0.7); if(m==='kimbap'){__T.runCmd('cookTap');__T.runCmd('cookTap');}})", [m, x, y])
        pg.wait_for_timeout(120); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, f'4-cook-{name}.png'))
        pg.evaluate("(()=>{const r=__T.G.run, S=__T.G.story; __T.runCmd('cookTap'); r.cook=null; r.tickets=r.tickets.filter(t=>t.cid!==-1); r.hands=[]; S.menus=S.menus0; delete S.menus0;})()")
    play(pg)
    shot(pg, '5-receipt')
    rec = pg.evaluate('JSON.stringify(__T.G.lastReceipt)')
    chapters = []
    for d in range(2, 9):
        to_prep(pg)
        chapters.append(pg.evaluate("[__T.G.day, __T.G.story.ch, __T.G.story.title, __T.G.story.menus.join('+'), __T.G.story.active.join(',')]"))
        if d == 4: shot(pg, '6-prep-ch1')
        pg.click('[data-act=open]')
        if d == 4:  # 1장 첫날: 냉장고 쪽지 「!」
            pg.evaluate('__bot.play(20)'); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, '6b-clue.png'))
        play(pg)
        if d == 7: r7 = pg.evaluate('JSON.stringify({foot:__T.G.lastReceipt.foot, entered:__T.G.lastReceipt.entered, served:__T.G.lastReceipt.served, quests:__T.G.lastReceipt.quests})')
    to_prep(pg); shot(pg, '9-prep-day9')
    story = pg.evaluate("JSON.stringify({tools:__T.G.story.tools, ch:__T.G.story.ch, title:__T.G.story.title, shop:__T.G.shop, done:__T.G.story.done, active:__T.G.story.active, decor:__T.G.story.decor, menus:__T.G.story.menus, prog:__T.G.story.prog})")
    bot0 = pg.evaluate('({problems: __bot.problems, games: __bot.games})')
    hist = pg.evaluate('JSON.stringify(__T.G.history.map(h=>[h.day,h.revenue,h.net,h.served,h.missed,+(h.rating||0).toFixed(2)]))')
    state = pg.evaluate('JSON.stringify({day:__T.G.day,cash:__T.G.cash,loan:__T.G.loan,rating:__T.G.rating,phase:__T.G.phase})')
    # 다시 열면 준비 화면부터 (이야기도 그대로)
    pg.reload(); pg.wait_for_function('window.__T && window.__T.viewReady()')
    pg.click('[data-act=continue]'); talk(pg); after = pg.evaluate('JSON.stringify({day:__T.G.day,phase:__T.G.phase,ch:__T.G.story.ch,shop:__T.G.shop})')
    b.close()
r = json.loads(rec); st = json.loads(story)
print('1일차 받은 메뉴:', {m: r['sales'][m]['n'] for m in r['sales']})
print('1일차:', {k: r[k] for k in ('revenue', 'tips', 'usedCost', 'expiredCost', 'net', 'served', 'missed', 'avgSpend', 'rating', 'quests')})
print('8일 기록 [일, 매출, 순이익, 손님, 놓침, 별]:', hist)
print('7일차:', r7)
print('날마다 [일, 장, 칭호, 메뉴, 할 일]:'); [print('  ', c) for c in chapters]
print('본 장면:', seen)
print('도구:', pg_tools if 'pg_tools' in dir() else '')
print('이야기:', st)
print('끝:', state, '· 다시 열기:', after)
print('봇 확인:', bot0['problems'][:5] or '문제 없음')
print('오류:', errs or '없음')
bad = errs or bot0['problems'] or st['ch'] < 2 or 'c1_week' not in st['done']
sys.exit(1 if bad else 0)
