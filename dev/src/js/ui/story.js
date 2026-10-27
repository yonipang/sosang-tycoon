// 이야기 화면: 대화 창 · 골목 신문 · 가게 이름 짓기 · 퀘스트 카드(준비 화면) · 퀘스트 표시(영업 중 왼쪽 위)
import { G } from '../save/state.js';
import { $, won } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { CAST, CHAPTERS, QUESTS, SCENES } from '../data/story.js';
import { MARKET_NEWS } from '../data/market.js';
import { MENUS, INGREDIENTS } from '../data/menu.js';
import { costOf, newsMenus } from '../sim/market.js';
import { questProg, questWaiting, menuOpen } from '../sim/story.js';
import { activeIncidents, incidentInfo } from '../sim/incidents.js';
import { clockText } from '../engine/util.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';
import { setMusic } from './music.js';
import { setting } from './settings.js';
import { playCut, cutActive, cutWaiting, cutTap } from './cutscene.js';
import { tutAsk } from '../sim/tutorial.js';
import { callStarts, ringHTML, startRing, stopRing } from './phone.js';

let open = null; // 보고 있는 장면 { id, i: 몇 번째 줄 }
const fill = s => s.replace(/\{shop\}/g, G.shop);
// who: CAST 이름 또는 { name, char } (골목에서 만난 손님 등)
const castOf = who => (who && typeof who === 'object' ? who : CAST[who]);
const face = (who, cls) => `<span class="${cls}">${icon('char' + castOf(who).char)}</span>`;

// 보여 줄 장면이 있으면 하나 열어요 (준비 화면에서, 또는 「바로」 장면이면 영업 중에도)
export function showNextScene() {
  if (open || !G.story || G.phase === 'title') return;
  const id = G.story.queue[0];
  const sc = id && SCENES[id];
  if (!sc || (sc.when !== 'now' && G.phase !== 'prep')) return;
  if (sc.at === 'dawn' && G.town && G.town.on && G.town.part !== 'dawn') return; // 아침 신문은 새벽에 (sim/town.js goDawn이 다시 불러요)
  if (G.phase === 'day' && G.run && G.run.cook) { setTimeout(showNextScene, 150); return; } // 영업 중 장면은 조리 미니게임이 끝난 뒤에
  if (G.phase === 'day') runCmd('hold', { on: true });
  open = { id, i: 0 };
  // 연출이 붙은 장면은 연출을 먼저 보고, 남은 줄을 이어서 보여 줘요
  if (sc.cut) { playCut(sc.cut, () => { runCmd('sceneOpen'); $('talk').hidden = false; drawScene(); }); return; }
  runCmd('sceneOpen');
  $('talk').hidden = false;
  drawScene();
  playSfx('page');
}

// 설정 「한 글자씩」: 대화 글을 한 글자씩 띄워요. 누르면 남은 글이 한 번에 나와요
let typing = null;
export function typeIn(box) {
  stopTyping();
  const p = box.querySelector('.tk-body p');
  if (!p || !setting('talk')) return;
  const full = p.textContent;
  let i = 0;
  p.textContent = '';
  typing = { p, full, timer: setInterval(() => { i++; p.textContent = full.slice(0, i); if (i >= full.length) stopTyping(); }, 35) };
}
export function stopTyping() {
  if (!typing) return false;
  clearInterval(typing.timer); typing.p.textContent = typing.full; typing = null;
  return true;
}

// 대화 한 줄 (연출 중에도 같은 모양)
export function lineHTML(who, text) {
  const p = who && castOf(who);
  return `<div class="tk-box">${p ? face(who, 'tk-face') : ''}<div class="tk-body">${p ? `<b class="tk-name">${p.name}</b>` : ''}<p>${fill(text)}</p><i class="tk-next">▼</i></div></div>`;
}

