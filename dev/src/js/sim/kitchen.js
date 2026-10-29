// 자동 주방 (v0.83 시험 — data/menu.js AUTO_COOK): 조리 미니게임 대신 조리대가 알아서 만들어요 (데이브 더 다이버의 반초처럼)
//  주문이 들어오면 그 메뉴의 조리대가 하나씩 만들어 조리대 위에 올려 둬요(최대 AUTO_SHELF) → 사장이 가서 들고 → 손님에게 내줘요
//  「완벽」은 갓 나왔을 때: 다 된 뒤 AUTO_FRESH.perfect초 안에 들면 「완벽」, good초 안이면 「좋음」, 더 늦으면 식어서 「보통」
//  주문이 없을 때 조리대를 누르면 하나 미리 만들어요(재료는 그때 써요)
//  재료: 주문 몫은 주문할 때(sim/customers.js decide), 미리 만드는 몫은 만들기 시작할 때 써요 — 조리대 위·만드는 중인 그릇은 이미 재료를 쓴 몫(kitMade)
import { G } from '../save/state.js';
import { MENUS, AUTO_COOK, AUTO_COOK_SEC, AUTO_SHELF, AUTO_FRESH, AUTO_FRESH_TIMER, AUTO_FRESH_TIMER2, AUTO_EQ_FAST, QUALITY_NAME, INGREDIENTS } from '../data/menu.js';
import { STATIONS } from '../data/layout.js';
import { josa } from '../engine/util.js';
import { emit } from './events.js';
import { hasTool, handsMax } from './tools.js';
import { eqLv, toolUp, cookTwice } from './guild.js';
import { stockOf, takeMenu, shortIng, todayMenus } from './pantry.js';
import { storyNote } from './story.js';
import { incidentNote } from './incidents.js';
import { tutNote } from './tutorial.js';

// 조리대 하나의 상태: cur 만드는 중 { menu, t, dur, n } · shelf 다 된 그릇 [{ menu, at }] · ahead 미리 만들 그릇 수
export function kitOf(id) {
  const r = G.run;
  r.kit = r.kit || {};
  return (r.kit[id] = r.kit[id] || { cur: null, shelf: [], ahead: [] });
}
const kitMenus = id => todayMenus().filter(m => MENUS[m].station === id);
const tk = m => G.run.tickets.filter(t => t.menu === m).length;
const hd = m => G.run.hands.filter(d => d.menu === m).length;
const shelfN = (K, m) => K.shelf.filter(d => d.menu === m).length;
const curN = (K, m) => (K.cur && K.cur.menu === m ? K.cur.n : 0);
// 이미 재료를 쓰고 만들었거나 만드는 중인 그릇 (sim/customers.js spareOf · removeTicket)
export function kitMade(m) {
  if (!AUTO_COOK || !G.run || !G.run.kit) return 0;
  const K = G.run.kit[MENUS[m].station];
  return K ? shelfN(K, m) + curN(K, m) : 0;
}
// 더 만들어야 하는 주문 몫 (프렙 통 그릇도 있는 몫으로 셈)
const needOf = (K, m) => tk(m) - hd(m) - shelfN(K, m) - curN(K, m) - ((G.run.ready && G.run.ready[m]) || []).length;
const cookSec = m => AUTO_COOK_SEC[MENUS[m].game] * (eqLv(MENUS[m].station) >= 2 ? AUTO_EQ_FAST : 1);
const freshMul = () => (toolUp('timer') ? AUTO_FRESH_TIMER2 : hasTool('timer') ? AUTO_FRESH_TIMER : 1);
// 조리대 위에서 지난 시간 → 품질
export function freshQ(d) {
  const age = G.run.kitT - d.at, k = freshMul();
  return age <= AUTO_FRESH.perfect * k ? 2 : age <= AUTO_FRESH.good * k ? 1 : 0;
}
// 그릇이 「완벽」으로 남은 몫 (0~1, 그리기용)
export function freshLeft(d) { return Math.max(0, 1 - (G.run.kitT - d.at) / (AUTO_FRESH.perfect * freshMul())); }

