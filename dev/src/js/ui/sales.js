// 판매 장부 (가게 안 · 계산대): 날마다 매출 · 남은 돈 · 손님, 주마다 합계. 최근 날이 위에 (G.history)
import { G } from '../save/state.js';
import { wonShort } from '../engine/util.js';
import { WEEKDAYS } from '../data/economy.js';

export function salesHTML() {
  const H = (G.history || []).slice().reverse();
  const head = `<div class="ts-head"><b>판매 장부</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>`;
  if (!H.length) return `${head}<p class="ts-note">아직 장사한 날이 없습니다</p>`;
  const weeks = {};
  for (const h of H) { const w = Math.ceil(h.day / 7); (weeks[w] = weeks[w] || []).push(h); }
  const body = Object.keys(weeks).sort((a, b) => b - a).map(w => {
    const L = weeks[w], rev = L.reduce((s, h) => s + h.revenue, 0), net = L.reduce((s, h) => s + h.net, 0);
    const rows = L.map(h => `<div class="sl-row"><span>${h.day}일차 <small>${WEEKDAYS[(h.day - 1) % 7]}</small></span><b>${wonShort(h.revenue)}</b><b class="${h.net < 0 ? 'neg' : ''}">${wonShort(h.net)}</b><b>${h.served}명</b></div>`).join('');
    return `<div class="sl-week"><span>${w}주차</span><b>매출 ${wonShort(rev)}</b><b class="${net < 0 ? 'neg' : ''}">남은 돈 ${wonShort(net)}</b></div>${rows}`;
  }).join('');
  return `${head}<div class="sl-row sl-th"><span>날</span><b>매출</b><b>남은 돈</b><b>손님</b></div>${body}
    <p class="ts-note">남은 돈 = 매출 − 재료값 (고정비는 주마다 따로 냅니다)</p>`;
}
