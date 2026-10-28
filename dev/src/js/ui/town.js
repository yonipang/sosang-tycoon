// 마을 화면: 준비 시간(밤~새벽) 골목 지도를 어느 방향으로든 걸어 다녀요. 바닥을 누르면 그곳까지, 가게·사람을 누르면 문 앞까지 걸어가서 할 일 창을 띄워요.
// 지도는 data/town.js (16px 칸), 그리기는 render/town.js, 규칙은 sim/town.js. 길 찾기는 칸 단위 너비 우선 탐색(상하좌우)
import { G } from '../save/state.js';
import { $, won, josa } from '../engine/util.js';
import { runCmd, onEvent } from '../sim/events.js';
import { MENUS, INGREDIENTS } from '../data/menu.js';
import { CAST, SCENES } from '../data/story.js';
import { TILE, STATIONS, REGISTER, DOOR, FRONT_Y, TABLES, SEATS, solidForPlayer } from '../data/layout.js';
import { drawShopTo, shopViewSize } from '../render/view.js';
import { findPath } from '../sim/path.js';
import { salesHTML } from './sales.js';
import { SHOP_SPOTS } from '../data/town.js';
import { MAP_W, MAP_H, BUILDINGS, MAP_PROPS, PLACES, ACTS, TOWN_NPC, VACANT_NOTE, NIGHT_SLOTS, HYGIENE_LOW, LOOKS, USES, WALKERS, MEET_LINES } from '../data/town.js';
import { PEOPLE } from '../data/customers.js';
import { PEOPLE_INFO } from '../data/people.js';
import { fxRand } from '../engine/random.js';
import { SPR } from '../art/atlas.js';
import { drawTown } from '../render/town.js';
import { townMode, slotsMax, actNow, placeOpen, marketUnit, phoneUnit, townClock, placeName, placeShort, placeActs, isDeal, marketCost, jungTalkOk, useOk, metToday } from '../sim/town.js';
import { furnOpen } from '../sim/furniture.js';
import { prepMax } from '../sim/tools.js';
import { prepUsed, prepRoom } from '../sim/town.js';
import { guildOpen } from '../sim/guild.js';
import { guildHTML } from './guild.js';
import { furnHTML, furnTheme, furnGrade, heartsHTML, drawFurnPreview, furnToggle, furnSetToCart, furnCartReset, furnCart } from './furn.js';
import { menuOpen } from '../sim/story.js';
import { invOf, invToday, invServings, openIngs, menusUsing, todayMenus, cartFor } from '../sim/pantry.js';
import { ingNews } from '../sim/market.js';
import { toast } from './feedback.js';
import { boardHTML, boardTab } from './board.js';
import { bookHTML } from './book.js';
let bookSel = 0; // 손님 수첩에서 고른 사람
import { lineHTML, talking } from './story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';
import { exOn, exHook, exUpdate, exTap, exBar, exHud, exNav, exNavClick, exSheetClick, exTalk, busHTML, initExplore, exMapH } from './explore.js';
import { exploreOpen } from '../sim/explore.js';

const WALK = 96;     // 걷는 빠르기 (지도 픽셀/초) — v0.35 사용자 요청으로 60 → 96
const VIEW_W = 224;  // 화면에 보이는 지도 너비 (14칸 — 멀리서 보듯, 포켓몬 하트골드 정도). 높이는 화면에 맞춰요
let T = null;        // 보이는 동안의 골목 { me, cam, path, goPlace, time, sheet, vw, vh }

export const townShown = () => !!T && !$('town').hidden;
export const townView = () => T; // 시험용 (main.js __T)

// 칸 ↔ 픽셀 (사람은 칸 가운데, 발끝은 칸 아래쪽)
const tileX = tx => tx * TILE + TILE / 2;
const tileY = ty => ty * TILE + TILE - 3;
const vacantB = BUILDINGS.find(b => b[0] === 'tw_vacant');

// 못 지나가는 칸: 건물 그림이 덮는 칸 · 물건 · 서 있는 이웃
let wallMap = null;
function walls() {
  if (!wallMap) {
    wallMap = new Uint8Array(MAP_W * MAP_H);
    for (const [n, x, bot] of BUILDINGS) {
      const [, , w, h] = SPR[n];
      for (let ty = Math.floor((bot - h) / TILE); ty < Math.ceil(bot / TILE); ty++)
        for (let tx = Math.floor(x / TILE); tx < Math.ceil((x + w) / TILE); tx++) if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) wallMap[ty * MAP_W + tx] = 1;
    }
    for (const p of MAP_PROPS) for (const [tx, ty] of p.block || []) wallMap[ty * MAP_W + tx] = 1;
  }
  const m = wallMap.slice();
  for (const id in TOWN_NPC) { const [tx, ty] = TOWN_NPC[id].at; m[ty * MAP_W + tx] = 1; }
  return m;
}
// 너비 우선 탐색: from 칸에서 to 칸까지 [[x,y], …] (from 빼고). 못 가면 null
function townPath(from, to) {
  const m = walls(), N = MAP_W * MAP_H, prev = new Int32Array(N).fill(-1);
  const s = from[1] * MAP_W + from[0], g = to[1] * MAP_W + to[0];
  if (m[g]) return null;
  prev[s] = s;
  const q = [s];
  for (let i = 0; i < q.length && prev[g] < 0; i++) {
    const c = q[i], cx = c % MAP_W, cy = (c - cx) / MAP_W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * MAP_W + nx;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || m[k] || prev[k] >= 0) continue;
      prev[k] = c; q.push(k);
    }
  }
  if (prev[g] < 0) return null;
  const out = [];
  for (let c = g; c !== s; c = prev[c]) out.unshift([c % MAP_W, Math.floor(c / MAP_W)]);
  return out;
}
// 누른 칸이 막혀 있으면 가장 가까운 갈 수 있는 칸으로
// 누른 칸에서 가장 가까운, 지금 걸어갈 수 있는 칸 (누른 곳이 막혀 있으면 그 앞)
//  건물 뒤처럼 멀리 돌아가야 닿는 칸은 피해요 — 돌아가는 만큼 벌점 (누르면 엉뚱한 곳으로 가던 것)
// 내 칸에서 각 칸까지 걸음 수 (못 가는 칸은 -1)
function reachDist(sx, sy) {
  const m = walls(), N = MAP_W * MAP_H, dist = new Int32Array(N).fill(-1), s0 = sy * MAP_W + sx;
  dist[s0] = 0;
  const q = [s0];
  for (let i = 0; i < q.length; i++) {
    const c = q[i], cx = c % MAP_W, cy = (c - cx) / MAP_W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * MAP_W + nx;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || m[k] || dist[k] >= 0) continue;
      dist[k] = dist[c] + 1; q.push(k);
    }
  }
  return dist;
}
// 사람 옆 네 칸 중 가장 빨리 닿는 칸 (위·아래·왼쪽·오른쪽 어디든)
function besideTile(tx, ty) {
  const [sx, sy] = meTile(), dist = reachDist(sx, sy);
  let best = null, bd = 1e9;
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const d = dist[y * MAP_W + x];
    if (d >= 0 && d < bd) { bd = d; best = [x, y]; }
  }
  return best || nearestOpen(tx, ty + 1);
}
// 도착하면 그 사람 쪽을 봐요
function faceTo(px, py) {
  const dx = px - T.me.x, dy = py - T.me.y;
  T.me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 3 : 1);
}
function nearestOpen(tx, ty) {
  const [sx, sy] = T ? meTile() : [tx, ty], dist = reachDist(sx, sy);
  let best = null, bs = 1e9;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = dist[y * MAP_W + x];
    if (d < 0) continue;
    const detour = d - (Math.abs(x - sx) + Math.abs(y - sy));
    const score = Math.hypot(x - tx, y - ty) + detour * 0.6;
    if (score < bs) { bs = score; best = [x, y]; }
  }
  return best;
}
const meTile = () => [Math.floor(T.me.x / TILE), Math.floor(T.me.y / TILE)];

// to 칸까지 걸어가요 (then: 도착하면 할 일)
function walkTo(to, then) {
  const at = T.me.path && T.me.path.length ? T.me.path[0] : meTile(); // 걷는 중이면 지금 향하는 칸에서 이어서
  const path = townPath(at, to);
  if (!path) return false;
  if (T.me.path && T.me.path.length) path.unshift(T.me.path[0]);
  T.me.path = path; T.then = then || null;
  if (!path.length) arrive();
  return true;
}
function arrive() {
  const me = T.me, then = T.then;
  me.moving = false; T.then = null;
  if (then) then();
}
function facePlace(id) {
  const [x, y, w, h] = PLACES[id].rect, dx = x + w / 2 - T.me.x, dy = y + h / 2 - T.me.y;
  T.me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 3 : 1);
}
function goPlace(id) {
  const go = () => (id === 'shop' ? enterShop() : openPlace(id)); // 우리 가게는 안으로 들어가요
  const ok = walkTo(PLACES[id].door, () => { facePlace(id); go(); });
  if (!ok) go();
}

