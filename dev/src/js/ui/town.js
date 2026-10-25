// 마을 화면: 밤·새벽 골목을 걸어 다녀요. 바닥을 누르면 걷고, 가게·사람을 누르면 걸어가서 할 일 창을 띄워요.
// 그림은 render/cut.js(연출과 같은 골목 그리기)를 넓은 골목(data/town.js TOWN_WORLD)으로 써요. 규칙은 sim/town.js
import { G } from '../save/state.js';
import { $, won, josa } from '../engine/util.js';
import { runCmd, onEvent } from '../sim/events.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { CAST } from '../data/story.js';
import { TOWN_W, TOWN_Y, TOWN_WORLD, TOWN_PROPS, PLACES, PLACE_ACTS, ACTS, TOWN_NPC, NIGHT_START, DAWN_START, HYGIENE_LOW, MARKET_PACK, MARKET_DEAL } from '../data/town.js';
import { drawCutOn, fitCanvas, CUT_W, CUT_H } from '../render/cut.js';
import { townMode, slotsMax, actNow, placeOpen, marketUnit } from '../sim/town.js';
import { menuOpen } from '../sim/story.js';
import { invCount } from '../sim/day.js';
import { lineHTML, talking } from './story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';

const WALK = 56; // 걷는 빠르기 (골목 픽셀/초)
let T = null;    // 보이는 동안의 골목 { me, cam, target, goPlace, time, sheet }
let tScale = 3;

export const townShown = () => !!T && !$('town').hidden;
export const townView = () => T; // 시험용 (main.js __T)

export function showTown() {
  if (!townMode()) return;
  const night = G.town.part !== 'dawn';
  if (!T) T = { me: { char: 0, x: PLACES.shop.x, y: TOWN_Y, dir: 3, pose: 'idle' }, cam: { x: 0, y: 14 }, target: null, goPlace: null, time: 0 };
  T.night = night;
  $('town').hidden = false;
  layoutTown();
  renderBar(); renderNav();
  if (!T.sheet) closeSheet();
}
// 아래: 장소 바로 가기 (누르면 그곳까지 걸어가요). 지금 닫힌 곳은 흐리게
function renderNav() {
  $('townNav').innerHTML = Object.keys(PLACES).map(id => `<button type="button" data-go="${id}" class="${placeOpen(id) ? '' : 'off'}">${PLACES[id].short}</button>`).join('');
}
export function hideTown() { if ($('town')) $('town').hidden = true; closeSheet(); }

function layoutTown() {
  const el = $('town'); if (el.hidden) return;
  tScale = fitCanvas($('townCv'), el.clientWidth, el.clientHeight - 96);
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
  const top = id => ({ x: PLACES[id].x - 1, y: 24 });
  if (Tn.part === 'dawn') { if (!Tn.marketIn) out.push(top('market')); out.push(top('shop')); }
  else if (Tn.used >= slotsMax()) out.push(top('home'));
  return out;
}

export function updateTown(dt) {
  if (!townShown()) return;
  T.time += dt;
  const me = T.me;
  if (T.target !== null && !talking()) {
    const d = T.target - me.x, step = WALK * dt;
    if (Math.abs(d) <= step) { me.x = T.target; T.target = null; me.moving = false; me.dir = 3; if (T.goPlace) { const p = T.goPlace; T.goPlace = null; openPlace(p); } }
    else { me.x += Math.sign(d) * step; me.moving = true; me.dir = d > 0 ? 0 : 2; }
  }
  T.cam.x = Math.max(0, Math.min(TOWN_W - CUT_W, me.x - CUT_W / 2));
  const dawn = G.town.part === 'dawn';
  const actors = { me };
  for (const id in TOWN_NPC) { const n = TOWN_NPC[id]; if (n.open === G.town.part) actors[id] = { char: CAST[id].char, x: n.x, y: TOWN_Y - 4, dir: 3, pose: 'idle' }; }
  drawCutOn($('townCv'), { cam: T.cam, actors, props: TOWN_PROPS, emotes: {}, time: T.time, night: !dawn, dawn, door: false, fade: 0, world: TOWN_WORLD, marks: townMarks() });
}

// 누른 곳: 건물이면 그 장소로, 아니면 그 자리까지 걸어요
function tapTown(e) {
  if (talking()) return;
  const r = $('townCv').getBoundingClientRect();
  const wx = T.cam.x + (e.clientX - r.left) / r.width * CUT_W, wy = T.cam.y + (e.clientY - r.top) / r.height * CUT_H;
  if (wx < 0 || wx > TOWN_W) return;
  closeSheet();
  const place = wy < 150 ? Object.keys(PLACES).find(id => wx >= PLACES[id].from && wx <= PLACES[id].to) : null;
  const npc = Object.keys(TOWN_NPC).find(id => TOWN_NPC[id].open === G.town.part && Math.abs(wx - TOWN_NPC[id].x) < 8 && wy > 130 && wy < 170);
  const go = npc ? Object.keys(PLACES).find(id => PLACES[id].who === npc) : place;
  T.goPlace = go || null;
  T.target = Math.max(8, Math.min(TOWN_W - 8, go ? PLACES[go].x : wx));
  playSfx('tap');
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
  $('townNav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b || talking()) return; closeSheet(); T.goPlace = b.dataset.go; T.target = PLACES[b.dataset.go].x; playSfx('tap'); });
  addEventListener('resize', layoutTown);
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
    if (what === 'dawn') { closeSheet(); T.me.x = PLACES.home.x; T.target = null; playSfx('page'); }
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
