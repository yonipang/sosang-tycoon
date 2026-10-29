// 동네 탐방 규칙 (2장부터, v0.78): 지도 만들기 · 체력 · 가방 · 사건 고르기 · 돌아오면 가게에 반영
//  수치·사건은 data/explore.js, 화면은 ui/explore.js, 그리기는 render/explore.js
//  탐방 중 상태(X)는 저장하지 않아요 — 앱을 닫으면 그날 탐방은 다시 할 수 있어요(다녀온 날은 돌아올 때 적어요)
import { G } from '../save/state.js';
import { emit, defineCmd } from './events.js';
import { makeRand } from '../engine/random.js';
import { MK, AP, APT_SHOPS, AP_CHARS, OF, OFFICE_SHOPS, OF_CHARS, EX_AREAS, SHOP_TYPES, SHOP_IDS, EX_STAMINA, EX_STEP, EX_BAG, EX_EVENTS, EX_CLOSED, EX_CHARS, EX_CARRY, FINDS, MEMOS, EX_EVENTS_POOL, newExplore } from '../data/explore.js';
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
  const types = shuffle([...shuffle(SHOP_IDS.slice()), ...shuffle(SHOP_IDS.slice()).slice(0, 2 * MK.SLOTS - SHOP_IDS.length - 1)]);
  types.splice(MK.VACANT, 0, 'vacant'); // 임대 매물 자리는 늘 그대로 (v0.84 — data/move.js)
  const closed = new Set(shuffle([...Array(2 * MK.SLOTS).keys()].filter(k => k !== MK.VACANT)).slice(0, EX_CLOSED));
  const shops = [], actors = [], props = [];
  let listing = null;
  types.forEach((type, k) => {
    const row = k < MK.SLOTS ? 0 : 1, i = k % MK.SLOTS, x = MK.X0 + i * MK.STEP, bot = row ? MK.BOT2 : MK.BOT1;
    const vac = type === 'vacant';
    const S = { type, x, bot, base: 1 + Math.floor(r() * 12), closed: vac || closed.has(k), vacant: vac };
    shops.push(S);
    if (vac) listing = { tx: x / 16 + 2, ty: Math.floor((bot + 19) / 16) };
    for (let ty = Math.floor((bot - 87) / 16); ty <= Math.floor((bot - 1) / 16); ty++) for (let tx = x / 16; tx < x / 16 + 5; tx++) block(tx, ty);
    const fy = Math.floor((bot + 19) / 16), c0 = Math.floor((x + 2) / 16), w = vac ? 0 : SHOP_TYPES[type].w;
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
  const marks = shops.filter(s => !s.closed).map(s => ({ name: SHOP_TYPES[s.type].name, tx: s.x / 16 + 2, ty: s.bot / 16 }));
  return { kind: 'market', W, H, walls, shops, actors, props, marks, listing, start: MK.START, kidRows: [8, 20], spawnY: [7, H - 2] };
}

// ── 아파트 단지 지도 (v0.82): 아파트 4동 · 화단 · 큰길 · 주차장 · 놀이터 · 상가 3칸 · 경비실 · 정류장 ──
//  ground: 0 보도 · 1 잔디 · 2 모래 · 3 아스팔트 · 4 울타리 (render/explore.js)
function genApt(r) {
  const { W, H } = AP, walls = new Uint8Array(W * H), ground = new Uint8Array(W * H);
  const block = (tx, ty) => { if (tx >= 0 && ty >= 0 && tx < W && ty < H) walls[ty * W + tx] = 1; };
  const fill = (x0, y0, x1, y1, g) => { for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) ground[ty * W + tx] = g; };
  const rect = (x0, y0, x1, y1) => { for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) block(tx, ty); };
  const shops = [], actors = [], props = [], npcs = {}, doors = [], marks = [];
  const spr = (n, x, bot) => props.push({ kind: 'spr', n, x, bot });
  const npc = (key, char, tx, ty) => { const A = { char, tx, ty }; actors.push(A); block(tx, ty); if (key) npcs[key] = A; return A; };
  const pick = a => a[Math.floor(r() * a.length)];
  fill(0, 0, W - 1, 0, 4); rect(0, 0, W - 1, 0);          // 울타리
  fill(0, 1, W - 1, 11, 1); fill(0, 14, W - 1, 15, 1);     // 잔디 · 화단
  fill(1, 18, 12, 25, 3); fill(14, 18, 22, 24, 2);         // 주차장 · 놀이터
  // 아파트 4동 (현관 앞은 보도)
  AP.TOWERS.forEach((tx, i) => {
    spr('ap_t' + (i + 1), tx * 16, AP.TOWER_BOT); rect(tx, 1, tx + 6, 11);
    doors.push({ key: 'door', tx: tx + 3, ty: 12, label: `${101 + i}동 현관` });
    marks.push({ name: `${101 + i}동`, tx: tx + 3, ty: 12 });
  });
  // 동 사이 나무 (102·103동 사이 아래는 분리수거장)
  const tree = (c, row, n) => { spr(n || (r() < 0.5 ? 'tree' : 'tree2'), c * 16 - 5, (row + 1) * 16); block(c, row); };
  [10, 21, 32].forEach(c => tree(c, 5)); [10, 32].forEach(c => tree(c, 10)); tree(42, 7);
  spr('ap_bin_blue', 20 * 16 + 2, 12 * 16); spr('ap_bin_green', 20 * 16 + 31, 12 * 16); rect(20, 11, 23, 11);
  npc('recycle', AP_CHARS.recycle, 22, 12); marks.push({ name: '분리수거장', tx: 21, ty: 12 });
  // 택배: 그날 한 동 현관 옆에 상자 · 기사님
  const cd = pick(doors); spr('ap_box', (cd.tx + 2) * 16 + 1, 14 * 16); spr('ap_box', (cd.tx + 2) * 16 + 1, 14 * 16 - 9); block(cd.tx + 2, 13);
  npc('courier', AP_CHARS.courier, cd.tx + 3, 13);
  // 단지 게시판 (103·104동 사이)
  props.push({ kind: 'board', tx: 32, ty: 13, v: 0 }); rect(32, 13, 33, 13);
  // 화단: 가로등 · 꽃 · 나무 · 벤치 둘(하나는 부녀회장님)
  [4, 15, 26, 37].forEach(c => { spr('ap_lamp', c * 16 + 1, 16 * 16); block(c, 15); });
  [[6, 14], [18, 14], [29, 14], [40, 14]].forEach(([c, row]) => { spr('ap_flowers', c * 16 - 6, (row + 1) * 16); rect(c, row, c + 1, row); });
  [1, 12, 23, 34].forEach(c => tree(c, 15));
  const bc = r() < 0.5 ? [8, 30] : [30, 8];
  spr('ap_bench', bc[0] * 16 + 3, 16 * 16); rect(bc[0], 15, bc[0] + 2, 15); npc('chair', AP_CHARS.chair, bc[0] + 3, 15);
  spr('ap_bench', bc[1] * 16 + 3, 16 * 16); rect(bc[1], 15, bc[1] + 2, 15); npcs.bench = { tx: bc[1] + 1, ty: 15, prop: true };
  // 큰길: 등교하는 학생 둘 · 장 본 할머니
  const sx = 14 + Math.floor(r() * 14); npc('students', AP_CHARS.student, sx, 16); npc(null, AP_CHARS.student2, sx + 1, 16);
  npc('shopper', AP_CHARS.shopper, 30 + Math.floor(r() * 10), 17);
  // 주차장: 차 여섯 자리 (그날 빈자리도 있어요) · 차단기
  for (let k = 0; k < 6; k++) if (r() < 0.75) { const tx = 1 + k * 2; spr('ap_car' + (1 + Math.floor(r() * 6)), tx * 16, 22 * 16); rect(tx, 19, tx + 1, 21); }
  spr('ap_gate', 16, 26 * 16); block(1, 25);
  marks.push({ name: '주차장', tx: 6, ty: 22 });
  // 놀이터: 미끄럼틀 · 그네 · 엄마
  spr('slide', 15 * 16, 24 * 16); rect(15, 21, 16, 23);
  spr('swing', 18 * 16 + 4, 22 * 16); rect(18, 21, 22, 21);
  npc(null, AP_CHARS.mom, 20, 23); marks.push({ name: '놀이터', tx: 19, ty: 21 });
  // 상가: 편의점 + 그날 두 가게
  const others = Object.keys(APT_SHOPS).filter(k => k !== 'cvs');
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const row3 = ['cvs', others[0], others[1]], ci = Math.floor(r() * 3); [row3[0], row3[ci]] = [row3[ci], row3[0]]; // 편의점 자리도 그날그날
  row3.splice(AP.VACANT, 0, 'vacant'); // 임대 매물 칸 (v0.84)
  let listing = null;
  row3.forEach((type, i) => {
    const x = AP.SHOP_X[i], bot = AP.SHOP_BOT, vac = type === 'vacant', S = { type, x, bot, base: 1 + Math.floor(r() * 12), closed: vac, vacant: vac, plain: true };
    shops.push(S); rect(x / 16, Math.floor((bot - 87) / 16), x / 16 + 4, Math.floor((bot - 1) / 16));
    if (vac) { listing = { tx: x / 16 + 2, ty: bot / 16 }; return; }
    S.owner = npc(null, APT_SHOPS[type].owner, x / 16 + 4, bot / 16);
    marks.push({ name: APT_SHOPS[type].name, tx: x / 16 + 2, ty: bot / 16 });
  });
  // 단지 앞: 경비실 · 화분 · 버스 정류장
  spr('ap_booth', 11 * 16, 28 * 16); rect(11, 26, 13, 27); npc('guard', AP_CHARS.guard, 14, 27);
  marks.push({ name: '경비실', tx: 12, ty: 27 });
  spr('ap_planter', 22 * 16, 28 * 16); rect(22, 27, 24, 27);
  spr('ap_planter', 34 * 16, 28 * 16); rect(34, 27, 36, 27);
  props.push({ kind: 'bus', tx: 2, ty: H - 1 }); for (let d = 0; d < 4; d++) block(2 + d, H - 1);
  return { kind: 'apt', W, H, walls, ground, shops, actors, props, npcs, doors, marks, listing, start: [7, H - 2], kidRows: [13, 17, 26], spawnY: [12, H - 3] };
}