// ── 가게 안: 문으로 들어가 사장이 걸어 다녀요. 물건을 누르거나 아래 버튼으로 할 일 (data/town.js SHOP_SPOTS) ──
const IN_WALK = 6; // 걷는 빠르기 (칸/초)
// 문을 지날 때: 화면이 까맣게 닫혔다가 열려요 (들어가기 · 나오기 연출, v0.43)
const FADE_MS = 220;
function doorFade(swap) {
  if (T.fading) return;
  const f = $('townFade');
  T.fading = true; closeSheet(); playSfx('door');
  f.hidden = false; f.classList.remove('out'); void f.offsetWidth; f.classList.add('in');
  setTimeout(() => {
    swap();
    f.classList.remove('in'); f.classList.add('out');
    setTimeout(() => { f.hidden = true; f.classList.remove('out'); T.fading = false; }, FADE_MS + 40);
  }, FADE_MS);
}
function enterShop() {
  doorFade(() => {
    T.inside = { me: { x: DOOR.x, y: FRONT_Y - 1, dir: 1, moving: false, path: [] }, then: null };
    renderNav(); layoutTown();
  });
}
function leaveShop() {
  doorFade(() => {
    T.inside = null;
    placeMe('shop'); T.me.dir = 3;
    renderNav(); layoutTown();
  });
}
// 물건의 칸 · 서는 칸
function spotTiles(S) {
  if (S.station) return { tiles: STATIONS[S.station].tiles, stand: STATIONS[S.station].stand };
  if (S.register) return { tiles: REGISTER.tiles, stand: REGISTER.stand };
  if (S.door) return { tiles: [[DOOR.x, FRONT_Y], [DOOR.x + 1, FRONT_Y]], stand: [[DOOR.x, FRONT_Y - 1], [DOOR.x + 1, FRONT_Y - 1]] }; // 문 두 칸 (v0.73)
  return { tiles: S.tiles, stand: S.stand };
}
const spotsNow = () => SHOP_SPOTS; // v0.59부터 늘 다 (밤·새벽 구분 없음)
function inWalk(goals, then) {
  const I = T.inside, me = I.me;
  const path = findPath(me, goals, 'player');
  if (!path) { if (then) then(); return; }
  me.path = path; I.then = then || null;
  if (!path.length) { I.then = null; if (then) then(); }
}
function goSpot(act) {
  const S = SHOP_SPOTS.find(s => s.act === act);
  if (!S) { doShop(act); return; }
  const { tiles, stand } = spotTiles(S);
  inWalk(stand, () => { const [tx, ty] = tiles[0], me = T.inside.me; me.dir = Math.abs(tx - me.x) > Math.abs(ty - me.y) ? (tx > me.x ? 0 : 2) : (ty > me.y ? 3 : 1); doShop(act); });
}
function doShop(act) {
  if (act === 'exit') { leaveShop(); return; }
  T.sheetPlace = 'shop';
  if (act === 'setup' && prepMax()) { prepCart = {}; sheet(stoveHTML(), 'stove'); playSfx('page'); return; } // 프렙 통이 있으면 조리대 창 (오픈 준비 + 프렙, v0.65)
  if (act === 'counter') { openCounter('sales'); playSfx('page'); return; } // 누르면 바로 영수증 (v0.66)
  runCmd('townAct', { place: 'shop', act });
}
// 조이스틱으로 걸을 때 막힌 칸: 탁자·의자 바로 위 줄도 막아요 (v0.73 사용자 요청 — 들어 올린 탁자 그림에 몸이 파묻혀 보였어요)
const solidIn = (x, y) => solidForPlayer(x, y) || TABLES.some(t => y === t.y - 1 && x >= t.x && x < t.x + t.w) || SEATS.some(q => y === q.y - 1 && x === q.x);
// 가게 안 조이스틱 (v0.48): 칸 단위 바닥에서 밀어서 걸어요. 물건·문에 부딪히면 그 일 (같은 칸에서는 한 번만)
function inJoy(dt, vx, vy) {
  const I = T.inside, me = I.me, m = Math.hypot(vx, vy), sp = IN_WALK * Math.min(1, m) / m;
  const nx = me.x + vx * sp * dt, ny = me.y + vy * sp * dt, step = IN_WALK * dt;
  // 몸 크기 상자로 부딪힘을 봐요 (v0.73: 반올림으로 보면 탁자에 반 칸 파묻혔어요) — 아래쪽은 거의 꽉 채워서 앞 물건(탁자 등)에 파묻히지 않게 · 좁은 통로는 줄 가운데로 살짝 끌어 줘요
  const B = 0.2, BD = 0.02, free = (x, y) => [[x + B, y + B], [x + 1 - B, y + B], [x + B, y + 1 - BD], [x + 1 - B, y + 1 - BD]].every(([a, b]) => !solidIn(Math.floor(a), Math.floor(b)));
  const nudge = (v, to) => v + Math.max(-step, Math.min(step, to - v));
  let hit = null;
  if (Math.abs(vx) > 0.01) {
    if (free(nx, me.y)) me.x = nx;
    else {
      const rx = Math.round(me.x) + Math.sign(vx), ry = Math.round(me.y);
      if (!solidIn(rx, ry)) { const y2 = nudge(me.y, ry); if (free(me.x, y2)) me.y = y2; } else hit = [rx, ry];
    }
  }
  if (Math.abs(vy) > 0.01) {
    if (free(me.x, ny)) me.y = ny;
    else {
      const rx = Math.round(me.x), ry = Math.round(me.y) + Math.sign(vy);
      if (!solidIn(rx, ry)) { const x2 = nudge(me.x, rx); if (free(x2, me.y)) me.x = x2; } else hit = hit || [rx, ry];
    }
  }
  me.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 0 : 2) : (vy > 0 ? 3 : 1);
  me.moving = true;
  if (!hit) { I.bumped = null; return; }
  const key = hit.join(',');
  if (I.bumped === key || T.sheet) return;
  const S = spotsNow().find(q => spotTiles(q).tiles.some(([a, b]) => a === hit[0] && b === hit[1]));
  if (S) { I.bumped = key; me.moving = false; doShop(S.act); }
}
function updateInside(dt) {
  const I = T.inside, me = I.me;
  let step = IN_WALK * dt;
  const [jx, jy] = joyVec();
  if (Math.hypot(jx, jy) > 0.25 && !T.fading) { if (me.path.length) { me.path = []; I.then = null; } inJoy(dt, jx, jy); step = 0; }
  else me.moving = false;
  while (step > 0 && me.path.length) {
    const [tx, ty] = me.path[0], dx = tx - me.x, dy = ty - me.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) { me.x = tx; me.y = ty; me.path.shift(); if (!me.path.length && I.then) { const t = I.then; I.then = null; t(); } continue; }
    me.moving = true;
    if (Math.abs(dx) >= 0.001) { const k = Math.min(step, Math.abs(dx)); me.x += Math.sign(dx) * k; step -= k; me.dir = dx > 0 ? 0 : 2; }
    else { const k = Math.min(step, Math.abs(dy)); me.y += Math.sign(dy) * k; step -= k; me.dir = dy > 0 ? 3 : 1; }
  }
  const marks = spotsNow().filter(S => S.act !== 'exit').map(S => { const t = spotTiles(S).tiles; const xs = t.map(a => a[0]), ys = t.map(a => a[1]); return { x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: Math.min(...ys) + (S.act === 'recipe' ? 0.3 : 0) }; });
  drawShopTo($('townCv'), { me, time: T.time, dawn: G.town.part === 'dawn', marks });
}
function tapInside(e) {
  const r = $('townCv').getBoundingClientRect(), V = shopViewSize();
  const x = Math.floor((e.clientX - r.left) / r.width * V.w / TILE), y = Math.floor((e.clientY - r.top) / r.height * V.h / TILE);
  playSfx('tap');
  const S = spotsNow().find(s => spotTiles(s).tiles.some(([a, b]) => a === x && b === y));
  if (S) { closeSheet(); goSpot(S.act); return; }
  closeSheet();
  inWalk([[x, y]]);
}

function placeMe(id) {
  if (T) T.inside = null; // 골목으로
  const [tx, ty] = PLACES[id].door;
  T.me.x = tileX(tx); T.me.y = tileY(ty); T.me.path = []; T.me.moving = false; T.me.dir = 3; T.then = null;
}

