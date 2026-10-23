// 시험용 사장 봇: window.__T로 하루를 대신 돌려요. (dev/qa/smoke.py가 페이지에 넣어요)
// check(): 매 걸음 규칙 확인 — 같은 사람(그림) 동시 방문 없음 · 한 탁자에는 한 일행만
window.__bot = (() => {
  const ST = { tteok: [1, 1], kimbap: [2, 1], twigim: [4, 1] };
  const tap = (x, y) => window.__T.runCmd('tap', { x: x + 0.5, y: y + 0.5 });
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
    const waiting = r.customers.filter(c => c.state === 'waitFood');
    const serveTo = waiting.filter(c => r.hands.some(d => d.menu === c.menu)).sort((a, b) => a.patience - b.patience)[0];
    if (serveTo) { tap(serveTo.x, serveTo.y - 1); return; } // 사람 머리 쪽을 눌러요
    const front = r.payLine.length && r.customers.find(c => c.id === r.payLine[0]);
    const atReg = p.target && p.target.kind === 'register';
    if (atReg && front) return;
    const need = Object.keys(ST).filter(m => r.tickets.filter(t => t.menu === m).length > r.hands.filter(d => d.menu === m).length);
    if (front && front.patience / front.patMax < 0.6) { tap(6, 7); return; }
    if (need.length && r.hands.length < 2) { const [x, y] = ST[need[0]]; tap(x, y); return; }
    if (r.hands.length && !waiting.some(c => r.hands.some(d => d.menu === c.menu))) { tap(6, 1); return; }
    if (!atReg) tap(6, 7);
  }
  function check() {
    const r = window.__T.G.run; if (!r) return;
    const chars = r.customers.map(c => c.char);
    if (new Set(chars).size !== chars.length) problems.push('같은 사람 둘: ' + chars.join(','));
    const byTable = {};
    r.seats.forEach((id, i) => { if (id === null) return; const c = r.customers.find(q => q.id === id); if (!c) { problems.push('빈 손님 자리'); return; } const no = [1, 1, 2, 2, 3, 3][i]; (byTable[no] = byTable[no] || new Set()).add(c.party); });
    for (const no in byTable) if (byTable[no].size > 1) problems.push(`${no}번 탁자에 일행 ${byTable[no].size}팀`);
  }
  function play(sec) {
    const { G, runFor } = window.__T;
    let t = 0;
    while (G.phase === 'day' && t < sec) { think(); runFor(0.1); check(); t += 0.1; }
    return G.phase;
  }
  return { think, play, problems, games };
})();
