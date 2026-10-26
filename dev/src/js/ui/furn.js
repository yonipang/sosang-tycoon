// 미소 가구 창 (마을 · 2장부터): 테마 하나를 골라 그 테마 물건 6칸만 보여 줘요 (한 화면에 정보는 조금만)
//  규칙은 sim/furniture.js (runCmd 'furnBuy'), 수치는 data/furniture.js
import { G } from '../save/state.js';
import { won, wonShort } from '../engine/util.js';
import { FURN_CATS, FURN_ORDER, FURN_SPR, FURN_THEMES, FURN_THEME_IDS, FURN_NAMES, FURN_THEME_NEED, FURN_SET_RATE } from '../data/furniture.js';
import { BOND_LV } from '../data/bond.js';
import { furnHave, furnPrice, setMissing, setPrice, themeCount, themeOn, mood, furnLocked } from '../sim/furniture.js';
import { bondLv, bondNext, misoDisc } from '../sim/bond.js';
import { iconURL } from './icons.js';
import { SPR } from '../art/atlas.js';

// 미리보기 그림: 카테고리마다 정한 배율로 (픽셀이 뭉개지지 않게 pixelated)
const PIC_K = { wall: 1.5, floor: 1.5, window: 2, plant: 1.5, frame: 3, table: 1.5 };
const pic = (name, k) => { const r = SPR[name] || [0, 0, 16, 16]; return `<img class="px fu-ic" src="${iconURL(name)}" style="width:${r[2] * k}px;height:${r[3] * k}px" alt="">`; };

// 하트: 찬 단계 ♥ · 남은 단계 ♡ (다음 단계까지 막대)
export function heartsHTML(who) {
  const lv = bondLv(who), nx = bondNext(who);
  return `<span class="hearts" title="친밀도">${'♥'.repeat(lv)}<i>${'♡'.repeat(BOND_LV.length - lv)}</i>${nx ? `<b class="hbar"><i style="width:${Math.round(nx[0] / nx[1] * 100)}%"></i></b>` : ''}</span>`;
}

let theme = null; // 고른 테마 (처음엔 가장 많이 맞춘 테마)
export function furnTheme(th) { if (th) theme = th; return theme || (theme = FURN_THEME_IDS.slice().sort((a, b) => themeCount(b) - themeCount(a))[0]); }

function tile(cat, th, locked) {
  const have = furnHave(cat), mine = have === th, C = FURN_CATS[cat];
  const k = PIC_K[cat], img = cat === 'table' ? pic('chair_' + th, k) + pic('table_' + th, k) : pic(FURN_SPR[cat] + '_' + th, k);
  const price = furnPrice(cat), poor = price > G.cash;
  return `<button type="button" class="fu-tile${mine ? ' mine' : ''}" data-ts="fbuy" data-c="${cat}" ${mine || locked || poor ? 'disabled' : ''}>
    <i class="fu-m">+${C.mood}</i><span class="fu-pic">${img}</span><b>${FURN_NAMES[cat][th]}</b>
    <small>${mine ? '설치됨' : wonShort(price)}</small></button>`;
}

export function furnHTML() {
  const th = furnTheme(), T = FURN_THEMES[th], locked = furnLocked();
  const n = themeCount(th), on = themeOn(), miss = setMissing(th), sp = setPrice(th);
  const tabs = FURN_THEME_IDS.map(id => `<button type="button" class="fu-tab${id === th ? ' sel' : ''}" data-ts="fth" data-t="${id}">${FURN_THEMES[id].short || FURN_THEMES[id].name}${themeCount(id) ? `<i>${themeCount(id)}</i>` : ''}</button>`).join('');
  const disc = misoDisc();
  return `<div class="ts-head"><b>미소 가구</b>${heartsHTML('miso')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <div class="fu-mood">분위기 <b>${mood()}</b><small>/100</small>${on ? ` · <span class="tag hot">${FURN_THEMES[on].name}</span>` : ''}${disc ? ` · <span class="fu-disc">♥ ${Math.round(disc * 100)}% 할인</span>` : ''}</div>
    <div class="fu-tabs">${tabs}</div>
    <p class="fu-bonus ${n >= FURN_THEME_NEED ? 'on' : ''}">${n >= FURN_THEME_NEED ? '★' : `${n}/${FURN_THEME_NEED}`} ${T.bonusText}</p>
    ${locked ? '<p class="ts-note">미소 사장님과 조금 더 친해지면 살 수 있습니다</p>' : ''}
    <div class="fu-grid">${FURN_ORDER.map(c => tile(c, th, locked)).join('')}</div>
    <div class="mk-foot">${miss.length > 1 ? `<button type="button" class="btn primary big mk-buy" data-ts="fset" ${locked || sp > G.cash ? 'disabled' : ''}>${T.name} 세트로 ${miss.length}개 · ${won(sp)} <small>${Math.round((1 - FURN_SET_RATE) * 100)}% 싸게</small></button>` : ''}
    <div class="mk-sum"><span>${miss.length ? '6개 다 맞추면 분위기 +10' : ''}</span><span>잔고 ${wonShort(G.cash)}</span></div></div>`;
}
