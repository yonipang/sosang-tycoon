// 칠판 (마을 · 우리 가게 「칠판」): 메뉴마다 레벨 · 숙련 막대 · 다음 레벨 효과 · 올리기 (규칙은 sim/upgrade.js)
// 2장부터 「메뉴 변형」 찾기 (v0.91): 레시피 네 칸 — 핀 꽂힌 칸은 못 바꾸고, ⇄ 딱지 칸 하나를 골라 재료를 바꿔 「한 그릇 만들어 보기」
// 마을 아래 창(ui/town.js sheet)에 칠판 모양으로 그려요. 올리기 = data-ts="menuUp"
import { MENUS, MENU_IDS, MENU_LEVELS, MASTERY_PERFECT, BASE_IDS, VARIANT_IDS, INGREDIENTS, VARIANT_FIND } from '../data/menu.js';
import { wonShort } from '../engine/util.js';
import { menuOpen } from '../sim/story.js';
import { menuLv, mastery, upState, devOpen, devState, varFound, findIngOpen, findIngLv } from '../sim/upgrade.js';
import { runCmd } from '../sim/events.js';
import { icon } from './icons.js';

const pctTxt = v => `${Math.round(v * 100)}%`;
const effTxt = L => `적당한 가격 +${pctTxt(L.fair)} · 만족 +${L.sat} · 재방문 ${pctTxt(L.back)}`;
// 2장부터: 기본 메뉴마다 탭 (그 메뉴 + 개발한 새 메뉴 · 아래에 「새 메뉴 개발」)
let tab = null;
export function boardTab(b) { if (b && b !== tab) { tab = b; boardFind('reset'); } return tab && menuOpen(tab) ? tab : BASE_IDS.find(menuOpen) || 'tteok'; }
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
// 찾았지만 아직 메뉴에 안 올린 변형: 재료(처음 쓰는 재료는 표시) · 조건 · 메뉴에 올리기
function devRow(m) {
  const M = MENUS[m], st = devState(m);
  const ings = M.recipe.map(i => (MENUS[M.base].recipe.includes(i) ? INGREDIENTS[i].name : `<em>${INGREDIENTS[i].name}</em>`)).join('·');
  const btn = `<button type="button" class="ch-btn" data-ts="menuDev" data-m="${m}" ${st === 'ok' ? '' : 'disabled'}>${st === 'lv' ? `Lv${M.lv} 필요` : st === 'cash' ? '잔고 모자람' : '메뉴에 올리기'}<small>${wonShort(M.dev)}</small></button>`;
  return `<div class="urow dev${st === 'ok' ? ' ready' : ''}">${icon(m, 'dish')}<div class="u-txt"><b>${M.name} <small class="u-price">${wonShort(M.price)}</small></b><small>${ings}</small></div>${btn}</div>`;
}
export function boardHTML() {
  const head = '<div class="ts-head"><b>칠판</b><button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>';
  const more = `<details class="u-more"><summary>레벨마다 효과</summary>
      <p>${MENU_LEVELS.slice(2).map((L, k) => `Lv${k + 2} · ${effTxt(L)}`).join('<br>')}</p>
      <p>숙련도는 내준 그릇 수입니다 (완벽 조리는 ${MASTERY_PERFECT}그릇). 숙련도가 차면 돈을 내고 올립니다</p>
      ${devOpen() ? '<p>메뉴 변형은 레시피 한 칸을 바꿔 찾습니다. 바꿔 넣을 재료는 기본 메뉴 레벨이 오르면 늘어납니다. 찾은 변형은 돈을 내고 메뉴에 올려 오늘의 메뉴 칸에서 팝니다</p>' : ''}
    </details>`;
  if (!devOpen()) return head + MENU_IDS.filter(m => menuOpen(m) && !MENUS[m].base).map(upRow).join('') + more; // 1장: 기본 메뉴만
  const b = boardTab();
  const tabs = BASE_IDS.filter(menuOpen).map(x => `<button type="button" class="u-tab${x === b ? ' sel' : ''}" data-ts="btab" data-b="${x}">${MENUS[x].name}<i>${VARIANT_IDS[x].filter(menuOpen).length + 1}</i></button>`).join('');
  const mine = [b, ...VARIANT_IDS[b].filter(menuOpen)].map(upRow).join('');
  const todo = VARIANT_IDS[b].filter(m => !menuOpen(m) && varFound(m) && m !== (vRes && vRes.hit)).map(devRow).join('');
  return `${head}<div class="u-tabs">${tabs}</div>${mine}<p class="u-sub">메뉴 변형</p>${findHTML(b)}${todo}${more}`;
}