export function showTown() {
  if (!townMode()) return;
  const part = G.town.part;
  if (!T) { T = { me: { char: 0, x: 0, y: 0, dir: 3, path: [] }, cam: { x: 0, y: 0 }, then: null, time: 0, vw: VIEW_W, vh: 240 }; placeMe('shop'); T.day = G.day; }
  if (T.day !== G.day) { placeMe('shop'); T.day = G.day; } // 영업을 마치면 가게 앞에서
  if (T.walkKey !== part + G.day) spawnWalkers(); // 골목을 걷는 손님 (밤·새벽마다 새로)
  $('town').hidden = false;
  document.body.classList.add('in-town'); // 위 막대(#bar)는 숨겨요 (마을 막대가 대신)
  renderBar(); renderNav();
  layoutTown();
  if (!T.sheet) closeSheet();
}
// 아래: 장소 바로 가기 (누르면 그곳까지 걸어가요). 지금 닫힌 곳은 흐리게
function renderNav() {
  if (exOn()) { $('townNav').innerHTML = exNav(); return; }
  if (T && T.inside) { // 가게 안: 할 일 버튼
    const B = [['pantry', '냉장고'], ['recipe', '메뉴 연구'], ['counter', '계산대'], ['clean', '청소'], ['setup', prepMax() ? '조리대' : '오픈 준비'], ['open', '가게 열기'], ['exit', '나가기']];
    $('townNav').innerHTML = B.map(([a, n]) => `<button type="button" data-in="${a}" class="${a === 'open' ? 'go' : ''}">${n}</button>`).join('');
    return;
  }
  $('townNav').innerHTML = Object.keys(PLACES).map(id => `<button type="button" data-go="${id}" class="${placeOpen(id) ? '' : 'off'}">${placeShort(id)}</button>`).join('');
}
export function hideTown() { if ($('town')) $('town').hidden = true; closeSheet(); }

// 캔버스: 너비 9칸, 높이는 남는 자리만큼 (그림 1픽셀 = 기기 픽셀 정수 개)
function layoutTown() {
  const el = $('town'); if (!el || el.hidden || !T) return;
  const cv = $('townCv'), dpr = window.devicePixelRatio || 1;
  const availH = el.clientHeight - $('townBar').offsetHeight - $('townNav').offsetHeight - 8;
  if (T.inside) { // 가게 안: 가게 전체가 들어가게 (정수 배)
    const V = shopViewSize(), k = Math.max(1, Math.floor(Math.min(el.clientWidth / V.w, availH / V.h) * dpr)) / dpr;
    cv.style.width = V.w * k + 'px'; cv.style.height = V.h * k + 'px';
    return;
  }
  const s = Math.max(1, Math.floor(el.clientWidth / VIEW_W * dpr)) / dpr;
  T.vw = VIEW_W; T.vh = Math.max(128, Math.min(exOn() ? exMapH() : MAP_H * TILE, Math.floor(availH / s)));
  cv.style.width = T.vw * s + 'px'; cv.style.height = T.vh * s + 'px';
}

// 위: 밤/새벽 · 시각 · 남은 일 칸 · 피로 · 위생
function renderBar() {
  exHud(); // 탐방 중이면 맨 위 HUD에 체력·가방 (아니면 숨겨요)
  if (exOn()) { $('townBar').innerHTML = exBar(); return; } // 동네 탐방: 체력 · 가방
  const Tn = G.town, dawn = Tn.part === 'dawn', max = slotsMax();
  const min = townClock(), hh = Math.floor(min / 60) % 24, mm = min % 60;
  // 칸: 밤 4칸(남색) + 새벽 3칸(노랑) 한 줄 · 쓴 칸은 비우고, 넘긴 칸은 빨강
  const over = Math.max(0, Tn.used - max);
  const dots = Array.from({ length: max }, (_, i) => `<i class="${i < NIGHT_SLOTS ? 'n' : 'd'} ${i < Tn.used ? 'used' : ''}"></i>`).join('') + (over ? `<b class="tb-over">+${over}시간</b>` : ''); // 넘겨 쓴 칸은 숫자로
  $('townBar').innerHTML = `<span class="tb-time ${dawn ? 'dawn' : 'night'}">${dawn ? '새벽' : '밤'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>
    <span class="tb-slots" title="남은 시간">${dots}</span>
    ${Tn.fatigue ? `<span class="tb-tag warn">피로 ${Tn.fatigue}</span>` : ''}
    <span class="tb-tag ${Tn.hygiene < HYGIENE_LOW ? 'warn' : ''}">위생 ${Tn.hygiene}</span>
    <button type="button" class="tb-phone" data-tb="phone" data-guide="phone" aria-label="휴대폰"><i></i></button>`; // 휴대폰 (v0.54)
}

// 할 일이 있는 곳 「!」: 시장(오늘 아직 재료를 안 샀으면) · 장을 봤으면 우리 가게(열기)
function townMarks() {
  const Tn = G.town, out = [];
  const top = id => { const [tx, ty] = PLACES[id].door; return { x: tileX(tx), y: ty * TILE - 40 }; };
  const bought = Object.keys(Tn.bought || {}).length > 0;
  out.push(top(bought ? 'shop' : 'market'));
  return out;
}

// ── 조이스틱: 화면을 누른 채로 끌면 그 자리에 조이스틱이 생기고, 민 쪽으로 걸어요 (짧게 누르면 그곳까지 걸어가요)
//  가게 문 앞에서 위로 밀거나 사람에게 부딪히면 할 일 창이 열려요 (포켓몬처럼). 키보드 방향키·WASD도 돼요
const JOY_R = 40;      // 조이스틱 반지름 (CSS 픽셀)
const JOY_START = 10;  // 이만큼 끌어야 조이스틱 (그보다 짧으면 누르기)
const keys = new Set();
function joyVec() {
  const j = T.joy;
  let x = 0, y = 0;
  if (j && j.on) { x = j.dx / JOY_R; y = j.dy / JOY_R; }
  if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1; if (keys.has('u')) y -= 1; if (keys.has('d')) y += 1;
  const m = Math.hypot(x, y);
  return m > 1 ? [x / m, y / m] : [x, y];
}
// 발 둘레(가로 10 · 세로 5픽셀)가 막힌 칸에 걸리는지
function blockedAt(x, y, m) {
  for (const px of [x - 5, x + 5]) for (const py of [y - 5, y]) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || m[ty * MAP_W + tx]) return true;
  }
  return false;
}
function joyMove(dt, vx, vy) {
  const me = T.me, m = walls(), sp = WALK * Math.min(1, Math.hypot(vx, vy)) / Math.hypot(vx, vy);
  const nx = me.x + vx * sp * dt, ny = me.y + vy * sp * dt;
  let hitUp = false, hitX = 0, hitY = 0;
  if (!blockedAt(nx, me.y, m)) me.x = nx; else hitX = Math.sign(vx);
  if (!blockedAt(me.x, ny, m)) me.y = ny; else { hitY = Math.sign(vy); hitUp = vy < 0; }
  me.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 0 : 2) : (vy > 0 ? 3 : 1);
  me.moving = true;
  T.sitUntil = 0;
  // 부딪힌 곳: 문 앞에서 위로 밀면 그 가게 · 물건 (같은 칸에서는 한 번만). 사람은 「대화하기」 버튼으로 (v0.49)
  const [tx, ty] = meTile();
  const key = tx + ',' + ty;
  if (T.bumped && T.bumped !== key) T.bumped = null;
  if ((!hitX && !hitY) || T.bumped || T.sheet) return;
  const bx = tx + (Math.abs(vx) >= Math.abs(vy) ? hitX : 0), by = ty + (Math.abs(vy) > Math.abs(vx) ? hitY : 0);
  let place = null;
  if (hitUp) place = Object.keys(PLACES).find(id => PLACES[id].door[0] === tx && PLACES[id].door[1] === ty);
  if (place) { T.bumped = key; me.moving = false; facePlace(place); if (place === 'shop') enterShop(); else { openPlace(place); playSfx('tap'); } return; } // 우리 가게 문은 걸어 들어가요
  const prop = MAP_PROPS.find(q => q.use && propOn(q) && (q.block || []).some(([a, b]) => a === bx && b === by));
  if (prop) { T.bumped = key; me.moving = false; openUse(prop); return; }
  const look = hitUp && LOOKS.find(L => inRect(tx * TILE + 8, ty * TILE - 4, L.rect));
  if (look) { T.bumped = key; me.moving = false; showLook(look); return; }
  if (hitUp && vacantB && ty * TILE === vacantB[2] && tx * TILE >= vacantB[1] && tx * TILE < vacantB[1] + SPR.tw_vacant[2]) { T.bumped = key; me.moving = false; showVacant(); }
}

