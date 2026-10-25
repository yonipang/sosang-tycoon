// 돌발 이벤트 화면 (데이브 더 다이버처럼 눈에 띄게):
//  시작 → 가게가 멈추고 「돌발 이벤트!」 띠 + 대화(intro, 누르면 다음) → 목표 카드(목표 · 시간 · 보상) → 「시작!」
//  진행 중 → 위 막대 빨간 띠 (ui/story.js updateQuestTrack · incidentBar)
//  끝 → 결과 카드 (한마디 + 받은 것) → 누르면 이어서
// 규칙 쪽은 sim/incidents.js (emit('incident', 'start'|'prog'|'end', x))
import { G } from '../save/state.js';
import { $, clockText } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { incidentInfo } from '../sim/incidents.js';
import { CAST } from '../data/story.js';
import { icon } from './icons.js';
import { playSfx } from './sfx.js';
import { lineHTML, typeIn, stopTyping } from './story.js';

const incQueue = []; // 보여 줄 차례 [{ kind: 'intro'|'result', x }]
let incCur = null;   // 지금 보고 있는 것 { kind, x, i: 몇 번째 말 }
let incHeld = false;

export const incidentShowing = () => !!incCur;

export function incidentStart(x) { incQueue.push({ kind: 'intro', x }); setTimeout(incNext, 0); }
export function incidentEnd(x) {
  // 아직 시작 화면을 보는 중에 끝났으면 (거의 없지만) 시작 화면은 빼요
  const qi = incQueue.findIndex(q => q.x === x && q.kind === 'intro');
  if (qi >= 0) incQueue.splice(qi, 1);
  incQueue.push({ kind: 'result', x }); setTimeout(incNext, 0); // 마감 때 끝난 것은 영수증으로 넘어가서 안 보여요
}

function incHold(on) {
  if (G.phase !== 'day' || !G.run) return;
  if (on && !G.run.paused) { runCmd('hold', { on: true }); incHeld = true; }
  if (!on && incHeld) { incHeld = false; runCmd('hold', { on: false }); }
}

function incNext() {
  if (incCur || !incQueue.length || G.phase !== 'day') return;
  incCur = { ...incQueue.shift(), i: 0 };
  incHold(true);
  $('incUI').hidden = false;
  playSfx(incCur.kind === 'intro' ? 'surprise' : incCur.x.state === 'win' ? 'perfect' : 'page');
  incDraw();
}

function incClose() {
  stopTyping();
  incCur = null;
  $('incUI').hidden = true; $('incUI').innerHTML = '';
  incHold(false);
  incNext();
}

// 띠는 처음 나올 때만 쾅 하고 (대화를 넘길 때마다 다시 움직이지 않게)
const incBanner = (D, sub) => `<div class="inc-banner${incCur.i === 0 ? ' pop' : ''}"><small>${sub}</small><b>${D.name}</b></div>`;

function incDraw() {
  const x = incCur.x, D = incidentInfo(x), el = $('incUI');
  if (incCur.kind === 'intro') {
    if (incCur.i < D.intro.length) { // 대화
      const [who, text] = D.intro[incCur.i];
      el.className = 'inc-ui talking' + (who && CAST[who].think ? ' think' : '') + (who ? '' : ' narr');
      el.innerHTML = incBanner(D, '돌발 이벤트!') + `<div class="inc-talk">${lineHTML(who, text)}</div>`;
      typeIn(el);
      return;
    }
    // 목표 카드
    const till = x.until !== undefined ? `${clockText(x.until)}까지` : '오늘 영업 중';
    el.className = 'inc-ui card';
    el.innerHTML = incBanner(D, '돌발 이벤트!') + `<div class="inc-card">
      <div class="inc-row"><small>목표</small><b>${D.goal}</b></div>
      <div class="inc-row"><small>시간</small><b>${till}</b></div>
      <div class="inc-row"><small>보상</small><b>${D.prize}</b></div>
      <button type="button" class="btn primary big" data-inc="go">시작!</button></div>`;
    return;
  }
  // 결과 카드
  const ok = x.state === 'win';
  const [who, say] = D.say || [null, ''];
  const got = x.bonus ? `+${x.bonus.toLocaleString('ko-KR')}원` : D.kind === 'guest' && ok ? '별 다섯 개 리뷰' : '';
  const prog = D.prog ? `<p class="inc-prog">${D.kind === 'group' ? '받은 아이' : '진행'} <b>${D.prog[0]}/${D.prog[1]}</b></p>` : '';
  el.className = 'inc-ui card result ' + (ok ? 'win' : 'lose');
  el.innerHTML = incBanner(D, ok ? '성공!' : '아쉽게도…') + `<div class="inc-card">
    ${who ? `<div class="inc-say">${icon('char' + CAST[who].char)}<div><small>${CAST[who].name}</small><p>${say}</p></div></div>` : ''}
    <p class="inc-msg">${ok ? D.win : D.lose}</p>${prog}
    ${got ? `<p class="inc-got">${got}</p>` : ''}
    <button type="button" class="btn ${ok ? 'primary' : ''} big" data-inc="ok">계속하기</button></div>`;
}

export function initIncidentUI() {
  $('incUI').addEventListener('click', e => {
    if (!incCur) return;
    if (stopTyping()) return; // 한 글자씩 나오는 중이면 먼저 다 보여 줘요
    const b = e.target.closest('[data-inc]');
    if (incCur.kind === 'intro' && incCur.i < incidentInfo(incCur.x).intro.length) { incCur.i++; playSfx('tap'); incDraw(); return; }
    if (b) { playSfx(b.dataset.inc === 'go' ? 'open' : 'tap'); incClose(); }
  });
}
// 영업이 끝나면 남은 화면은 치워요 (결과는 영수증에도 나와요)
export function incidentReset() { incQueue.length = 0; if (incCur) { incCur = null; $('incUI').hidden = true; $('incUI').innerHTML = ''; incHeld = false; } }
