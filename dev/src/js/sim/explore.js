// 동네 탐방 규칙 (2장부터, v0.78): 지도 만들기 · 체력 · 가방 · 사건 고르기 · 돌아오면 가게에 반영
//  수치·사건은 data/explore.js, 화면은 ui/explore.js, 그리기는 render/explore.js
//  탐방 중 상태(X)는 저장하지 않아요 — 앱을 닫으면 그날 탐방은 다시 할 수 있어요(다녀온 날은 돌아올 때 적어요)
import { G } from '../save/state.js';
import { emit, defineCmd } from './events.js';
import { makeRand } from '../engine/random.js';
import { MK, SHOP_TYPES, SHOP_IDS, EX_STAMINA, EX_STEP, EX_BAG, EX_EVENTS, EX_CLOSED, EX_CHARS, FINDS, MEMOS, EX_EVENTS_POOL, newExplore } from '../data/explore.js';
import { townMode } from './town.js';
import { stockIn } from './pantry.js';
import { addBond } from './bond.js';
import { CUSTOMER_TYPES } from '../data/customers.js';

let X = null; // 지금 탐방 { area, map, sp, bag, spots, got }
export const exRun = () => X;
export const exploreOpen = () => townMode() && G.story.ch >= 2;
export const exploredToday = () => !!G.explore && G.explore.last === G.day;
export const exploreReady = () => exploreOpen() && !exploredToday();
const EXP = () => (G.explore = G.explore || newExplore());