export function updateTown(dt) {
  if (!townShown()) return;
  T.time += dt;
  if (exOn()) { exUpdate(dt); return; } // 동네 탐방 중 (v0.78)
  if (T.inside) { if (!talking()) updateInside(dt); else drawShopTo($('townCv'), { me: T.inside.me, time: T.time, dawn: G.town.part === 'dawn' }); return; }
  const me = T.me;
  const [vx, vy] = talking() ? [0, 0] : joyVec();
  if (Math.hypot(vx, vy) > 0.25) { if (me.path.length) { me.path = []; T.then = null; } joyMove(dt, vx, vy); }
  else if (!me.path.length) me.moving = false;
  if (me.path.length && !talking()) {
    let step = WALK * dt;
    // 가로 먼저, 그다음 세로로 칸 가운데까지 (한 번에 남은 거리만큼만 — 넘어가면 좌우로 떨며 제자리에 맴돌아요)
    while (step > 0 && me.path.length) {
      const [tx, ty] = me.path[0], gx = tileX(tx), gy = tileY(ty), dx = gx - me.x, dy = gy - me.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { me.x = gx; me.y = gy; me.path.shift(); if (!me.path.length) arrive(); continue; }
      if (Math.abs(dx) >= 0.01) { const k = Math.min(step, Math.abs(dx)); me.x += Math.sign(dx) * k; step -= k; me.dir = dx > 0 ? 0 : 2; }
      else { const k = Math.min(step, Math.abs(dy)); me.y += Math.sign(dy) * k; step -= k; me.dir = dy > 0 ? 3 : 1; }
      me.moving = true;
    }
  }
  T.cam.x = Math.max(0, Math.min(MAP_W * TILE - T.vw, me.x - T.vw / 2));
  T.cam.y = Math.max(0, Math.min(MAP_H * TILE - T.vh, me.y - 16 - T.vh / 2));
  if (!talking()) updateWalkers(dt);
  updateTalkBtn();
  me.sit = T.sitUntil > T.time; // 벤치에서 쉬는 동안 앉아 있어요
  const dawn = G.town.part === 'dawn';
  const actors = [me, ...(T.walkers || [])];
  for (const id in TOWN_NPC) { const n = TOWN_NPC[id]; actors.push({ char: id === 'choi' && guildOpen() ? CAST.moon.char : CAST[id].char, x: tileX(n.at[0]), y: tileY(n.at[1]), dir: 3 }); } // 2장: 세탁소 자리엔 문 회장님
  drawTown($('townCv'), { cam: T.cam, vw: T.vw, vh: T.vh, actors, time: T.time, night: !dawn, dawn, marks: townMarks(), swap: { ...(furnOpen() ? { sign_flower: 'sign_furn' } : {}), ...(guildOpen() ? { sign_laundry: 'sign_hw' } : {}) }, only: onlyNow() });
}

// ── 골목 꾸밈 · 물건 · 걷는 손님 (v0.48) ──
// 장에 따라 바뀌는 가게 앞 꾸밈 (꽃집 → 미소 가구 · 세탁소 → 문 철물)
const onlyNow = () => ({ flower1: !furnOpen(), flower2: furnOpen(), laundry1: !guildOpen(), laundry2: guildOpen() });
const propOn = p => !p.only || onlyNow()[p.only];
const propRect = p => [p.x, p.y - SPR[p.spr][3], SPR[p.spr][2], SPR[p.spr][3]];
// 물건 창: 쉬기·자판기는 버튼, 나머지는 한 줄
function openUse(p) {
  if (p.use === 'bus' && exploreOpen()) { sheet(busHTML(), 'ex'); return; } // 2장부터: 새벽 첫차로 동네 탐방 (v0.78)
  const U = USES[p.use], head = `<div class="ts-head"><b>${U.name}</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>`;
  if (!U.act) { sheet(`${head}<p class="ts-note">${U.note}</p>`); return; }
  const ok = useOk(p.use), why = G.town.fatigue <= 0 ? '지금은 피곤하지 않습니다' : p.use === 'drink' && G.town.drink === G.day ? '이번 턴에는 이미 마셨습니다' : '';
  sheet(`${head}<button type="button" class="ts-act" data-ts="use" data-u="${p.use}" ${ok ? '' : 'disabled'}><b>${U.act}</b><small>${ok ? U.sub : why || U.sub}</small></button>`);
}
function goProp(p) {
  const [bx, by] = p.block[0], at = nearestOpen(bx, by + 1);
  const face = () => { const [tx, ty] = meTile(); T.me.dir = Math.abs(bx - tx) > Math.abs(by - ty) ? (bx > tx ? 0 : 2) : (by > ty ? 3 : 1); openUse(p); };
  if (!at || !walkTo(at, face)) face();
}
function showLook(L) { sheet(`<div class="ts-head"><b>${L.name}</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${L.note}</p>`); }
// 걷는 손님: 아무 칸에서 시작해 근처 아무 데로 걸어가고, 잠깐 쉬었다가 또 걸어요 (보이기만 — fxRand)
const NPC_WALK = 34;
function openTile() {
  const m = walls();
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(fxRand() * MAP_W), y = Math.floor(fxRand() * MAP_H);
    if (!m[y * MAP_W + x] && ![8, 9, 20, 21].includes(y)) return [x, y]; // 찻길 위는 빼요
  }
  return [13, 7];
}
function spawnWalkers() {
  T.walkKey = G.town.part + G.day;
  const pool = Object.keys(PEOPLE).map(Number).filter(ch => ch !== 7 && ch !== 9); // 이웃 사장님은 빼요
  T.walkers = [];
  for (let k = 0; k < (WALKERS[G.town.part] || 0) && pool.length; k++) {
    const char = pool.splice(Math.floor(fxRand() * pool.length), 1)[0], [tx, ty] = openTile();
    T.walkers.push({ char, x: tileX(tx), y: tileY(ty), dir: 3, path: [], moving: false, wait: fxRand() * 2, talk: false, cool: 0 });
  }
}
function updateWalkers(dt) {
  for (const w of T.walkers || []) {
    if (w.talk) { w.moving = false; continue; }
    if (w.wait > 0) { w.wait -= dt; w.moving = false; continue; }
    if (!w.path.length) {
      const [tx, ty] = openTile(), from = [Math.floor(w.x / TILE), Math.floor(w.y / TILE)];
      w.path = Math.hypot(tx - from[0], ty - from[1]) < 14 ? townPath(from, [tx, ty]) || [] : [];
      if (!w.path.length) { w.wait = 0.5; continue; }
    }
    let step = NPC_WALK * dt;
    while (step > 0 && w.path.length) {
      const [tx, ty] = w.path[0], gx = tileX(tx), gy = tileY(ty), dx = gx - w.x, dy = gy - w.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { w.x = gx; w.y = gy; w.path.shift(); if (!w.path.length) w.wait = 1 + fxRand() * 3; continue; }
      if (Math.abs(dx) >= 0.01) { const k = Math.min(step, Math.abs(dx)); w.x += Math.sign(dx) * k; step -= k; w.dir = dx > 0 ? 0 : 2; }
      else { const k = Math.min(step, Math.abs(dy)); w.y += Math.sign(dy) * k; step -= k; w.dir = dy > 0 ? 3 : 1; }
      w.moving = true;
    }
  }
}
// 걷는 손님과 이야기: 처음이면 다음 영업에 올 가능성이 높아져요 (sim/town.js townMeet)
function talkWalker(w) {
  const me = T.me, P = PEOPLE_INFO[w.char] || { name: '손님' }, who = { name: P.name, char: w.char };
  w.talk = true; w.path = []; w.dir = me.x < w.x ? 2 : 0; me.dir = me.x < w.x ? 0 : 2; me.path = []; me.moving = false;
  const first = runCmd('townMeet', { char: w.char });
  const pool = MEET_LINES[PEOPLE[w.char]] || MEET_LINES.worker, lines = first ? pool[w.char % pool.length] : ['또 만났네요. 그럼 내일 봬요!'];
  showChat(lines.map(t => [who, t]));
  chatQ.after = () => { w.talk = false; w.cool = T.time + 3; w.wait = 1.5; if (first) toast(`${josa(P.name, '이/가')} 다음 영업에 들를 가능성이 높아졌습니다`, 'good'); };
}
// 「대화하기」 버튼: 사람 바로 앞에 서면 그 사람 머리 위에 떠요 (이웃 사장님 · 걷는 손님)
const TALK_NEAR = { x: 22, y: 18 };
function talkTarget() {
  if (T.sheet || talking() || T.fading || T.inside || chatQ) return null;
  const me = T.me, near = (x, y) => Math.abs(x - me.x) < TALK_NEAR.x && Math.abs(y - me.y) < TALK_NEAR.y;
  for (const id in TOWN_NPC) { const n = TOWN_NPC[id]; if (near(tileX(n.at[0]), tileY(n.at[1]))) return { npc: id, x: tileX(n.at[0]), y: tileY(n.at[1]) }; }
  const w = (T.walkers || []).find(q => !q.talk && near(q.x, q.y));
  return w ? { w, x: w.x, y: w.y } : null;
}
function updateTalkBtn() {
  const b = $('townTalk'), t = talkTarget();
  T.talkT = t;
  if (!t) { if (!b.hidden) b.hidden = true; return; }
  if (t.w) t.w.wait = Math.max(t.w.wait, 0.3); // 버튼이 뜬 동안은 그 자리에 서 있어요
  const cv = $('townCv').getBoundingClientRect(), box = $('town').getBoundingClientRect();
  b.style.left = (cv.left - box.left + (t.x - T.cam.x) / T.vw * cv.width) + 'px';
  b.style.top = (cv.top - box.top + (t.y - 34 - T.cam.y) / T.vh * cv.height) + 'px';
  b.hidden = false;
}
function talkPress() {
  if (exOn()) { exTalk(); return; }
  const t = T.talkT;
  if (!t) return;
  $('townTalk').hidden = true; playSfx('tap');
  if (t.w) { talkWalker(t.w); return; }
  const place = Object.keys(PLACES).find(id => PLACES[id].who === t.npc);
  if (place) { T.me.path = []; T.me.dir = t.x > T.me.x + 4 ? 0 : t.x < T.me.x - 4 ? 2 : 1; openPlace(place); }
}
const walkerAt = (x, y) => (T.walkers || []).find(w => inRect(x, y, [w.x - 8, w.y - 30, 16, 32]));

