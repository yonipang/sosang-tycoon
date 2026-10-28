// 동네 탐방 화면 (v0.78): 골목 화면(ui/town.js)의 캔버스·막대·아래 버튼·창을 빌려 써요
//  걷기는 골목과 같아요(조이스틱 · 짧게 누르면 그곳까지). 사람 옆에서 오른쪽 아래 상호작용 버튼 「살펴보기」 → 사건 창(고르기 하나)
//  체력(위 막대)은 걸을 때 · 일을 도울 때 줄고, 국밥·어묵 국물로 조금 돌아와요. 버스 정류장으로 가면 돌아가요
//  규칙은 sim/explore.js (runCmd 'exStart' · 'exWalk' · 'exPick' · 'exFinish' · 'exReturn'), 그리기 render/explore.js
//  v0.81: 심부름(짐 배달 · 아이와 할머니 찾기)과 손기술(떡 자르기 · 김 뒤집기 · 꼬치 끼우기 · 나물 다듬기)
import { G } from '../save/state.js';
import { $, won, josa } from '../engine/util.js';
import { fxRand } from '../engine/random.js';
import { toast } from './feedback.js';
import { runCmd, onEvent } from '../sim/events.js';
import { TILE } from '../data/layout.js';
import { EX_AREAS, EX_AREA_IDS, EX_STAMINA, EX_BAG, EX_CARRY, FINDS, MEMOS, EX_EVENTS_POOL } from '../data/explore.js';
import { exRun, exploreReady, exploredToday } from '../sim/explore.js';
import { drawExplore } from '../render/explore.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';
import { talking } from './story.js';

const EX_WALK = 96, EX_NEAR = { x: 22, y: 18 };
let V = null;     // 탐방 화면 { me, cam, time, acc, open }
let XC = null;     // 골목 화면이 빌려주는 것 { sheet, closeSheet, refresh, fade, view, joy, back }
export const exView = () => V; // 시험 스크립트용 (main.js __T)
export const exOn = () => !!V;
export const exMapH = () => (exRun() ? exRun().map.H * TILE : 0);
export function exHook(ctx) { XC = ctx; }

const exHead = (t, x = true) => `<div class="ts-head"><b>${t}</b>${x ? '<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button>' : ''}</div>`;
const exEvOf = id => EX_EVENTS_POOL.find(e => e.id === id);
const exPx = tx => tx * TILE + TILE / 2, exPy = ty => ty * TILE + TILE - 3;

// ── 버스 정류장 창 (골목) ──
// 동네 고르기 (v0.82 아파트 단지): 하루 한 곳
export function busHTML() {
  if (exploredToday()) return `${exHead('버스 정류장')}<p class="ts-note">오늘은 이미 동네에 다녀왔습니다. 내일 또 가 보세요.</p>`;
  const rows = EX_AREA_IDS.map(id => { const A = EX_AREAS[id]; return `<button type="button" class="ts-act" data-ts="exGo" data-area="${id}"><b>${A.bus}</b><small>${A.sub}</small></button>`; }).join('');
  return `${exHead('버스 정류장')}<p class="ts-note">하루 한 곳, 준비 시간은 쓰지 않습니다. 걸으면 체력이 줄고 가방은 ${EX_BAG}칸입니다.</p>${rows}`;
}
const exArea = () => EX_AREAS[(exRun() || {}).area] || EX_AREAS.market;
export function exGo(area) {
  if (!exploreReady()) return;
  XC.closeSheet();
  XC.fade(() => {
    if (!runCmd('exStart', { area })) return;
    const [sx, sy] = exRun().map.start;
    V = { me: { char: 0, x: exPx(sx), y: exPy(sy), dir: 1, path: [], moving: false }, cam: { x: 0, y: 0 }, time: 0, acc: 0, bumped: null };
    XC.refresh();
    const A = exArea();
    XC.sheet(`${exHead(A.name)}<p class="ts-note">${A.intro} 사람들 앞에서 상호작용 버튼 「살펴보기」를 눌러 보세요. 체력이 다 떨어지기 전에 정류장으로 돌아오세요.</p>`, 'ex');
  });
}