// ── 오피스 거리 지도 (v0.84 사용자 요청): 빌딩 4채 · 넓은 보도 · 찻길과 횡단보도 · 노점·쉼터 · 1층 가게 7칸(하나는 임대 매물) · 정류장 ──
//  ground: 0 보도 · 1 잔디 · 3 아스팔트 · 5 찻길 · 6 횡단보도 · 7 빌딩 뒤 (render/explore.js)
function genOffice(r) {
  const { W, H } = OF, walls = new Uint8Array(W * H), ground = new Uint8Array(W * H);
  const block = (tx, ty) => { if (tx >= 0 && ty >= 0 && tx < W && ty < H) walls[ty * W + tx] = 1; };
  const fill = (x0, y0, x1, y1, g) => { for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) ground[ty * W + tx] = g; };
  const rect = (x0, y0, x1, y1) => { for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) block(tx, ty); };
  const shops = [], actors = [], props = [], npcs = {}, doors = [], marks = [];
  const spr = (n, x, bot) => props.push({ kind: 'spr', n, x, bot });
  const npc = (key, char, tx, ty) => { const A = { char, tx, ty }; actors.push(A); block(tx, ty); if (key) npcs[key] = A; return A; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  fill(0, 0, W - 1, 0, 7); rect(0, 0, W - 1, 0);
  // 빌딩 4채 (로비 = 배달 받는 곳)
  OF.TOWERS.forEach((tx, i) => {
    spr('of_t' + (i + 1), tx * 16, OF.TOWER_BOT); rect(tx, 1, tx + 6, 11);
    doors.push({ key: 'door', tx: tx + 3, ty: 12, label: `${OF.NAMES[i]} 로비` });
    marks.push({ name: OF.NAMES[i], tx: tx + 3, ty: 12 });
  });
  // 빌딩 사이 광장: 화단 · 나무
  for (const c of [9, 20, 31]) { fill(c, 1, c + 3, 11, 1); }
  const tree = (c, row) => { spr(r() < 0.5 ? 'tree' : 'tree2', c * 16 - 5, (row + 1) * 16); block(c, row); };
  [10, 21, 32].forEach(c => { tree(c, 4); tree(c + 1, 9); }); tree(42, 6);
  npc('guard', OF_CHARS.guard, OF.TOWERS[0] + 5, 12); // 한빛타워 로비 안내
  props.push({ kind: 'board', tx: 21, ty: 13, v: 0 }); rect(21, 13, 22, 13); // 빌딩 게시판
  npc('intern', OF_CHARS.intern, 26 + Math.floor(r() * 6), 13);
  npc('lead', OF_CHARS.lead, 3 + Math.floor(r() * 10), 14);
  [4, 15, 28, 40].forEach(c => { spr('ap_lamp', c * 16 + 1, 15 * 16); block(c, 14); });
  // 찻길: 횡단보도로만 건너요
  fill(0, OF.ROAD[0], W - 1, OF.ROAD[1], 5);
  for (let tx = 0; tx < W; tx++) {
    const cross = OF.CROSS.some(([a, b]) => tx >= a && tx <= b);
    if (cross) fill(tx, OF.ROAD[0], tx, OF.ROAD[1], 6); else rect(tx, OF.ROAD[0], tx, OF.ROAD[1]);
  }
  // 아래 보도: 쉼터 벤치 · 토스트 노점 · 배달 오토바이
  fill(1, 19, 9, 21, 1);
  spr('ap_bench', 4 * 16 + 3, 22 * 16); rect(4, 21, 6, 21); npcs.bench = { tx: 5, ty: 21, prop: true };
  tree(2, 20); tree(9, 20);
  marks.push({ name: '쉼터', tx: 5, ty: 21 });
  const cx = 13 + Math.floor(r() * 8);
  const cart = { kind: 'cart', tx: cx, ty: 20, v: Math.floor(r() * 4) }; rect(cx, 20, cx + 2, 20);
  cart.npc = npc(null, OF_CHARS.cart, cx + 3, 20); props.push(cart);
  marks.push({ name: '토스트 노점', tx: cx + 1, ty: 20 });
  spr('ap_box', 36 * 16 + 1, 21 * 16); spr('ap_box', 36 * 16 + 1, 21 * 16 - 9); block(36, 20);
  npc('courier', OF_CHARS.courier, 37, 20);
  // 1층 가게 7칸 (하나는 임대 매물 — 자리는 늘 그대로)
  const types = shuffle(Object.keys(OFFICE_SHOPS)); types.splice(OF.VACANT, 0, 'vacant');
  let listing = null;
  types.forEach((type, i) => {
    const x = OF.X0 + i * OF.STEP, bot = OF.SHOP_BOT, vac = type === 'vacant', S = { type, x, bot, base: 1 + Math.floor(r() * 12), closed: vac, vacant: vac, plain: true };
    shops.push(S); rect(x / 16, Math.floor((bot - 87) / 16), x / 16 + 4, Math.floor((bot - 1) / 16));
    if (vac) { listing = { tx: x / 16 + 2, ty: bot / 16 }; return; }
    S.owner = npc(null, OFFICE_SHOPS[type].owner, x / 16 + 4, bot / 16);
    marks.push({ name: OFFICE_SHOPS[type].name, tx: x / 16 + 2, ty: bot / 16 });
    if (type === 'dosirak') OF_CHARS.line.forEach((ch, k) => npc(k ? null : 'line', ch, x / 16 + 1 + k, bot / 16)); // 도시락 가게 앞 줄
  });
  props.push({ kind: 'bus', tx: 2, ty: H - 1 }); for (let d = 0; d < 4; d++) block(2 + d, H - 1);
  return { kind: 'office', W, H, walls, ground, shops, actors, props, npcs, doors, marks, listing, start: [7, H - 1], kidRows: [13, 19, 21], spawnY: [12, H - 2] };
}

