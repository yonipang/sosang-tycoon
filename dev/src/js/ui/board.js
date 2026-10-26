// 메뉴 연구 칠판 (마을 · 우리 가게 「메뉴 연구 칠판」): 메뉴마다 레벨 · 숙련 막대 · 다음 레벨 효과 · 올리기 (규칙은 sim/upgrade.js)
// 마을 아래 창(ui/town.js sheet)에 칠판 모양으로 그려요. 올리기 = data-ts="menuUp"
import { MENUS, MENU_IDS, MENU_LEVELS, MASTERY_PERFECT, BASE_IDS, VARIANT_IDS, INGREDIENTS } from '../data/menu.js';
import { wonShort } from '../engine/util.js';
import { menuOpen } from '../sim/story.js';
import { menuLv, mastery, upState, devOpen, devState } from '../sim/upgrade.js';
import { icon } from './icons.js';

const pctTxt = v => `${Math.round(v * 100)}%`;
const effTxt = L => `적당한 가격 +${pctTxt(L.fair)} · 만족 +${L.sat} · 재방문 ${pctTxt(L.back)}`;
// 2장부터: 기본 메뉴마다 탭 (그 메뉴 + 개발한 새 메뉴 · 아래에 「새 메뉴 개발」)
let tab = null;
export function boardTab(b) { if (b) tab = b; return tab && menuOpen(tab) ? tab : BASE_IDS.find(menuOpen) || 'tteok'; }
function upRow(m) {
  const lv = menuLv(m), st = upState(m), next = MENU_LEVELS[lv + 1];
  const have = mastery(m), bar = next ? Math.min(100, Math.round(have / next.need * 100)) : 100;
  const stars = '★'.repeat(lv) + '☆'.repeat(MENU_LEVELS.length - 1 - lv);
  const btn = st === 'max' ? '<span class="u-note">최고 레벨</span>'
    : `<button type="button" class="ch-btn" data-ts="menuUp" data-m="${m}" ${st === 'ok' ? '' : 'disabled'}>${st === 'need' ? '숙련 모자람' : st === 'cash' ? '잔고 모자람' : '올리기'}<small>${wonShort(next.cost)}</small></button>`;
  return `<div class="urow${st === 'ok' ? ' ready' : ''}" data-m="${m}">${icon(m, 'dish')}<div class="u-txt"><b>${MENUS[m].name} <i class="lv">Lv${lv}</i> <span class="stars">${stars}</span></b>
    <div class="ubar"><i style="width:${bar}%"></i></div>
    <small>숙련 ${have}${next ? ` / ${next.need}` : ''}</small></div>${btn}</div>`;
}
// 아직 안 만든 새 메뉴: 재료(처음 쓰는 재료는 표시) · 조건 · 개발하기
function devRow(m) {
  const M = MENUS[m], st = devState(m);
  const ings = M.recipe.map(i => (MENUS[M.base].recipe.includes(i) ? INGREDIENTS[i].name : `<em>${INGREDIENTS[i].name}</em>`)).join('·');
  const btn = `<button type="button" class="ch-btn" data-ts="menuDev" data-m="${m}" ${st === 'ok' ? '' : 'disabled'}>${st === 'lv' ? `Lv${M.lv} 필요` : st === 'cash' ? '잔고 모자람' : '개발하기'}<small>${wonShort(M.dev)}</small></button>`;
  return `<div class="urow dev${st === 'ok' ? ' ready' : ''}">${icon(m, 'dish')}<div class="u-txt"><b>${M.name} <small class="u-price">${wonShort(M.price)}</small></b><small>${ings}</small></div>${btn}</div>`;
}
export function boardHTML() {
  const head = '<div class="ts-head"><b>메뉴 연구 칠판</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>';
  const more = `<details class="u-more"><summary>레벨마다 효과</summary>
      <p>${MENU_LEVELS.slice(2).map((L, k) => `Lv${k + 2} · ${effTxt(L)}`).join('<br>')}</p>
      <p>숙련도는 내준 그릇 수입니다 (완벽 조리는 ${MASTERY_PERFECT}그릇). 숙련도가 차면 돈을 내고 올립니다</p>
      ${devOpen() ? '<p>새 메뉴는 기본 메뉴 레벨이 오르면 개발할 수 있습니다. 개발한 메뉴는 오늘의 메뉴 칸에 올려 팝니다</p>' : ''}
    </details>`;
  if (!devOpen()) return head + MENU_IDS.filter(m => menuOpen(m) && !MENUS[m].base).map(upRow).join('') + more; // 1장: 기본 메뉴만
  const b = boardTab();
  const tabs = BASE_IDS.filter(menuOpen).map(x => `<button type="button" class="u-tab${x === b ? ' sel' : ''}" data-ts="btab" data-b="${x}">${MENUS[x].name}<i>${VARIANT_IDS[x].filter(menuOpen).length + 1}</i></button>`).join('');
  const mine = [b, ...VARIANT_IDS[b].filter(menuOpen)].map(upRow).join('');
  const todo = VARIANT_IDS[b].filter(m => !menuOpen(m)).map(devRow).join('');
  return `${head}<div class="u-tabs">${tabs}</div>${mine}${todo ? `<p class="u-sub">새 메뉴 개발</p>${todo}` : ''}${more}`;
}