// ── 메뉴 변형 찾기 (v0.91): 칸 고르기 → 재료 고르기 → 해 보기 → 결과 ──
let vSlot = -1, vPut = null, vRes = null;
// 화면 상태 바꾸기 (ui/town.js 칠판 버튼): slot · ing · try · reset
export function boardFind(act, v) {
  if (act === 'reset') { vSlot = -1; vPut = null; vRes = null; }
  else if (act === 'slot') { vSlot = vSlot === v ? -1 : v; vPut = null; vRes = null; }
  else if (act === 'ing') vPut = v;
  else if (act === 'try' && vSlot >= 0 && vPut) { vRes = runCmd('menuTry', { base: boardTab(), slot: vSlot, ing: vPut }); if (!vRes) boardFind('reset'); }
}
const ingName = k => (k === 'none' ? '빼기' : INGREDIENTS[k].name);
const ingPic = (k, cls) => (k === 'none' ? `<span class="${cls} vf-none">✕</span>` : icon('ing_' + k, cls));
function findHTML(b) {
  const F = VARIANT_FIND[b], rec = MENUS[b].recipe;
  const slots = rec.map((k, i) => {
    const fx = F.fixed.includes(i), sw = i === vSlot && vPut, show = sw ? vPut : k;
    const cls = fx ? 'fixed' : i === vSlot ? 'sel' : vSlot >= 0 ? 'off' : 'can';
    return `<button type="button" class="vf-slot ${cls}" data-ts="vSlot" data-s="${i}" ${fx || vRes ? 'disabled' : ''} aria-label="${INGREDIENTS[k].name}${fx ? ' · 바꿀 수 없음' : ' · 바꿀 수 있음'}">${!fx && vSlot < 0 ? '<i class="vf-sw">⇄</i>' : ''}${sw ? `<i class="vf-old">${INGREDIENTS[k].name}</i>` : ''}${ingPic(show, 'vf-ic')}<span>${ingName(show)}</span></button>`;
  }).join('');
  let below = '';
  if (vRes) {
    if (vRes.hit) {
      const M = MENUS[vRes.hit], st = devState(vRes.hit);
      below = `<div class="vf-res">${vRes.again ? '<small>이미 찾은 변형입니다</small>' : '<span class="vf-stamp">새 변형!</span>'}${icon(vRes.hit, 'vf-dish')}<b>${M.name}</b><small>${M.recipe.map(i => INGREDIENTS[i].name).join(' · ')} · ${wonShort(M.price)}</small>
        <div class="vf-btns"><button type="button" class="ch-btn" data-ts="vOk">나중에</button>${st === 'done' ? '' : `<button type="button" class="ch-btn pri" data-ts="menuDev" data-m="${vRes.hit}" ${st === 'ok' ? '' : 'disabled'}>${st === 'lv' ? `Lv${M.lv} 필요` : st === 'cash' ? '잔고 모자람' : '메뉴에 올리기'}<small>${wonShort(M.dev)}</small></button>`}</div></div>`;
    } else below = `<div class="vf-res flop"><small>칠판에 적었습니다</small><b>${vRes.text}</b><div class="vf-btns"><button type="button" class="ch-btn" data-ts="vOk">다른 칸 바꿔 보기</button></div></div>`;
  } else if (vSlot >= 0) {
    const shelf = F.shelf.map(k => {
      const open = findIngOpen(b, k);
      return `<button type="button" class="vf-ing${k === vPut ? ' on' : ''}" data-ts="vIng" data-k="${k}" ${open ? '' : 'disabled'}>${open ? `${ingPic(k, 'vf-ic')}<span>${ingName(k)}</span>` : `<span class="vf-lock"></span><span>Lv${findIngLv(b, k)}</span>`}</button>`;
    }).join('');
    below = `<div class="vf-pick" style="--ax:${(vSlot + 0.5) * 25}%"><div class="vf-shelf">${shelf}</div></div>
      <button type="button" class="btn primary vf-go" data-ts="vTry" ${vPut ? '' : 'disabled'}>한 그릇 만들어 보기</button>`;
  }
  const vids = VARIANT_IDS[b];
  const got = `<div class="vf-found">${vids.map(m => varFound(m) ? `<span class="got${menuOpen(m) ? ' on' : ''}">${icon(m, 'vf-mini')}</span>` : '<span>?</span>').join('')}</div>`;
  return `<div class="vf"><div class="vf-slots">${slots}</div>${below}${got}</div>`;
}
