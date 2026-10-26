// 마을 화면: 밤·새벽 골목 지도를 어느 방향으로든 걸어 다녀요. 바닥을 누르면 그곳까지, 가게·사람을 누르면 문 앞까지 걸어가서 할 일 창을 띄워요.
// 지도는 data/town.js (16px 칸), 그리기는 render/town.js, 규칙은 sim/town.js. 길 찾기는 칸 단위 너비 우선 탐색(상하좌우)
import { G } from '../save/state.js';
import { $, won, josa } from '../engine/util.js';
import { runCmd, onEvent } from '../sim/events.js';
import { MENUS, INGREDIENTS } from '../data/menu.js';
import { CAST } from '../data/story.js';
import { TILE, STATIONS, REGISTER, DOOR, FRONT_Y } from '../data/layout.js';
import { drawShopTo, shopViewSize } from '../render/view.js';
import { findPath } from '../sim/path.js';
import { salesHTML } from './sales.js';
import { SHOP_SPOTS } from '../data/town.js';
import { MAP_W, MAP_H, BUILDINGS, MAP_PROPS, PLACES, ACTS, TOWN_NPC, VACANT_NOTE, NIGHT_SLOTS, HYGIENE_LOW } from '../data/town.js';
import { SPR } from '../art/atlas.js';
import { drawTown } from '../render/town.js';
import { townMode, slotsMax, actNow, placeOpen, marketUnit, townClock, placeName, placeShort, placeActs } from '../sim/town.js';
import { furnOpen } from '../sim/furniture.js';
import { furnHTML, furnTheme, furnGrade, heartsHTML, drawFurnPreview, furnToggle, furnSetToCart, furnCartReset, furnCart } from './furn.js';
import { menuOpen } from '../sim/story.js';
import { invOf, invToday, invServings, openIngs, menusUsing, todayMenus, cartFor } from '../sim/pantry.js';
import { ingNews } from '../sim/market.js';
import { toast } from './feedback.js';
import { boardHTML } from './board.js';
import { bookHTML } from './book.js';
let bookSel = 0; // 손님 수첩에서 고른 사람
import { lineHTML, talking } from './story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';

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
  for (const id in TOWN_NPC) if (TOWN_NPC[id].open === G.town.part) { const [tx, ty] = TOWN_NPC[id].at; m[ty * MAP_W + tx] = 1; }
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
function nearestOpen(tx, ty) {
  const m = walls();
  let best = null, bd = 1e9;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (m[y * MAP_W + x]) continue;
    const d = (x - tx) ** 2 + (y - ty) ** 2;
    if (d < bd) { bd = d; best = [x, y]; }
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

// ── 가게 안 (밤·새벽): 문으로 들어가 사장이 걸어 다녀요. 물건을 누르거나 아래 버튼으로 할 일 (data/town.js SHOP_SPOTS) ──
const IN_WALK = 6; // 걷는 빠르기 (칸/초)
function enterShop() {
  closeSheet();
  T.inside = { me: { x: DOOR.x, y: FRONT_Y - 1, dir: 1, moving: false, path: [] }, then: null };
  playSfx('page');
  renderNav(); layoutTown();
}
function leaveShop() {
  T.inside = null; closeSheet();
  placeMe('shop'); T.me.dir = 3;
  playSfx('page');
  renderNav(); layoutTown();
}
// 물건의 칸 · 서는 칸
function spotTiles(S) {
  if (S.station) return { tiles: STATIONS[S.station].tiles, stand: STATIONS[S.station].stand };
  if (S.register) return { tiles: REGISTER.tiles, stand: REGISTER.stand };
  if (S.door) return { tiles: [[DOOR.x, FRONT_Y]], stand: [[DOOR.x, FRONT_Y - 1]] };
  return { tiles: S.tiles, stand: S.stand };
}
const spotsNow = () => SHOP_SPOTS.filter(S => S.act === 'exit' || S.act === 'counter' || S.act === 'ledger' || S.act === 'recipe' || ACTS[S.act].when === 'any' || ACTS[S.act].when === G.town.part);
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
  if (act === 'counter') { openCounter(); playSfx('page'); return; }
  runCmd('townAct', { place: 'shop', act });
}
function updateInside(dt) {
  const I = T.inside, me = I.me;
  let step = IN_WALK * dt;
  me.moving = false;
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
  if (!T) { T = { me: { char: 0, x: 0, y: 0, dir: 3, path: [] }, cam: { x: 0, y: 0 }, then: null, time: 0, vw: VIEW_W, vh: 240 }; placeMe('shop'); T.part = part; }
  if (T.part !== part) { placeMe(part === 'dawn' ? 'home' : 'shop'); T.part = part; } // 밤은 가게 앞, 새벽은 집 앞에서
  $('town').hidden = false;
  document.body.classList.add('in-town'); // 위 막대(#bar)는 숨겨요 (마을 막대가 대신)
  renderBar(); renderNav();
  layoutTown();
  if (!T.sheet) closeSheet();
}
// 아래: 장소 바로 가기 (누르면 그곳까지 걸어가요). 지금 닫힌 곳은 흐리게
function renderNav() {
  if (T && T.inside) { // 가게 안: 할 일 버튼
    const dawn = G.town.part === 'dawn';
    const B = [['ledger', '오늘의 메뉴'], ['recipe', '메뉴 연구'], ['counter', '계산대'], dawn ? ['setup', '오픈 준비'] : ['clean', '청소'], ...(dawn ? [['open', '가게 열기']] : []), ['exit', '나가기']];
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
  T.vw = VIEW_W; T.vh = Math.max(128, Math.min(MAP_H * TILE, Math.floor(availH / s)));
  cv.style.width = T.vw * s + 'px'; cv.style.height = T.vh * s + 'px';
}

// 위: 밤/새벽 · 시각 · 남은 일 칸 · 피로 · 위생
function renderBar() {
  const Tn = G.town, dawn = Tn.part === 'dawn', max = slotsMax();
  const min = townClock(), hh = Math.floor(min / 60) % 24, mm = min % 60;
  // 칸: 밤 4칸(남색) + 새벽 3칸(노랑) 한 줄 · 쓴 칸은 비우고, 넘긴 칸은 빨강
  const over = Math.max(0, Tn.used - max);
  const dots = Array.from({ length: max }, (_, i) => `<i class="${i < NIGHT_SLOTS ? 'n' : 'd'} ${i < Tn.used ? 'used' : ''}"></i>`).join('') + (over ? `<b class="tb-over">+${over}</b>` : ''); // 넘겨 쓴 칸은 숫자로
  $('townBar').innerHTML = `<span class="tb-time ${dawn ? 'dawn' : 'night'}">${dawn ? '새벽' : '밤'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>
    <span class="tb-slots" title="할 수 있는 일">${dots}</span>
    ${Tn.fatigue ? `<span class="tb-tag warn">피로 ${Tn.fatigue}</span>` : ''}
    <span class="tb-tag ${Tn.hygiene < HYGIENE_LOW ? 'warn' : ''}">위생 ${Tn.hygiene}</span>`;
}

// 할 일이 있는 곳 「!」: 새벽 시장(아직 안 감) · 새벽 가게(열기) · 밤 할 일을 다 했으면 집
function townMarks() {
  const Tn = G.town, out = [];
  const top = id => { const [tx, ty] = PLACES[id].door; return { x: tileX(tx), y: ty * TILE - 40 }; };
  if (Tn.part === 'dawn') { if (!Tn.marketIn) out.push(top('market')); out.push(top('shop')); }
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
  // 부딪힌 곳: 이웃이면 그 가게 · 문 앞에서 위로 밀면 그 가게 (같은 칸에서는 한 번만)
  const [tx, ty] = meTile();
  const key = tx + ',' + ty;
  if (T.bumped && T.bumped !== key) T.bumped = null;
  if ((!hitX && !hitY) || T.bumped || T.sheet) return;
  const bx = tx + (Math.abs(vx) >= Math.abs(vy) ? hitX : 0), by = ty + (Math.abs(vy) > Math.abs(vx) ? hitY : 0);
  const npc = Object.keys(TOWN_NPC).find(id => TOWN_NPC[id].open === G.town.part && TOWN_NPC[id].at[0] === bx && TOWN_NPC[id].at[1] === by);
  let place = npc ? Object.keys(PLACES).find(id => PLACES[id].who === npc) : null;
  if (!place && hitUp) place = Object.keys(PLACES).find(id => PLACES[id].door[0] === tx && PLACES[id].door[1] === ty);
  if (place) { T.bumped = key; me.moving = false; facePlace(place); openPlace(place); playSfx('tap'); return; }
  if (hitUp && vacantB && ty * TILE === vacantB[2] && tx * TILE >= vacantB[1] && tx * TILE < vacantB[1] + SPR.tw_vacant[2]) { T.bumped = key; me.moving = false; showVacant(); }
}

export function updateTown(dt) {
  if (!townShown()) return;
  T.time += dt;
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
  const dawn = G.town.part === 'dawn';
  const actors = [me];
  for (const id in TOWN_NPC) { const n = TOWN_NPC[id]; if (n.open === G.town.part) actors.push({ char: CAST[id].char, x: tileX(n.at[0]), y: tileY(n.at[1]), dir: 3 }); }
  drawTown($('townCv'), { cam: T.cam, vw: T.vw, vh: T.vh, actors, time: T.time, night: !dawn, dawn, marks: townMarks(), swap: furnOpen() ? { sign_flower: 'sign_furn' } : null });
}

function showVacant() { sheet(`<div class="ts-head"><b>빈 가게</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${VACANT_NOTE}</p>`); }

// 누른 곳: 이웃 → 그 가게 · 건물(문 앞) → 할 일 · 빈 가게 → 안내 · 나머지는 그 칸까지 걸어요
const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
function tapTown(e) {
  if (talking()) return;
  if (T.inside) { tapInside(e); return; }
  const r = $('townCv').getBoundingClientRect();
  const wx = T.cam.x + (e.clientX - r.left) / r.width * T.vw, wy = T.cam.y + (e.clientY - r.top) / r.height * T.vh;
  closeSheet();
  playSfx('tap');
  const npc = Object.keys(TOWN_NPC).find(id => { const n = TOWN_NPC[id]; return n.open === G.town.part && inRect(wx, wy, [tileX(n.at[0]) - 8, tileY(n.at[1]) - 30, 16, 32]); });
  const place = npc ? Object.keys(PLACES).find(id => PLACES[id].who === npc) : Object.keys(PLACES).find(id => inRect(wx, wy, PLACES[id].rect));
  if (place) { goPlace(place); return; }
  if (vacantB && inRect(wx, wy, [vacantB[1], vacantB[2] - SPR.tw_vacant[3], SPR.tw_vacant[2], SPR.tw_vacant[3]])) {
    walkTo(nearestOpen(Math.floor((vacantB[1] + 24) / TILE), Math.floor(vacantB[2] / TILE)), () => { T.me.dir = 1; showVacant(); });
    return;
  }
  const to = nearestOpen(Math.floor(wx / TILE), Math.floor(wy / TILE));
  if (to) walkTo(to);
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
  const acts = placeActs(id).filter(a => (ACTS[a].when === 'any' || ACTS[a].when === Tn.part) && !COUNTER_ACTS.includes(a)); // 홍보는 계산대 창에서
  const rows = acts.map(a => actRow(id, a)).join('');
  const who = P.who && ['miso', 'jung'].includes(P.who) ? heartsHTML(P.who) : ''; // 친밀도 하트 (sim/bond.js)
  sheet(`<div class="ts-head"><b>${id === 'shop' ? G.shop : placeName(id)}</b>${who}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>${rows || `<p class="ts-note">${id === 'board' ? '동네 소식과 행사 안내가 붙어 있습니다' : '지금 할 일이 없습니다'}</p>`}`);
  T.sheetPlace = id;
}
// 우리 가게 계산대 · 홍보: 인스타 올리기 · 파워블로거 섭외
const COUNTER_ACTS = ['insta', 'blogger'];
function openCounter() { // 계산대: 판매 장부 · 손님 수첩 · 홍보(밤)
  const promo = COUNTER_ACTS.filter(a => ACTS[a].when === G.town.part).map(a => actRow('shop', a)).join('');
  sheet(`<div class="ts-head"><b>계산대</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>${actRow('shop', 'sales')}${actRow('shop', 'book')}
    <small class="mk-h">홍보</small>${promo || '<p class="ts-note">홍보는 밤에 할 수 있습니다</p>'}`, 'counter');
  T.sheetPlace = 'shop';
}
function actRow(id, a) {
  const Tn = G.town;
  {
    const A = ACTS[a], ok = actNow(id, a);
    const cost = A.cost ? `${A.cost}칸` : '';
    const sub = a === 'clean' ? (Tn.hygiene >= 100 ? '이미 깨끗합니다' : `위생 ${Tn.hygiene} → ${Math.min(100, Tn.hygiene + 60)}`) : a === 'talk' ? (ok ? '내일 소개 손님이 옵니다' : '오늘은 이미 이야기했습니다')
      : a === 'setup' ? (ok ? '오늘 11시까지 손이 빠릅니다' : '이미 준비했습니다') : a === 'market' ? (Tn.marketIn ? '다시 들어가기' : '처음 들어갈 때 한 칸')
      : a === 'insta' ? (ok ? '내일 학생 손님이 더 들어옵니다' : '오늘 밤은 이미 올렸습니다') : a === 'blogger' ? (ok ? `${won(A.money)} · 내일 블로거가 옵니다. 맛있으면 사흘 동안 직장인·어르신이 더, 아니면 덜` : '내일 블로거가 옵니다')
      : a === 'furn' ? (Tn.furnIn ? '다시 들어가기' : '미소 사장님과 이야기 · 가구 보기 (내일 소개 손님)')
      : a === 'book' ? '가게에 온 손님들' : a === 'sales' ? '날마다 매출 · 남은 돈 · 손님' : a === 'counter' ? '인스타 올리기 · 파워블로거 섭외' : a === 'sleep' ? (Tn.used < NIGHT_SLOTS ? `남은 밤 ${NIGHT_SLOTS - Tn.used}칸만큼 쉬고 새벽 5시에 일어납니다` : '새벽 5시에 일어납니다') : a === 'open' ? '가격 확인하고 문 열기' : a === 'ledger' ? '가격 · 장사 도구 · 할 일' : a === 'recipe' ? '숙련도와 돈으로 메뉴 레벨 올리기' : '';
    return `<button type="button" class="ts-act" data-ts="act" data-a="${a}" ${ok ? '' : 'disabled'}><b>${actLabel(id, a)}</b><small>${sub}</small>${cost && !(a === 'market' && Tn.marketIn) && !(a === 'furn' && Tn.furnIn) ? `<i>${cost}</i>` : ''}</button>`;
  }
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
let cart = {}, plan = {};
const PLAN_STEP = 5;
function planDefault() {
  const last = G.history[G.history.length - 1];
  plan = {};
  for (const m of todayMenus()) plan[m] = Math.max(PLAN_STEP, Math.ceil(((last && last.sold[m]) || 10) / PLAN_STEP) * PLAN_STEP + PLAN_STEP);
}
// 진열대 타일 (화면 정리): 누를 때마다 한 묶음 담기 · 담은 타일에 +수량과 − · 내일 모자랄 재료는 빨간 점 · 특가·시세는 구석에
function ingTile(i, lack) {
  const I = INGREDIENTS[i], unit = marketUnit(i), k = cart[i] || 0, news = ingNews(i);
  const inv = invOf(i), today = invToday(i), short = (lack[i] || 0) > k;
  const tag = G.town.deal === i ? '<i class="mk-tag deal">특가</i>' : news ? `<i class="mk-tag ${news.mul > 1 ? 'up' : 'down'}">${news.mul > 1 ? '▲' : '▼'}</i>` : '';
  return `<div class="mk-tile${k ? ' in' : ''}" data-ts="cart" data-i="${i}" data-d="1" role="button" aria-label="${I.name} 한 묶음 담기">
    ${short ? '<i class="mk-dot"></i>' : ''}${tag}${icon('ing_' + i, 'mk-ic')}
    <b>${I.name}</b><small>${won(unit * I.pack)}</small>
    <div class="mk-row">${k ? `<span class="mk-n">+${k * I.pack}</span><button type="button" class="mk-minus" data-ts="cart" data-i="${i}" data-d="-1" aria-label="${I.name} 빼기">−</button>`
      : today ? `<small class="mk-inv today">오늘까지 ${today}</small>` : inv ? `<small class="mk-inv">재고 ${inv}</small>` : ''}</div>
  </div>`;
}
function marketHTML() {
  const ings = openIngs(), lack = cartFor(plan);
  const total = ings.reduce((s, i) => s + marketUnit(i) * (cart[i] || 0) * INGREDIENTS[i].pack, 0);
  const short = total > G.cash;
  return `<div class="ts-head"><b>정 사장 식자재</b>${heartsHTML('jung')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <small class="mk-h">오늘 팔 양</small>
    <div class="mk-plan">${todayMenus().map(m => `<div class="mk-prow">${icon(m, 'dish')}<span>${MENUS[m].name}<small>재고로 ${invServings(m)}그릇</small></span><div class="step"><button type="button" data-ts="plan" data-m="${m}" data-d="-1" aria-label="${MENUS[m].name} 덜 팔기">−</button><b>${plan[m] || 0}그릇</b><button type="button" data-ts="plan" data-m="${m}" data-d="1" aria-label="${MENUS[m].name} 더 팔기">+</button></div></div>`).join('')}</div>
    <button type="button" class="btn small mk-fill" data-ts="fill">모자란 재료 담기 <small>빨간 점이 모자란 재료</small></button>
    <small class="mk-h">진열대 <i>누르면 한 묶음</i></small>
    <div class="mk-shelf">${ings.map(i => ingTile(i, lack)).join('')}</div>
    <div class="mk-foot"><div class="mk-sum"><span>합계 <b>${won(total)}</b></span><span class="${short ? 'neg' : ''}">잔고 ${won(G.cash)}</span></div>
    <button type="button" class="btn primary big mk-buy" data-ts="buyCart" ${total && !short ? '' : 'disabled'}>${short ? '잔고가 모자랍니다' : total ? `구매하기 · ${won(total)}` : '재료를 눌러 담아 보세요'}</button></div>`;
}

export function initTown() {
  // 누르기·끌기 (조이스틱)
  const cv = $('townCv'), joyEl = $('townJoy');
  cv.addEventListener('pointerdown', e => {
    if (!T || talking()) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    T.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, on: false, ev: e };
  });
  cv.addEventListener('pointermove', e => {
    const j = T && T.joy;
    if (!j || j.id !== e.pointerId) return;
    let dx = e.clientX - j.sx, dy = e.clientY - j.sy;
    if (!j.on && (Math.hypot(dx, dy) < JOY_START || T.inside)) return; // 가게 안은 누르기만
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
  addEventListener('keydown', e => { if (townShown() && !(T && T.inside) && KEY[e.code] && !e.target.closest('input')) { keys.add(KEY[e.code]); e.preventDefault(); } });
  addEventListener('keyup', e => { if (KEY[e.code]) { keys.delete(KEY[e.code]); if (T && !keys.size) T.bumped = null; } });
  addEventListener('blur', () => keys.clear());
  $('townNav').addEventListener('click', e => {
    if (talking()) return;
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
    if (k === 'close') { closeSheet(); playSfx('tap'); }
    else if (k === 'act') runCmd('townAct', { place: T.sheetPlace, act: b.dataset.a });
    else if (k === 'cart') { const i = b.dataset.i; cart[i] = Math.max(0, (cart[i] || 0) + +b.dataset.d); playSfx('tap'); sheet(marketHTML(), 'market'); }
    else if (k === 'fill') { cart = cartFor(plan); playSfx(Object.keys(cart).length ? 'page' : 'tap'); if (!Object.keys(cart).length) toast('재료가 넉넉합니다. 더 살 것이 없습니다', 'info'); sheet(marketHTML(), 'market'); }
    else if (k === 'who') { bookSel = +b.dataset.c; playSfx('tap'); sheet(bookHTML(bookSel), 'book'); }
    else if (k === 'fth') { furnTheme(b.dataset.t); playSfx('tap'); showFurn(); }
    else if (k === 'fgr') { furnGrade(+b.dataset.g); playSfx('tap'); showFurn(); }
    else if (k === 'fbuy') { furnToggle(b.dataset.c, b.dataset.k); playSfx('tap'); showFurn(); }
    else if (k === 'fset') { furnSetToCart(); playSfx('tap'); showFurn(); }
    else if (k === 'freset') { furnCartReset(); playSfx('tap'); showFurn(); }
    else if (k === 'fcart') { if (runCmd('furnBuyCart', { cart: furnCart() })) { furnCartReset(); showFurn(); } }
    else if (k === 'fbuild') runCmd('shopBuild');
    else if (k === 'menuUp') runCmd('menuUp', { menu: b.dataset.m });
    else if (k === 'plan') { const m = b.dataset.m; plan[m] = Math.max(0, (plan[m] || 0) + +b.dataset.d * PLAN_STEP); playSfx('tap'); sheet(marketHTML(), 'market'); }
    else if (k === 'buyCart') { if (runCmd('marketBuyCart', { cart })) cart = {}; refreshTown(); }
  });
  onEvent('town', (what, arg) => {
    if (!T) return;
    if (what === 'chat') { showChat(arg); return; }
    if (what === 'market') { T.sheetPlace = 'market'; cart = {}; planDefault(); if (chatQ) chatQ.after = () => sheet(marketHTML(), 'market'); else sheet(marketHTML(), 'market'); return; } // 정 사장 인사 뒤에는 시장 창
    if (what === 'furn') { T.sheetPlace = 'flower'; furnCartReset(); if (chatQ) chatQ.after = () => showFurn(); else showFurn(); return; } // 미소 사장님 이야기 뒤에는 가구 창
    if (what === 'sales') { T.sheetPlace = 'shop'; sheet(salesHTML(), 'sales'); playSfx('page'); return; }
    if (what === 'book') { T.sheetPlace = 'shop'; sheet(bookHTML(bookSel), 'book'); playSfx('page'); return; }
    if (what === 'counter') { openCounter(); playSfx('page'); return; }
    if (what === 'recipe') { sheet(boardHTML(), 'chalk'); playSfx('page'); return; }
    if (what === 'dawn') { T.part = 'dawn'; playSfx('page'); if (arg === 'sleep') { closeSheet(); placeMe('home'); } } // 밤 칸을 다 쓰면 그 자리에서 새벽
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
  else if (s.classList.contains('sales')) sheet(salesHTML(), 'sales');
  else if (s.classList.contains('book')) sheet(bookHTML(bookSel), 'book');
  else if (T.sheetPlace) openPlace(T.sheetPlace);
}
