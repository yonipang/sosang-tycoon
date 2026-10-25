// 설정 (이 기기에만 기억해요 — 브라우저 저장소. 막혀 있으면 기본값으로)
//  music·sfx: 크기 단계 0~4 (0 = 끔, 4 = 100%)
const KEY = 'sosang-settings';
export const LEVELS = [0, 0.25, 0.5, 0.75, 1];
const S = { music: 4, sfx: 4 };
try {
  Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}'));
  if (localStorage.getItem('sosang-music') === 'off') S.music = 0; // 옛 「음악 끄기」 버튼 설정
} catch (e) { /* 저장소를 못 쓰는 환경 */ }

export const setting = k => S[k];
export const levelVol = k => LEVELS[Math.max(0, Math.min(4, S[k] | 0))];
export function stepSetting(k, d) {
  S[k] = Math.max(0, Math.min(4, (S[k] | 0) + d));
  try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.removeItem('sosang-music'); } catch (e) { /* 그대로 */ }
  return S[k];
}