// ── 위 막대 · 아래 버튼 ──
// 체력 · 가방은 맨 위 HUD 둘째 줄에 (v0.79 사용자 요청) — 골목 막대에는 시각과 동네 이름만
export function exHud() {
  const X = exRun(), el = $('exHud');
  document.body.classList.toggle('in-ex', !!X);
  if (!X) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; } return; }
  const p = Math.max(0, X.sp / EX_STAMINA), low = p < 0.25;
  const bag = Array.from({ length: EX_BAG }, (_, i) => `<i class="ex-slot">${X.bag[i] ? icon(FINDS[X.bag[i]].icon, 'ex-ic') : ''}</i>`).join('');
  el.innerHTML = `<span class="ex-sp${low ? ' low' : ''}"><b>체력</b><i><i style="width:${Math.round(p * 100)}%"></i></i><em>${Math.ceil(X.sp)}</em></span>
    <span class="ex-bag"><b>가방</b>${bag}</span>`;
  el.hidden = false;
}
export function exBar() {
  const X = exRun(); if (!X) return '';
  const T = X.task;
  const A = exArea();
  return `<span class="tb-time ${X.area === 'apt' ? 'morning' : 'dawn'}">${A.when} ${A.clock}</span>${T ? `<span class="ex-place ex-task">${T.kind === 'escort' ? `아이와 할머니 찾기${T.hint ? ` · ${T.hint} 근처` : ''}` : `${T.item} → ${T.label}`}</span>` : `<span class="ex-place">${A.name}</span>`}`;
}
export const exNav = () => `<button type="button" data-ex="bag">가방 ${exRun() ? exRun().bag.length : 0}/${EX_BAG}</button><button type="button" data-ex="bus" class="go">정류장으로</button>`;
export function exNavClick(k) {
  if (!V) return;
  playSfx('tap');
  if (k === 'bag') { XC.sheet(bagHTML(), 'ex'); return; }
  if (k === 'bus') { XC.closeSheet(); exWalkTo(exRun().map.start, () => XC.sheet(leaveHTML(), 'ex')); }
}
function bagHTML() {
  const X = exRun();
  const rows = X.bag.map(id => { const F = FINDS[id]; return `<div class="ex-row">${icon(F.icon, 'ex-ric')}<span><b>${F.name}</b><small>${F.text}</small></span></div>`; }).join('') || '<p class="ts-note">아직 아무것도 담지 않았습니다.</p>';
  return `${exHead(`가방 ${X.bag.length}/${EX_BAG}`)}${rows}<p class="ts-note">정류장으로 돌아가면 가게에 반영됩니다. 체력이 다 떨어지면 절반을 두고 와요.</p>`;
}
function leaveHTML() {
  const X = exRun();
  return `${exHead('버스 정류장')}<p class="ts-note">가방 ${X.bag.length}/${EX_BAG} · 남은 체력 ${Math.round(X.sp)}</p>
    <button type="button" class="ts-act" data-ts="exLeave"><b>버스 타고 돌아가기</b><small>담은 것을 가게로 가져가요</small></button>`;
}

