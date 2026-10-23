// 사장: 칸을 누르면 그리로 가서 할 일을 해요.
//  조리대 → 조리 미니게임(바늘 멈추기) → 손에 들기(최대 2개)
//  손님 자리 → 들고 있는 음식 내주기 · 계산대 → 서 있는 동안 계산 · 퇴식대 → 들고 있는 음식 버리기
import { G } from '../save/state.js';
import { MENUS, COOK_ZONE, COOK_TIMEOUT, QUALITY_NAME } from '../data/menu.js';
import { HANDS_MAX, PAY_STEP_SEC } from '../data/economy.js';
import { STATIONS, REGISTER, SEATS, PAY_SPOTS, solidForPlayer } from '../data/layout.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';
import { findPath, standAround, walk } from './path.js';
import { custById, serve, pay } from './customers.js';

const has = (tiles, x, y) => tiles.some(([a, b]) => a === x && b === y);
export const handsCount = m => G.run.hands.filter(d => d.menu === m).length;
export const ticketsCount = m => G.run.tickets.filter(t => t.menu === m).length;

// 누른 칸이 무엇인지 → 할 일
export function targetAt(x, y) {
  const r = G.run;
  for (const id in STATIONS) if (has(STATIONS[id].tiles, x, y) || has(STATIONS[id].stand, x, y)) return { kind: 'station', id };
  if (has(REGISTER.tiles, x, y) || has(REGISTER.stand, x, y) || has(PAY_SPOTS, x, y)) return { kind: 'register' };
  // 자리나 탁자를 누르면: 그 탁자에서 음식을 기다리는 손님 (들고 있는 음식과 맞는 손님 먼저)
  const seatI = SEATS.findIndex(s => s.x === x && s.y === y);
  const table = seatI >= 0 ? SEATS[seatI].table : (x === 2 && (y === 5 || y === 7) ? (y === 5 ? 1 : 2) : 0);
  if (table) {
    const waiting = SEATS.map((s, i) => ({ s, c: r.seats[i] && custById(r.seats[i]) }))
      .filter(o => o.s.table === table && o.c && o.c.state === 'waitFood');
    const pickOne = (seatI >= 0 && waiting.find(o => o.s === SEATS[seatI]))
      || waiting.find(o => r.hands.some(d => d.menu === o.c.menu)) || waiting[0];
    if (pickOne) return { kind: 'serve', cid: pickOne.c.id };
    return null;
  }
  if (!solidForPlayer(x, y)) return { kind: 'move', x, y };
  return null;
}

function standFor(t) {
  if (t.kind === 'station') return STATIONS[t.id].stand;
  if (t.kind === 'register') return REGISTER.stand;
  if (t.kind === 'serve') {
    const c = custById(t.cid);
    return c && c.seat >= 0 ? standAround([[SEATS[c.seat].x, SEATS[c.seat].y]], 'player') : null;
  }
  return [[t.x, t.y]];
}

// 화면에서 칸을 눌렀을 때
defineCmd('tap', ({ x, y }) => {
  const r = G.run;
  if (!r || G.phase !== 'day') return;
  if (r.cook) { cookStop(); return; }
  const t = targetAt(x, y);
  if (!t) return;
  const goals = standFor(t);
  if (!goals || !goals.length) return;
  const p = r.player;
  const path = findPath(p, goals, 'player');
  if (!path) return;
  p.path = path; p.target = t; p.payT = 0;
  emit('tapMark', x, y, t.kind);
});

defineCmd('cookStop', () => cookStop());

function startCook(st) {
  const r = G.run, m = st.menu;
  if (r.hands.length >= HANDS_MAX) { emit('toast', '손이 꽉 찼습니다. 먼저 내주거나 퇴식대에 버려 보세요', 'warn'); return; }
  if (ticketsCount(m) <= handsCount(m)) {
    emit('toast', ticketsCount(m) ? `${MENUS[m].name} 주문은 이미 손에 들고 있습니다` : `아직 ${MENUS[m].name} 주문이 없습니다`, 'info');
    return;
  }
  r.cook = { menu: m, t: 0, speed: MENUS[m].cook, pos: 0 };
  emit('cook', true, m);
  emit('sfx', 'cookStart');
}

// 바늘: 0~1을 오가요. 가운데(0.5)에 가까울수록 좋은 음식
function cookPos(c) { return 0.5 - 0.5 * Math.cos(c.t * 2.6 * c.speed); }

function cookStop(timeout) {
  const r = G.run, c = r && r.cook;
  if (!c) return;
  const d = Math.abs(c.pos - 0.5);
  const q = timeout ? 0 : d <= COOK_ZONE.perfect ? 2 : d <= COOK_ZONE.good ? 1 : 0;
  r.cook = null;
  r.hands.push({ menu: c.menu, q });
  const p = r.player;
  emit('float', p.x, p.y - 1.8, `${MENUS[c.menu].name} ${QUALITY_NAME[q]}${q === 2 ? '!' : ''}`, q === 2 ? 'great' : q === 1 ? 'good' : 'plain');
  emit('sfx', q === 2 ? 'perfect' : 'cookDone');
  emit('cook', false, c.menu, q);
}

function serveTo(cid) {
  const r = G.run, c = custById(cid);
  if (!c || c.state !== 'waitFood') return;
  const i = r.hands.map((d, k) => [d, k]).filter(([d]) => d.menu === c.menu).sort((a, b) => b[0].q - a[0].q)[0];
  if (!i) { emit('toast', `이 손님은 ${josa(MENUS[c.menu].name, '을/를')} 주문했습니다`, 'info'); return; }
  r.hands.splice(i[1], 1);
  serve(c, i[0]);
}

function trash() {
  const r = G.run;
  if (!r.hands.length) { emit('toast', '퇴식대입니다. 남는 음식을 여기에 버릴 수 있습니다', 'info'); return; }
  const d = r.hands.pop();
  r.log.wasteDishes += MENUS[d.menu].cost;
  emit('float', r.player.x, r.player.y - 1.6, `${MENUS[d.menu].name} 버림`, 'bad');
  emit('sfx', 'trash');
}

function arrive(t) {
  if (t.kind === 'station') {
    const st = STATIONS[t.id];
    if (st.menu) startCook(st); else trash();
  } else if (t.kind === 'serve') serveTo(t.cid);
  else if (t.kind === 'register') { G.run.player.dir = 3; }
}

// 계산대 앞에 서 있으면 맨 앞 손님부터 계산해요
function atRegister(p) {
  return !p.moving && p.target && p.target.kind === 'register' && has(REGISTER.stand, Math.round(p.x), Math.round(p.y));
}

export function updatePlayer(dt) {
  const r = G.run, p = r.player;
  if (r.cook) {
    r.cook.t += dt;
    r.cook.pos = cookPos(r.cook);
    if (r.cook.t >= COOK_TIMEOUT) cookStop(true);
    return;
  }
  const wasMoving = p.path.length > 0;
  const arrived = walk(p, dt);
  if (arrived && wasMoving && p.target) {
    if (p.target.kind === 'station') p.dir = 1;
    arrive(p.target);
    if (p.target.kind !== 'register') p.target = null;
  }
  if (atRegister(p)) {
    p.dir = 3;
    const c = custById(r.payLine[0]);
    if (c && c.state === 'payLine' && !c.moving) {
      p.payT += dt;
      if (p.payT >= PAY_STEP_SEC) { p.payT = 0; pay(c); }
    } else p.payT = 0;
  }
}
