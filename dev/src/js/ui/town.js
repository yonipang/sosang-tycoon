// 마을 화면: 밤·새벽 골목 지도를 어느 방향으로든 걸어 다녀요. 바닥을 누르면 그곳까지, 가게·사람을 누르면 문 앞까지 걸어가서 할 일 창을 띄워요.
// 지도는 data/town.js (16px 칸), 그리기는 render/town.js, 규칙은 sim/town.js. 길 찾기는 칸 단위 너비 우선 탐색(상하좌우)
import { G } from '../save/state.js';
import { $, won, josa } from '../engine/util.js';
import { runCmd, onEvent } from '../sim/events.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { CAST } from '../data/story.js';
import { TILE } from '../data/layout.js';
import { MAP_W, MAP_H, BUILDINGS, MAP_PROPS, PLACES, PLACE_ACTS, ACTS, TOWN_NPC, VACANT_NOTE, NIGHT_START, DAWN_START, HYGIENE_LOW, MARKET_PACK, MARKET_DEAL } from '../data/town.js';
import { SPR } from '../art/atlas.js';
import { drawTown } from '../render/town.js';
import { townMode, slotsMax, actNow, placeOpen, marketUnit } from '../sim/town.js';
import { menuOpen } from '../sim/story.js';
import { invCount } from '../sim/day.js';
import { lineHTML, talking } from './story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';

const WALK = 60;     // 걷는 빠르기 (지도 픽셀/초)
const VIEW_W = 144;  // 화면에 보이는 지도 너비 (9칸). 높이는 화면에 맞춰요
let T = null;        // 보이는 동안의 골목 { me, cam, path, goPlace, time, sheet, vw, vh }

export const townShown = () => !!T && !$('town').hidden;
export const townView = () => T; // 시험용 (main.js __T)

// 칸 ↔ 픽셀 (사람은 칸 가운데, 발끝은 칸 아래쪽)
const tileX = tx => tx * TILE + TILE / 2;
const tileY = ty => ty * TILE + TILE - 3;
const vacantB = BUILDINGS.find(b => b[0] === 'st_vacant');

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
  const ok = walkTo(PLACES[id].door, () => { facePlace(id); openPlace(id); });
  if (!ok) openPlace(id);
}

function placeMe(id) {
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
  $('townNav').innerHTML = Object.keys(PLACES).map(id => `<button type="button" data-go="${id}" class="${placeOpen(id) ? '' : 'off'}">${PLACES[id].short}</button>`).join('');
}
export function hideTown() { if ($('town')) $('town').hidden = true; closeSheet(); }

// 캔버스: 너비 9칸, 높이는 남는 자리만큼 (그림 1픽셀 = 기기 픽셀 정수 개)
function layoutTown() {
  const el = $('town'); if (!el || el.hidden || !T) return;
  const cv = $('townCv'), dpr = window.devicePixelRatio || 1;
  const availH = el.clientHeight - $('townBar').offsetHeight - $('townNav').offsetHeight - 8;
  const s = Math.max(1, Math.floor(el.clientWidth / VIEW_W * dpr)) / dpr;
  T.vw = VIEW_W; T.vh = Math.max(128, Math.min(MAP_H * TILE, Math.floor(availH / s)));
  cv.style.width = T.vw * s + 'px'; cv.style.height = T.vh * s + 'px';
}

// 위: 밤/새벽 · 시각 · 남은 일 칸 · 피로 · 위생
function renderBar() {
  const Tn = G.town, dawn = Tn.part === 'dawn', max = slotsMax();
  const min = (dawn ? DAWN_START : NIGHT_START) + Tn.used * 60, hh = Math.floor(min / 60) % 24, mm = min % 60;
  const dots = Array.from({ length: Math.max(max, Tn.used) }, (_, i) => `<i class="${i < Tn.used ? (i >= max ? 'over' : 'used') : ''}"></i>`).join('');
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
  else if (Tn.used >= slotsMax()) out.push(top('home'));
  return out;
}

