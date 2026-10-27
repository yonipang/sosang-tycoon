// 규칙이 남긴 사건(emit)을 받아 화면·소리로 보여 줘요.
import { G } from '../save/state.js';
import { $ } from '../engine/util.js';
import { onEvent } from '../sim/events.js';
import { tileToCss, addMark } from '../render/view.js';
import { saveGame } from '../save/storage.js';
import { cloudSaved } from '../save/cloud.js';
import { CAST } from '../data/story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';
import { renderPrep, renderReceipt, renderWeekly, renderPause, hideScreen, showConflict } from './screens.js';
import { setupCook, renderRush, renderDawn } from './hud.js';
import { showNextScene, updateQuestTrack, closeQuests } from './story.js';
import { incidentInfo } from '../sim/incidents.js';
import { incidentStart, incidentEnd, incidentReset } from './incident.js';
import { showTown, hideTown, townShown, refreshTown } from './town.js';
import { townMode } from '../sim/town.js';
import { SCENES } from '../data/story.js';
import { setMusic } from './music.js';
import { ohInShop } from '../sim/tutorial.js';

export function toast(text, kind, who) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info') + (who ? ' who' : '');
  if (who) el.innerHTML = `<span class="q-face">${icon('char' + CAST[who].char)}</span><span>${text}</span>`; // 이야기 인물이 하는 말
  else el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2600);
}

