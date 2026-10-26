// 손님 수첩 기록 (data/people.js): 누가 몇 번 왔는지 · 마지막 만족 — 영업 중엔 G.run.log에 모았다가 마감 때 G.book에 더해요
//  G.book { 그림 번호: { first: 처음 온 날, visits: 온 횟수, sat: 마지막 만족(1~5) } } · 맛있게 먹은 메뉴·다시 온 횟수는 G.fans (sim/upgrade.js)
import { G } from '../save/state.js';
import { REGULAR_BACK } from '../data/people.js';

export function noteVisit(char) { const L = G.run.log; L.visits[char] = (L.visits[char] || 0) + 1; }
export function noteBookSat(char, sat) { G.run.log.lastSat[char] = sat; }
export function bookEndDay() {
  const L = G.run.log;
  for (const ch in L.visits) { const b = (G.book[ch] = G.book[ch] || { first: G.day, visits: 0, sat: null }); b.visits += L.visits[ch]; }
  for (const ch in L.lastSat) if (G.book[ch]) G.book[ch].sat = L.lastSat[ch];
}
export const bookSeen = ch => !!(G.book && G.book[ch]);
export const regularCandidate = ch => !!(G.fans && G.fans[ch] && G.fans[ch].n >= REGULAR_BACK);
