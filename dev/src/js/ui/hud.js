// 영업 중 화면 위아래 막대: 날짜·시계·잔고·별점 / 주문표 / 손에 든 것·남은 재료·속도
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, COOK_ZONE } from '../data/menu.js';
import { WEEKDAYS } from '../data/economy.js';
import { $, clockText, wonShort } from '../engine/util.js';
import { icon } from './icons.js';

const last = {};
function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
function setHTML(id, v) { if (last['h' + id] !== v) { last['h' + id] = v; $(id).innerHTML = v; } }

export const dayLabel = d => `${d}일차 · ${WEEKDAYS[(d - 1) % 7]}요일`;

export function updateHud() {
  setText('hDay', dayLabel(G.day || 1));
  setText('hCash', wonShort(G.cash || 0));
  setText('hStar', (G.rating || 3).toFixed(1));
  const r = G.run;
  if (!r) return;
  setText('hClock', clockText(Math.min(r.min, 720)));
  // 주문표: 들어온 순서대로 (손에 이미 든 몫은 흐리게)
  const handLeft = {};
  for (const d of r.hands) handLeft[d.menu] = (handLeft[d.menu] || 0) + 1;
  const tk = r.tickets.slice(0, 7).map(t => {
    const c = r.customers.find(q => q.id === t.cid);
    const f = c ? c.patience / c.patMax : 1;
    const ready = handLeft[t.menu] > 0 && (handLeft[t.menu]--, true);
    return `<div class="tk${ready ? ' ready' : ''}${f < 0.25 ? ' late' : ''}">${icon(t.menu)}<b>${t.table}번</b><i style="width:${Math.round(f * 10) * 10}%"></i></div>`;
  }).join('') + (r.tickets.length > 7 ? `<div class="tk more">+${r.tickets.length - 7}</div>` : '');
  setHTML('tickets', tk || '<div class="tk-empty">주문이 들어오면 여기에 쌓입니다</div>');
  // 손
  const hands = [0, 1].map(i => {
    const d = r.hands[i];
    return `<div class="hand${d ? ' q' + d.q : ''}">${d ? icon(d.menu) : ''}</div>`;
  }).join('');
  setHTML('hands', hands);
  // 남은 재료
  setHTML('stockMini', MENU_IDS.map(m => `<span class="${r.stock[m] <= 0 ? 'out' : r.stock[m] <= 3 ? 'low' : ''}">${icon(m)}${r.stock[m] <= 0 ? '품절' : r.stock[m]}</span>`).join(''));
  setText('bSpeed', r.speed + '×');
  // 조리 바늘
  if (r.cook) {
    $('cookNeedle').style.left = (r.cook.pos * 100).toFixed(1) + '%';
    setText('cookName', MENUS[r.cook.menu].name + ' 만드는 중');
  }
}

// 조리 막대의 좋은 칸·완벽한 칸 너비 (data/menu.js 값에서)
export function initCookBar() {
  const p = COOK_ZONE.perfect, g = COOK_ZONE.good;
  $('zoneGood').style.left = (50 - g * 100) + '%'; $('zoneGood').style.width = (g * 200) + '%';
  $('zonePerfect').style.left = (50 - p * 100) + '%'; $('zonePerfect').style.width = (p * 200) + '%';
}