export function updateTown(dt) {
  if (!townShown()) return;
  T.time += dt;
  const me = T.me;
  if (me.path.length && !talking()) {
    let step = WALK * dt;
    while (step > 0 && me.path.length) {
      const [tx, ty] = me.path[0], gx = tileX(tx), gy = tileY(ty), dx = gx - me.x, dy = gy - me.y, d = Math.abs(dx) + Math.abs(dy);
      if (d <= step) { me.x = gx; me.y = gy; step -= d; me.path.shift(); if (!me.path.length) arrive(); continue; }
      if (Math.abs(dx) > 0.01) { me.x += Math.sign(dx) * step; me.dir = dx > 0 ? 0 : 2; } else { me.y += Math.sign(dy) * step; me.dir = dy > 0 ? 3 : 1; }
      me.moving = true; step = 0;
    }
  }
  T.cam.x = Math.max(0, Math.min(MAP_W * TILE - T.vw, me.x - T.vw / 2));
  T.cam.y = Math.max(0, Math.min(MAP_H * TILE - T.vh, me.y - 16 - T.vh / 2));
  const dawn = G.town.part === 'dawn';
  const actors = [me];
  for (const id in TOWN_NPC) { const n = TOWN_NPC[id]; if (n.open === G.town.part) actors.push({ char: CAST[id].char, x: tileX(n.at[0]), y: tileY(n.at[1]), dir: 3 }); }
  drawTown($('townCv'), { cam: T.cam, vw: T.vw, vh: T.vh, actors, time: T.time, night: !dawn, dawn, marks: townMarks() });
}

// 누른 곳: 이웃 → 그 가게 · 건물(문 앞) → 할 일 · 빈 가게 → 안내 · 나머지는 그 칸까지 걸어요
const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
function tapTown(e) {
  if (talking()) return;
  const r = $('townCv').getBoundingClientRect();
  const wx = T.cam.x + (e.clientX - r.left) / r.width * T.vw, wy = T.cam.y + (e.clientY - r.top) / r.height * T.vh;
  closeSheet();
  playSfx('tap');
  const npc = Object.keys(TOWN_NPC).find(id => { const n = TOWN_NPC[id]; return n.open === G.town.part && inRect(wx, wy, [tileX(n.at[0]) - 8, tileY(n.at[1]) - 30, 16, 32]); });
  const place = npc ? Object.keys(PLACES).find(id => PLACES[id].who === npc) : Object.keys(PLACES).find(id => inRect(wx, wy, PLACES[id].rect));
  if (place) { goPlace(place); return; }
  if (vacantB && inRect(wx, wy, [vacantB[1], vacantB[2] - SPR.st_vacant[3], SPR.st_vacant[2], SPR.st_vacant[3]])) {
    walkTo(nearestOpen(Math.floor((vacantB[1] + 24) / TILE), Math.floor(vacantB[2] / TILE)), () => { T.me.dir = 1; sheet(`<div class="ts-head"><b>빈 가게</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${VACANT_NOTE}</p>`); });
    return;
  }
  const to = nearestOpen(Math.floor(wx / TILE), Math.floor(wy / TILE));
  if (to) walkTo(to);
}

// ── 아래 창: 장소의 할 일 · 이웃 이야기 · 시장 ──
function sheet(html, cls) {
  const s = $('townSheet');
  s.className = 'town-sheet ' + (cls || '');
  s.innerHTML = html; s.hidden = false;
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
    sheet(`<div class="ts-head"><b>${P.name}</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div><p class="ts-note">${P.open === 'dawn' ? '새벽에 문을 엽니다' : '지금은 문을 닫았습니다'}</p>`);
    return;
  }
  const acts = PLACE_ACTS[id].filter(a => ACTS[a].when === 'any' || ACTS[a].when === Tn.part);
  const rows = acts.map(a => {
    const A = ACTS[a], ok = actNow(id, a);
    const cost = A.cost ? `${A.cost}칸` : '';
    const sub = a === 'clean' ? `위생 ${Tn.hygiene} → ${Math.min(100, Tn.hygiene + 60)}` : a === 'talk' ? (ok ? '내일 소개 손님이 옵니다' : '오늘은 이미 이야기했습니다')
      : a === 'flyer' ? `${won(A.money)} · 내일 손님 조금 더` : a === 'setup' ? '오늘 11시까지 손이 빠릅니다' : a === 'market' ? (Tn.marketIn ? '다시 들어가기' : '처음 들어갈 때 한 칸')
      : a === 'sleep' ? (Tn.used < slotsMax() ? '일을 남기고 자면 피로가 풀립니다' : '새벽 5시에 일어납니다') : a === 'open' ? '가격 확인하고 문 열기' : a === 'ledger' ? '가격 · 장사 도구 · 할 일' : '';
    return `<button type="button" class="ts-act" data-ts="act" data-a="${a}" ${ok ? '' : 'disabled'}><b>${actLabel(id, a)}</b><small>${sub}</small>${cost ? `<i>${(a === 'market' && Tn.marketIn) ? '' : cost}</i>` : ''}</button>`;
  }).join('');
  sheet(`<div class="ts-head"><b>${id === 'shop' ? G.shop : P.name}</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>${rows || '<p class="ts-note">지금 할 일이 없습니다</p>'}`);
  T.sheetPlace = id;
}

