// 손님 수첩 (마을 · 우리 가게 「손님 수첩」): 얼굴 칸 18개 — 아직 안 온 사람은 그림자, 누르면 아래에 그 사람 (기록은 sim/book.js)
import { G } from '../save/state.js';
import { MENUS } from '../data/menu.js';
import { CUSTOMER_TYPES, PEOPLE, REGULARS } from '../data/customers.js';
import { PEOPLE_INFO, BOOK_ORDER, REGULAR_BACK } from '../data/people.js';
import { bookSeen, regularCandidate } from '../sim/book.js';
import { icon } from './icons.js';
import { josa } from '../engine/util.js';

const typeOf = ch => PEOPLE[ch] || (Object.values(REGULARS).find(r => r.char === ch) || {}).type || 'elder';
const satFace = s => (s >= 4.5 ? 'love' : s >= 3.5 ? 'happy' : s >= 2.5 ? 'meh' : 'angry');
export function bookHTML(sel) {
  const seen = BOOK_ORDER.filter(bookSeen).length;
  const cells = BOOK_ORDER.map(ch => `<button type="button" class="bk-cell${bookSeen(ch) ? '' : ' unseen'}${ch === sel ? ' sel' : ''}" data-ts="who" data-c="${ch}" aria-label="${bookSeen(ch) ? PEOPLE_INFO[ch].name : '아직 모르는 손님'}">${icon('char' + ch, 'bk-face')}${regularCandidate(ch) ? '<i class="bk-star">★</i>' : ''}</button>`).join('');
  let info = '<p class="bk-hint">얼굴을 눌러 보세요</p>';
  if (sel && !bookSeen(sel)) info = '<p class="bk-hint">아직 가게에 온 적이 없습니다</p>';
  else if (sel) {
    const P = PEOPLE_INFO[sel], b = G.book[sel], f = G.fans && G.fans[sel];
    info = `<div class="bk-info"><div class="bk-name"><b>${P.name}</b><small>${CUSTOMER_TYPES[typeOf(sel)].name}</small>${regularCandidate(sel) ? '<span class="tag hot">단골 후보</span>' : ''}</div>
      <p>${P.bio}</p>
      <small>${b.visits}번 왔습니다${b.sat != null ? ` · 마지막 ${icon('face_' + satFace(b.sat), 'face')}` : ''}${f ? ` · ${josa(MENUS[f.m].name, '을/를')} 맛있게 먹었습니다 · 다시 온 ${f.n}번` : ''}</small></div>`;
  }
  return `<div class="ts-head"><b>손님 수첩</b><small class="bk-count">${seen}/${BOOK_ORDER.length}명</small><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <div class="bk-grid">${cells}</div>${info}
    <p class="bk-foot">맛있게 먹고 ${REGULAR_BACK}번 다시 온 손님은 ★ 단골 후보</p>`;
}