function showVacant() { sheet(`<div class="ts-head"><b>빈 가게</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${VACANT_NOTE}</p>`); }

// 누른 곳: 이웃 → 그 가게 · 건물(문 앞) → 할 일 · 빈 가게 → 안내 · 나머지는 그 칸까지 걸어요 (갈 수 없는 칸이면 가만히)
const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
function tapTown(e) {
  if (talking()) return;
  if (exOn()) { exTap(e); return; }
  if (T.inside) { tapInside(e); return; }
  const r = $('townCv').getBoundingClientRect();
  const wx = T.cam.x + (e.clientX - r.left) / r.width * T.vw, wy = T.cam.y + (e.clientY - r.top) / r.height * T.vh;
  closeSheet();
  playSfx('tap');
  // 사람을 누르면 그 옆 가장 가까운 칸까지 걸어가요 (v0.51) — 이야기는 머리 위 「대화하기」 버튼으로 (v0.49 사용자 요청)
  const npc = Object.keys(TOWN_NPC).find(id => { const n = TOWN_NPC[id]; return inRect(wx, wy, [tileX(n.at[0]) - 8, tileY(n.at[1]) - 30, 16, 32]); });
  if (npc) { const [nx, ny] = TOWN_NPC[npc].at, at = besideTile(nx, ny); if (at) walkTo(at, () => faceTo(nx * TILE + TILE / 2, ny * TILE + 13)); return; }
  const w = walkerAt(wx, wy);
  if (w) { const at = besideTile(Math.floor(w.x / TILE), Math.floor(w.y / TILE)); if (at) { w.wait = Math.max(w.wait, 2); w.path = []; walkTo(at, () => faceTo(w.x, w.y)); } return; }
  const place = Object.keys(PLACES).find(id => inRect(wx, wy, PLACES[id].rect));
  if (place) { goPlace(place); return; }
  const prop = MAP_PROPS.find(q => q.use && propOn(q) && inRect(wx, wy, propRect(q)));
  if (prop) { goProp(prop); return; }
  const look = LOOKS.find(L => inRect(wx, wy, L.rect));
  if (look) { const [x, y, w2, h2] = look.rect; const at = nearestOpen(Math.floor((x + w2 / 2) / TILE), Math.floor((y + h2) / TILE)); if (!at || !walkTo(at, () => { T.me.dir = 1; showLook(look); })) showLook(look); return; }
  if (vacantB && inRect(wx, wy, [vacantB[1], vacantB[2] - SPR.tw_vacant[3], SPR.tw_vacant[2], SPR.tw_vacant[3]])) {
    walkTo(nearestOpen(Math.floor((vacantB[1] + 24) / TILE), Math.floor(vacantB[2] / TILE)), () => { T.me.dir = 1; showVacant(); });
    return;
  }
  // 갈 수 없는 곳(막힌 칸 · 닿지 않는 칸)을 누르면 그대로 서 있어요 (v0.40 사용자 요청)
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || walls()[ty * MAP_W + tx]) return;
  walkTo([tx, ty]);
}

// ── 아래 창: 장소의 할 일 · 이웃 이야기 · 시장 ──
function sheet(html, cls) {
  const s = $('townSheet');
  const keep = !s.hidden && s.className === 'town-sheet ' + (cls || '') ? s.scrollTop : 0; // 같은 창을 다시 그리면 스크롤 자리 그대로
  s.className = 'town-sheet ' + (cls || '');
  s.innerHTML = html; s.hidden = false;
  s.scrollTop = keep;
  T.sheet = true;
}
export function closeSheet() { const s = $('townSheet'); if (!s) return; s.hidden = true; s.innerHTML = ''; if (T) T.sheet = false; }

const NEIGHBOR = { miso: '미소 사장님', choi: '최 사장님' };
function actLabel(place, act) {
  const A = ACTS[act];
  if (act === 'talk') return `${josa(NEIGHBOR[PLACES[place].who], '과/와')} 이야기하기`;
  return A.name;
}
function openPlace(id) {
  const P = PLACES[id], Tn = G.town;
  if (!placeOpen(id)) {
    sheet(`<div class="ts-head"><b>${placeName(id)}</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${P.open === 'dawn' ? '새벽에 문을 엽니다' : '지금은 문을 닫았습니다'}</p>`);
    return;
  }
  const acts = placeActs(id).filter(a => !COUNTER_ACTS.includes(a)); // 홍보는 휴대폰에서
  const rows = acts.map(a => actRow(id, a)).join('');
  const bw = id === 'laundry' && guildOpen() ? 'moon' : P.who;
  const who = bw && ['miso', 'jung', 'moon'].includes(bw) ? heartsHTML(bw) : ''; // 친밀도 하트 (sim/bond.js)
  sheet(`<div class="ts-head"><b>${id === 'shop' ? G.shop : placeName(id)}</b>${who}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>${rows || `<p class="ts-note">${id === 'board' ? '동네 소식과 행사 안내가 붙어 있습니다' : '지금 할 일이 없습니다'}</p>`}`);
  T.sheetPlace = id;
}
// 홍보(인스타 올리기 · 파워블로거 섭외)는 휴대폰 앱에서 (v0.54 사용자 요청 — 전에는 계산대). 다른 장소 창에는 안 보여요
const COUNTER_ACTS = ['insta', 'blogger'];
// 계산대 (v0.66 사용자 요청): 누르면 바로 영수증(판매 장부), 위 탭으로 손님 수첩
let counterTab = 'sales';
const noHead = h => h.replace(/^<div class="ts-head">[\s\S]*?<\/button><\/div>/, '');
function openCounter(tab) {
  if (tab) counterTab = tab;
  const tabs = [['sales', '영수증'], ['book', '손님 수첩']].map(([k, n]) => `<button type="button" class="fu-tab${counterTab === k ? ' sel' : ''}" data-ts="ctab" data-t="${k}">${n}</button>`).join('');
  sheet(`<div class="ct-top"><div class="ts-head"><b>계산대</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <button type="button" class="btn primary ct-open" data-ts="act" data-a="open">가게 열기</button>
    <div class="ct-tabs">${tabs}</div></div>${noHead(counterTab === 'book' ? bookHTML(bookSel) : salesHTML())}`, 'counter'); // 포스(계산대)에서도 가게 열기 (v0.68 사용자 요청)
  T.sheetPlace = 'shop';
}

