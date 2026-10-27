// 플레이 기록 (Google Analytics 4 · Firebase 프로젝트 sosang-tycoon) — 만든 사람이 보는 익명 통계예요. 플레이어 화면엔 아무것도 안 보여요.
//  규칙 코드가 emit('track', 이름, 값)으로 알려 주면 여기서 GA로 보내요 (sim/day.js · sim/story.js · sim/upgrade.js …)
//  웹앱 주소(github.io)에서만 켜져요 — Claude 미리보기·내 컴퓨터에서 연 파일은 보내지 않아요. 설정 「플레이 기록」에서 끌 수 있어요
//  이름·이메일은 보내지 않아요 (GA가 기기마다 만드는 임의 번호만)
import { G } from '../save/state.js';
import { onEvent } from '../sim/events.js';
import { setting } from './settings.js';

const GA_ID = 'G-L04Y1ZQLTN';
const gaLive = () => typeof location !== 'undefined' && /github\.io$/.test(location.hostname);
let gaReady = false;

function gaTag() { window.dataLayer.push(arguments); }
function gaLoad() {
  if (gaReady || !gaLive() || !setting('stats')) return;
  gaReady = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gaTag;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  gaTag('js', new Date());
  gaTag('config', GA_ID, { send_page_view: true });
}
// 지금 게임 상태 (이벤트마다 같이 보내요)
const gaBase = () => ({ day: G.day || 0, ch: (G.story && G.story.ch) || 0, cash: Math.round((G.cash || 0) / 1000) }); // 잔고는 천 원 단위
export function track(name, params = {}) {
  if (!gaReady || !setting('stats')) return;
  try { gaTag('event', name, { ...gaBase(), ...params }); } catch (e) { /* 보내기 실패는 무시 */ }
}
// 설정에서 끄면 바로 멈춰요 (켜면 다시)
export function statsChanged() {
  window['ga-disable-' + GA_ID] = !setting('stats');
  if (setting('stats')) gaLoad();
}

export function initAnalytics() {
  window['ga-disable-' + GA_ID] = !setting('stats');
  gaLoad();
  onEvent('track', (name, params) => track(name, params));
  onEvent('phase', p => track('phase', { phase: p }));
  // 앱을 닫거나 다른 앱으로 갈 때: 어디까지 했는지 (그만둔 지점)
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') track('leave', { phase: G.phase, part: (G.town && G.town.on && G.town.part) || '' }); });
}
