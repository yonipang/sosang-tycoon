// 돌발 이벤트 진행 (data/incidents.js): 그날 고르기 · 시작 · 세기 · 성공/실패와 보상.
// 화면은 만지지 않고 사건만: emit('incident', 'start'|'end', 돌발) · toast
import { G } from '../save/state.js';
import { josa } from '../engine/util.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { INCIDENTS, INCIDENTS_PER_DAY } from '../data/incidents.js';
import { rand, weighted } from '../engine/random.js';
import { emit } from './events.js';
import { menuOpen } from './story.js';
import { spawnParty, freeChars, spareOf, canSell } from './customers.js';

// {menu} {qty} 채우기 ({menu}을/를처럼 조사가 붙으면 받침에 맞게)
const fillText = (s, d) => String(s || '')
  .replace(/\{menu\}(을\/를|이\/가|은\/는|으로\/로)?/g, (_, pair) => { const n = d.menu ? MENUS[d.menu].name : ''; return pair ? josa(n, pair) : n; })
  .replace(/\{qty\}/g, d.qty || '');

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
// 화면에 보여 줄 것: 글은 채워서, 진행도 「3/8」, 남은 시간 비율(0~1)
export function incidentInfo(x) {
  const D = INCIDENTS[x.id], r = G.run;
  const prog = D.kind === 'takeout' ? [x.qty - x.left, x.qty] : D.kind === 'mission' ? [x.count, D.need] : D.kind === 'group' ? [x.paid, x.need] : null;
  const left = x.until !== undefined && r ? Math.max(0, Math.min(1, (x.until - r.min) / Math.max(1, x.until - x.t0))) : null;
  return {
    ...D, text: fillText(D.text, x), goal: fillText(D.goal, x), prize: fillText(D.prize, x),
    intro: (D.intro || []).map(([who, t]) => [who, fillText(t, x)]),
    say: x.state === 'win' ? D.winSay : D.loseSay,
    prog, left,
  };
}

function startIncident(x) {
  const r = G.run, D = INCIDENTS[x.id];
  x.state = 'on'; x.t0 = r.min;
  if (D.kind === 'group') { // 두세 명씩 몇 번에 나눠서 와요 (gap 분마다)
    if (freeChars('student').length < 2) { x.state = 'skip'; return; }
    x.need = D.size; x.paid = 0; x.gone = 0; x.came = 0;
    x.until = r.min + D.limit;
    const per = Math.ceil(D.size / D.waves);
    x.waves = Array.from({ length: D.waves }, (_, k) => ({ at: r.min + k * D.gap, n: Math.min(per, D.size - k * per) })).filter(w => w.n > 0);
    groupWaves(x);
  } else if (D.kind === 'takeout') {
    const ms = MENU_IDS.filter(m => menuOpen(m) && canSell(m));
    if (!ms.length) { x.state = 'skip'; return; }
    x.menu = ms[Math.floor(rand() * ms.length)];
    const spare = spareOf(x.menu); // 미리 만들어 손에 든 몫은 재료를 다시 쓰지 않아요
    x.qty = Math.min(D.qty, r.stock[x.menu] + spare);
    x.left = x.qty; x.until = r.min + D.limit;
    r.stock[x.menu] -= Math.max(0, x.qty - spare);
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

// 차례가 된 아이들을 들여보내요 (빈 학생 그림이 모자라면 조금 뒤에 다시)
function groupWaves(x) {
  const r = G.run;
  for (const w of x.waves) {
    if (w.done || r.min < w.at) continue;
    const chars = freeChars('student').slice(0, w.n);
    if (!chars.length) { w.at = r.min + 3; continue; }
    w.done = true; x.came += chars.length;
    if (chars.length < w.n) x.need -= w.n - chars.length; // 그림이 모자라 덜 온 만큼은 목표에서 빼요
    spawnParty(chars, { force: true, tag: x, type: 'student' });
  }
}
// 단체: 모두 끝났나 (계산했거나 나갔거나)
function groupCheck(x) {
  const D = INCIDENTS[x.id];
  if (x.paid + x.gone >= x.need && x.waves.every(w => w.done)) endIncident(x, x.paid >= Math.min(D.pass, x.need));
}

function endIncident(x, ok) {
  const r = G.run, D = INCIDENTS[x.id];
  if (x.state !== 'on') return;
  x.state = ok ? 'win' : 'lose';
  if (ok) {
    const bonus = D.kind === 'group' ? 0 : (D.reward || D.tip || 0); // 단체는 아래에서 (낸 아이 수만큼)
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
  // 단체: 계산한 아이마다 팁, 모두 받으면 덤 (성공·실패와 상관없이 받은 만큼은 받아요)
  if (D.kind === 'group') { x.bonus = x.paid * D.perKid + (x.paid >= x.need ? D.allBonus : 0); if (x.bonus) { G.cash += x.bonus; r.log.tips += x.bonus; } }
  else x.bonus = ok ? (D.reward || D.tip || 0) : 0;
  (r.log.incidents = r.log.incidents || []).push({ name: D.name, ok, bonus: x.bonus });
  emit('incident', 'end', x); // 결과 카드 (ui/incident.js)
  emit('sfx', ok ? 'perfect' : 'angry');
}

// 매 걸음 (sim/day.js tickDay)
export function tickIncidents() {
  const r = G.run;
  for (const x of r.incidents) {
    if (x.state === 'wait' && r.min >= x.at && !r.closing) startIncident(x);
    else if (x.state === 'on' && INCIDENTS[x.id].kind === 'group') { groupWaves(x); if (r.min >= x.until) endIncident(x, x.paid >= Math.min(INCIDENTS[x.id].pass, x.need)); }
    else if (x.state === 'on' && x.until !== undefined && r.min >= x.until) endIncident(x, false);
  }
}
// 마감: 아직 진행 중인 것은 실패로
export function closeIncidents() { for (const x of G.run.incidents) if (x.state === 'on') endIncident(x, INCIDENTS[x.id].kind === 'group' && x.paid >= Math.min(INCIDENTS[x.id].pass, x.need)); }

// 규칙 코드가 알려 주는 일
//  paid(손님) · missed(손님) · served(손님, 품질) · cook(품질)
export function incidentNote(kind, c, q) {
  const r = G.run;
  if (!r) return;
  if (kind === 'cook') {
    for (const x of activeIncidents()) if (INCIDENTS[x.id].kind === 'mission' && q === 2) { x.count++; emit('incident', 'prog', x); if (x.count >= INCIDENTS[x.id].need) endIncident(x, true); }
    return;
  }
  const x = c && c.tag;
  if (!x || x.state !== 'on') return;
  const D = INCIDENTS[x.id];
  if (D.kind === 'group') {
    if (kind === 'paid') { x.paid++; emit('incident', 'prog', x); }
    if (kind === 'missed') x.gone++;
    groupCheck(x);
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
      x.left--; emit('incident', 'prog', x);
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