// ── 사건 창 ──
function eventHTML(i) {
  const X = exRun(), S = X.spots[i], ev = exEvOf(S.ev);
  const btns = ev.choices.map((ch, k) => {
    const F = ch.give && FINDS[ch.give];
    const cost = [ch.task ? (ch.task.kind === 'escort' ? '직접 찾아 주기' : `직접 배달 · 들고 걸으면 체력 ${EX_CARRY}배`) : '', ch.mini ? `손기술 · ${ch.mini.name}` : '', ch.cost ? `체력 −${ch.cost}` : '', ch.pay ? `${won(ch.pay)}` : '', ch.heal ? `체력 +${ch.heal}` : ''].filter(Boolean).join(' · ');
    const why = ch.pay && G.cash < ch.pay ? '잔고가 모자랍니다' : ch.cost && X.sp < ch.cost ? '힘이 모자랍니다' : '';
    return `<button type="button" class="ts-act" data-ts="exPick" data-s="${i}" data-i="${k}" ${why ? 'disabled' : ''}><b>${ch.label}</b><small>${why || [cost, F ? `가방에: ${F.name}` : ''].filter(Boolean).join(' · ')}</small></button>`;
  }).join('');
  return `${exHead(ev.title)}<p class="ex-txt">${ev.text}</p>${btns}<button type="button" class="ts-act ex-pass" data-ts="close"><b>지나치기</b><small>체력을 아껴요</small></button>`;
}
function fullHTML(spot, i, fin) {
  const X = exRun(), F = FINDS[exEvOf(X.spots[spot].ev).choices[i].give];
  const k = fin ? 'exDropF' : 'exDrop';
  const rows = X.bag.map((id, d) => { const B = FINDS[id]; return `<button type="button" class="ts-act" data-ts="${k}" data-s="${spot}" data-i="${i}" data-d="${d}"><b>${B.name} 버리고 담기</b><small>${B.text}</small></button>`; }).join('');
  const skip = fin ? '<button type="button" class="ts-act ex-pass" data-ts="exSkipF"><b>안 받고 끝내기</b><small>가방은 그대로</small></button>' : '<button type="button" class="ts-act ex-pass" data-ts="close"><b>그만두기</b><small>그대로 둡니다</small></button>';
  return `${exHead('가방이 가득 찼습니다', !fin)}<p class="ts-note">${josa(F.name, '을/를')} 담으려면 하나를 내려놓아야 합니다.</p>${rows}${skip}`;
}
// ── 손기술 (v0.81): timing 움직이는 바늘이 초록 칸에 올 때 누르기 · mash 시간 안에 빠르게 눌러 채우기 ──
function mgStart(title, M) {
  V.mg = M.kind === 'timing' ? { ...M, title, pos: 0, dir: 1, round: 0, hits: 0, zone: mgZone(), flash: '' } : { ...M, title, fill: 0, t: M.time };
  XC.sheet(mgHTML(), 'ex mg');
}
function mgZone() { const w = 0.24, a = 0.08 + fxRand() * (0.84 - w); return [a, a + w]; }
function mgHTML() {
  const m = V.mg;
  const top = m.kind === 'timing'
    ? `<p class="mg-help">바늘이 초록 칸에 올 때 누르세요 · ${m.rounds}번 중 ${m.need}번</p><div class="mg-dots">${Array.from({ length: m.rounds }, (_, k) => `<i class="${k < m.round ? (m.res[k] ? 'ok' : 'no') : ''}"></i>`).join('')}</div>
       <div class="mg-bar"><i class="mg-zone" style="left:${m.zone[0] * 100}%;width:${(m.zone[1] - m.zone[0]) * 100}%"></i><i class="mg-needle" id="mgNeedle"></i></div>`
    : `<p class="mg-help">${m.time}초 안에 빠르게 눌러 막대를 채우세요</p><div class="mg-bar fill"><i class="mg-fill" id="mgFill"></i></div><p class="mg-time" id="mgTime"></p>`;
  return `${exHead(m.title + ' · ' + m.name, false)}${top}<button type="button" class="btn primary big mg-go" data-ts="exMg">${m.act}</button>`;
}
function mgPress() {
  const m = V.mg; if (!m) return;
  if (m.kind === 'timing') {
    const ok = m.pos >= m.zone[0] && m.pos <= m.zone[1];
    m.res = m.res || []; m.res.push(ok); if (ok) m.hits++;
    m.round++; playSfx(ok ? 'perfect' : 'tap');
    if (m.round >= m.rounds) return mgEnd(m.hits >= m.need ? 1 : 0);
    m.zone = mgZone(); m.speed *= 1.08;
    XC.sheet(mgHTML(), 'ex mg');
  } else { m.fill = Math.min(1, m.fill + 1 / m.taps); playSfx('tap'); if (m.fill >= 1) mgEnd(1); }
}
function mgTick(dt) {
  const m = V.mg; if (!m) return;
  if (!XC.sheetOpen()) { mgEnd(0); return; } // 창을 닫으면 그만두기(실패)
  if (m.kind === 'timing') {
    m.pos += m.dir * m.speed * dt; if (m.pos > 1) { m.pos = 1; m.dir = -1; } if (m.pos < 0) { m.pos = 0; m.dir = 1; }
    const n = $('mgNeedle'); if (n) n.style.left = (m.pos * 100).toFixed(1) + '%';
  } else {
    m.t -= dt; m.fill = Math.max(0, m.fill - dt * 0.06);
    const f = $('mgFill'), t = $('mgTime');
    if (f) f.style.width = (m.fill * 100).toFixed(1) + '%';
    if (t) t.textContent = `남은 시간 ${Math.max(0, m.t).toFixed(1)}초`;
    if (m.t <= 0) mgEnd(0);
  }
}
function mgEnd(score) { V.mg = null; runCmd('exFinish', { score }); }
export function exSheetClick(k, b) {
  if (k === 'exGo') { playSfx('page'); exGo(b.dataset.area); return true; }
  if (k === 'exPick') { runCmd('exPick', { spot: +b.dataset.s, i: +b.dataset.i }); return true; }
  if (k === 'exDrop') { runCmd('exPick', { spot: +b.dataset.s, i: +b.dataset.i, drop: +b.dataset.d }); return true; }
  if (k === 'exDropF') { runCmd('exFinish', { drop: +b.dataset.d }); return true; }
  if (k === 'exSkipF') { runCmd('exFinish', { drop: -1 }); return true; }
  if (k === 'exMg') { mgPress(); return true; }
  if (k === 'exLeave') { playSfx('page'); exHome(); return true; }
  return false;
}
function exHome() {
  XC.closeSheet();
  XC.fade(() => { runCmd('exReturn'); });
}

