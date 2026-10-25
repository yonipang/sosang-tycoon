// 브라우저 저장 (localStorage는 막혀 있을 수 있어서 모두 try/catch)
import { G, SAVE_KEY, serialize, deserialize } from './state.js';

export const BACKUP_KEY = 'sosang-tycoon-backup'; // 클라우드 세이브로 바꾸기 직전의 이 기기 세이브 하나

export function saveGame() {
  try { if (G.meta) G.meta.at = Date.now(); localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
export function loadGame() {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return false;
    deserialize(t);
    return true;
  } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 저장소를 못 쓰는 환경 */ }
}
// 클라우드 저장이 쓰는 것: 세이브 글 그대로 읽기 · 바꿔 넣기 (바꾸기 전 것은 백업)
export function saveText() {
  try { return localStorage.getItem(SAVE_KEY) || ''; } catch (e) { return ''; }
}
export function replaceSave(text) {
  try { const old = localStorage.getItem(SAVE_KEY); if (old) localStorage.setItem(BACKUP_KEY, old); localStorage.setItem(SAVE_KEY, text); return true; } catch (e) { return false; }
}
// 세이브 한눈에 보기 (고를 때 쓰는 요약)
export function saveSummary(text) {
  try {
    const o = JSON.parse(text);
    return { id: (o.meta && o.meta.id) || '', at: (o.meta && o.meta.at) || 0, day: o.day || 1, shop: o.shop || '', ch: (o.story && o.story.ch) || 0 };
  } catch (e) { return null; }
}
