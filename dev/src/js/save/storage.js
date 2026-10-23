// 브라우저 저장 (localStorage는 막혀 있을 수 있어서 모두 try/catch)
import { SAVE_KEY, serialize, deserialize } from './state.js';

export function saveGame() {
  try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; }
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
