// 이야기 화면: 대화 창 · 골목 신문 · 가게 이름 짓기 · 퀘스트 카드(준비 화면) · 퀘스트 표시(영업 중 왼쪽 위)
import { G } from '../save/state.js';
import { $, won } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { CAST, CHAPTERS, QUESTS, SCENES } from '../data/story.js';
import { questProg, questWaiting } from '../sim/story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';

let open = null; // 보고 있는 장면 { id, i: 몇 번째 줄 }
const fill = s => s.replace(/\{shop\}/g, G.shop);
const face = (who, cls) => `<span class="${cls}">${icon('char' + CAST[who].char)}</span>`;

// 보여 줄 장면이 있으면 하나 열어요 (준비 화면에서, 또는 「바로」 장면이면 영업 중에도)
export function showNextScene() {
  if (open || !G.story || G.phase === 'title') return;
  const id = G.story.queue[0];
  const sc = id && SCENES[id];
  if (!sc || (sc.when !== 'now' && G.phase !== 'prep')) return;
  if (G.phase === 'day') runCmd('hold', { on: true });
  open = { id, i: 0 };
  $('talk').hidden = false;
  drawScene();
  playSfx('page');
}

function drawScene() {
  const sc = SCENES[open.id], box = $('talk');
  if (sc.paper) { box.className = 'talk paper-mode'; box.innerHTML = paperHTML(sc); return; }
  if (open.i < sc.lines.length) {
    const [who, text] = sc.lines[open.i];
    const p = who && CAST[who];
    box.className = 'talk' + (p ? '' : ' narr');
    box.innerHTML = `<div class="tk-box">${p ? face(who, 'tk-face') : ''}<div class="tk-body">${p ? `<b class="tk-name">${p.name}</b>` : ''}<p>${fill(text)}</p><i class="tk-next">▼</i></div></div>`;
    return;
  }
  box.className = 'talk';
  box.innerHTML = `<div class="tk-box"><div class="tk-body"><b class="tk-name">새 간판</b><p>가게 이름을 지어 주세요</p>
    <div class="ask-row"><input id="talkName" maxlength="8" value="골목분식" autocomplete="off" aria-label="가게 이름"><button type="button" class="btn primary" data-talk="name">간판 걸기</button></div></div></div>`;
}

function paperHTML(sc) {
  const P = sc.paper;
  return `<div class="np">
    <div class="np-mast"><b>골목 신문</b><small>제${P.no}호 · ${G.day}일차</small></div>
    <div class="np-pic">${icon('char0')}${icon('tteok')}</div>
    <h3 class="np-head">${fill(P.head)}</h3>
    <p class="np-sub">${fill(P.sub)}</p>
    <p class="np-body">${fill(P.body)}</p>
    ${sc.title ? `<div class="np-title"><small>칭호</small><b>${sc.title}</b></div>` : ''}
    <small class="np-tap">눌러서 넘기기</small>
  </div>`;
}

function finish(name) {
  open = null;
  $('talk').hidden = true; $('talk').innerHTML = '';
  runCmd('sceneDone', { name });
  if (G.phase === 'day') runCmd('hold', { on: false });
  updateQuestTrack();
  showNextScene();
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
  const box = $('talk');
  box.addEventListener('click', e => {
    if (!open) return;
    if (e.target.closest('[data-talk=name]')) { finish($('talkName').value); return; }
    if (e.target.closest('input')) return;
    advance();
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'talkName') finish(e.target.value); });
  addEventListener('keydown', e => { if (open && !SCENES[open.id].ask && (e.code === 'Space' || e.code === 'Enter')) { advance(); e.preventDefault(); } });
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
  return `<div class="qcard">
    <div class="q-head"><small>${ch.name}</small><b>${ch.sub}</b>${S.title ? `<span class="q-title">${S.title}</span>` : ''}</div>
    ${S.active.map(id => questRow(id, true)).join('') || `<p class="q-none">${S.queue.length ? '이야기가 이어집니다…' : '지금은 이어지는 이야기가 없습니다'}</p>`}
  </div>`;
}

// 영업 중: 위 막대 주문표 아래에 할 일 (2개까지)
let lastTrack = '';
export function updateQuestTrack() {
  const el = $('questTrack');
  const S = G.story;
  const html = S && G.phase === 'day' ? S.active.slice(0, 2).map(id => {
    const q = QUESTS[id], [a, b] = questProg(id), wait = questWaiting(id);
    return `<div class="qt">${face(q.who, 'q-face')}<span>${wait ? q.title : q.goal}${b > 1 && !wait ? ` <b>${a}/${b}</b>` : ''}</span></div>`;
  }).join('') : '';
  if (html !== lastTrack) { lastTrack = html; el.innerHTML = html; }
  el.hidden = !html;
}

// 영수증·주간 정산: 오늘 끝낸 퀘스트
export function doneCard(ids) {
  if (!ids || !ids.length) return '';
  return `<div class="hl wide quest"><small>퀘스트 완료</small><b>${ids.map(id => QUESTS[id].title).join(' · ')}</b></div>`;
}
