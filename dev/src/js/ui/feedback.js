// 규칙이 남긴 사건(emit)을 받아 화면·소리로 보여 줘요.
import { G } from '../save/state.js';
import { $ } from '../engine/util.js';
import { onEvent } from '../sim/events.js';
import { tileToCss, addMark } from '../render/view.js';
import { saveGame } from '../save/storage.js';
import { playSfx } from './sfx.js';
import { renderPrep, renderReceipt, renderWeekly, renderPause, hideScreen } from './screens.js';
import { setupCook, renderRush } from './hud.js';

export function toast(text, kind) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.textContent = text;
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

// 첫날 길잡이: 처음 겪는 일마다 한 번씩만
const shown = new Set();
function hint(key, text) {
  if (G.day > 2 || shown.has(key)) return;
  shown.add(key);
  toast(text, 'hint');
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
    if (!on) hint('serve', '음식을 든 채로 손님 자리를 눌러 보세요');
  });
  onEvent('fridge', open => { if (open) $('rushUI').hidden = false; if (!$('rushUI').hidden) renderRush(); });
  onEvent('order', () => hint('order', '주문이 들어왔습니다! 말풍선이 뜬 조리대를 눌러 보세요'));
  onEvent('phase', p => {
    if (p !== 'day') { $('cookUI').hidden = true; $('rushUI').hidden = true; $('toasts').innerHTML = ''; } // 영업 중 알림은 정산 화면으로 넘기지 않아요
    if (p === 'prep') { saveGame(); renderPrep(); }
    else if (p === 'day') hideScreen();
    else if (p === 'receipt') renderReceipt();
    else if (p === 'weekly') renderWeekly();
  });
  onEvent('prep', () => renderPrep());
  onEvent('pause', on => { if (on) renderPause(); else if (G.phase === 'day') hideScreen(); });
  onEvent('closing', () => playSfx('page'));
}

// 계산 줄이 처음 생기면 알려 줘요 (main.js가 매 프레임 불러요)
export function watchHints() {
  const r = G.run;
  if (r && r.payLine.length && !(r.player.target && r.player.target.kind === 'register')) hint('pay', '계산 줄이 생겼습니다. 계산대를 눌러 보세요');
}