// 매 걸음 (sim/loop.js): 조리대마다 만들기 · 다 되면 조리대 위에
export function tickKitchen(dt) {
  const r = G.run;
  if (!AUTO_COOK || !r) return;
  r.kitT = (r.kitT || 0) + dt;
  for (const id in STATIONS) {
    const st = STATIONS[id];
    if (!st.menu) continue;
    const ms = kitMenus(id);
    if (!ms.length && !(r.kit && r.kit[id])) continue;
    const K = kitOf(id);
    if (K.cur) {
      K.cur.t += dt;
      if (K.cur.t >= K.cur.dur) done(id, K);
    }
    if (K.cur || K.shelf.length >= AUTO_SHELF) continue;
    // 다음 그릇: 먼저 들어온 주문 → 미리 만들기
    const t = r.tickets.find(q => ms.includes(q.menu) && needOf(K, q.menu) > 0);
    let m = t ? t.menu : null, ahead = false;
    if (!m && K.ahead.length) {
      m = K.ahead.shift();
      if (stockOf(m) <= 0) { emit('toast', `${josa(INGREDIENTS[shortIng(m)].name, '이/가')} 없어 미리 만들지 못했습니다`, 'warn'); continue; }
      takeMenu(m); ahead = true;
    }
    if (!m) continue;
    const n = !ahead && cookTwice(id) && needOf(K, m) >= 2 ? 2 : 1; // 설비 Lv3: 주문이 둘 넘게 밀리면 한 번에 2그릇
    K.cur = { menu: m, t: 0, dur: cookSec(m), n, ahead };
    tutNote('cookStart'); if (ahead) tutNote('aheadStart');
  }
  // 조리대 앞에서 기다리던 사장: 다 되면 바로 들어요
  const w = r.kitWait, p = r.player;
  if (w && (p.path.length || p.moving)) r.kitWait = null;
  else if (w && kitOf(w).shelf.length && r.hands.length < handsMax()) { r.kitWait = null; kitPickup(w); }
}
function done(id, K) {
  const r = G.run, c = K.cur;
  K.cur = null;
  for (let k = 0; k < c.n; k++) K.shelf.push({ menu: c.menu, at: r.kitT, ahead: c.ahead }); // ahead: 주문 없이 미리 만든 그릇 (퀘스트 「손이 놀 때」)
  emit('sfx', 'cookDone'); // 조리대 위 말풍선이 「다 됐어요」를 보여 줘요 (render/view.js kitchenHint)
}

// 조리대를 눌렀을 때 (sim/player.js arriveAt): 다 된 그릇 들기 · 없으면 기다리거나 하나 미리 만들기
export function kitPickup(id) {
  const r = G.run, K = kitOf(id), p = r.player;
  const ms = kitMenus(id);
  if (!ms.length) { emit('toast', `${josa(MENUS[STATIONS[id].menu].name, '은/는')} 오늘 쉬는 메뉴입니다`, 'info'); return; }
  if (r.hands.length >= handsMax()) { emit('toast', '손이 꽉 찼습니다. 먼저 내주거나 퇴식대에 버려 보세요', 'warn'); return; }
  let got = 0;
  // 프렙 통에 미리 만들어 둔 그릇 먼저 (주문이 있는 메뉴부터)
  for (const m of ms) {
    const rd = r.ready && r.ready[m];
    while (rd && rd.length && r.hands.length < handsMax() && tk(m) > hd(m)) { rd.sort((a, b) => b - a); hold(m, rd.shift(), true); got++; }
  }
  // 조리대 위 그릇: 주문 있는 메뉴 · 오래된 것부터
  K.shelf.sort((a, b) => (tk(b.menu) > hd(b.menu)) - (tk(a.menu) > hd(a.menu)) || a.at - b.at);
  while (K.shelf.length && r.hands.length < handsMax()) { const d = K.shelf.shift(); hold(d.menu, freshQ(d), false, d.ahead); got++; }
  if (got) return;
  if (K.cur) { r.kitWait = id; emit('float', p.x, p.y - 1.8, `${MENUS[K.cur.menu].name} 만드는 중…`, 'plain'); return; } // 서 있으면 다 되는 대로 들어요
  // 주문이 없으면 만들지 않아요 (v0.88 사용자 요청: 「하나 미리 만들기」 뺌)
  if (!ms.some(x => stockOf(x) > 0)) { emit('toast', `${josa(INGREDIENTS[shortIng(ms[0])].name, '이/가')} 없습니다. 냉장고에서 급구매해 보세요`, 'warn'); return; }
  emit('float', p.x, p.y - 1.8, '주문이 들어오면 만듭니다', 'plain');
}
// 손에 들기 (조리 미니게임의 finishCook 몫 — 품질 알림 · 퀘스트 · 돌발 미션)
function hold(m, q, prep, made) {
  const r = G.run, p = r.player;
  const ahead = made || tk(m) <= hd(m); // 주문 없이 미리 만든 몫
  if (prep && tk(m) <= hd(m) && stockOf(m) > 0) takeMenu(m); // 프렙 그릇은 낼 때 재료를 써요 (sim/day.js)
  r.hands.push(ahead ? { menu: m, q, ahead: true } : { menu: m, q });
  emit('float', p.x, p.y - 1.8, prep ? `미리 만든 ${MENUS[m].name}` : `${MENUS[m].name} ${QUALITY_NAME[q]}${q === 2 ? '!' : q === 0 ? ' (식었어요)' : ''}`, q === 2 ? 'great' : q === 1 ? 'good' : 'plain');
  emit('sfx', q === 2 && !prep ? 'perfect' : 'cookDone');
  if (!prep) { storyNote('cook', { menu: m, q }); storyNote('cookStreak', { menu: m, q }); incidentNote('cook', { menu: m }, q); }
  tutNote('cookEnd');
}

// 마감 (sim/day.js endDay): 조리대 위·만드는 중인 그릇은 버려요 (재료는 이미 썼어요)
export function kitLeftCost(costOf) {
  const r = G.run;
  if (!r || !r.kit) return 0;
  let s = 0;
  for (const id in r.kit) { const K = r.kit[id]; for (const d of K.shelf) s += costOf(d.menu); if (K.cur) s += costOf(K.cur.menu) * K.cur.n; K.shelf = []; K.cur = null; K.ahead = []; }
  return s;
}
