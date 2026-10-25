// 설정 (이 기기에만 기억해요 — 브라우저 저장소. 막혀 있으면 기본값으로)
//  music·sfx: 크기 단계 0~4 (0 = 끔, 4 = 100%) · vibe: 진동 1/0 · talk: 대화 글 0 한 번에 / 1 한 글자씩
const KEY = 'sosang-settings';
export const LEVELS = [0, 0.25, 0.5, 0.75, 1];
const S = { music: 4, sfx: 4, vibe: 1, talk: 0 };
try {
  Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}'));
  if (localStorage.getItem('sosang-music') === 'off') S.music = 0; // 옛 「음악 끄기」 버튼 설정
} catch (e) { /* 저장소를 못 쓰는 환경 */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.removeItem('sosang-music'); } catch (e) { /* 그대로 */ } }

export const setting = k => S[k];
export const levelVol = k => LEVELS[Math.max(0, Math.min(4, S[k] | 0))];
export function stepSetting(k, d) { S[k] = Math.max(0, Math.min(4, (S[k] | 0) + d)); save(); return S[k]; }
export function setOption(k, v) { S[k] = v; save(); }

// 진동 (안드로이드 브라우저만 돼요. 아이폰 사파리는 진동 기능을 열어 주지 않아요)
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function vibrate(pattern) { if (S.vibe && canVibrate()) { try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ } } }

// 홈 화면에 추가 (웹앱 설치)
//  installed: 이미 홈 화면에서 열림 · prompt: 바로 설치 창을 띄울 수 있음(안드로이드 크롬) · ios: 사파리 공유 버튼으로 · web: 웹앱 주소에서만
export const WEBAPP_URL = 'https://yonipang.github.io/sosang-tycoon/';
let installEvent = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
export function installState() {
  if ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone) return 'installed';
  if (installEvent) return 'prompt';
  if (!/github\.io$/.test(location.hostname)) return 'web';
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 'manual';
}
export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch (e) { /* 무시 */ }
  installEvent = null;
  return true;
}
