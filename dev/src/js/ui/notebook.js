// 손님층 수첩 화면 (계산대 「손님층」 탭, v0.90): ① 세 손님층 목록 → ② 누르면 그 손님층 칸 네 개 (잠긴 칸엔 남은 조건만)
//  기록은 sim/notebook.js · 수치 data/notebook.js · 동네 메모(2장 탐방)도 여기서 다시 읽어요
import { CUSTOMER_TYPES } from '../data/customers.js';
import { NOTE, NOTE_KEYS, NOTE_TYPES, NOTE_HOURS } from '../data/notebook.js';
import { nbPeek, nbCount, nbGot, nbNew, nbText, nbPeak, hourName } from '../sim/notebook.js';
import { exMemos } from '../sim/explore.js';
import { TYPE_BADGE } from '../render/view.js';
import { icon } from './icons.js';

// 손님층 표시 (가게 안 손님 머리 옆과 같은 그림 — 책가방 · 넥타이 · 지팡이)
export function typeBadgeHTML(type, cls) {
  const [col, g] = TYPE_BADGE[type];
  let px = '';
  g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') px += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }));
  return `<span class="nb-badge ${cls || ''}" style="background:${col}"><svg viewBox="0 0 5 5" fill="#fff" shape-rendering="crispEdges" aria-hidden="true">${px}</svg></span>`;
}
const segs = n => `<span class="nb-segs">${NOTE_KEYS.map((_, i) => `<i class="${i < n ? 'f' : ''}"></i>`).join('')}</span>`;

export function notebookHTML(sel) {
  if (sel === 'memo') return memoHTML();
  if (sel && CUSTOMER_TYPES[sel]) return typeHTML(sel);
  const rows = NOTE_TYPES.map(t => {
    const got = nbGot(t), b = nbPeek(t), fav = got.includes('fav') && nbText(t, 'fav'), hr = got.includes('hour') && nbPeak(b);
    const sub = [fav && fav.v, hr != null && hr !== false && hourName(hr)].filter(Boolean).join(' · ') || (got.length ? '조금 알게 됐습니다' : '아직 잘 모릅니다');
    return `<button type="button" class="nb-row${got.length ? '' : ' dim'}" data-ts="nbType" data-t="${t}">${nbNew(t) ? '<i class="nb-new">NEW</i>' : ''}${typeBadgeHTML(t, got.length ? '' : 'off')}<span class="nb-nm"><b>${CUSTOMER_TYPES[t].name}</b><small>${sub}</small>${segs(got.length)}</span><span class="nb-cnt">${got.length}/${NOTE_KEYS.length}</span></button>`;
  }).join('');
  const memos = exMemos();
  return `<p class="nb-note">장사하면서 알아낸 것이 저절로 적힙니다</p>${rows}${memos.length ? `<button type="button" class="nb-memo" data-ts="nbType" data-t="memo"><span>동네 메모 · 탐방에서 본 것</span><span>${memos.length}줄 ▸</span></button>` : ''}`;
}

function typeHTML(t) {
  const T = CUSTOMER_TYPES[t], b = nbPeek(t), got = nbGot(t);
  const cells = NOTE_KEYS.map(k => {
    const N = NOTE[k];
    if (!got.includes(k)) {
      const n = Math.min(N.need, nbCount(b, k));
      return `<div class="nb-entry lock"><span class="k">${N.name}</span><span class="v">?</span><span class="nb-prog"><span>${N.goal(T.name)}</span><span class="bar"><i style="width:${Math.round(n / N.need * 100)}%"></i></span><span>${n}/${N.need}</span></span></div>`;
    }
    const x = nbText(t, k);
    let extra = '';
    if (k === 'hour') {
      const mx = Math.max(1, ...NOTE_HOURS.map(h => b.hrs[h] || 0)), pk = nbPeak(b);
      extra = `<span class="nb-hours">${NOTE_HOURS.map(h => `<i class="${h === pk ? 'pk' : ''}" style="height:${Math.max(6, Math.round((b.hrs[h] || 0) / mx * 100))}%;${h === pk ? `background:${TYPE_BADGE[t][0]}` : ''}"></i>`).join('')}</span><span class="nb-hl"><span>9시</span><span>12시</span><span>15시</span><span>18시</span><span>20시</span></span>`;
    }
    return `<div class="nb-entry"><span class="k">${N.name}</span><span class="v">${k === 'fav' ? icon(x.menu, 'nb-dish') : ''}${x.v}</span>${extra}<span class="why">${x.why}</span></div>`;
  }).join('');
  return `<button type="button" class="nb-back" data-ts="nbType" data-t="">◂ 뒤로</button>
    <div class="nb-hero">${typeBadgeHTML(t, 'big')}<b>${T.name}</b></div>${cells}`;
}

function memoHTML() {
  const memos = exMemos();
  return `<button type="button" class="nb-back" data-ts="nbType" data-t="">◂ 뒤로</button>
    <p class="nb-note">동네 탐방에서 본 것</p>${memos.map(m => `<p class="ex-memo">${m}</p>`).join('')}`;
}
