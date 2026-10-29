// 3장 길 건너 떡볶이 공장 (data/rival.js): 3장 며칠째 · 공사 · 개업 · 오픈 세일 · 손님층·시간마다 가져가는 몫
//  G.story.c3 = 3장이 시작된 날 (sim/story.js sceneDone, 장면 ch: 3)
import { G } from '../save/state.js';
import { RIVAL } from '../data/rival.js';
import { emit, defineCmd } from './events.js';

export const c3Day = () => (G.story && G.story.ch >= 3 && G.story.c3 ? G.day - G.story.c3 + 1 : 0);
export const rivalHoard = () => c3Day() >= 1 && c3Day() < RIVAL.openDay;     // 공사 가림막
export const rivalBuilt = () => c3Day() >= RIVAL.openDay;                    // 개업
export const rivalSale = () => rivalBuilt() && c3Day() < RIVAL.openDay + RIVAL.sale.days;
// 이 시간 · 이 손님층 지나가는 사람 중 공장으로 가는 몫 (0~1)
export function rivalTake(type, hour) {
  if (!rivalBuilt() || hour < RIVAL.hours[0] || hour >= RIVAL.hours[1]) return 0;
  return (rivalSale() ? RIVAL.sale.take : RIVAL.take)[type] || 0;
}

// 골목에서 가림막을 처음 살펴보면 장면 (ui/town.js showVacant) — 장면을 띄웠으면 true
defineCmd('rivalLook', () => {
  const S = G.story;
  if (!rivalHoard() || (S.flags || {}).c3hoard) return false;
  (S.flags = S.flags || {}).c3hoard = true;
  S.queue.push('c3_hoard'); emit('story');
  return true;
});