// 준비 화면의 한 곳을 가리켜요 (오 사장님이 짚어 주는 줄)
//  짚은 곳만 구멍을 낸 어두운 막(#guideDim)을 화면 전체(위 막대 포함)에 덮어요. 스크롤하면 구멍도 따라가요
//  (큰 box-shadow는 아이폰 사파리에서 안 그려질 때가 있어서 clip-path 구멍으로 해요)
let guideEl = null, guideRaf = 0;
function guide(key) {
  document.querySelectorAll('.guide-on').forEach(e => e.classList.remove('guide-on'));
  const el = key && document.querySelector(`[data-guide="${key}"]`);
  $('screen').classList.toggle('guiding', !!el);
  guideEl = el || null;
  $('guideDim').hidden = !el;
  if (el) { el.classList.add('guide-on'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (!guideRaf) guideRaf = requestAnimationFrame(guideHole); }
  return !!el;
}
function guideHole() {
  guideRaf = 0;
  if (!guideEl || !guideEl.isConnected) { $('guideDim').hidden = true; return; }
  const a = $('app').getBoundingClientRect(), r = guideEl.getBoundingClientRect(), p = 6;
  const L = r.left - a.left - p, T = r.top - a.top - p, R = r.right - a.left + p, B = r.bottom - a.top + p;
  $('guideDim').style.clipPath = `polygon(0 0, 0 100%, ${L}px 100%, ${L}px ${T}px, ${R}px ${T}px, ${R}px ${B}px, ${L}px ${B}px, ${L}px 100%, 100% 100%, 100% 0)`;
  guideRaf = requestAnimationFrame(guideHole);
}

function drawScene() {
  const sc = SCENES[open.id], box = $('talk');
  guide(null);
  if (sc.paper) { box.className = 'talk paper-mode'; box.innerHTML = paperHTML(sc); return; }
  if (open.i < sc.lines.length) {
    const [who, text, at, pic] = sc.lines[open.i];
    if (who === 'tip') { box.className = 'talk tip-mode'; box.innerHTML = tipHTML(text, pic); playSfx('page'); return; }
    if (callStarts(sc.lines, open.i) && open.rung !== open.i) { open.ringing = true; box.className = 'talk ring-mode'; box.innerHTML = ringHTML(who); startRing(); return; } // 전화: 「받기」를 눌러야 대화 (ui/phone.js)
    if (who === 'oh' || who === 'ohPhone') setMusic('oh'); // 오 사장님이 말하면 테마곡
    box.className = 'talk' + (who ? (CAST[who].think ? ' think' : '') : ' narr') + (guide(at) ? ' guide' : '');
    box.innerHTML = lineHTML(who, text);
    typeIn(box);
    return;
  }
  box.className = 'talk';
  box.innerHTML = `<div class="tk-box"><div class="tk-body"><b class="tk-name">새 간판</b><p>가게 이름을 지어 주세요</p>
    <div class="ask-row"><input id="talkName" maxlength="8" value="골목분식" autocomplete="off" aria-label="가게 이름"><button type="button" class="btn primary" data-talk="name">간판 걸기</button></div></div></div>`;
}

// 장사 요령 카드 (오 사장님 가게 길잡이 — 데이브 더 다이버의 요령 카드처럼): 그림 · 한두 문장 · 확인
function tipHTML(text, pic) {
  const pics = [].concat(pic || []).map(n => `<span class="tip-pic">${icon(n)}</span>`).join('');
  return `<div class="tip-card"><small class="tip-tag">장사 요령</small>${pics ? `<div class="tip-pics">${pics}</div>` : ''}<p>${fill(text)}</p><span class="btn primary">확인</span></div>`;
}

// 오 사장님이 시키는 일: 가게 그림 아래쪽 띠 (화살표는 render/view.js). 매 프레임 불러요 (main.js)
let tutLast = '';
export function updateTutBar() {
  const a = G.phase === 'day' ? tutAsk() : null, el = $('tutBar');
  const html = a ? `<span class="tb-face">${icon('char' + CAST.oh.char)}</span><p>${a.text}</p>` : '';
  if (html === tutLast) return;
  tutLast = html;
  el.innerHTML = html; el.hidden = !a;
  if (a) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}

// 시세 소식: 우리 가게에 무엇이 바뀌는지 (오르내리는 재료 · 그 재료를 쓰는 메뉴의 원가·원가율 · 며칠)
const newsShopMenus = n => newsMenus(n).filter(m => menuOpen(m));
function marketEffect(id) {
  const n = MARKET_NEWS[id], up = n.mul > 1;
  const ings = n.ings.map(i => INGREDIENTS[i].name).join('·');
  const rows = newsShopMenus(n).map(m => {
    const base = MENUS[m].cost, now = costOf(m), pr = G.prices[m];
    return `<b>${MENUS[m].name} 1인분 원가 ${won(base)} → ${won(now)}</b><span>지금 가격이면 원가율 ${Math.round(base / pr * 100)}% → ${Math.round(now / pr * 100)}%</span>`;
  }).join('');
  return `<div class="np-effect ${up ? 'up' : 'down'}"><small>${G.shop} · ${ings} 값 ${up ? '오름' : '내림'} · ${n.days === 1 ? "오늘 하루" : `${n.days}일 동안`}</small>${rows}</div>`;
}

function paperHTML(sc) {
  const P = sc.paper;
  return `<div class="np">
    <div class="np-mast"><b>골목 신문</b><small>${P.tag || `제${P.no}호`} · ${G.day}일차</small></div>
    <div class="np-pic">${P.market ? icon(newsShopMenus(MARKET_NEWS[P.market])[0] || 'tteok') : `${icon('char0')}${icon('tteok')}`}</div>
    <h3 class="np-head">${fill(P.head)}</h3>
    <p class="np-sub">${fill(P.sub)}</p>
    <p class="np-body">${fill(P.body)}</p>
    ${P.market ? marketEffect(P.market) : ''}
    ${sc.title ? `<div class="np-title"><small>칭호</small><b>${sc.title}</b></div>` : ''}
    <small class="np-tap">눌러서 넘기기</small>
  </div>`;
}

function finish(name) {
  stopTyping();
  stopRing();
  open = null;
  guide(null);
  setMusic(null);
  $('talk').hidden = true; $('talk').innerHTML = '';
  runCmd('sceneDone', { name });
  if (G.phase === 'day') runCmd('hold', { on: false });
  updateQuestTrack();
  showNextScene();
}

// 전화 받기
function answer() {
  stopRing();
  open.ringing = false; open.rung = open.i;
  playSfx('open');
  drawScene();
}

function advance() {
  const sc = SCENES[open.id];
  if (sc.paper) { finish(); return; }
  if (open.i >= sc.lines.length) return; // 이름 짓는 중
  open.i++;
  playSfx('tap');
  if (open.i >= sc.lines.length && !sc.ask) finish(); else drawScene();
}

export function initStory() {
  $('questTrack').addEventListener('click', e => { if (e.target.closest('[data-qopen]')) openQuests(); });
  $('qModal').addEventListener('click', e => { if (e.target === $('qModal') || e.target.closest('[data-qclose]')) { closeQuests(); playSfx('tap'); } }); // 창 밖을 눌러도 닫혀요
  const box = $('talk');
  box.addEventListener('click', e => {
    if (stopTyping()) return; // 한 글자씩 나오는 중이면 먼저 다 보여 줘요
    if (cutWaiting()) { cutTap(); return; }
    if (!open || cutActive()) return;
    if (open.ringing) { if (e.target.closest('[data-ring]')) answer(); return; } // 울리는 동안은 「받기」만
    if (e.target.closest('[data-talk=name]')) { finish($('talkName').value); return; }
    if (e.target.closest('input')) return;
    advance();
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'talkName') finish(e.target.value); });
  addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && stopTyping()) { e.preventDefault(); return; }
    if (cutWaiting() && (e.code === 'Space' || e.code === 'Enter')) { cutTap(); e.preventDefault(); return; }
    if (open && open.ringing && (e.code === 'Space' || e.code === 'Enter')) { answer(); e.preventDefault(); return; }
    if (open && !cutActive() && !SCENES[open.id].ask && (e.code === 'Space' || e.code === 'Enter')) { advance(); e.preventDefault(); }
  });
}
export const talking = () => !!open;

