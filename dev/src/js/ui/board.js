// 메뉴 연구 칠판 (마을 · 우리 가게 「메뉴 연구 칠판」): 메뉴마다 레벨 · 숙련 막대 · 다음 레벨 효과 · 올리기 (규칙은 sim/upgrade.js)
// 마을 아래 창(ui/town.js sheet)에 칠판 모양으로 그려요. 올리기 = data-ts="menuUp"
import { MENUS, MENU_IDS, MENU_LEVELS, MASTERY_PERFECT } from '../data/menu.js';
import { wonShort } from '../engine/util.js';
import { menuOpen } from '../sim/story.js';
import { menuLv, lvInfo, mastery, upState } from '../sim/upgrade.js';
import { icon } from './icons.js';

const pctTxt = v => `${Math.round(v * 100)}%`;
const effTxt = L => `적당한 가격 +${pctTxt(L.fair)} · 만족 +${L.sat} · 재방문 ${pctTxt(L.back)}`;
export function boardHTML() {
  const rows = MENU_IDS.filter(m => menuOpen(m)).map(m => {
    const lv = menuLv(m), st = upState(m), next = MENU_LEVELS[lv + 1];
    const have = mastery(m), bar = next ? Math.min(100, Math.round(have / next.need * 100)) : 100;
    const stars = '★'.repeat(lv) + '☆'.repeat(MENU_LEVELS.length - 1 - lv);
    const btn = st === 'max' ? '<span class="u-note">최고 레벨</span>'
      : `<button type="button" class="ch-btn" data-ts="menuUp" data-m="${m}" ${st === 'ok' ? '' : 'disabled'}>${st === 'need' ? '숙련 모자람' : st === 'cash' ? '잔고 모자람' : '올리기'}<small>${wonShort(next.cost)}</small></button>`;
    return `<div class="urow${st === 'ok' ? ' ready' : ''}" data-m="${m}">${icon(m, 'dish')}<div class="u-txt"><b>${MENUS[m].name} <i class="lv">Lv${lv}</i> <span class="stars">${stars}</span></b>
      <div class="ubar"><i style="width:${bar}%"></i></div>
      <small>숙련 ${have}${next ? ` / ${next.need}` : ''}</small>
      <small>${next ? `Lv${lv + 1} → ${effTxt(next)}` : effTxt(lvInfo(m))}</small></div>${btn}</div>`;
  }).join('');
  return `<div class="ts-head"><b>메뉴 연구 칠판</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    ${rows}
    <p class="u-foot">숙련도는 내준 그릇 수입니다 (완벽 조리는 ${MASTERY_PERFECT}그릇). 숙련도가 차면 돈을 내고 올립니다. 다음 영업부터 효과가 납니다</p>`;
}
