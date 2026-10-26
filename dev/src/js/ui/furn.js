// 미소 가구 창 (마을 · 2장부터): 테마 하나를 골라 그 테마 물건 6칸만 보여 줘요 (한 화면에 정보는 조금만)
//  규칙은 sim/furniture.js (runCmd 'furnBuy'), 수치는 data/furniture.js
import { G } from '../save/state.js';
import { won, wonShort } from '../engine/util.js';
import { FURN_ORDER, FURN_THEMES, FURN_THEME_IDS, FURN_THEME_NEED, FURN_SET_RATE, FURN_SPECIAL, MISO_SET, FURN_PREM_HEART } from '../data/furniture.js';
import { SLOTS_BY_GRADE, GRADE_NAMES } from '../data/menu.js';
import { TABLES } from '../data/layout.js';
import { BOND_LV } from '../data/bond.js';
import { furnHave, furnPrice, setMissing, setPrice, themeCount, themesOn, mood, furnLocked, itemInfo, itemLocked, misoOwned, misoPrice, shopLv, nextBuild, buildPrice } from '../sim/furniture.js';
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

let theme = null; // 고른 탭: 테마 · 'sp'(친밀도 전용·미소 컬렉션) · 'build'(확장공사). 처음엔 가장 많이 맞춘 테마
let grade = 1;    // 테마 탭에서 일반(1) · 고급(2)
export function furnTheme(th) { if (th) theme = th; return theme || (theme = FURN_THEME_IDS.slice().sort((a, b) => themeCount(b) - themeCount(a))[0]); }
export function furnGrade(g) { if (g) grade = g; return grade; }
const hearts = n => '♥'.repeat(n);

function tile(cat, key) {
  const I = itemInfo(cat, key), mine = furnHave(cat) === key, lock = itemLocked(cat, key);
  const k = PIC_K[cat], img = cat === 'table' ? pic(I.spr.replace('table_', 'chair_'), k) + pic(I.spr, k) : pic(I.spr, k);
  const price = furnPrice(cat, key), poor = price > G.cash;
  return `<button type="button" class="fu-tile${mine ? ' mine' : ''}${lock ? ' lock' : ''}" data-ts="fbuy" data-c="${cat}" data-k="${key}" ${mine || lock || poor ? 'disabled' : ''}>
    <i class="fu-m">+${I.mood}</i><span class="fu-pic">${img}</span><b>${I.name}</b>
    <small>${mine ? '설치됨' : lock ? `${hearts(I.heart)} 필요` : wonShort(price)}</small></button>`;
}

function themeTab(th) {
  const T = FURN_THEMES[th], n = themeCount(th), key = c => (grade === 2 ? th + '2' : th);
  const miss = setMissing(th, grade), sp = setPrice(th, grade), lock = itemLocked('wall', key());
  return `<div class="fu-grade"><button type="button" data-ts="fgr" data-g="1" class="${grade === 1 ? 'sel' : ''}">일반</button><button type="button" data-ts="fgr" data-g="2" class="${grade === 2 ? 'sel' : ''}">고급 <small>${hearts(FURN_PREM_HEART)}</small></button></div>
    <p class="fu-bonus ${n >= FURN_THEME_NEED ? 'on' : ''}">${n >= FURN_THEME_NEED ? '★' : `${n}/${FURN_THEME_NEED}`} ${T.bonusText}</p>
    <div class="fu-grid">${FURN_ORDER.map(c => tile(c, key(c))).join('')}</div>
    <div class="mk-foot">${miss.length > 1 && !lock ? `<button type="button" class="btn primary big mk-buy" data-ts="fset" ${sp > G.cash ? 'disabled' : ''}>${T.short || T.name}${grade === 2 ? ' 고급' : ''} 세트로 ${miss.length}개 · ${won(sp)} <small>${Math.round((1 - FURN_SET_RATE) * 100)}% 싸게</small></button>` : ''}
    <div class="mk-sum"><span>${miss.length ? '6개 다 맞추면 분위기 +10' : ''}</span><span>잔고 ${wonShort(G.cash)}</span></div></div>`;
}

