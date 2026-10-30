// 영업 중 화면 위아래 막대: 날짜·시계·잔고·별점 / 주문표 / 손에 든 것·남은 재료·속도
import { G } from '../save/state.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { handsMax, cookRule } from '../sim/tools.js';
import { RUSH_QTY } from '../data/economy.js';
import { rushCost } from '../sim/day.js';
import { runCmd } from '../sim/events.js';
import { WEEKDAYS } from '../data/economy.js';
import { $, clockText, won, wonShort } from '../engine/util.js';
import { icon } from './icons.js';
import { menuOpen } from '../sim/story.js';
import { stockOf, shortIng, todayMenus } from '../sim/pantry.js';
import { INGREDIENTS } from '../data/menu.js';
import { townMode } from '../sim/town.js';

const last = {};
function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
function setHTML(id, v) { if (last['h' + id] !== v) { last['h' + id] = v; $(id).innerHTML = v; } }

export const dayLabel = d => `${d}일차 · ${WEEKDAYS[(d - 1) % 7]}요일`;

export function updateHud() {
  setText('hDay', dayLabel(Math.max(1, (G.day || 1) - (G.phase === 'prep' && townMode() ? 1 : 0)))); // 하루는 가게를 열 때 넘어가요 (v0.93 사용자 요청): 장사 뒤 밤·새벽은 그날 그대로
  setText('hCash', wonShort(G.cash || 0));
  const alba = !!G.story && G.story.ch === 0; // 프롤로그: 아직 알바라 가게 돈은 오 사장님 것
  if (last.alba !== alba) { last.alba = alba; $('hCash').parentElement.hidden = alba; }
  setText('hStar', G.rating == null ? '—' : G.rating.toFixed(1)); // 리뷰가 없으면 「—」 (sim/rating.js)
  const r = G.run;
  if (!r) return;
  setText('hClock', r.dawn ? '06:00' : clockText(Math.min(r.min, 720)));
  // 주문표: 들어온 순서대로 (손에 이미 든 몫은 흐리게)
  const handLeft = {};
  for (const d of r.hands) handLeft[d.menu] = (handLeft[d.menu] || 0) + 1;
  // 주문표 칸에 들어가는 만큼만 (넘치면 마지막 칸이 +몇)
  const fit = Math.max(2, Math.floor(($('tickets').clientWidth + 4) / 48));
  const show = r.tickets.length > fit ? fit - 1 : fit;
  const tk = r.tickets.slice(0, show).map(t => {
    const c = r.customers.find(q => q.id === t.cid);
    const f = c ? c.patience / c.patMax : 1;
    const ready = handLeft[t.menu] > 0 && (handLeft[t.menu]--, true);
    const ev = t.takeout || (c && c.tag && c.tag.state === 'on'); // 돌발 이벤트 주문은 빨간 표
    return `<div class="tk${ready ? ' ready' : ''}${f < 0.25 ? ' late' : ''}${ev ? ' ev' : ''}">${icon(t.menu)}<b>${t.table ? t.table + '번' : '포장'}</b><i style="width:${Math.round(f * 10) * 10}%"></i></div>`;
  }).join('') + (r.tickets.length > show ? `<div class="tk more">+${r.tickets.length - show}</div>` : '');
  setHTML('tickets', tk); // 빈 주문표 안내 글은 빼요 (v0.43 화면 정리)
  // 손
  const hands = Array.from({ length: handsMax() }, (_, i) => i).map(i => { // 서빙 쟁반이 있으면 3칸
    const d = r.hands[i];
    return `<div class="hand${d ? ' q' + d.q : ''}">${d ? icon(d.menu) : ''}</div>`;
  }).join('');
  setHTML('hands', hands);
  // 남은 재료
  setHTML('stockMini', todayMenus().map(m => {
    const inc = r.rush.filter(o => o.menu === m).reduce((s, o) => s + o.n, 0), n = stockOf(m);
    return `<span class="${n <= 0 ? 'out' : n <= 3 ? 'low' : ''}">${icon(m)}${n <= 0 ? '품절' : n}${inc ? `<i class="inc">+${inc}</i>` : ''}${r.ready && r.ready[m] && r.ready[m].length ? `<i class="ready" title="미리 끓여 둔 그릇">${r.ready[m].length}</i>` : ''}</span>`;
  }).join(''));
  setText('bSpeed', r.speed + '×');
  // 조리 미니게임
  const c = r.cook;
  if (c) {
    const g = cookRule(c.game);
    if (c.game === 'roll') {
      $('cookFill').style.width = (c.pos * 100).toFixed(1) + '%';
      $('cookNeedle').style.left = (100 - Math.min(1, c.t / g.timeout) * 100).toFixed(1) + '%';
      setText('cookName', `${MENUS[c.menu].name} ${g.name} ${c.taps}/${g.taps}`);
    } else $('cookNeedle').style.left = (c.pos * 100).toFixed(1) + '%';
  }
}