// ── 규칙에서 온 소식 ──
export function initExplore() {
  onEvent('explore', (what, arg) => {
    if (!XC) return;
    if (what === 'picked') {
      const F = arg.give && FINDS[arg.give];
      XC.sheet(`${exHead(arg.title || '', true)}<p class="ex-txt">${arg.say || ''}</p>${F ? `<div class="ex-row got">${icon(F.icon, 'ex-ric')}<span><b>가방에 담았습니다: ${F.name}</b><small>${F.text}</small></span></div>` : ''}${arg.memo ? `<p class="ex-memo">동네 메모 · ${MEMOS[arg.memo]}</p>` : ''}`, 'ex');
      XC.refresh();
    } else if (what === 'full') XC.sheet(fullHTML(arg.spot, arg.i, arg.finish), 'ex');
    else if (what === 'task') {
      const T = arg.task;
      V.trail = [];
      XC.sheet(`${exHead(arg.title)}<p class="ex-txt">${T.kind === 'escort' ? `아이가 손을 꼭 잡고 따라옵니다. 할머니는 ${T.hint ? `「${T.hint}」 근처에 ` : ''}계실 거래요. 찾으면 상호작용 버튼으로 「${T.verb}」.` : `${josa(T.item, '을/를')} 들었습니다. 「${T.label}」에 가서 상호작용 버튼으로 「${T.verb}」. 짐을 들고 걸으면 체력이 ${EX_CARRY}배로 줄어요.`}</p>`, 'ex');
      XC.refresh();
    } else if (what === 'mini') mgStart(arg.title, arg.mini);
    else if (what === 'done') XC.refreshBar();
    else if (what === 'faint') {
      if (V) { V.me.path = []; }
      XC.sheet(faintHTML(), 'ex faint');
      XC.refresh();
    } else if (what === 'end') { V = null; XC.back(); showSummary(arg); }
  });
}
// 체력이 바닥났을 때 (창을 닫아도 다시 떠요 — 택시로만 돌아가요)
function faintHTML() {
  const X = exRun();
  return `${exHead('더는 못 걷겠습니다…', false)}<p class="ex-txt">숨이 차서 택시를 불렀습니다.${X.lost && X.lost.length ? ` 서두르다 가방에서 ${josa(X.lost.map(id => FINDS[id].name).join(', '), '을/를')} 떨어뜨렸습니다.` : ''}</p>
    <button type="button" class="ts-act" data-ts="exLeave"><b>택시 타고 돌아가기</b><small>남은 것만 가게로</small></button>`;
}
function showSummary(S) {
  const got = S.got.map(id => { const F = FINDS[id]; return `<div class="ex-row">${icon(F.icon, 'ex-ric')}<span><b>${F.name}</b><small>${F.text}</small></span></div>`; }).join('') || '<p class="ts-note">이번엔 빈손으로 돌아왔습니다.</p>';
  const memos = S.memos.map(m => `<p class="ex-memo">${MEMOS[m]}</p>`).join('');
  XC.sheet(`${exHead(`${(EX_AREAS[S.area] || EX_AREAS.market).name}에서 돌아왔습니다`)}${got}${S.lost.length ? `<p class="ts-note">떨어뜨린 것: ${S.lost.map(id => FINDS[id].name).join(', ')}</p>` : ''}${memos ? `<small class="ex-h">새 동네 메모</small>${memos}` : ''}`, 'ex');
}