function float(x, y, text, kind) {
  const p = tileToCss(x, y);
  const el = document.createElement('div');
  el.className = 'float ' + (kind || '');
  el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('floats').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// 말풍선: 사람 머리 위를 따라다녀요 (지나가는 사람의 한마디 등)
const speech = [];
function say(id, text) {
  const el = document.createElement('div');
  el.className = 'say';
  el.textContent = text;
  $('floats').appendChild(el);
  speech.push({ id, el, t: 0 });
}
export function updateSpeech(dt) {
  for (let i = speech.length - 1; i >= 0; i--) {
    const s = speech[i]; s.t += dt;
    const c = G.run && G.run.customers.find(q => q.id === s.id);
    if (!c || s.t > 2.2) { s.el.remove(); speech.splice(i, 1); continue; }
    const p = tileToCss(c.x, c.y + (c.lane || 0) - 1.55);
    s.el.style.left = p.x + 'px'; s.el.style.top = p.y + 'px';
    s.el.style.opacity = s.t > 1.9 ? String((2.2 - s.t) / 0.3) : '1';
  }
}

// 줄 서 있는 장면이 준비 화면의 한 곳을 짚으면(장사 도구·가격 …) 마을 대신 장부를 먼저 열어요
function sceneWantsLedger() {
  const sc = SCENES[G.story && G.story.queue[0]];
  return !!(sc && sc.lines && sc.lines.some(l => l[2]));
}
const renderBarSoon = () => refreshTown();
// 첫날 길잡이: 처음 겪는 일마다 한 번씩만
const shown = new Set();
// oh: 프롤로그(알바 사흘) 동안은 오 사장님이 옆에서 말해 줘요
function hint(key, text, oh) {
  if (G.day > 2 || shown.has(key) || ohInShop()) return; // 프롤로그 1~2일차는 오 사장님이 가게에서 직접 (sim/tutorial.js)
  shown.add(key);
  if (oh && G.story && G.story.ch === 0) toast(oh, 'hint', 'oh');
  else toast(text, 'hint');
}

export function initFeedback() {
  onEvent('toast', toast);
  onEvent('float', float);
  onEvent('say', say);
  onEvent('sfx', playSfx);
  onEvent('tapMark', (x, y) => { addMark(x, y); playSfx('tap'); });
  onEvent('cook', (on, menu, game) => {
    if (on) setupCook(menu, game);
    $('cookUI').hidden = !on;
    if (on && G.run && G.run.dawn) $('dawnUI').hidden = true; // 새벽에 끓이는 동안은 새벽 창을 잠깐 내려요
    if (!on) hint('serve', '음식을 든 채로 손님 자리를 눌러 보세요', '다 됐으면 손님 자리를 눌러서 갖다줘. 식기 전에!');
  });
  // 돌발 이벤트: 시작하면 대화·목표 카드, 끝나면 결과 카드 (ui/incident.js) · 진행은 위 막대 빨간 띠 (ui/story.js)
  onEvent('incident', (what, x) => {
    const D = incidentInfo(x);
    if (what === 'start') incidentStart(x);
    else if (what === 'end') incidentEnd(x);
    else if (what === 'prog' && G.run && D.prog) float(G.run.player.x, G.run.player.y - 2.2, `${D.name} ${D.prog[0]}/${D.prog[1]}`, 'great'); // 이벤트 진행도는 빨간 띠와 함께 사장 머리 위에도
    if (D.kind === 'mission' && what !== 'prog') setMusic(what === 'start' ? 'oh' : null); // 오 사장님 미션 동안 테마곡
    updateQuestTrack();
  });
  onEvent('dawn', (on, q) => {
    $('dawnUI').hidden = !on;
    if (on) renderDawn();
    if (q !== undefined) toast(q === 2 ? '완벽한 떡볶이를 보온 통에 담았습니다' : '떡볶이를 보온 통에 담았습니다', q === 2 ? 'good' : 'info');
  });
  onEvent('fridge', open => { if (open) $('rushUI').hidden = false; if (!$('rushUI').hidden) renderRush(); });
  onEvent('order', () => hint('order', '주문이 들어왔습니다! 말풍선이 뜬 조리대를 눌러 보세요', '주문 들어왔다! 말풍선 뜬 화구를 눌러.'));
  onEvent('phase', p => {
    if (p !== 'day') setMusic(null); // 영업이 끝나면 미션 음악도 멈춰요
    if (p !== 'day') { closeQuests(); incidentReset(); $('cookUI').hidden = true; $('rushUI').hidden = true; $('dawnUI').hidden = true; $('toasts').innerHTML = ''; } // 영업 중 알림은 정산 화면으로 넘기지 않아요
    if (p !== 'prep') hideTown();
    document.body.classList.toggle('in-town', p === 'prep' && townMode());
    if (p === 'prep') { setTimeout(showConflict, 0); if (saveGame()) cloudSaved(); if (townMode() && !sceneWantsLedger()) { hideScreen(); showTown(); } else renderPrep(); showNextScene(); }
    else if (p === 'day') hideScreen();
    else if (p === 'receipt') renderReceipt();
    else if (p === 'weekly') renderWeekly();
    updateQuestTrack();
  });
  onEvent('prep', () => { // 준비 화면·마을에서 바뀐 것(이야기 장면·수리비·장보기 등)은 바로 저장
    if (saveGame()) cloudSaved();
    if (townMode() && townShown() && $('screen').hidden) refreshTown(); else renderPrep();
  });
  // 마을: 가게 장부(준비 화면)를 열어요 · 새벽에 장면이 기다리고 있으면
  onEvent('town', what => {
    if (what === 'ledger' || what === 'open') { playSfx('page'); renderPrep(); return; }
    if (!$('screen').hidden && $('screen').classList.contains('scr-prep')) hideScreen(); // 장부를 보다가 골목 일을 하면 골목으로
    if (!townShown()) showTown();
    if (what === 'dawn') renderBarSoon();
  });
  onEvent('story', showNextScene);
  onEvent('menuUp', m => { const el = document.querySelector(`.urow[data-m="${m}"]`); if (el) { el.classList.add('lvup'); el.scrollIntoView({ block: 'nearest' }); } }); // 메뉴 레벨이 오르면 그 줄이 반짝
  onEvent('quest', updateQuestTrack);
  onEvent('pause', on => { if (on) renderPause(); else if (G.phase === 'day') hideScreen(); });
  onEvent('closing', () => playSfx('page'));
}

// 계산 줄이 처음 생기면 알려 줘요 (main.js가 매 프레임 불러요)
export function watchHints() {
  const r = G.run;
  if (r && r.payLine.length && !(r.player.target && r.player.target.kind === 'register')) hint('pay', '계산 줄이 생겼습니다. 계산대를 눌러 보세요', '계산 줄 섰다. 계산대 뒤에 서 있어야 계산이 돼.');
}
