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
    for _ in range(120):
        if not pg.evaluate("!document.getElementById('talk').hidden"): return
        sid = pg.evaluate('__T.G.story.queue[0]')
        if sid not in seen:
            seen.append(sid)
            if sid in SHOT_SCENES: shot(pg, 'talk-' + sid)
        if pg.locator('#talkName').count():
            shot(pg, 'talk-name'); pg.fill('#talkName', '떡집'); pg.click('[data-talk=name]')
        elif pg.locator('#talk [data-ring]').count():  # 전화가 울리면 「받기」 (v0.54)
            if 'ring' not in seen: seen.append('ring'); shot(pg, 'talk-ring')
            pg.click('#talk [data-ring]')
        else: pg.click('#talk')
    raise RuntimeError('대화가 끝나지 않아요')
def to_prep(pg):
    pg.locator('[data-act=afterReceipt]:visible').first.click()
    if pg.locator('[data-act=afterWeekly]').count():
        shot(pg, '7-weekly'); pg.click('[data-act=afterWeekly]')
    talk(pg)
    town = pg.evaluate('__T.town().on')
    if town: town_night_dawn(pg)
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
    # 봇은 재료를 넉넉히 시켜요 (「재료가 떨어지지 않은 날」 퀘스트가 운에 맡겨지지 않게) — 마을에서는 새벽 시장에서 샀어요
    if not town:
        for btn in pg.locator('[data-act=prep][data-d="1"]').all(): btn.click(); btn.click()
def town_chat(pg):
    for _ in range(20):
        if pg.evaluate("!document.getElementById('talk').hidden || !document.getElementById('cut').hidden"):  # 이야기 장면(신문·연출 등)이 위에 떠 있으면 먼저 넘겨요
            print('  마을 대화 중 장면:', pg.evaluate('__T.G.story.queue[0]')); talk(pg); continue
        if pg.evaluate("document.getElementById('townSheet').hidden || !document.getElementById('townSheet').classList.contains('chat')"): return
        pg.click('#townSheet'); pg.wait_for_timeout(30)
def town_night_dawn(pg):
    """마을(준비 시간 한 턴, v0.59부터 밤·새벽 구분 없음): 청소·이웃 이야기 → 휴대폰 식자재 주문(한 번) → 시장에서 (어제 판 만큼 + 넉넉히) 사기 → 오픈 준비 → 가게 열기(또는 집에서 자기)"""
    R = lambda c, a: pg.evaluate("__T.runCmd('%s', %s)" % (c, a))
    if 'town' not in seen:
        seen.append('town'); pg.click('[data-act=toTown]') if pg.locator('[data-act=toTown]').count() else None
        pg.wait_for_timeout(300); shot(pg, '9-town-night')
    R('townAct', "{place:'shop',act:'clean'}")
    R('townAct', "{place:'laundry',act:'talk'}"); town_chat(pg)
    R('townAct', "{place:'shop',act:'insta'}")  # 홍보 (v0.54부터 휴대폰 앱 — 규칙은 그대로 우리 가게 일)
    if pg.evaluate('__T.G.story.ch') >= 2 and 'furn' not in seen:  # 미소 가구 (2장 · 밤 네 번째 칸): 들르면 이야기 → 가구 창(새벽이 돼도 창은 그대로) · 벽지 하나 사기
        seen.append('furn')
        pg.evaluate("__T.runCmd('townAct', {place:'flower',act:'furn'})"); pg.wait_for_timeout(100); town_chat(pg); pg.wait_for_timeout(150)
        if not pg.locator('#townSheet.furn').count(): errs.append('미소 가구 창이 안 열려요')
        else:
            pg.click('[data-ts=fth][data-t=wood]'); pg.wait_for_timeout(50)
            pg.click('[data-ts=fbuy][data-c=wall]'); pg.wait_for_timeout(100)  # 담기 → 미리보기 → 구매하기
            pg.click('[data-ts=fcart]'); pg.wait_for_timeout(100)
            if pg.evaluate('__T.G.furn.have.wall') != 'wood': errs.append('미소 가구에서 벽지를 못 샀어요')
            shot(pg, '9e-furn')
    if 'order' not in seen:  # 휴대폰 「식자재 주문」(v0.59): 정가 · 시간 안 씀 · 친밀도 없음
        seen.append('order')
        used, bond, cash = pg.evaluate('__T.G.town.used'), pg.evaluate('JSON.stringify(__T.G.bond.pts)'), pg.evaluate('__T.G.cash')
        pg.click('[data-tb=phone]'); pg.wait_for_timeout(120)
        if pg.evaluate("!document.getElementById('talk').hidden"): shot(pg, '9g-phone-help'); talk(pg)  # 처음 열면 휴대폰 안내 카드 (v0.61)
        else: errs.append('휴대폰을 처음 열었는데 안내 카드가 안 나와요')
        pg.click('[data-ts=app][data-p=order]'); pg.wait_for_timeout(80)
        pg.click('[data-ts=fill]'); pg.wait_for_timeout(50); pg.locator('.mk-tile[data-i=ddeok]').click(); pg.wait_for_timeout(50)
        shot(pg, '9f-phone-order')
        pg.click('[data-ts=buyCart]'); pg.wait_for_timeout(80)
        if pg.evaluate('__T.G.cash') >= cash: errs.append('휴대폰 식자재 주문이 돈을 쓰지 않았어요')
        if pg.evaluate('__T.G.town.used') != used: errs.append('휴대폰 식자재 주문에 시간이 들었어요')
        if pg.evaluate('JSON.stringify(__T.G.bond.pts)') != bond: errs.append('휴대폰 주문에 친밀도가 올랐어요')
        pg.evaluate("document.querySelector('#townSheet [data-ts=close]') && document.querySelector('#townSheet [data-ts=close]').click()")
    R('townAct', "{place:'market',act:'market'}"); town_chat(pg)
    if 'market' not in seen: seen.append('market'); pg.wait_for_timeout(200); shot(pg, '9b-market')
    # 화면 그대로: 「모자란 만큼 담기」 → 떡 한 묶음 더(진열대 타일) → 「구매하기」
    pg.click('[data-ts=fill]'); pg.wait_for_timeout(50)
    pg.locator('.mk-tile[data-i=ddeok]').click(); pg.wait_for_timeout(50)
    if 'cart' not in seen: seen.append('cart'); shot(pg, '9c-market-cart')
    before = pg.evaluate('__T.G.cash')
    if pg.locator('[data-ts=buyCart]:not([disabled])').count():
        pg.click('[data-ts=buyCart]'); pg.wait_for_timeout(50)
        if pg.evaluate('__T.G.cash') >= before: errs.append('시장 구매하기 버튼이 돈을 쓰지 않았어요')
    R('townAct', "{place:'shop',act:'setup'}")
    if pg.evaluate('__T.G.day') % 2: R('townAct', "{place:'home',act:'sleep'}"); talk(pg)  # 집에서 자면 가게 열기 화면으로 (v0.59)
    else: R('townAct', "{place:'shop',act:'open'}"); talk(pg)
