// 사장: 누른 곳으로 가서 할 일을 해요.
//  조리대 → 메뉴마다 다른 조리 미니게임(졸이기·말기·튀기기) → 손에 들기(최대 2개)
//  손님(또는 그 탁자) → 들고 있는 음식 내주기 · 계산대 → 서 있는 동안 계산 · 퇴식대 → 들고 있는 음식 버리기
import { G } from '../save/state.js';
import { MENUS, COOK_GAMES, QUALITY_NAME, menuOpen } from '../data/menu.js';
import { HANDS_MAX, PAY_STEP_SEC } from '../data/economy.js';
import { STATIONS, REGISTER, SEATS, TABLES, PAY_SPOTS, solidForPlayer } from '../data/layout.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';
import { findPath, standAround, walk } from './path.js';
import { custById, serve, pay } from './customers.js';

const has = (tiles, x, y) => tiles.some(([a, b]) => a === x && b === y);
export const handsCount = m => G.run.hands.filter(d => d.menu === m).length;
export const ticketsCount = m => G.run.tickets.filter(t => t.menu === m).length;

// 한 탁자에서 음식을 기다리는 손님 중 내줄 사람 (들고 있는 음식과 맞는 사람 먼저, 오래 기다린 사람 먼저)
function waiterAtTable(no, prefer) {
  const r = G.run;
  const list = r.customers.filter(c => c.state === 'waitFood' && c.seat >= 0 && SEATS[c.seat].table === no)
    .sort((a, b) => a.patience - b.patience);
  const match = c => r.hands.some(d => d.menu === c.menu);
  return (prefer && match(prefer) && prefer) || list.find(match) || prefer || list[0] || null;
}

// 누른 자리(칸 좌표, 소수점까지)가 무엇인지 → 할 일
export function targetAt(fx, fy) {
  const r = G.run;
  const x = Math.floor(fx), y = Math.floor(fy);
  // 1) 사람 그림을 눌렀는지 (그림은 발밑 칸에서 위로 한 칸 반, 주문 말풍선까지)
  const hit = r.customers.filter(c => c.state !== 'leave' && fx >= c.x - 0.1 && fx < c.x + 1.1 && fy >= c.y - (c.state === 'waitFood' ? 2.2 : 1.3) && fy < c.y + 1)
    .sort((a, b) => b.y - a.y);
  for (const c of hit) {
    if (c.state === 'waitFood') { const w = waiterAtTable(SEATS[c.seat].table, c); return { kind: 'serve', cid: w.id }; }
    if (c.state === 'payLine') return { kind: 'register' };
  }
  // 2) 탁자·자리 칸
  const seat = SEATS.find(s => s.x === x && s.y === y);
  const table = TABLES.find(t => t.x === x && t.y === y);
  const no = seat ? seat.table : table ? table.no : 0;
  if (no) { const w = waiterAtTable(no); return w ? { kind: 'serve', cid: w.id } : null; }
  // 3) 조리대·계산대
  for (const id in STATIONS) {
    const st = STATIONS[id];
    if (st.menu && !menuOpen(st.menu, G.day)) continue; // 아직 없는 조리대
    if (has(st.tiles, x, y) || has(st.stand, x, y)) return { kind: 'station', id };
  }
  if (has(REGISTER.tiles, x, y) || has(REGISTER.stand, x, y) || has(PAY_SPOTS, x, y)) return { kind: 'register' };
  if (!solidForPlayer(x, y)) return { kind: 'move', x, y };
  return null;
}

function standFor(t) {
  if (t.kind === 'station') return STATIONS[t.id].stand;
  if (t.kind === 'register') return REGISTER.stand;
  if (t.kind === 'serve') {
    const c = custById(t.cid);
    if (!c || c.seat < 0) return null;
    const s = SEATS[c.seat], tb = TABLES.find(q => q.no === s.table);
    return standAround([[s.x, s.y], [tb.x, tb.y]], 'player'); // 탁자 옆 어디서든 내줄 수 있어요
  }
  return [[t.x, t.y]];
}

// 화면을 눌렀을 때 (x·y: 칸 좌표, 소수점까지)
defineCmd('tap', ({ x, y }) => {
  const r = G.run;
  if (!r || G.phase !== 'day') return;
  if (r.cook) { cookTap(); return; }
  const t = targetAt(x, y);
  if (!t) return;
  const goals = standFor(t);
  if (!goals || !goals.length) return;
  const p = r.player;
  const path = findPath(p, goals, 'player');
  if (!path) return;
  p.path = path; p.target = t; p.payT = 0;
  emit('tapMark', Math.floor(x), Math.floor(y), t.kind);
  if (!path.length) arriveAt(p); // 이미 그 자리에 서 있으면 바로 해요
});

defineCmd('cookTap', () => cookTap());
defineCmd('cookStop', () => cookTap()); // 옛 이름

// ── 조리 미니게임 ──
function startCook(st) {
  const r = G.run, m = st.menu;
  if (r.hands.length >= HANDS_MAX) { emit('toast', '손이 꽉 찼습니다. 먼저 내주거나 퇴식대에 버려 보세요', 'warn'); return; }
  if (ticketsCount(m) <= handsCount(m)) {
    emit('toast', ticketsCount(m) ? `${MENUS[m].name} 주문은 이미 손에 들고 있습니다` : `아직 ${MENUS[m].name} 주문이 없습니다`, 'info');
    return;
  }
  r.cook = { menu: m, game: MENUS[m].game, t: 0, speed: MENUS[m].cook, pos: 0, taps: 0 };
  emit('cook', true, m, r.cook.game);
  emit('sfx', 'cookStart');
}

