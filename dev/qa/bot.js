// 시험용 사장 봇: window.__T로 하루를 대신 돌려요. (dev/qa/smoke.py가 페이지에 넣어요)
window.__bot = (() => {
  const SEAT = [[1, 5], [3, 5], [1, 7], [3, 7]];
  const ST = { tteok: [1, 1], kimbap: [2, 1], twigim: [4, 1] };
  function think() {
    const { G, runCmd } = window.__T, r = G.run;
    if (!r) return;
    const p = r.player;
    if (r.cook) { if (Math.abs(r.cook.pos - 0.5) < 0.06 || r.cook.t > 2.8) runCmd('cookStop'); return; }
    if (p.moving) return;
    const waiting = r.customers.filter(c => c.state === 'waitFood');
    const serveTo = waiting.filter(c => r.hands.some(d => d.menu === c.menu)).sort((a, b) => a.patience - b.patience)[0];
    if (serveTo) { const [x, y] = SEAT[serveTo.seat]; runCmd('tap', { x, y }); return; }
    const front = r.payLine.length && r.customers.find(c => c.id === r.payLine[0]);
    const atReg = p.target && p.target.kind === 'register';
    if (atReg && front) return; // 계산 중
    const need = Object.keys(ST).filter(m => r.tickets.filter(t => t.menu === m).length > r.hands.filter(d => d.menu === m).length);
    if (front && front.patience / front.patMax < 0.6) { runCmd('tap', { x: 6, y: 5 }); return; }
    if (need.length && r.hands.length < 2) { const [x, y] = ST[need[0]]; runCmd('tap', { x, y }); return; }
    if (r.hands.length && !serveTo && !need.length && !waiting.some(c => r.hands.some(d => d.menu === c.menu))) { runCmd('tap', { x: 6, y: 1 }); return; }
    if (!atReg) runCmd('tap', { x: 6, y: 5 });
  }
  // 하루가 끝나거나 sec초가 지날 때까지
  function play(sec) {
    const { G, runFor } = window.__T;
    let t = 0;
    while (G.phase === 'day' && t < sec) { think(); runFor(0.1); t += 0.1; }
    return G.phase;
  }
  return { think, play };
})();