// 퀘스트 한 줄
function questRow(id, full) {
  const q = QUESTS[id], [a, b] = questProg(id), wait = questWaiting(id);
  const count = b > 1 && !wait ? ` ${a}/${b}` : '';
  const btn = full && q.kind === 'pay' ? `<button type="button" class="btn small" data-act="questPay" data-q="${id}">${won(q.cost)} 내기</button>` : '';
  return `<div class="qrow">${face(q.who, 'q-face')}<div class="q-txt"><b>${q.title}</b><small>${wait ? q.wait : q.goal + count}</small>${b > 1 && !wait ? `<i class="q-bar"><i style="width:${Math.round(a / b * 100)}%"></i></i>` : ''}</div>${btn}</div>`;
}

// 준비 화면: 지금 장과 할 일
export function questCard() {
  const S = G.story;
  if (!S || (!S.active.length && !S.title)) return '';
  const ch = CHAPTERS[S.ch];
  return `<div class="qcard" data-guide="quest">
    <div class="q-head"><small>${ch.name}</small><b>${ch.sub}</b>${S.title ? `<span class="q-title">${S.title}</span>` : ''}</div>
    ${S.active.map(id => questRow(id, true)).join('') || `<p class="q-none">${S.queue.length ? '이야기가 이어집니다…' : '지금은 이어지는 이야기가 없습니다'}</p>`}
  </div>`;
}