def open_shop(pg):
    """가게 열기 → 보온 통이 있으면 새벽에 미리 끓이기(봇이 미니게임) → 문 열기"""
    pg.click('[data-act=open]')
    if pg.evaluate("!document.getElementById('dawnUI').hidden"):
        if 'dawn' not in seen: seen.append('dawn'); shot(pg, '6c-dawn')
        for _ in range(6):
            if pg.locator('[data-dawn=cook][disabled]').count(): break
            pg.click('[data-dawn=cook]')
            pg.evaluate("(()=>{for(let i=0;i<400&&__T.G.run.cook;i++){__bot.think();__T.runFor(1/30)}})()")
        if 'dawn2' not in seen: seen.append('dawn2'); shot(pg, '6d-dawn-full')
        pg.click('[data-dawn=open]')
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
    chapters = []; incs = []
    for d in range(2, 9):
        to_prep(pg)
        chapters.append(pg.evaluate("[__T.G.day, __T.G.story.ch, __T.G.story.title, __T.G.story.menus.join('+'), __T.G.story.active.join(',')]"))
        if d == 4: shot(pg, '6-prep-ch1')
        open_shop(pg)
        if d == 4:  # 1장 첫날: 냉장고 쪽지 「!」
            pg.evaluate('__bot.play(20)'); pg.locator('#cvWrap').screenshot(path=os.path.join(OUT, '6b-clue.png'))
        if d == 6:  # 영업 중 돌발 이벤트 화면 (시작 직후)
            pg.evaluate("(()=>{__T.runCmd('devIncident',{id:'takeout'}); __T.runFor(0.2)})()"); pg.wait_for_timeout(300); shot(pg, '6e-incident')
        play(pg)
        incs.append([d, pg.evaluate('JSON.stringify(__T.G.lastReceipt.incidents)'), pg.evaluate('(__T.G.lastReceipt.reviews||[]).map(v=>v.who).join(",")')])
        if d == 7:  # 영수증 시간대 막대 (v0.63: 김밥 들어오는 날부터 · 들어온 손님만): 넘겨서 찾고 막대 하나 누르기
            for _ in range(4):
                if pg.locator('.hourly:visible').count(): break
                if not pg.locator('[data-act=rcNext]:visible').count(): break
                pg.locator('[data-act=rcNext]:visible').first.click(); pg.wait_for_timeout(150)
            if not pg.locator('.hourly:visible').count(): errs.append('영수증에 시간대 막대가 안 나와요 (김밥 날부터)')
            else:
                before = pg.locator('.hourly .h-sum').inner_text()
                pg.locator('.hourly .hc').nth(3).click(); pg.wait_for_timeout(100); shot(pg, '5b-receipt-hourly')
                if pg.locator('.hourly .h-sum').inner_text() == before: errs.append('시간대 막대를 눌러도 숫자가 안 바뀌어요')
        if d == 7: r7 = pg.evaluate('JSON.stringify({foot:__T.G.lastReceipt.foot, entered:__T.G.lastReceipt.entered, served:__T.G.lastReceipt.served, quests:__T.G.lastReceipt.quests})')
    if not pg.evaluate('!!(__T.G.lastReceipt.hourly && Object.keys(__T.G.lastReceipt.hourly).length)'): errs.append('영수증 시간대 기록이 없어요')
    to_prep(pg); shot(pg, '9-prep-day9')
    # 메뉴 연구 칠판 (마을 · 우리 가게): 떡볶이 올리기
    pg.evaluate("__T.runCmd('townAct', {place:'shop',act:'recipe'})"); pg.wait_for_timeout(200)
    up = {'mastery': pg.evaluate('JSON.stringify(__T.G.mastery)')}
    if not pg.locator('#townSheet.chalk').count(): errs.append('메뉴 연구 칠판이 안 열려요')
    else:
        shot(pg, '9d-board')
        if pg.locator('[data-ts=menuUp][data-m=tteok]:not([disabled])').count():
            pg.click('[data-ts=menuUp][data-m=tteok]'); pg.wait_for_timeout(100)
            if pg.evaluate('__T.G.menuLv.tteok') != 2: errs.append('떡볶이 업그레이드가 안 됐어요')
        else: errs.append('떡볶이 숙련도가 30을 못 넘었어요')
    up['lv'] = pg.evaluate('JSON.stringify(__T.G.menuLv)')
    up['furn'] = pg.evaluate('JSON.stringify({have:__T.G.furn.have, bond:__T.G.bond.pts})')
    story = pg.evaluate("JSON.stringify({dawn:__T.G.history.slice(-3).map(h=>h.day), tools:__T.G.story.tools, ch:__T.G.story.ch, title:__T.G.story.title, shop:__T.G.shop, done:__T.G.story.done, active:__T.G.story.active, decor:__T.G.story.decor, menus:__T.G.story.menus, prog:__T.G.story.prog})")
    bot0 = pg.evaluate('({problems: __bot.problems, games: __bot.games})')
    hist = pg.evaluate('JSON.stringify(__T.G.history.map(h=>[h.day,h.revenue,h.net,h.served,h.missed,+(h.rating||0).toFixed(2)]))')
    state = pg.evaluate('JSON.stringify({day:__T.G.day,cash:__T.G.cash,loan:__T.G.loan,rating:__T.G.rating,phase:__T.G.phase})')
    # 다시 열면 준비 화면부터 (이야기도 그대로)
    pg.reload(); pg.wait_for_function('window.__T && window.__T.viewReady()')
    pg.click('[data-act=continue]'); talk(pg); after = pg.evaluate('JSON.stringify({day:__T.G.day,phase:__T.G.phase,ch:__T.G.story.ch,shop:__T.G.shop,wall:__T.G.furn.have.wall})')
    b.close()
r = json.loads(rec); st = json.loads(story)
print('1일차 받은 메뉴:', {m: r['sales'][m]['n'] for m in r['sales']})
print('1일차:', {k: r[k] for k in ('revenue', 'tips', 'usedCost', 'expiredCost', 'net', 'served', 'missed', 'avgSpend', 'rating', 'quests')})
print('8일 기록 [일, 매출, 순이익, 손님, 놓침, 별]:', hist)
print('7일차:', r7)
print('날마다 [일, 장, 칭호, 메뉴, 할 일]:'); [print('  ', c) for c in chapters]
print('본 장면:', seen)
print('돌발 [일, 결과, 리뷰 쓴 사람]:'); [print('  ', i) for i in incs]
print('도구:', pg_tools if 'pg_tools' in dir() else '')
print('이야기:', st)
print('메뉴 업그레이드:', up)
print('끝:', state, '· 다시 열기:', after)
print('봇 확인:', bot0['problems'][:5] or '문제 없음')
print('오류:', errs or '없음')
bad = errs or bot0['problems'] or st['ch'] < 2 or 'c1_week' not in st['done']
sys.exit(1 if bad else 0)
