// 규칙이 남긴 사건(emit)을 받아 화면·소리로 보여 줘요.
import { G } from '../save/state.js';
import { $ } from '../engine/util.js';
import { onEvent } from '../sim/events.js';
import { tileToCss, addMark } from '../render/view.js';
import { saveGame } from '../save/storage.js';
import { playSfx } from './sfx.js';
import { renderPrep, renderReceipt, renderWeekly, renderPause, hideScreen } from './screens.js';

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
  onEvent('sfx', playSfx);
  onEvent('tapMark', (x, y) => { addMark(x, y); playSfx('tap'); });
  onEvent('cook', (on) => {
    $('cookUI').hidden = !on;
    if (!on) hint('serve', '음식을 든 채로 손님 자리를 눌러 보세요');
  });
  onEvent('order', () => hint('order', '주문이 들어왔습니다! 말풍선이 뜬 조리대를 눌러 보세요'));
  onEvent('phase', p => {
    if (p !== 'day') $('cookUI').hidden = true;
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
