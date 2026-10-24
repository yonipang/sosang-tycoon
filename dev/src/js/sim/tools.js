// 장사 도구 규칙: 사기 · 효과 (손 수 · 미니게임 구간 · 미리 만들어 둔 그릇)
import { G } from '../save/state.js';
import { TOOLS, COOK_EASE } from '../data/tools.js';
import { COOK_GAMES } from '../data/menu.js';
import { HANDS_MAX } from '../data/economy.js';
import { emit, defineCmd } from './events.js';
import { josa } from '../engine/util.js';
import { storyNote } from './story.js';

export const hasTool = id => !!G.story && (G.story.tools || []).includes(id);
export const handsMax = () => HANDS_MAX + (hasTool('tray') ? TOOLS.tray.effect.hands : 0);
// 미니게임 구간: 주방 타이머가 있으면 넓은 구간
export const cookRule = game => hasTool('timer') ? { ...COOK_GAMES[game], ...COOK_EASE[game] } : COOK_GAMES[game];
// 새벽에 미리 만들어 둘 수 있는 그릇 수 (보온 통 · 재료가 있는 만큼만) { 메뉴: 수 }
export function readyCap(stock) {
  const out = {};
  for (const id of G.story ? G.story.tools : []) {
    const rd = TOOLS[id].effect.ready;
    if (rd) for (const m in rd) if (Math.min(rd[m], stock[m] || 0) > 0) out[m] = Math.min(rd[m], stock[m] || 0);
  }
  return out;
}

defineCmd('buyTool', ({ id }) => {
  const t = TOOLS[id], S = G.story;
  if (!t || !S.toolsOpen || hasTool(id) || G.phase !== 'prep') return;
  if (G.cash < t.price) { emit('toast', '잔고가 모자랍니다', 'warn'); return; }
  G.cash -= t.price;
  S.tools.push(id);
  emit('sfx', 'coin');
  emit('toast', `${josa(t.name, '을/를')} 들였습니다`, 'good');
  storyNote('buyTool');
  emit('prep');
});
