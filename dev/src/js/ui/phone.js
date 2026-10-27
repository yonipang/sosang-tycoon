// 전화 받기 (v0.54 사용자 요청): 전화로 말하는 사람(data/story.js CAST의 phone: true)이 말을 꺼내기 전에
//  폰이 울리고 「받기」를 눌러야 대화가 이어져요. 이야기 장면(ui/story.js)과 돌발 이벤트(ui/incident.js)가 같이 써요.
//  휴대폰 화면(홍보·최근 통화·상권 지도)은 마을 화면(ui/town.js)에 있어요.
import { CAST } from '../data/story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';

export const isPhone = who => !!(who && typeof who === 'string' && CAST[who] && CAST[who].phone);
// 이 줄에서 전화가 새로 걸려 오나 (앞줄이 전화가 아니었으면)
export const callStarts = (lines, i) => isPhone(lines[i] && lines[i][0]) && !(i > 0 && isPhone(lines[i - 1][0]));
const callerName = who => CAST[who].name.replace(/ · 전화$/, '');

// 울리는 폰 (받기 버튼 하나 — 이야기 전화라 거절은 없어요)
export function ringHTML(who, attr) { // attr: 받기 버튼에 더 붙일 속성 (돌발 이벤트 data-inc)
  const p = CAST[who];
  return `<div class="ring-phone" role="dialog" aria-label="${callerName(who)} 전화">
    <small class="ring-tag">전화가 왔습니다</small>
    <span class="ring-face">${icon('char' + p.char)}</span>
    <b class="ring-name">${callerName(who)}</b>
    <button type="button" class="btn primary big ring-ok" data-ring="1" ${attr || ''}>받기</button>
  </div>`;
}

// 따르릉 (울리는 동안 1.4초마다, 진동도)
let ringT = 0;
export function startRing() { stopRing(); playSfx('ring'); ringT = setInterval(() => playSfx('ring'), 1400); }
export function stopRing() { if (ringT) { clearInterval(ringT); ringT = 0; } }
