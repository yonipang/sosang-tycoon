// 설정 (이 기기에만 기억해요 — 브라우저 저장소. 막혀 있으면 기본값으로)
//  music·sfx: 크기 단계 0~4 (0 = 끔, 4 = 100%) · vibe: 진동 1/0 · talk: 대화 글 0 한 번에 / 1 한 글자씩 · stats: 플레이 기록 1/0
const KEY = 'sosang-settings';
export const LEVELS = [0, 0.25, 0.5, 0.75, 1];
const S = { music: 4, sfx: 4, vibe: 1, talk: 0, stats: 1 }; // stats: 익명 플레이 기록 보내기 (ui/analytics.js)
try {
  Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}'));
  if (localStorage.getItem('sosang-music') === 'off') S.music = 0; // 옛 「음악 끄기」 버튼 설정
} catch (e) { /* 저장소를 못 쓰는 환경 */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.removeItem('sosang-music'); } catch (e) { /* 그대로 */ } }

export const setting = k => S[k];
export const levelVol = k => LEVELS[Math.max(0, Math.min(4, S[k] | 0))];
export function stepSetting(k, d) { S[k] = Math.max(0, Math.min(4, (S[k] | 0) + d)); save(); return S[k]; }
export function setOption(k, v) { S[k] = v; save(); }

// 진동: 안드로이드는 navigator.vibrate. 아이폰 사파리는 진동 기능을 열어 주지 않아서,
//  설정 앱 같은 「스위치」 체크박스(iOS 18~)를 누르면 나는 짧은 「톡」을 빌려 써요 — 숨긴 스위치를 대신 눌러요 (세기·길이는 못 바꾸고 한 번에 톡 한 번)
const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const IOS_SWITCH = IOS && typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
let tick = null;
function iosTick() {
  if (!tick) {
    const box = document.createElement('label');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
    box.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    document.body.appendChild(box);
    tick = box;
  }
  tick.click();
}
export const vibeKind = () => (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? 'android' : IOS_SWITCH ? 'ios' : '');
export const canVibrate = () => !!vibeKind();
export function vibrate(pattern) {
  if (!S.vibe) return;
  const k = vibeKind();
  if (k === 'android') { try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ } return; }
  if (k === 'ios') { // [울림, 쉼, 울림 …] → 울림마다 톡 한 번
    const p = Array.isArray(pattern) ? pattern : [pattern];
    let at = 0;
    for (let i = 0; i < p.length; i += 2) { if (at) setTimeout(iosTick, at); else iosTick(); at += Math.max(70, (p[i] || 0) + (p[i + 1] || 0)); }
  }
}

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
