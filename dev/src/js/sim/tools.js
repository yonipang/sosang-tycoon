// 장사 도구 규칙: 사기 · 효과 (손 수 · 미니게임 구간 · 미리 만들어 둔 그릇)
import { G } from '../save/state.js';
import { TOOLS, COOK_EASE, PREP_BIG } from '../data/tools.js';
import { COOK_GAMES } from '../data/menu.js';
import { HANDS_MAX } from '../data/economy.js';
import { emit, defineCmd } from './events.js';
import { josa } from '../engine/util.js';
import { storyNote } from './story.js';
import { toolUp, rollTaps, fryZone } from './guild.js';
import { COOK_EASE2 } from '../data/guild.js';

export const hasTool = id => !!G.story && (G.story.tools || []).includes(id);
export const handsMax = () => HANDS_MAX + (hasTool('tray') ? TOOLS.tray.effect.hands : 0) + (toolUp('tray') ? 1 : 0); // 큰 쟁반(상인회) +1
// 미니게임 구간: 주방 타이머가 있으면 넓은 구간
//  디지털 타이머(상인회 도구 등급 업) · 김밥 작업대 Lv2(덜 눌러도 말림) · 튀김기 Lv2(구간 넓게) — sim/guild.js
export function cookRule(game) {
  const g = { ...COOK_GAMES[game], ...(hasTool('timer') ? COOK_EASE[game] : {}), ...(toolUp('timer') ? COOK_EASE2[game] : {}) };
  if (game === 'roll') g.taps = rollTaps(g.taps);
  const fz = game === 'fry' && fryZone();
  if (fz) { g.perfect = [Math.min(g.perfect[0], fz.perfect[0]), Math.max(g.perfect[1], fz.perfect[1])]; g.good = [Math.min(g.good[0], fz.good[0]), Math.max(g.good[1], fz.good[1])]; }
  return g;
}
// 프렙 통: 준비 시간에 미리 만들어 둘 수 있는 그릇 수 (v0.65 — 보온 통의 새벽 끓이기 대신) · 큰 프렙 통(상인회)
export const prepMax = () => (hasTool('warmer') ? (toolUp('warmer') ? PREP_BIG : TOOLS.warmer.effect.prep) : 0);
// (옛 새벽 끓이기 — v0.65부터 쓰지 않아요: 늘 빈 값이라 새벽 창이 열리지 않아요)
export function readyCap() { return {}; }

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