function specialTab() {
  const lv = bondLv('miso'), own = misoOwned(), lock = lv < MISO_SET.heart, price = misoPrice();
  const pics = FURN_ORDER.map(c => pic(c === 'table' ? 'chair_miso' : itemInfo(c, 'miso').spr, 1)).join('');
  return `<p class="fu-bonus">친밀도로 여는 물건 · 어느 테마로든 셉니다</p>
    <div class="fu-grid two">${Object.keys(FURN_SPECIAL).map(k => tile(FURN_SPECIAL[k].cat, k)).join('')}</div>
    <div class="fu-set${own ? ' mine' : ''}${lock ? ' lock' : ''}"><div class="fu-set-pics">${pics}</div>
      <b>${MISO_SET.name}</b><small>${MISO_SET.note}</small><small>6가지 한 번에 · 분위기 ${MISO_SET.mood} · 테마 보너스 넷 다</small>
      <button type="button" class="btn ${own || lock ? '' : 'primary'}" data-ts="fmiso" ${own || lock || price > G.cash ? 'disabled' : ''}>${own ? '설치됨' : lock ? `${hearts(MISO_SET.heart)} 필요` : won(price)}</button></div>
    <p class="fu-bonus" style="text-align:right">잔고 ${wonShort(G.cash)}</p>`;
}

function buildTab() {
  const lv = shopLv(), B = nextBuild(), now = SLOTS_BY_GRADE[lv];
  if (!B) return `<p class="ts-note">지금 가게 「${GRADE_NAMES[lv]}」 · 탁자 ${TABLES.length}개. 더 넓히는 공사는 준비 중입니다</p>`;
  const lock = bondLv('miso') < B.heart, price = buildPrice();
  return `<div class="fu-build">
      <div class="fu-b-row"><span>지금</span><b>${GRADE_NAMES[lv]}</b><small>탁자 ${TABLES.length}개 · 메뉴 칸 ${now}</small></div>
      <div class="fu-b-arrow">▼ 홀을 두 줄 넓혀요</div>
      <div class="fu-b-row next"><span>공사 뒤</span><b>${B.name}</b><small>탁자 ${B.tables}개 · 메뉴 칸 ${SLOTS_BY_GRADE[lv + 1]}</small></div>
      <p class="fu-bonus">주간 임대료 +${wonShort(B.rent)} · 공사는 오늘 밤에 끝납니다</p>
    </div>
    <div class="mk-foot"><button type="button" class="btn primary big mk-buy" data-ts="fbuild" ${lock || price > G.cash ? 'disabled' : ''}>${lock ? `${hearts(B.heart)} 필요` : `확장공사 · ${won(price)}`}</button>
    <div class="mk-sum"><span></span><span>잔고 ${wonShort(G.cash)}</span></div></div>`;
}

export function furnHTML() {
  const tab = furnTheme(), on = themesOn(), disc = misoDisc();
  const tabs = FURN_THEME_IDS.map(id => `<button type="button" class="fu-tab${id === tab ? ' sel' : ''}" data-ts="fth" data-t="${id}">${FURN_THEMES[id].short || FURN_THEMES[id].name}${themeCount(id) ? `<i>${themeCount(id)}</i>` : ''}</button>`).join('')
    + `<button type="button" class="fu-tab${tab === 'sp' ? ' sel' : ''}" data-ts="fth" data-t="sp">특별 <small>♥4</small></button><button type="button" class="fu-tab${tab === 'build' ? ' sel' : ''}" data-ts="fth" data-t="build">확장공사</button>`;
  return `<div class="ts-head"><b>미소 가구</b>${heartsHTML('miso')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>
    <div class="fu-mood">분위기 <b>${mood()}</b><small>/100</small>${on.length ? ` · ${on.map(t => `<span class="tag hot">${FURN_THEMES[t].short || FURN_THEMES[t].name}</span>`).join(' ')}` : ''}${disc ? ` · <span class="fu-disc">♥ ${Math.round(disc * 100)}% 할인</span>` : ''}</div>
    <div class="fu-tabs">${tabs}</div>
    ${furnLocked() ? '<p class="ts-note">미소 사장님과 조금 더 친해지면 살 수 있습니다</p>' : ''}
    ${tab === 'sp' ? specialTab() : tab === 'build' ? buildTab() : themeTab(tab)}`;
}