// 사건 자리: 열린 가게 사장님 · 노점 · 할머니 · 게시판 · 길 잃은 아이
function placeEvents(map, r, area) {
  const pool = EX_EVENTS_POOL.filter(e => (e.area || 'market') === area || e.area === 'any');
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const spots = [], used = new Set();
  for (const ev of pool) {
    if (spots.length >= EX_EVENTS) break;
    let at = null;
    if (ev.at.startsWith('shop:')) { const S = map.shops.find(s => !s.closed && s.type === ev.at.slice(5) && !used.has(s)); if (S) { used.add(S); at = S.owner; } }
    else if (map.npcs && map.npcs[ev.at]) { const N = map.npcs[ev.at]; if (!used.has(N)) { used.add(N); at = N; } } // 아파트 단지 사람들
    else if (ev.at === 'cart' || ev.at === 'stall') { const P = map.props.find(p => p.kind === ev.at && p.npc && !used.has(p)); if (P) { used.add(P); at = P.npc; } }
    else if (ev.at === 'board') { const P = map.props.find(p => p.kind === 'board'); if (P) at = { tx: P.tx, ty: P.ty, prop: true }; }
    else if (ev.at === 'kid') {
      for (let t = 0; t < 40 && !at; t++) {
        const tx = 3 + Math.floor(r() * (map.W - 6)), ty = map.kidRows[Math.floor(r() * map.kidRows.length)];
        if (!map.walls[ty * map.W + tx] && !map.walls[(ty + 1) * map.W + tx]) { at = { char: EX_CHARS.kid, tx, ty }; map.actors.push(at); map.walls[ty * map.W + tx] = 1; }
      }
    }
    if (at) spots.push({ ev: ev.id, tx: at.tx, ty: at.ty, done: false });
  }
  return spots;
}
const evOf = id => EX_EVENTS_POOL.find(e => e.id === id);