function cookTap() {
  const r = G.run, c = r && r.cook;
  if (!c) return;
  const g = COOK_GAMES[c.game];
  if (c.game === 'stir') {
    const d = Math.abs(c.pos - 0.5);
    finishCook(d <= g.zone.perfect ? 2 : d <= g.zone.good ? 1 : 0);
  } else if (c.game === 'roll') {
    c.taps++; c.pos = c.taps / g.taps;
    emit('sfx', 'tap');
    if (c.taps >= g.taps) finishCook(c.t <= g.perfect ? 2 : c.t <= g.good ? 1 : 0);
  } else if (c.game === 'fry') {
    const p = c.pos, inZ = z => p >= z[0] && p <= z[1];
    finishCook(inZ(g.perfect) ? 2 : inZ(g.good) ? 1 : 0, p < g.good[0] ? '덜 익음' : p > g.good[1] ? '많이 익음' : '');
  }
}

function updateCook(c, dt) {
  const g = COOK_GAMES[c.game];
  c.t += dt;
  if (c.game === 'stir') {
    c.pos = 0.5 - 0.5 * Math.cos(c.t * 2.6 * c.speed); // 0~1을 오가요
    if (c.t >= g.timeout) finishCook(0);
  } else if (c.game === 'roll') {
    if (c.t >= g.timeout) finishCook(0, '덜 말림');
  } else if (c.game === 'fry') {
    c.pos = Math.min(1, c.t / g.sec); // 한 번만 지나가요
    if (c.pos >= 1) finishCook(0, '탔어요');
  }
}

function finishCook(q, note) {
  const r = G.run, c = r.cook;
  r.cook = null;
  r.hands.push({ menu: c.menu, q });
  const p = r.player;
  emit('float', p.x, p.y - 1.8, note && q < 2 ? `${note}…` : `${MENUS[c.menu].name} ${QUALITY_NAME[q]}${q === 2 ? '!' : ''}`, q === 2 ? 'great' : q === 1 ? 'good' : 'plain');
  emit('sfx', q === 2 ? 'perfect' : 'cookDone');
  emit('cook', false, c.menu, c.game, q);
}

// ── 내주기·버리기 ──
function serveTo(cid) {
  const r = G.run;
  let c = custById(cid);
  if (!c || c.state !== 'waitFood') {
    // 그 사이에 상황이 바뀌었으면 같은 탁자에서 다른 사람을 찾아요
    const no = c && c.seat >= 0 ? SEATS[c.seat].table : 0;
    c = no ? waiterAtTable(no) : null;
    if (!c) return;
  }
  const no = SEATS[c.seat].table;
  if (!r.hands.some(d => d.menu === c.menu)) c = waiterAtTable(no) || c;
  const i = r.hands.map((d, k) => [d, k]).filter(([d]) => d.menu === c.menu).sort((a, b) => b[0].q - a[0].q)[0];
  if (!i) { emit('toast', `이 손님은 ${josa(MENUS[c.menu].name, '을/를')} 주문했습니다`, 'info'); return; }
  r.hands.splice(i[1], 1);
  serve(c, i[0]);
  // 같은 탁자에 들고 있는 음식을 기다리는 사람이 또 있으면 이어서 내줘요
  const next = waiterAtTable(no);
  if (next && next.state === 'waitFood' && r.hands.some(d => d.menu === next.menu)) serveTo(next.id);
}

function trash() {
  const r = G.run;
  if (!r.hands.length) { emit('toast', '퇴식대입니다. 남는 음식을 여기에 버릴 수 있습니다', 'info'); return; }
  const d = r.hands.pop();
  r.log.wasteDishes += MENUS[d.menu].cost;
  emit('float', r.player.x, r.player.y - 1.6, `${MENUS[d.menu].name} 버림`, 'bad');
  emit('sfx', 'trash');
}

function arriveAt(p) {
  const t = p.target;
  if (!t) return;
  if (t.kind === 'station') {
    p.dir = 1;
    const st = STATIONS[t.id];
    if (st.menu) startCook(st); else trash();
  } else if (t.kind === 'serve') {
    const c = custById(t.cid);
    if (c && c.seat >= 0) { const s = SEATS[c.seat]; p.dir = Math.abs(s.x - p.x) > Math.abs(s.y - p.y) ? (s.x > p.x ? 0 : 2) : (s.y > p.y ? 3 : 1); }
    serveTo(t.cid);
  } else if (t.kind === 'register') p.dir = 3;
  if (t.kind !== 'register') p.target = null;
}

// 계산대 뒤에 서 있으면 맨 앞 손님부터 계산해요
function atRegister(p) {
  return !p.moving && p.target && p.target.kind === 'register' && has(REGISTER.stand, Math.round(p.x), Math.round(p.y));
}

export function updatePlayer(dt) {
  const r = G.run, p = r.player;
  if (r.cook) { updateCook(r.cook, dt); return; }
  const wasMoving = p.path.length > 0;
  const arrived = walk(p, dt);
  if (arrived && wasMoving) arriveAt(p);
  if (atRegister(p)) {
    p.dir = 3;
    const c = custById(r.payLine[0]);
    if (c && c.state === 'payLine' && !c.moving) {
      p.payT += dt;
      if (p.payT >= PAY_STEP_SEC) { p.payT = 0; pay(c); }
    } else p.payT = 0;
  }
}

