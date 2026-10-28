// 시험용 사장 봇: window.__T로 하루를 대신 돌려요. (dev/qa/smoke.py가 페이지에 넣어요)
// check(): 매 걸음 규칙 확인 — 같은 사람(그림) 동시 방문 없음 · 한 탁자에는 한 일행만
window.__bot = (() => {
  const ST = { tteok: [1, 1], kimbap: [2, 1], twigim: [4, 1] };
  const tap = (x, y) => window.__T.runCmd('tap', { x: x + 0.5, y: y + 0.5 });
  const reg = () => { const [x, y] = window.__T.regAt(); tap(x, y); }; // 계산대 (v0.72부터 주방 앞)
  const problems = [];
  const games = { stir: 0, roll: 0, fry: 0 };
  function cook(r) {
    const c = r.cook, run = window.__T.runCmd;
    if (c.t === 0) games[c.game]++;
    if (c.game === 'stir' && (Math.abs(c.pos - 0.5) < 0.06 || c.t > 2.8)) run('cookTap');
    else if (c.game === 'roll' && c.t > 0.22 * (c.taps + 1)) run('cookTap');
    else if (c.game === 'fry' && c.pos >= 0.7) run('cookTap');
  }
  function think() {
    const { G } = window.__T, r = G.run;
    if (!r) return;
    const p = r.player;
    if (r.cook) { cook(r); return; }
    if (p.moving) return;
    // 오 사장님이 미리 만들어 보라고 하면 (프롤로그 2일차)
    const ask = window.__T.tutAsk();
    if (ask && ask.at === 'stove' && ask.until === 'cookStart' && r.hands.length < 2) { tap(1, 1); return; }
    // 이야기: 냉장고 뒤 쪽지를 찾아야 하면 한가할 때 냉장고로
    if (G.story.active.includes('c1_note') && !r.hands.length && !r.tickets.length && !r.payLine.length) { tap(0, 1); return; }
    const waiting = r.customers.filter(c => c.state === 'waitFood');
    const serveTo = waiting.filter(c => r.hands.some(d => d.menu === c.menu)).sort((a, b) => a.patience - b.patience)[0];
    if (serveTo) { tap(serveTo.x, serveTo.y - 1); return; } // 사람 머리 쪽을 눌러요
    const front = r.payLine.length && r.customers.find(c => c.id === r.payLine[0]);
    const atReg = p.target && p.target.kind === 'register';
    if (atReg && front) return;
    const base = m => m.split('_')[0]; // 새 메뉴(tteok_rose …)는 기본 메뉴의 조리대에서
    const need = [...new Set(r.tickets.map(t => t.menu))].filter(m => r.tickets.filter(t => t.menu === m).length > r.hands.filter(d => d.menu === m).length).map(base);
    if (front && front.patience / front.patMax < 0.6) { reg(); return; }
    if (need.length && r.hands.length < 2) { const [x, y] = ST[need[0]]; tap(x, y); return; }
    if (r.tickets.some(t => t.takeout && r.hands.some(d => d.menu === t.menu)) && !waiting.some(c => r.hands.some(d => d.menu === c.menu))) { if (!atReg) reg(); return; } // 포장은 계산대로
    if (r.hands.some(d => !d.ahead) && !waiting.some(c => r.hands.some(d => d.menu === c.menu))) { const [tx, ty] = window.__T.trashAt(); tap(tx, ty); return; } // 미리 만든 몫은 들고 있어요 (퇴식대 — v0.67부터 홀 왼쪽 아래)
    if (!atReg) reg();
  }
  function check() {
    const r = window.__T.G.run; if (!r) return;
    const chars = r.customers.map(c => c.char);
    if (new Set(chars).size !== chars.length) problems.push('같은 사람 둘: ' + chars.join(','));
    const byTable = {};
    r.seats.forEach((id, i) => { if (id === null) return; const c = r.customers.find(q => q.id === id); if (!c) { problems.push('빈 손님 자리'); return; } const no = Math.floor(i / 2) + 1; (byTable[no] = byTable[no] || new Set()).add(c.party); });
    for (const no in byTable) if (byTable[no].size > 1) problems.push(`${no}번 탁자에 일행 ${byTable[no].size}팀`);
  }
  function play(sec) {
    const { G, runFor } = window.__T;
    let t = 0;
    const ui = document.getElementById('incUI'); // 돌발 이벤트 대화·카드는 넘겨요 (봇은 runFor라 멈춤과 상관없이 돌아요)
    for (let k = 0; k < 20 && !ui.hidden; k++) { const b = ui.querySelector('[data-inc]'); (b || ui).click(); }
    const talk = document.getElementById('talk'); // 영업 중 대화·요령 카드도 넘겨요 (오 사장님 가게 길잡이)
    while (G.phase === 'day' && t < sec) { for (let k = 0; k < 4 && !talk.hidden; k++) (talk.querySelector('[data-ring]') || talk).click(); think(); runFor(0.1); check(); t += 0.1; }
    return G.phase;
  }
  return { think, play, problems, games };
})();