// 영업 중: 위 막대 주문표 아래 — 돌발 이벤트(남은 시간·진행도)와 「퀘스트」 버튼. 퀘스트는 눌러서 창으로 한 번에 봐요
let lastTrack = '', lastDone = -1, popT = 0;
export function updateQuestTrack() {
  const el = $('questTrack');
  const S = G.story, day = G.phase === 'day';
  // 돌발 이벤트: 빨간 띠 (이름 · 진행도 · 남은 시간 막대, 얼마 안 남으면 깜빡) — 둘이면 3초마다 번갈아
  //  남은 시간 막대 폭은 아래에서 바로 바꿔요 (띠를 다시 그리면 「쿵」 움직임이 다시 나와서, 진행도가 바뀔 때만 다시 그려요)
  const act = day ? activeIncidents() : [];
  const cur = act.length ? act[Math.floor(performance.now() / 3000) % act.length] : null;
  const curD = cur && incidentInfo(cur);
  const inc = cur ? `<div class="qt inc${curD.left !== null && curD.left <= 0.25 ? ' hurry' : ''}" data-qopen="1"><span class="inc-tag">!</span><span class="inc-name">${curD.short || curD.name}</span>${curD.prog ? `<b>${curD.prog[0]}/${curD.prog[1]}</b>` : ''}${curD.left !== null ? '<i class="inc-time"><i></i></i>' : ''}${act.length > 1 ? `<small class="inc-more">+${act.length - 1}</small>` : ''}</div>` : '';
  // 퀘스트를 끝내면 버튼이 잠깐 반짝여요 (끝냈다는 알림은 toast로)
  const done = S ? S.done.length : 0;
  if (lastDone >= 0 && done > lastDone) popT = performance.now() + 1600;
  lastDone = done;
  const n = S ? S.active.length : 0;
  const pop = performance.now() < popT;
  const btn = day && S && (n || S.title) ? `<button type="button" class="qt qbtn${pop ? ' pop' : ''}" data-qopen="1" aria-label="퀘스트 보기">퀘스트${n ? ` <b>${n}</b>` : ''}</button>` : '';
  const html = inc + btn;
  if (html !== lastTrack) { lastTrack = html; el.innerHTML = html; }
  el.hidden = !html;
  const bar = cur && curD.left !== null && el.querySelector('.inc-time > i');
  if (bar) bar.style.width = (curD.left * 100).toFixed(1) + '%';
}

// 퀘스트 창: 지금 장 · 할 일 전부 · 진행 중인 돌발 이벤트 (영업 중에 열면 가게는 잠깐 멈춰요)
let qHeld = false;
export function openQuests() {
  const S = G.story;
  if (!S) return;
  const ch = CHAPTERS[S.ch];
  const inc = G.phase === 'day' ? activeIncidents().map(x => {
    const D = incidentInfo(x), prog = D.prog ? `${D.prog[0]}/${D.prog[1]}` : '';
    return `<div class="qrow inc"><span class="inc-tag">돌발</span><div class="q-txt"><b>${D.name}</b><small>${D.goal}${prog ? ` · ${prog}` : ''}${x.until !== undefined ? ` · ${clockText(x.until)}까지` : ''}</small></div></div>`;
  }).join('') : '';
  $('qModal').innerHTML = `<div class="qm-card" role="dialog" aria-label="퀘스트">
    <div class="q-head"><small>${ch.name}</small><b>${ch.sub}</b>${S.title ? `<span class="q-title">${S.title}</span>` : ''}</div>
    ${inc ? `<small class="qm-h">돌발 이벤트</small>${inc}<small class="qm-h">퀘스트</small>` : ''}
    ${S.active.map(id => questRow(id, false)).join('') || `<p class="q-none">${S.queue.length ? '이야기가 이어집니다…' : '지금은 이어지는 이야기가 없습니다'}</p>`}
    <button type="button" class="btn" data-qclose="1">닫기</button>
  </div>`;
  $('qModal').hidden = false;
  if (G.phase === 'day' && G.run && !G.run.paused) { runCmd('hold', { on: true }); qHeld = true; }
  playSfx('page');
}
export function closeQuests() {
  if ($('qModal').hidden) return;
  $('qModal').hidden = true; $('qModal').innerHTML = '';
  if (qHeld) { qHeld = false; if (G.phase === 'day') runCmd('hold', { on: false }); }
}

// 영수증: 오늘의 돌발 이벤트
export function incidentCard(list) {
  if (!list || !list.length) return '';
  return `<div class="hl wide incident"><small>돌발 이벤트</small><b>${list.map(i => `${i.name} ${i.ok ? '성공' + (i.bonus ? ` +${i.bonus.toLocaleString('ko-KR')}원` : '') : '실패'}`).join(' · ')}</b></div>`;
}

// 영수증·주간 정산: 오늘 끝낸 퀘스트
export function doneCard(ids) {
  if (!ids || !ids.length) return '';
  return `<div class="hl wide quest"><small>퀘스트 완료</small><b>${ids.map(id => QUESTS[id].title).join(' · ')}</b></div>`;
}