// 새벽 창 (보온 통): 미리 끓인 그릇 칸 · 끓이기 · 문 열기
const QMARK = ['보통', '좋음', '완벽'];
export function renderDawn() {
  const r = G.run;
  if (!r || !r.dawn) return;
  $('dawnSlots').innerHTML = Object.keys(r.dawn.cap).map(m => {
    const made = r.ready[m] || [], cap = r.dawn.cap[m];
    return Array.from({ length: cap }, (_, i) => made[i] !== undefined
      ? `<span class="dslot q${made[i]}">${icon(m)}<small>${QMARK[made[i]]}</small></span>`
      : '<span class="dslot empty"></span>').join('');
  }).join('');
  const m = Object.keys(r.dawn.cap)[0], full = (r.ready[m] || []).length >= r.dawn.cap[m];
  const b = document.querySelector('[data-dawn=cook]');
  b.disabled = full;
  b.textContent = full ? '보온 통이 가득 찼습니다' : `${MENUS[m].name} 끓이기 (${(r.ready[m] || []).length}/${r.dawn.cap[m]})`;
}
export function initDawn() {
  $('dawnUI').addEventListener('click', e => {
    const b = e.target.closest('[data-dawn]');
    if (!b) return;
    runCmd(b.dataset.dawn === 'cook' ? 'dawnCook' : 'dawnDone');
  });
}

// 냉장고 창: 메뉴마다 만들 수 있는 그릇(가장 먼저 떨어질 재료)과 급구매 버튼 (급구매는 메뉴 한 벌씩)
export function renderRush() {
  const r = G.run;
  if (!r) return;
  $('rushList').innerHTML = todayMenus().map(m => {
    const inc = r.rush.filter(o => o.menu === m);
    const wait = inc.length ? Math.ceil(Math.min(...inc.map(o => o.t))) : 0;
    const low = INGREDIENTS[shortIng(m)].name;
    return `<div class="rush-row">${icon(m)}<div><b>${MENUS[m].ing}</b><small>${stockOf(m)}그릇 남음 · 먼저 떨어질 재료: ${low}${inc.length ? ` · ${inc.reduce((s, o) => s + o.n, 0)}그릇 분 오는 중 (${wait}초)` : ''}</small></div>
      <button type="button" class="btn small" data-rush="${m}" ${r.closing ? 'disabled' : ''}>${RUSH_QTY}인분 급구매<br>${won(rushCost(m))}</button></div>`;
  }).join('');
}
export function initRush() {
  $('rushList').addEventListener('click', e => {
    const b = e.target.closest('[data-rush]');
    if (b) runCmd('rushBuy', { menu: b.dataset.rush });
  });
  $('rushClose').addEventListener('click', () => { $('rushUI').hidden = true; });
  $('rushUI').addEventListener('click', e => { if (e.target === $('rushUI')) $('rushUI').hidden = true; }); // 냉장고 창 밖을 누르면 닫혀요
}

// 조리를 시작할 때 미니게임 막대를 그 메뉴에 맞게 바꿔요 (구간은 data/menu.js COOK_GAMES · 주방 타이머는 data/tools.js COOK_EASE)
export function setupCook(menu, game) {
  const g = cookRule(game); // 주방 타이머가 있으면 넓은 구간
  $('cookBar').className = 'cook-bar g-' + game;
  setText('cookName', `${MENUS[menu].name} ${g.name}`);
  setText('cookTip', g.tip);
  const zone = (id, a, b) => { $(id).style.left = a * 100 + '%'; $(id).style.width = (b - a) * 100 + '%'; };
  $('cookFill').style.width = '0%';
  if (game === 'stir') { zone('zoneGood', 0.5 - g.zone.good, 0.5 + g.zone.good); zone('zonePerfect', 0.5 - g.zone.perfect, 0.5 + g.zone.perfect); }
  else if (game === 'fry') { zone('zoneGood', g.good[0], g.good[1]); zone('zonePerfect', g.perfect[0], g.perfect[1]); }
  else { zone('zoneGood', 0, 0); zone('zonePerfect', 0, 0); $('cookNeedle').style.left = '100%'; }
}