// ── 걷기 ──
function exWalls() { return exRun().map.walls; }
function exBlocked(x, y) {
  const M = exRun().map;
  for (const qx of [x - 5, x + 5]) for (const qy of [y - 5, y]) {
    const tx = Math.floor(qx / TILE), ty = Math.floor(qy / TILE);
    if (tx < 0 || ty < 0 || tx >= M.W || ty >= M.H || M.walls[ty * M.W + tx]) return true;
  }
  return false;
}
function exPath(from, to) {
  const M = exRun().map, W = M.W, N = W * M.H, m = M.walls, prev = new Int32Array(N).fill(-1);
  const s = from[1] * W + from[0], g = to[1] * W + to[0];
  if (m[g]) return null;
  prev[s] = s; const q = [s];
  for (let i = 0; i < q.length && prev[g] < 0; i++) {
    const cc = q[i], cx = cc % W, cy = (cc - cx) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= M.H || m[k] || prev[k] >= 0) continue;
      prev[k] = cc; q.push(k);
    }
  }
  if (prev[g] < 0) return null;
  const out = [];
  for (let cc = g; cc !== s; cc = prev[cc]) out.unshift([cc % W, Math.floor(cc / W)]);
  return out;
}
const exMeTile = () => [Math.floor(V.me.x / TILE), Math.floor(V.me.y / TILE)];
function exWalkTo(to, then) {
  const p = exPath(V.me.path.length ? V.me.path[0] : exMeTile(), to);
  if (!p) return false;
  if (V.me.path.length) p.unshift(V.me.path[0]);
  V.me.path = p; V.then = then || null;
  if (!p.length) { V.then = null; if (then) then(); }
  return true;
}
// 사람 옆 칸 (가장 가까운)
function exBeside(tx, ty) {
  const [sx, sy] = exMeTile();
  let best = null, bd = 1e9;
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const x = tx + dx, y = ty + dy, p = exPath([sx, sy], [x, y]);
    if (p && p.length < bd) { bd = p.length; best = [x, y]; }
  }
  return best;
}
function spotNear() {
  const X = exRun(); if (!X || X.fainted) return -1;
  return X.spots.findIndex(s => !s.done && Math.abs(exPx(s.tx) - V.me.x) < EX_NEAR.x && Math.abs(exPy(s.ty) - V.me.y) < EX_NEAR.y);
}
function openSpot(i) { V.me.path = []; V.me.moving = false; playSfx('tap'); XC.sheet(eventHTML(i), 'ex'); }
// 상호작용 버튼 (v0.80 — ui/town.js updateActBtn): 사람 옆이면 「살펴보기」, 정류장 옆이면 「돌아가기」
export function exActTarget() {
  const X = exRun(); if (!V || !X || X.fainted) return null;
  const T = X.task;
  if (X.pend && !T) return { label: '가방 정리', run: () => runCmd('exFinish') }; // 손기술 뒤 가방이 가득 찼을 때 창을 닫아 버렸으면
  if (T && Math.abs(exPx(T.tx) - V.me.x) < EX_NEAR.x && Math.abs(exPy(T.ty) - V.me.y) < EX_NEAR.y) return { label: T.verb, run: () => { V.me.path = []; runCmd('exFinish'); } };
  const i = spotNear();
  if (i >= 0) return { label: '살펴보기', run: () => (T ? toast(T.kind === 'escort' ? '먼저 아이를 할머니께 모셔다드려요' : `먼저 ${josa(T.item, '을/를')} 전해 줘요`, 'info') : openSpot(i)) };
  const [tx, ty] = exMeTile(), bus = X.map.props.find(p => p.kind === 'bus');
  if (bus && ty >= bus.ty - 1 && tx >= bus.tx - 1 && tx <= bus.tx + 5) return { label: '돌아가기', run: () => { V.me.path = []; XC.sheet(leaveHTML(), 'ex'); } };
  return null;
}