// 떠나기: 버스 정류장 (골목 준비 시간과 따로, 하루 한 번)
defineCmd('exStart', ({ area } = {}) => {
  if (!exploreReady()) { emit('toast', exploredToday() ? '오늘은 이미 다녀왔습니다. 내일 또 가 보세요' : '아직 갈 수 없습니다', 'info'); return false; }
  if (!EX_AREAS[area]) area = 'market';
  const r = makeRand((G.baseSeed || 1) + G.day * 7919 + 4243 + (area === 'apt' ? 977 : area === 'office' ? 1553 : 0));
  const map = area === 'apt' ? genApt(r) : area === 'office' ? genOffice(r) : genMarket(r);
  X = { area, map, sp: EX_STAMINA, bag: [], spots: placeEvents(map, r, area), memos: [], did: 0, walked: 0 };
  emit('sfx', 'door');
  emit('explore', 'start');
  return true;
});
// 걸은 만큼 체력 (화면이 걸음을 알려 줘요 — 칸 단위 거리)
defineCmd('exWalk', ({ d }) => {
  if (!X || !(d > 0)) return false;
  X.walked += d; X.sp = Math.max(0, X.sp - d * EX_STEP * (X.task && X.task.carry ? EX_CARRY : 1)); // 짐을 들면 더 힘들어요
  if (X.sp <= 0) faint();
  return true;
});
// 사건 고르기: i번째 선택 (drop: 가방이 가득 찼을 때 버릴 칸)
//  심부름(task)은 시작만 하고, 손기술(mini)은 화면이 놀이를 끝낸 뒤 exFinish로 마무리해요 (v0.81)
defineCmd('exPick', ({ spot, i, drop }) => {
  if (!X || X.task || X.pend) return false;
  const S = X.spots[spot]; if (!S || S.done) return false;
  const ev = evOf(S.ev), C = ev.choices[i]; if (!C) return false;
  if (C.pay && G.cash < C.pay) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  if (C.cost && X.sp < C.cost) { emit('toast', '그럴 힘이 남아 있지 않습니다', 'warn'); return false; }
  if (C.task) {
    const T = exMakeTask(S, C.task);
    if (T) { X.task = { ...T, spot, i }; emit('sfx', 'page'); emit('explore', 'task', { title: ev.title, task: X.task }); return true; }
  }
  if (C.mini) {
    if (C.cost) X.sp -= C.cost;
    X.pend = { spot, i, mini: true };
    emit('explore', 'mini', { title: ev.title, mini: C.mini });
    if (X.sp <= 0) faint();
    return true;
  }
  return exDone(S, ev, C, drop, true);
});
// 심부름 · 손기술 마무리: score 0이면 실패(가방엔 안 담겨요) · drop 가방이 찼을 때 버릴 칸(-1이면 담지 않고 끝내기)
defineCmd('exFinish', ({ score, drop } = {}) => {
  if (!X) return false;
  const P = X.pend || (X.task ? { spot: X.task.spot, i: X.task.i } : null); if (!P) return false;
  if (score !== undefined) P.score = score;
  const S = X.spots[P.spot], ev = evOf(S.ev), C = ev.choices[P.i];
  if (P.mini && !P.score) { // 손기술 실패
    X.pend = null; S.done = true; X.did++;
    emit('sfx', 'angry'); emit('explore', 'picked', { title: ev.title, say: C.fail || '잘 안 됐습니다.', fail: true });
    return true;
  }
  X.pend = P;
  const ok = exDone(S, ev, C, drop, false);
  if (ok) {
    X.pend = null;
    if (X.task) {
      const t = X.task; X.task = null;
      if (t.kind === 'escort') { // 아이는 할머니 옆에 서요
        const M = X.map, kid = M.actors.find(a => a.hidden);
        if (kid) for (const dx of [1, -1, 2, -2]) { const k = t.ty * M.W + t.tx + dx; if (!M.walls[k]) { kid.tx = t.tx + dx; kid.ty = t.ty; kid.hidden = false; M.walls[k] = 1; break; } }
      }
    }
    emit('explore', 'done'); // 화면: 위 막대(할 일) 다시 그리기
  }
  return ok;
});
function exDone(S, ev, C, drop, pay) {
  if (C.give && X.bag.length >= EX_BAG) {
    if (drop === undefined) { emit('explore', 'full', { spot: X.spots.indexOf(S), i: ev.choices.indexOf(C), finish: !pay }); return false; }
    if (drop >= 0) X.bag.splice(drop, 1);
  }
  if (pay && C.pay) G.cash -= C.pay;
  if (pay && C.cost) X.sp -= C.cost;
  if (C.heal) X.sp = Math.min(EX_STAMINA, X.sp + C.heal);
  const give = C.give && !(drop === -1) ? C.give : null;
  if (give) X.bag.push(give);
  if (C.bond) addBond(C.bond[0], C.bond[1], '시장에서 받은 꽃', true);
  const fresh = ev.memo && !EXP().memos.includes(ev.memo) && !X.memos.includes(ev.memo); // 처음 본 메모만 알려요
  if (fresh) X.memos.push(ev.memo);
  S.done = true; X.did++;
  emit('sfx', give ? 'coin' : 'page');
  emit('explore', 'picked', { title: ev.title, say: C.say, give, memo: fresh ? ev.memo : null });
  if (X.sp <= 0) faint();
  return true;
}
// 심부름 만들기: deliver = 받을 사람(멀리 있는 곳 먼저) · escort = 시장 어딘가에 할머니가 나타나요
function exAnchors() {
  const M = X.map, out = [];
  for (const s of M.shops) if (!s.closed && s.owner) out.push({ key: 'shop:' + s.type, tx: s.owner.tx, ty: s.owner.ty, label: (SHOP_TYPES[s.type] || APT_SHOPS[s.type] || OFFICE_SHOPS[s.type]).name });
  for (const p of M.props) if (p.npc) out.push({ key: p.kind, tx: p.npc.tx, ty: p.npc.ty, label: p.kind === 'cart' ? '어묵 노점' : '파라솔 할머니' });
  for (const d of M.doors || []) out.push(d); // 아파트 현관
  return out;
}
const exFar = (a, S) => Math.abs(a.tx - S.tx) + Math.abs(a.ty - S.ty);
function exMakeTask(S, T) {
  const M = X.map;
  if (T.kind === 'deliver') {
    const cand = exAnchors().filter(a => (a.tx !== S.tx || a.ty !== S.ty) && T.to.includes(a.key) && !X.spots.some(q => !q.done && q.tx === a.tx && q.ty === a.ty));
    if (!cand.length) return null;
    cand.sort((a, b) => (T.to.indexOf(a.key) - T.to.indexOf(b.key)) * 4 + (exFar(b, S) - exFar(a, S)) / 6);
    const to = cand.find(a => exFar(a, S) >= 12) || cand[0];
    return { kind: 'deliver', item: T.item, verb: T.verb, carry: true, tx: to.tx, ty: to.ty, label: to.label };
  }
  if (T.kind === 'escort') { // 멀리 떨어진 빈 칸에 할머니 (옆 칸도 비어 있어야 다가갈 수 있어요)
    const r = makeRand((G.baseSeed || 1) + G.day * 31 + S.tx * 7 + S.ty);
    for (let t = 0; t < 200; t++) {
      const tx = 2 + Math.floor(r() * (M.W - 4)), ty = M.spawnY[0] + Math.floor(r() * (M.spawnY[1] - M.spawnY[0] + 1)), k = ty * M.W + tx;
      if (M.walls[k] || M.walls[k + M.W] || exFar({ tx, ty }, S) < 14) continue;
      const near = M.marks.slice().sort((a, b) => Math.abs(a.tx - tx) + Math.abs(a.ty - ty) - (Math.abs(b.tx - tx) + Math.abs(b.ty - ty)))[0]; // 가까운 곳 이름이 힌트
      const g = { char: EX_CHARS.grandma, tx, ty, key: 'grandma' };
      M.actors.push(g); M.walls[k] = 1;
      const kid = M.actors.find(a => a.tx === S.tx && a.ty === S.ty); if (kid) { kid.hidden = true; M.walls[S.ty * M.W + S.tx] = 0; } // 아이는 나를 따라와요
      return { kind: 'escort', verb: T.verb, tx, ty, label: '할머니', hint: near ? near.name : '', follow: EX_CHARS.kid };
    }
    return null;
  }
  return null;
}
// 체력이 바닥나면: 가방 절반(내림)을 두고 택시로 돌아와요
function faint() {
  if (!X || X.fainted) return;
  X.fainted = true; X.task = null; X.pend = null;
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
// 임대 매물 살펴보기 (v0.84 — data/move.js): 본 동네를 남겨 둬요 (나중에 이사할 때 「살펴본 자리」로)
defineCmd('exListing', () => {
  if (!X || !X.map.listing) return false;
  const E = EXP(); E.seen = E.seen || [];
  if (!E.seen.includes(X.area)) E.seen.push(X.area);
  emit('track', 'move_look', { area: X.area });
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
