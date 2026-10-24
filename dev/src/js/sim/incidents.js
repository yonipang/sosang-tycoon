// 돌발 이벤트 진행 (data/incidents.js): 그날 고르기 · 시작 · 세기 · 성공/실패와 보상.
// 화면은 만지지 않고 사건만: emit('incident', 'start'|'end', 돌발) · toast
import { G } from '../save/state.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { INCIDENTS, INCIDENTS_PER_DAY } from '../data/incidents.js';
import { rand, weighted } from '../engine/random.js';
import { emit } from './events.js';
import { menuOpen } from './story.js';
import { spawnParty, freeChars } from './customers.js';

const fillText = (s, d) => s.replace('{menu}', d.menu ? MENUS[d.menu].name : '').replace('{qty}', d.qty || '');

// 영업 시작 때 오늘 일어날 돌발을 정해 둬요 (그날 씨앗 rand라 같은 날은 같은 일이 일어나요)
export function planIncidents(r) {
  r.incidents = [];
  const pool = Object.keys(INCIDENTS).filter(id => G.day >= INCIDENTS[id].minDay);
  let n = INCIDENTS_PER_DAY(G.day);
  while (n-- > 0 && pool.length) {
    const id = weighted(Object.fromEntries(pool.map(k => [k, INCIDENTS[k].weight])));
    pool.splice(pool.indexOf(id), 1);
    const D = INCIDENTS[id];
    r.incidents.push({ id, at: D.from + rand() * (D.to - D.from), state: 'wait' });
  }
}

// 지금 바로 일으키기 (개발자 모드)
export function forceIncident(id) {
  const r = G.run;
  if (!r || r.closing || !INCIDENTS[id]) return;
  r.incidents.push({ id, at: r.min, state: 'wait' });
}

export const activeIncidents = () => (G.run ? G.run.incidents.filter(x => x.state === 'on') : []);
export const incidentInfo = x => ({ ...INCIDENTS[x.id], text: fillText(INCIDENTS[x.id].text, x) });

function startIncident(x) {
  const r = G.run, D = INCIDENTS[x.id];
  x.state = 'on'; x.t0 = r.min;
  if (D.kind === 'group') {
    const chars = freeChars('student');
    if (chars.length < 2) { x.state = 'skip'; return; }
    const n = Math.min(D.size, chars.length - (chars.length % 2));
    x.need = n; x.paid = 0;
    for (let k = 0; k < n; k += 2) spawnParty(chars.slice(k, k + 2), { force: true, tag: x, delay: k });
  } else if (D.kind === 'takeout') {
    const ms = MENU_IDS.filter(m => menuOpen(m) && r.stock[m] >= 1);
    if (!ms.length) { x.state = 'skip'; return; }
    x.menu = ms[Math.floor(rand() * ms.length)];
    x.qty = Math.min(D.qty, r.stock[x.menu]);
    x.left = x.qty; x.until = r.min + D.limit;
    r.stock[x.menu] -= x.qty;
    for (let i = 0; i < x.qty; i++) r.tickets.push({ cid: -1, menu: x.menu, table: 0, takeout: x });
    emit('order', -1, x.menu);
  } else if (D.kind === 'mission') {
    x.count = 0; x.until = D.until;
  } else if (D.kind === 'guest') {
    const chars = freeChars('worker');
    if (!chars.length) { x.state = 'skip'; return; }
    x.menu = menuOpen(D.menu) ? D.menu : MENU_IDS.find(m => menuOpen(m));
    x.until = r.min + D.limit;
    spawnParty([chars[0]], { force: true, tag: x, wants: x.menu });
  }
  emit('incident', 'start', x);
  emit('sfx', 'surprise');
}

function endIncident(x, ok) {
  const r = G.run, D = INCIDENTS[x.id];
  if (x.state !== 'on') return;
  x.state = ok ? 'win' : 'lose';
  if (ok) {
    const bonus = D.reward || D.tip || 0;
    if (bonus) { G.cash += bonus; r.log.tips += bonus; }
    if (D.kind === 'guest') { for (let i = 0; i < 3; i++) r.log.sats.push(5); r.log.events.push({ kind: 'blogger', menu: x.menu, who: '블로거' }); }
  }
  if (D.kind === 'takeout' && !ok) { // 못 만든 몫은 재료를 돌려놔요 (이미 만든 건 손에 남아요)
    const left = r.tickets.filter(t => t.takeout === x);
    r.tickets = r.tickets.filter(t => t.takeout !== x);
    const handsM = r.hands.filter(d => d.menu === x.menu).length, others = r.tickets.filter(t => t.menu === x.menu).length;
    r.stock[x.menu] += Math.max(0, left.length - Math.max(0, handsM - others));
    r.log.sats.push(2);
  }
  (r.log.incidents = r.log.incidents || []).push({ name: D.name, ok, bonus: ok ? (D.reward || D.tip || 0) : 0 });
  emit('incident', 'end', x);
  emit('toast', ok ? D.win : D.lose, ok ? 'good' : 'warn');
  emit('sfx', ok ? 'perfect' : 'angry');
}

// 매 걸음 (sim/day.js tickDay)
export function tickIncidents() {
  const r = G.run;
  for (const x of r.incidents) {
    if (x.state === 'wait' && r.min >= x.at && !r.closing) startIncident(x);
    else if (x.state === 'on' && x.until !== undefined && r.min >= x.until) endIncident(x, false);
  }
}
// 마감: 아직 진행 중인 것은 실패로
export function closeIncidents() { for (const x of G.run.incidents) if (x.state === 'on') endIncident(x, false); }

// 규칙 코드가 알려 주는 일
//  paid(손님) · missed(손님) · served(손님, 품질) · cook(품질)
export function incidentNote(kind, c, q) {
  const r = G.run;
  if (!r) return;
  if (kind === 'cook') {
    for (const x of activeIncidents()) if (INCIDENTS[x.id].kind === 'mission' && q === 2 && ++x.count >= INCIDENTS[x.id].need) endIncident(x, true);
    return;
  }
  const x = c && c.tag;
  if (!x || x.state !== 'on') return;
  const D = INCIDENTS[x.id];
  if (D.kind === 'group') {
    if (kind === 'paid' && ++x.paid >= x.need) endIncident(x, true);
    if (kind === 'missed') endIncident(x, false);
  } else if (D.kind === 'guest') {
    if (kind === 'served') endIncident(x, q === 2);
    if (kind === 'missed') endIncident(x, false);
  }
}

// 포장: 계산대에 서면 손에 든 포장 몫을 넘겨요 (sim/player.js)
export function handTakeout() {
  const r = G.run;
  for (const x of activeIncidents().filter(x => INCIDENTS[x.id].kind === 'takeout')) {
    while (x.left > 0) {
      const i = r.hands.findIndex(d => d.menu === x.menu);
      if (i < 0) break;
      r.hands.splice(i, 1);
      const ti = r.tickets.findIndex(t => t.takeout === x);
      if (ti >= 0) r.tickets.splice(ti, 1);
      x.left--;
      const price = G.prices[x.menu];
      G.cash += price; G.weekSales += price;
      r.log.sales[x.menu].n++; r.log.sales[x.menu].rev += price;
      emit('float', r.player.x, r.player.y - 1.6, `포장 +${price.toLocaleString('ko-KR')}원`, 'cash');
      emit('sfx', 'coin');
    }
    if (x.left <= 0) endIncident(x, true);
  }
}
export const takeoutWaiting = () => activeIncidents().some(x => INCIDENTS[x.id].kind === 'takeout' && x.left > 0);
