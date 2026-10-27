// 리뷰 기록 (v0.68 사용자 요청): 위 막대 별점(★)을 누르면 지금까지 받은 리뷰를 날마다 보여 줘요
//  리뷰 글은 마감 때 G.history[].revs에 남겨요 (sim/day.js) — 이 기능 전의 날은 글이 없어요
import { G } from '../save/state.js';
import { $ } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { playSfx } from './sfx.js';

const starStr = n => '★'.repeat(Math.max(0, Math.min(5, Math.round(n)))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(n))));
let held = false;

function reviewHTML() {
  const days = (G.history || []).filter(h => h.revs && h.revs.length).slice().reverse();
  const head = `<div class="rl-head"><b>리뷰 기록</b><small>★ ${G.rating == null ? '—' : G.rating.toFixed(1)} · 리뷰 ${G.ratingN || 0}개</small><button type="button" class="ts-x" data-rl="close" aria-label="닫기">✕</button></div>`;
  if (!days.length) return `${head}<p class="rl-none">아직 남은 리뷰가 없습니다. 영업을 마치면 여기에 쌓입니다.</p>`;
  return head + days.map(h => `<small class="rl-day">${h.day}일차</small>${h.revs.map(v => `<div class="rv"><div class="rs"><span class="rl-stars">${starStr(v.s)}</span><small>${v.w}</small></div><p>${v.t}</p></div>`).join('')}`).join('');
}
function close() {
  $('revModal').hidden = true; $('revModal').innerHTML = '';
  if (held) { runCmd('hold', { on: false }); held = false; }
}
export function initReviews() {
  const pill = $('hStar') && $('hStar').parentElement;
  if (!pill) return;
  pill.classList.add('tap');
  pill.addEventListener('click', () => {
    if (!G.story || !$('revModal').hidden) return;
    if (G.phase === 'day' && G.run && !G.run.paused) { runCmd('hold', { on: true }); held = true; } // 영업 중이면 잠깐 멈춰요
    $('revModal').innerHTML = `<div class="qm-card rl-card" role="dialog" aria-label="리뷰 기록">${reviewHTML()}</div>`;
    $('revModal').hidden = false;
    playSfx('page');
  });
  $('revModal').addEventListener('click', e => { if (e.target === $('revModal') || e.target.closest('[data-rl=close]')) { close(); playSfx('tap'); } });
}