let chatQ = null; // 이웃 이야기 줄들
function showChat(lines) {
  chatQ = { lines, i: 0 };
  drawChat();
}
function drawChat() {
  const [who, text] = chatQ.lines[chatQ.i];
  sheet(`<div class="ts-chat">${lineHTML(who, text)}</div>`, 'chat');
}

// 시장: 메뉴마다 5인분씩 사고 무르기 (오늘 산 것만)
function marketHTML() {
  const Tn = G.town, last = G.history[G.history.length - 1];
  const rows = MENU_IDS.filter(m => menuOpen(m)).map(m => {
    const unit = marketUnit(m), deal = Tn.deal === m, bought = Tn.bought[m] || 0;
    return `<div class="mk-row">${icon(m)}<div class="mk-txt"><b>${MENUS[m].ing}${deal ? ' <span class="tag hot">오늘 특가</span>' : ''}</b>
      <small>${MARKET_PACK}인분 ${won(unit * MARKET_PACK)}${deal ? ` (${Math.round((1 - MARKET_DEAL) * 100)}% 싸게)` : ''} · 재고 ${invCount(m)}${last ? ` · 어제 ${last.sold[m] || 0}그릇` : ''}</small></div>
      <div class="step"><button type="button" data-ts="buy" data-m="${m}" data-d="-1" ${bought ? '' : 'disabled'} aria-label="${MENUS[m].ing} 무르기">−</button><b>${bought}</b><button type="button" data-ts="buy" data-m="${m}" data-d="1" aria-label="${MENUS[m].ing} 사기">+</button></div></div>`;
  }).join('');
  return `<div class="ts-head"><b>정 사장 식자재</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <p class="ts-note">5인분씩 삽니다. 먼저 산 재료부터 쓰고, 유통기한이 지나면 버립니다.</p>${rows}
    <div class="mk-sum"><span>잔고</span><b>${won(G.cash)}</b></div>`;
}

export function initTown() {
  $('townCv').addEventListener('click', tapTown);
  $('townNav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b || talking()) return; closeSheet(); goPlace(b.dataset.go); playSfx('tap'); });
  addEventListener('resize', layoutTown);
  if (window.ResizeObserver) new ResizeObserver(layoutTown).observe($('town'));
  $('townSheet').addEventListener('click', e => {
    if (chatQ) { chatQ.i++; playSfx('tap'); if (chatQ.i >= chatQ.lines.length) { const after = chatQ.after; chatQ = null; closeSheet(); if (after) after(); } else drawChat(); return; }
    const b = e.target.closest('[data-ts]');
    if (!b) return;
    const k = b.dataset.ts;
    if (k === 'close') { closeSheet(); playSfx('tap'); }
    else if (k === 'act') runCmd('townAct', { place: T.sheetPlace, act: b.dataset.a });
    else if (k === 'buy') runCmd('marketBuy', { menu: b.dataset.m, packs: +b.dataset.d });
  });
  onEvent('town', (what, arg) => {
    if (!T) return;
    if (what === 'chat') { showChat(arg); return; }
    if (what === 'market') { T.sheetPlace = 'market'; if (chatQ) chatQ.after = () => sheet(marketHTML(), 'market'); else sheet(marketHTML(), 'market'); return; } // 정 사장 인사 뒤에는 시장 창
    if (what === 'dawn') { closeSheet(); placeMe('home'); T.part = 'dawn'; playSfx('page'); }
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
  else if (T.sheetPlace) openPlace(T.sheetPlace);
}