// ── 휴대폰 (v0.54 사용자 요청): 위 막대 휴대폰 → 앱 — 인스타 · 블로그(홍보) · 전화(최근 통화) · 상권 지도(3장에 열려요, 지금은 자물쇠) ──
let phoneApp = null, callOpen = -1;
const APPS = [
  { id: 'insta', name: '인스타' },
  { id: 'blog', name: '블로그' },
  { id: 'order', name: '식자재 주문' }, // v0.59: 정가 · 시간 안 씀 (가게에 가면 특가·단골가·친밀도)
  { id: 'call', name: '전화' },
  { id: 'map', name: '상권 지도', lock: true }, // 3장 「길 건너 대결」에서 깔려요 (기획서 3장 탭)
];
function openPhone(app) {
  if (app !== undefined) { phoneApp = app; callOpen = -1; }
  sheet(phoneHTML(), 'phone');
  T.sheetPlace = 'shop'; // 홍보는 우리 가게 일로 셈 (sim/town.js townAct)
}
function phoneHTML() {
  const min = townClock(), clock = `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const A = APPS.find(a => a.id === phoneApp);
  let body;
  if (!A) body = `<div class="ph-apps">${APPS.map(a => `<button type="button" class="ph-app${a.lock ? ' lock' : ''}" data-ts="app" data-p="${a.id}"><i class="ph-ic ${a.id}">${a.lock ? '<b class="ph-lock"></b>' : ''}</i><span>${a.name}</span></button>`).join('')}</div>`;
  else {
    const head = `<div class="ph-head"><button type="button" class="ph-back" data-ts="app" data-p="" aria-label="뒤로">◂</button><b>${A.name}</b></div>`;
    if (A.id === 'insta') body = head + actRow('shop', 'insta');
    else if (A.id === 'blog') body = head + actRow('shop', 'blogger');
    else body = head + callsHTML();
  }
  return `<div class="ph"><div class="ph-top"><span>${clock}</span><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><div class="ph-screen">${body}</div></div>`;
}
// 최근 통화: 받은 전화(이야기 장면)를 다시 읽어요
function callsHTML() {
  const calls = (G.story && G.story.calls) || [];
  if (!calls.length) return '<p class="ph-note">아직 받은 전화가 없습니다.</p>';
  return calls.map((c, i) => {
    const lines = ((SCENES[c.id] && SCENES[c.id].lines) || []).filter(l => CAST[l[0]] && CAST[l[0]].phone);
    if (!lines.length) return '';
    const who = CAST[lines[0][0]], open = i === callOpen;
    return `<button type="button" class="ph-call${open ? ' open' : ''}" data-ts="callOpen" data-i="${i}"><span class="ph-face">${icon('char' + who.char)}</span><span class="ph-cw"><b>${who.name.replace(/ · 전화$/, '')}</b><small>${c.day}일차</small></span></button>`
      + (open ? `<div class="ph-lines">${lines.map(l => `<p>${l[1].replace(/\{shop\}/g, G.shop)}</p>`).join('')}</div>` : '');
  }).join('');
}

function actRow(id, a) {
  const Tn = G.town;
  {
    const A = ACTS[a], ok = actNow(id, a), day = Tn.part === 'dawn' ? '오늘' : '내일'; // 홍보 효과는 다가오는 영업일
    const cost = a === 'market' ? (marketCost() ? `${marketCost()}시간` : '') : A.cost ? `${A.cost}시간` : '';
    const sub = a === 'clean' ? (Tn.hygiene >= 100 ? '이미 깨끗합니다' : `위생 ${Tn.hygiene} → ${Math.min(100, Tn.hygiene + 60)}`) : a === 'talk' ? (ok ? '내일 소개 손님이 옵니다' : '오늘은 이미 이야기했습니다')
      : a === 'setup' ? (ok ? '오늘 11시까지 손이 빠릅니다' : '이미 준비했습니다') : a === 'market' ? (Tn.marketIn ? '다시 들어가기' : marketCost() ? '특가 · 단골가 · 처음 들어갈 때 1시간' : '배달 · 시간이 들지 않습니다')
      : a === 'insta' ? (ok ? `${day} 학생 손님이 더 들어옵니다` : '이미 올렸습니다') : a === 'blogger' ? (ok ? `${won(A.money)} · ${day} 블로거가 옵니다. 맛있으면 사흘 동안 직장인·어르신이 더, 아니면 덜` : `${day} 블로거가 옵니다`)
      : a === 'guild' ? (Tn.guildIn ? '다시 들어가기' : '문 회장님과 이야기 · 설비 손보기 (내일 소개 손님)')
      : a === 'furn' ? (Tn.furnIn ? '다시 들어가기' : '미소 사장님과 이야기 · 가구 보기 (내일 소개 손님)')
      : a === 'book' ? '가게에 온 손님들' : a === 'sales' ? '날마다 매출 · 총이익 · 손님' : a === 'counter' ? '판매 장부 · 손님 수첩' : a === 'sleep' ? (slotsMax() > Tn.used ? `남은 ${slotsMax() - Tn.used}시간은 푹 쉬고 아침에 가게를 엽니다` : '아침에 가게를 엽니다') : a === 'open' ? '가격 확인하고 문 열기' : a === 'ledger' ? '가격 · 장사 도구 · 할 일' : a === 'recipe' ? '숙련도와 돈으로 메뉴 레벨 올리기' : '';
    return `<button type="button" class="ts-act" data-ts="act" data-a="${a}" ${ok ? '' : 'disabled'}><b>${actLabel(id, a)}</b><small>${sub}</small>${cost && !(a === 'market' && Tn.marketIn) && !(a === 'furn' && Tn.furnIn) && !(a === 'guild' && Tn.guildIn) ? `<i>${cost}</i>` : ''}</button>`;
  }
}

// 냉장고 (가게 안): 창고에 있는 재료 · 유통기한(들어온 묶음마다) · 오늘의 메뉴마다 만들 수 있는 그릇
function pantryHTML() {
  const ings = openIngs().filter(i => invOf(i) > 0);
  // 유통기한 자세히 (v0.66 사용자 요청): 들어온 날마다 묶어 「몇 개 · 언제까지」 — 오늘까지 빨강 · 내일까지 주황
  const when = d => (d <= 0 ? '오늘까지' : d === 1 ? '내일까지' : `${d}일 남음`);
  const batches = i => { const by = {}; for (const b of G.inv[i] || []) if (b.n > 0) by[b.exp] = (by[b.exp] || 0) + b.n; return Object.keys(by).map(Number).sort((a, b) => a - b).map(e => ({ n: by[e], d: e - G.day })); };
  const rows = ings.map(i => { const t = invToday(i), B = batches(i);
    return `<div class="pt-row${t ? ' today' : ''}">${icon('ing_' + i, 'mk-ic')}<span>${INGREDIENTS[i].name}</span><b>${invOf(i)}</b>
      <div class="pt-exp">${B.map(b => `<i class="${b.d <= 0 ? 'd0' : b.d === 1 ? 'd1' : ''}">${b.n}개 · ${when(b.d)}</i>`).join('')}</div></div>`; }).join('');
  const menus = todayMenus().map(m => `<span>${icon(m, 'dish')}${invServings(m)}그릇</span>`).join('');
  return `<div class="ts-head"><b>냉장고</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <div class="pt-menus">${menus}</div>
    ${rows ? `<div class="pt-list">${rows}</div>` : '<p class="ts-note">비어 있습니다. 정 사장 식자재에서 사거나 휴대폰으로 주문해 보세요</p>'}`;
}
// 조리대 (프렙 통이 있을 때, v0.65 사용자 결정): 오픈 준비 + 프렙 만들기 — 메뉴마다 그릇 수를 골라 한 번에 (1시간 · 미니게임 없이 「좋음」)
//  얼마나 만들지가 실력: 어제 판 그릇을 한 줄로 보여 줘요 (팔지 못한 프렙은 마감 때 버려요)
let prepCart = {};
function stoveHTML() {
  const Tn = G.town, max = prepMax(), made = Tn.prep || {}, last = G.history[G.history.length - 1];
  const cartN = Object.values(prepCart).reduce((a, b) => a + b, 0), left = max - prepUsed() - cartN;
  const rows = todayMenus().map(m => { const k = prepCart[m] || 0, sold = last && last.sold ? last.sold[m] || 0 : 0;
    return `<div class="mk-prow">${icon(m, 'dish')}<span>${MENUS[m].name}<small>어제 ${sold}그릇 팔림${made[m] ? ` · 프렙 ${made[m]}` : ''}</small></span><div class="step"><button type="button" data-ts="prepD" data-m="${m}" data-d="-1" aria-label="${MENUS[m].name} 덜 만들기" ${k ? '' : 'disabled'}>−</button><b>${k}그릇</b><button type="button" data-ts="prepD" data-m="${m}" data-d="1" aria-label="${MENUS[m].name} 더 만들기" ${left > 0 && k < prepRoom(m) ? '' : 'disabled'}>+</button></div></div>`; }).join('');
  return `<div class="ts-head"><b>조리대</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    ${actRow('shop', 'setup')}
    <small class="mk-h">프렙 <i>${prepUsed() + cartN}/${max}그릇 · 미니게임 없이 바로 나갑니다</i></small>
    <div class="mk-plan">${rows}</div>
    <p class="ts-note">팔지 못한 프렙은 마감 때 버립니다</p>
    <button type="button" class="btn primary big" data-ts="prepMake" ${cartN ? '' : 'disabled'}>${cartN ? `프렙 ${cartN}그릇 만들기 · 1시간` : '만들 그릇 수를 골라 보세요'}</button>`;
}
// 미소 가구 창 (미리보기 캔버스는 창을 그린 뒤에)
function showFurn() { sheet(furnHTML(), 'furn'); drawFurnPreview(); }

let chatQ = null; // 이웃 이야기 줄들
function showChat(lines) {
  chatQ = { lines, i: 0 };
  drawChat();
}
function drawChat() {
  const [who, text] = chatQ.lines[chatQ.i];
  sheet(`<div class="ts-chat">${lineHTML(who, text)}</div>`, 'chat');
}

// 시장: 원재료를 묶음으로 장바구니에 담고, 아래 「구매하기」로 한 번에 사요 (장바구니는 화면에만 — 사기 전엔 돈이 안 나가요)
//  「모자란 만큼 담기」: 오늘 팔 양(어제 판 만큼 + 넉넉히, planDefault)에서 창고 재고를 빼고 모자란 재료만 담아요 (sim/pantry.js cartFor)
let cart = {}, plan = {}, mkPhone = false; // mkPhone: 휴대폰 주문 (정가 · 정 사장님 이야기·특가 없음)
const unitOf = i => (mkPhone ? phoneUnit(i) : marketUnit(i));
const PLAN_STEP = 5;
function planDefault() {
  const last = G.history[G.history.length - 1];
  plan = {};
  for (const m of todayMenus()) plan[m] = Math.max(PLAN_STEP, Math.ceil(((last && last.sold[m]) || 10) / PLAN_STEP) * PLAN_STEP + PLAN_STEP);
}
// 진열대 타일 (화면 정리): 누를 때마다 한 묶음 담기 · 담은 타일에 +수량과 − · 내일 모자랄 재료는 빨간 점 · 특가·시세는 구석에
function ingTile(i, lack) {
  const I = INGREDIENTS[i], unit = unitOf(i), k = cart[i] || 0, news = ingNews(i);
  const inv = invOf(i), today = invToday(i), short = (lack[i] || 0) > k;
  const tag = !mkPhone && isDeal(i) ? '<i class="mk-tag deal">특가</i>' : !mkPhone && G.town.kept === i ? '<i class="mk-tag keep">+1일</i>' : news ? `<i class="mk-tag ${news.mul > 1 ? 'up' : 'down'}">${news.mul > 1 ? '▲' : '▼'}</i>` : '';
  return `<div class="mk-tile${k ? ' in' : ''}" data-ts="cart" data-i="${i}" data-d="1" role="button" aria-label="${I.name} 한 묶음 담기">
    ${short ? '<i class="mk-dot"></i>' : ''}${tag}${icon('ing_' + i, 'mk-ic')}
    <b>${I.name}</b><small>${won(unit * I.pack)}</small>
    <div class="mk-row">${k ? `<span class="mk-n">+${k * I.pack}</span><button type="button" class="mk-minus" data-ts="cart" data-i="${i}" data-d="-1" aria-label="${I.name} 빼기">−</button>`
      : today ? `<small class="mk-inv today">오늘까지 ${today}</small>` : inv ? `<small class="mk-inv">재고 ${inv}</small>` : ''}</div>
  </div>`;
}
// 정 사장님 한 줄: 이야기하기(하루 한 번, ♥+2) · 따로 빼 둔 재료 (♥♥♥)
function marketJung() {
  const kept = G.town.kept ? `<span>빼 둔 재료 ${INGREDIENTS[G.town.kept].name} <small>(+1일)</small></span>` : '';
  const talk = jungTalkOk() ? '<button type="button" class="btn small mk-talk" data-ts="jungTalk">정 사장님과 이야기 <small>♥+2</small></button>' : '';
  return talk || kept ? `<div class="mk-jung">${kept}${talk}</div>` : '';
}
function marketHTML() {
  const ings = openIngs(), lack = cartFor(plan);
  const total = ings.reduce((s, i) => s + unitOf(i) * (cart[i] || 0) * INGREDIENTS[i].pack, 0);
  const short = total > G.cash;
  return `<div class="ts-head"><b>${mkPhone ? '식자재 주문 · 정가' : '정 사장 식자재'}</b>${mkPhone ? '' : heartsHTML('jung')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    ${mkPhone ? '' : marketJung()}
    <small class="mk-h">오늘 팔 양</small>
    <div class="mk-plan">${todayMenus().map(m => `<div class="mk-prow">${icon(m, 'dish')}<span>${MENUS[m].name}<small>재고로 ${invServings(m)}그릇</small></span><div class="step"><button type="button" data-ts="plan" data-m="${m}" data-d="-1" aria-label="${MENUS[m].name} 덜 팔기">−</button><b>${plan[m] || 0}그릇</b><button type="button" data-ts="plan" data-m="${m}" data-d="1" aria-label="${MENUS[m].name} 더 팔기">+</button></div></div>`).join('')}</div>
    <button type="button" class="btn small mk-fill" data-ts="fill">모자란 재료 담기 <small>빨간 점이 모자란 재료</small></button>
    <small class="mk-h">진열대 <i>누르면 한 묶음</i></small>
    <div class="mk-shelf">${ings.map(i => ingTile(i, lack)).join('')}</div>
    <div class="mk-foot"><div class="mk-sum"><span>합계 <b>${won(total)}</b></span><span class="${short ? 'neg' : ''}">잔고 ${won(G.cash)}</span></div>
    <button type="button" class="btn primary big mk-buy" data-ts="buyCart" ${total && !short ? '' : 'disabled'}>${short ? '잔고가 모자랍니다' : total ? `${mkPhone ? '주문하기' : '구매하기'} · ${won(total)}` : '재료를 눌러 담아 보세요'}</button></div>`;
}

export function initTown() {
  // 동네 탐방 (v0.78): 골목 화면을 빌려줘요
  exHook({
    sheet, closeSheet, fade: doorFade, joy: joyVec,
    refresh: () => { renderBar(); renderNav(); layoutTown(); }, refreshBar: () => { renderBar(); renderNav(); },
    view: () => ({ vw: T.vw, vh: T.vh }), sheetOpen: () => !!T.sheet,
    back: () => { T.inside = null; T.me.x = tileX(36); T.me.y = tileY(22); T.me.path = []; T.me.moving = false; T.me.dir = 3; T.then = null; $('townTalk').textContent = '대화하기'; $('townTalk').hidden = true; renderBar(); renderNav(); layoutTown(); },
  });
  initExplore();
  // 누르기·끌기 (조이스틱)
  const cv = $('townCv'), joyEl = $('townJoy');
  cv.addEventListener('pointerdown', e => {
    if (!T || talking() || T.fading) return;
    e.preventDefault();
    const sh = $('townSheet');
    if (!sh.hidden) { // 창이 떠 있으면 바깥을 누를 때 걷지 않아요: 이웃 대화는 넘기고, 다른 창은 닫아요
      if (chatQ) sh.click(); else { closeSheet(); playSfx('tap'); }
      return;
    }
    cv.setPointerCapture(e.pointerId);
    T.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, on: false, ev: e };
  });
  cv.addEventListener('pointermove', e => {
    const j = T && T.joy;
    if (!j || j.id !== e.pointerId) return;
    let dx = e.clientX - j.sx, dy = e.clientY - j.sy;
    if (!j.on && Math.hypot(dx, dy) < JOY_START) return; // 가게 안에서도 조이스틱 (v0.48)
    if (!j.on) { // 조이스틱 시작: 누른 자리에 받침을 놓아요
      j.on = true; closeSheet();
      const r = $('town').getBoundingClientRect();
      joyEl.style.left = (j.sx - r.left) + 'px'; joyEl.style.top = (j.sy - r.top) + 'px'; joyEl.hidden = false;
    }
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
    j.dx = dx; j.dy = dy;
    joyEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const joyEnd = e => {
    const j = T && T.joy;
    if (!j || j.id !== e.pointerId) return;
    T.joy = null; joyEl.hidden = true; T.bumped = null;
    if (!j.on && e.type === 'pointerup') tapTown(e); // 짧게 눌렀으면 그곳까지 걸어가요
  };
  cv.addEventListener('pointerup', joyEnd);
  cv.addEventListener('pointercancel', joyEnd);
  const KEY = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  addEventListener('keydown', e => { if (townShown() && KEY[e.code] && !e.target.closest('input')) { keys.add(KEY[e.code]); e.preventDefault(); } });
  addEventListener('keyup', e => { if (KEY[e.code]) { keys.delete(KEY[e.code]); if (T && !keys.size) T.bumped = null; } });
  addEventListener('blur', () => keys.clear());
  $('townTalk').addEventListener('click', e => { e.stopPropagation(); talkPress(); });
  $('townBar').addEventListener('click', e => { if (!talking() && e.target.closest('[data-tb=phone]')) { if (chatQ) return; openPhone(null); playSfx('page'); runCmd('phoneHelp'); } }); // 휴대폰 (v0.54) · 처음 열면 안내 카드 (v0.61)
  $('townNav').addEventListener('click', e => {
    if (talking()) return;
    const exB = e.target.closest('[data-ex]');
    if (exB) { exNavClick(exB.dataset.ex); return; }
    const inB = e.target.closest('[data-in]');
    if (inB) { closeSheet(); playSfx('tap'); const a = inB.dataset.in; if (a === 'open') doShop('open'); else goSpot(a); return; }
    const b = e.target.closest('[data-go]'); if (!b) return; closeSheet(); goPlace(b.dataset.go); playSfx('tap');
  });
  addEventListener('resize', layoutTown);
  if (window.ResizeObserver) new ResizeObserver(layoutTown).observe($('town'));
  $('townSheet').addEventListener('click', e => {
    if (chatQ) { chatQ.i++; playSfx('tap'); if (chatQ.i >= chatQ.lines.length) { const after = chatQ.after; chatQ = null; closeSheet(); if (after) after(); } else drawChat(); return; }
    const b = e.target.closest('[data-ts]');
    if (!b) return;
    const k = b.dataset.ts;
    if (exSheetClick(k, b)) return; // 동네 탐방 창
    if (k === 'close') { closeSheet(); playSfx('tap'); }
    else if (k === 'use') { const u = b.dataset.u; if (runCmd('townUse', { use: u })) { closeSheet(); if (u === 'rest') { T.sitUntil = T.time + 2.5; T.me.path = []; } } }
    else if (k === 'act') runCmd('townAct', { place: T.sheetPlace, act: b.dataset.a });
    else if (k === 'app') { const p = b.dataset.p; if (p && APPS.find(a => a.id === p).lock) { toast('아직 깔리지 않은 앱입니다', 'info'); playSfx('tap'); return; } if (p === 'order') { mkPhone = true; T.sheetPlace = 'shop'; cart = {}; planDefault(); playSfx('page'); sheet(marketHTML(), 'market'); return; } /* 식자재 주문: 바로 주문 창 */ openPhone(p || null); playSfx('tap'); }
    else if (k === 'callOpen') { const i = +b.dataset.i; callOpen = callOpen === i ? -1 : i; openPhone(); playSfx('tap'); }
    else if (k === 'cart') { const i = b.dataset.i; cart[i] = Math.max(0, (cart[i] || 0) + +b.dataset.d); playSfx('tap'); sheet(marketHTML(), 'market'); }
    else if (k === 'fill') { cart = cartFor(plan); playSfx(Object.keys(cart).length ? 'page' : 'tap'); if (!Object.keys(cart).length) toast('재료가 넉넉합니다. 더 살 것이 없습니다', 'info'); sheet(marketHTML(), 'market'); }
    else if (k === 'who') { bookSel = +b.dataset.c; playSfx('tap'); if ($('townSheet').classList.contains('counter')) openCounter(); else sheet(bookHTML(bookSel), 'book'); }
    else if (k === 'ctab') { openCounter(b.dataset.t); playSfx('tap'); }
    else if (k === 'fth') { furnTheme(b.dataset.t); playSfx('tap'); showFurn(); }
    else if (k === 'fgr') { furnGrade(+b.dataset.g); playSfx('tap'); showFurn(); }
    else if (k === 'fbuy') { furnToggle(b.dataset.c, b.dataset.k); playSfx('tap'); showFurn(); }
    else if (k === 'fset') { furnSetToCart(); playSfx('tap'); showFurn(); }
    else if (k === 'freset') { furnCartReset(); playSfx('tap'); showFurn(); }
    else if (k === 'fcart') { if (runCmd('furnBuyCart', { cart: furnCart() })) { furnCartReset(); showFurn(); } }
    else if (k === 'fbuild') runCmd('shopBuild');
    else if (k === 'eqUp') runCmd('equipUp', { id: b.dataset.id });
    else if (k === 'toolUp') runCmd('toolUp', { id: b.dataset.id });
    else if (k === 'join') runCmd('questPay', { id: 'c2_join' });
    else if (k === 'menuUp') runCmd('menuUp', { menu: b.dataset.m });
    else if (k === 'menuDev') runCmd('menuDev', { menu: b.dataset.m });
    else if (k === 'btab') { boardTab(b.dataset.b); playSfx('tap'); sheet(boardHTML(), 'chalk'); }
    else if (k === 'prepD') { const m = b.dataset.m; prepCart[m] = Math.max(0, (prepCart[m] || 0) + +b.dataset.d); playSfx('tap'); sheet(stoveHTML(), 'stove'); }
    else if (k === 'prepMake') { if (runCmd('prepMake', { plan: prepCart })) prepCart = {}; refreshTown(); }
    else if (k === 'plan') { const m = b.dataset.m; plan[m] = Math.max(0, (plan[m] || 0) + +b.dataset.d * PLAN_STEP); playSfx('tap'); sheet(marketHTML(), 'market'); }
    else if (k === 'jungTalk') { if (runCmd('jungTalk') && chatQ) chatQ.after = () => sheet(marketHTML(), 'market'); }
    else if (k === 'buyCart') { if (runCmd('marketBuyCart', { cart, phone: mkPhone })) cart = {}; refreshTown(); }
  });
  onEvent('town', (what, arg) => {
    if (!T) return;
    if (what === 'chat') { showChat(arg); return; }
    if (what === 'market') { T.sheetPlace = 'market'; mkPhone = false; cart = {}; planDefault(); if (chatQ) chatQ.after = () => sheet(marketHTML(), 'market'); else sheet(marketHTML(), 'market'); return; } // 정 사장 인사 뒤에는 시장 창
    if (what === 'furn') { T.sheetPlace = 'flower'; furnCartReset(); if (chatQ) chatQ.after = () => showFurn(); else showFurn(); return; } // 미소 사장님 이야기 뒤에는 가구 창
    if (what === 'guild') { T.sheetPlace = 'laundry'; if (chatQ) chatQ.after = () => sheet(guildHTML(), 'guild'); else sheet(guildHTML(), 'guild'); return; } // 문 회장님 이야기 뒤에 상인회 창
    if (what === 'sales') { T.sheetPlace = 'shop'; sheet(salesHTML(), 'sales'); playSfx('page'); return; }
    if (what === 'pantry') { T.sheetPlace = 'shop'; sheet(pantryHTML(), 'pantry'); playSfx('page'); return; }
    if (what === 'book') { T.sheetPlace = 'shop'; sheet(bookHTML(bookSel), 'book'); playSfx('page'); return; }
    if (what === 'counter') { openCounter('sales'); playSfx('page'); return; }
    if (what === 'recipe') { sheet(boardHTML(), 'chalk'); playSfx('page'); return; }
    if (what === 'dawn') { playSfx('page'); renderBar(); return; } // 4시간을 쓰면 시계가 새벽으로 (할 수 있는 일은 같아요)
    if (what === 'ledger' || what === 'open') { closeSheet(); return; } // ui/feedback.js가 장부(준비 화면)를 열어요
  });
}

// 규칙이 바뀌면 (칸·돈) 위 막대와 열린 창을 다시 그려요
export function refreshTown() {
  if (!townShown()) return;
  renderBar(); renderNav();
  if (chatQ) return;
  const s = $('townSheet');
  if (s.hidden) return;
  if (s.classList.contains('market')) sheet(marketHTML(), 'market');
  else if (s.classList.contains('furn')) showFurn();
  else if (s.classList.contains('chalk')) sheet(boardHTML(), 'chalk');
  else if (s.classList.contains('counter')) openCounter();
  else if (s.classList.contains('phone')) openPhone();
  else if (s.classList.contains('guild')) sheet(guildHTML(), 'guild');
  else if (s.classList.contains('sales')) sheet(salesHTML(), 'sales');
  else if (s.classList.contains('book')) sheet(bookHTML(bookSel), 'book');
  else if (s.classList.contains('pantry')) sheet(pantryHTML(), 'pantry');
  else if (s.classList.contains('stove')) sheet(stoveHTML(), 'stove');
  else if (T.sheetPlace) openPlace(T.sheetPlace);
}