export function exUpdate(dt) {
  const X = exRun(); if (!V || !X) return;
  V.time += dt;
  const me = V.me, vw = XC.view().vw, vh = XC.view().vh, ox = me.x, oy = me.y;
  if (X.fainted && !XC.sheetOpen() && !talking()) XC.sheet(faintHTML(), 'ex faint');
  const busy = talking() || XC.sheetOpen() || X.fainted;
  const [vx, vy] = busy ? [0, 0] : XC.joy();
  if (Math.hypot(vx, vy) > 0.25) {
    if (me.path.length) { me.path = []; V.then = null; }
    const sp = EX_WALK * Math.min(1, Math.hypot(vx, vy)) / Math.hypot(vx, vy);
    const nx = me.x + vx * sp * dt, ny = me.y + vy * sp * dt;
    if (!exBlocked(nx, me.y)) me.x = nx;
    if (!exBlocked(me.x, ny)) me.y = ny;
    me.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 0 : 2) : (vy > 0 ? 3 : 1); me.moving = true;
    // 부딪혀도 창은 안 열려요 — 상호작용 버튼으로 (v0.80)
  } else if (!me.path.length) me.moving = false;
  if (me.path.length && !busy) {
    let step = EX_WALK * dt;
    while (step > 0 && me.path.length) {
      const [tx, ty] = me.path[0], gx = exPx(tx), gy = exPy(ty), dx = gx - me.x, dy = gy - me.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { me.x = gx; me.y = gy; me.path.shift(); if (!me.path.length && V.then) { const t = V.then; V.then = null; t(); } continue; }
      if (Math.abs(dx) >= 0.01) { const k = Math.min(step, Math.abs(dx)); me.x += Math.sign(dx) * k; step -= k; me.dir = dx > 0 ? 0 : 2; }
      else { const k = Math.min(step, Math.abs(dy)); me.y += Math.sign(dy) * k; step -= k; me.dir = dy > 0 ? 3 : 1; }
      me.moving = true;
    }
  }
  // 걸은 만큼 체력 (칸 단위로 모아서)
  V.acc += Math.hypot(me.x - ox, me.y - oy) / TILE;
  if (V.acc >= 0.5) { const d = V.acc; V.acc = 0; runCmd('exWalk', { d }); XC.refreshBar(); }
  const M = X.map;
  V.cam.x = Math.max(0, Math.min(M.W * TILE - vw, me.x - vw / 2));
  V.cam.y = Math.max(0, Math.min(M.H * TILE - vh, me.y - 16 - vh / 2));
  if (V.mg) mgTick(dt);
  // 따라오는 아이 (심부름 escort): 내가 지나온 자리를 조금 늦게 밟아요
  let follow = null;
  if (X.task && X.task.follow) {
    V.trail = V.trail || [];
    const last = V.trail[V.trail.length - 1];
    if (!last || Math.hypot(last.x - me.x, last.y - me.y) > 1.5) { V.trail.push({ x: me.x, y: me.y, dir: me.dir }); if (V.trail.length > 40) V.trail.shift(); }
    const p = V.trail[Math.max(0, V.trail.length - 10)] || { x: me.x, y: me.y + 8, dir: me.dir };
    follow = { char: X.task.follow, x: p.x, y: p.y, dir: p.dir, moving: me.moving };
  }
  drawExplore($('townCv'), { map: M, cam: V.cam, vw, vh, me, time: V.time, marks: X.task ? [] : X.spots.filter(s => !s.done), follow, carry: !!(X.task && X.task.carry), target: X.task ? { tx: X.task.tx, ty: X.task.ty } : null });
}
// 짧게 누르기: 사람·정류장 → 그 옆까지 걸어가기만 (창은 상호작용 버튼으로) · 바닥 → 그곳까지
export function exTap(e) {
  const X = exRun(); if (!V || !X || X.fainted) return;
  const r = $('townCv').getBoundingClientRect(), { vw, vh } = XC.view();
  const wx = V.cam.x + (e.clientX - r.left) / r.width * vw, wy = V.cam.y + (e.clientY - r.top) / r.height * vh;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  playSfx('tap');
  const T = X.task;
  if (T && wx >= exPx(T.tx) - 8 && wx < exPx(T.tx) + 8 && wy >= exPy(T.ty) - 30 && wy < exPy(T.ty) + 4) { const at = exBeside(T.tx, T.ty); if (at) exWalkTo(at, () => { V.me.dir = T.ty < at[1] ? 1 : T.ty > at[1] ? 3 : T.tx > at[0] ? 0 : 2; }); return; }
  const si = X.spots.findIndex(s => !s.done && wx >= exPx(s.tx) - 8 && wx < exPx(s.tx) + 8 && wy >= exPy(s.ty) - 30 && wy < exPy(s.ty) + 4);
  if (si >= 0) { const s = X.spots[si], at = exBeside(s.tx, s.ty); if (at) exWalkTo(at, () => { V.me.dir = s.ty < at[1] ? 1 : s.ty > at[1] ? 3 : s.tx > at[0] ? 0 : 2; }); return; } // 걸어가기만 (v0.80)
  const bus = X.map.props.find(p => p.kind === 'bus');
  if (bus && wx >= bus.tx * TILE && wx < bus.tx * TILE + 72 && wy >= (bus.ty + 1) * TILE - 47 && wy < (bus.ty + 1) * TILE) { exWalkTo(X.map.start); return; }
  if (tx < 0 || ty < 0 || tx >= X.map.W || ty >= X.map.H || exWalls()[ty * X.map.W + tx]) return;
  exWalkTo([tx, ty]);
}