// ── 재래시장 지도: 그날 씨앗으로 가게 자리 · 문 닫은 가게 · 길 가운데 노점 · 사건 자리 ──
function genMarket(r) {
  const { W, H } = MK, walls = new Uint8Array(W * H);
  const block = (tx, ty) => { if (tx >= 0 && ty >= 0 && tx < W && ty < H) walls[ty * W + tx] = 1; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (let ty = 0; ty < 6; ty++) for (let tx = 0; tx < W; tx++) block(tx, ty); // 위 가게 줄 (가게 사이 틈도 막혀요)
  const types = shuffle([...shuffle(SHOP_IDS.slice()), ...shuffle(SHOP_IDS.slice()).slice(0, 2 * MK.SLOTS - SHOP_IDS.length)]);
  const closed = new Set(shuffle([...Array(2 * MK.SLOTS).keys()]).slice(0, EX_CLOSED));
  const shops = [], actors = [], props = [];
  types.forEach((type, k) => {
    const row = k < MK.SLOTS ? 0 : 1, i = k % MK.SLOTS, x = MK.X0 + i * MK.STEP, bot = row ? MK.BOT2 : MK.BOT1;
    const S = { type, x, bot, base: 1 + Math.floor(r() * 12), closed: closed.has(k) };
    shops.push(S);
    for (let ty = Math.floor((bot - 87) / 16); ty <= Math.floor((bot - 1) / 16); ty++) for (let tx = x / 16; tx < x / 16 + 5; tx++) block(tx, ty);
    const fy = Math.floor((bot + 19) / 16), c0 = Math.floor((x + 2) / 16), w = SHOP_TYPES[type].w;
    if (!S.closed) {
      for (let tx = c0; tx <= Math.floor((x + 1 + w) / 16); tx++) block(tx, fy);
      S.owner = { char: SHOP_TYPES[type].owner, tx: x / 16 + 4, ty: fy };
      actors.push(S.owner); block(S.owner.tx, fy);
    }
  });
  // 길 가운데: 노점(아주머니) · 파라솔 할머니 · 게시판 · 상자 — 겹치지 않게 칸을 골라요
  const taken = new Set();
  const slotX = (y0, n) => { // 같은 길(위 A · 아래 B)에서는 좌우로 2칸씩 띄워요
    const g = y0 < 16 ? 'A' : 'B';
    for (let t = 0; t < 40; t++) { const tx = 3 + Math.floor(r() * (W - 10)); let ok = true; for (let d = -2; d <= n + 1; d++) if (taken.has(g + (tx + d))) ok = false; if (ok) { for (let d = 0; d < n; d++) taken.add(g + (tx + d)); return tx; } }
    return null;
  };
  const put = (kind, ty, n, extra) => {
    const tx = slotX(ty, n + (extra ? 1 : 0)); if (tx === null) return null;
    const P = { kind, tx, ty, v: Math.floor(r() * 4) };
    for (let d = 0; d < n; d++) block(tx + d, ty);
    if (extra) { P.npc = { char: extra, tx: tx + n, ty }; actors.push(P.npc); block(tx + n, ty); }
    props.push(P); return P;
  };
  put('cart', 10, 3, EX_CHARS.cart); put('cart', 21, 3, EX_CHARS.cart);
  put('stall', 10, 3, EX_CHARS.stall);
  put('board', 9, 2); put('crate', 10, 2); put('crate', 21, 2);
  // 버스 정류장 (왼쪽 아래) — 여기서 시작하고 여기서 돌아가요
  props.push({ kind: 'bus', tx: 2, ty: 23 }); for (let d = 0; d < 4; d++) block(2 + d, 23);
  return { W, H, walls, shops, actors, props };
}

// 사건 자리: 열린 가게 사장님 · 노점 · 할머니 · 게시판 · 길 잃은 아이
function placeEvents(map, r) {
  const pool = EX_EVENTS_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const spots = [], used = new Set();
  for (const ev of pool) {
    if (spots.length >= EX_EVENTS) break;
    let at = null;
    if (ev.at.startsWith('shop:')) { const S = map.shops.find(s => !s.closed && s.type === ev.at.slice(5) && !used.has(s)); if (S) { used.add(S); at = S.owner; } }
    else if (ev.at === 'cart' || ev.at === 'stall') { const P = map.props.find(p => p.kind === ev.at && p.npc && !used.has(p)); if (P) { used.add(P); at = P.npc; } }
    else if (ev.at === 'board') { const P = map.props.find(p => p.kind === 'board'); if (P) at = { tx: P.tx, ty: P.ty, prop: true }; }
    else if (ev.at === 'kid') {
      for (let t = 0; t < 40 && !at; t++) {
        const tx = 3 + Math.floor(r() * (map.W - 6)), ty = r() < 0.5 ? 8 : 20;
        if (!map.walls[ty * map.W + tx] && !map.walls[(ty + 1) * map.W + tx]) { at = { char: EX_CHARS.kid, tx, ty }; map.actors.push(at); map.walls[ty * map.W + tx] = 1; }
      }
    }
    if (at) spots.push({ ev: ev.id, tx: at.tx, ty: at.ty, done: false });
  }
  return spots;
}
const evOf = id => EX_EVENTS_POOL.find(e => e.id === id);

// 떠나기: 버스 정류장 (골목 준비 시간과 따로, 하루 한 번)
defineCmd('exStart', () => {
  if (!exploreReady()) { emit('toast', exploredToday() ? '오늘은 이미 다녀왔습니다. 내일 새벽에 또 가 보세요' : '아직 갈 수 없습니다', 'info'); return false; }
  const r = makeRand((G.baseSeed || 1) + G.day * 7919 + 4243);
  const map = genMarket(r);
  X = { area: 'market', map, sp: EX_STAMINA, bag: [], spots: placeEvents(map, r), memos: [], did: 0, walked: 0 };
  emit('sfx', 'door');
  emit('explore', 'start');
  return true;
});
// 걸은 만큼 체력 (화면이 걸음을 알려 줘요 — 칸 단위 거리)
defineCmd('exWalk', ({ d }) => {
  if (!X || !(d > 0)) return false;
  X.walked += d; X.sp = Math.max(0, X.sp - d * EX_STEP);
  if (X.sp <= 0) faint();
  return true;
});
// 사건 고르기: i번째 선택 (drop: 가방이 가득 찼을 때 버릴 칸)
defineCmd('exPick', ({ spot, i, drop }) => {
  if (!X) return false;
  const S = X.spots[spot]; if (!S || S.done) return false;
  const ev = evOf(S.ev), C = ev.choices[i]; if (!C) return false;
  if (C.pay && G.cash < C.pay) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  if (C.cost && X.sp < C.cost) { emit('toast', '그럴 힘이 남아 있지 않습니다', 'warn'); return false; }
  if (C.give && X.bag.length >= EX_BAG) {
    if (drop === undefined) { emit('explore', 'full', { spot, i }); return false; }
    X.bag.splice(drop, 1);
  }
  if (C.pay) G.cash -= C.pay;
  if (C.cost) X.sp -= C.cost;
  if (C.heal) X.sp = Math.min(EX_STAMINA, X.sp + C.heal);
  if (C.give) X.bag.push(C.give);
  if (C.bond) addBond(C.bond[0], C.bond[1], '시장에서 받은 꽃', true);
  if (ev.memo && !EXP().memos.includes(ev.memo) && !X.memos.includes(ev.memo)) X.memos.push(ev.memo);
  S.done = true; X.did++;
  emit('sfx', C.give ? 'coin' : 'page');
  emit('explore', 'picked', { title: ev.title, say: C.say, give: C.give, memo: ev.memo && X.memos.includes(ev.memo) ? ev.memo : null });
  if (X.sp <= 0) faint();
  return true;
});
// 체력이 바닥나면: 가방 절반(내림)을 두고 택시로 돌아와요
function faint() {
  if (!X || X.fainted) return;
  X.fainted = true;
  const lose = Math.floor(X.bag.length / 2);
  X.lost = [];
  for (let k = 0; k < lose; k++) X.lost.push(...X.bag.splice(Math.floor((X.walked * 7 + k * 13) % X.bag.length), 1));
  emit('explore', 'faint');
}
// 돌아오기: 가방에 담은 것을 가게에 반영하고 다녀온 날을 적어요
defineCmd('exReturn', () => {
  if (!X) return false;
  const E = EXP(), got = [];
  for (const id of X.bag) {
    const F = FINDS[id]; got.push(id);
    if (F.kind === 'ing') stockIn(F.ing, F.n);
    else if (F.kind === 'note') G.mastery[F.menu] = (G.mastery[F.menu] || 0) + F.n;
    else if (F.kind === 'ref') G.town.referral.push('ex_' + F.type);
    else if (F.kind === 'flyer') E.flyer = { type: F.type, mul: F.mul, from: G.day, until: G.day + F.days - 1 };
  }
  for (const m of X.memos) if (!E.memos.includes(m)) E.memos.push(m);
  E.last = G.day; E.runs = (E.runs || 0) + 1;
  const sum = { area: X.area, got, lost: X.lost || [], memos: X.memos.slice(), fainted: !!X.fainted, did: X.did };
  emit('track', 'explore', { area: X.area, got: got.length, lost: sum.lost.length, did: X.did, sp: Math.round(X.sp), fainted: sum.fainted ? 1 : 0 });
  X = null;
  emit('explore', 'end', sum);
  emit('prep');
  return true;
});
// 동네 메모 (손님 수첩 · 3장 상권 지도에서 써요)
export const exMemos = () => (G.explore ? G.explore.memos : []).map(id => MEMOS[id]).filter(Boolean);
// 전단 효과 (sim/traffic.js promoMul)
export function flyerMul(type) {
  const f = G.explore && G.explore.flyer;
  return f && f.type === type && G.day >= f.from && G.day <= f.until ? f.mul : 1;
}
export const typeName = t => (CUSTOMER_TYPES[t] ? CUSTOMER_TYPES[t].name : '손님');
