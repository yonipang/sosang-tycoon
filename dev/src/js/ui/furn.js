// 미소 가구 창 (마을 · 2장부터): 위에 가게 미리보기 · 가진 물건 한 줄 · 효과 한 줄, 아래 테마 하나의 물건 6칸
//  물건을 누르면 장바구니에 담겨 미리보기에 바로 보이고, 「구매하기」로 한 번에 사요 (「초기화」로 비우기)
//  규칙은 sim/furniture.js (runCmd 'furnBuy'), 수치는 data/furniture.js
import { G } from '../save/state.js';
import { won, wonShort } from '../engine/util.js';
import { FURN_ORDER, FURN_THEMES, FURN_THEME_IDS, FURN_THEME_NEED, FURN_SET_RATE, FURN_SPECIAL, MISO_SET, FURN_PREM_HEART, FURN_CATS } from '../data/furniture.js';
import { GRADE_NAMES } from '../data/menu.js';
import { TABLES } from '../data/layout.js';
import { BOND_LV } from '../data/bond.js';
import { furnHave, furnPrice, setMissing, themeCount, themesOn, mood, furnLocked, itemInfo, itemLocked, misoOwned, misoPrice, shopLv, nextBuild, buildPrice, withFurn, cartList, cartPrice, cartIsSet } from '../sim/furniture.js';
import { drawShopTo } from '../render/view.js';
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

// 장바구니 { 카테고리: 물건 이름 } — 사기 전엔 미리보기만
let fcart = {};
export function furnCartReset() { fcart = {}; }
export function furnToggle(cat, key) {
  if (key === 'miso') { const all = FURN_ORDER.every(c => fcart[c] === 'miso'); for (const c of FURN_ORDER) { if (all) delete fcart[c]; else fcart[c] = 'miso'; } return; }
  if (fcart[cat] === key) delete fcart[cat];
  else { if (Object.values(fcart).includes('miso')) for (const c of FURN_ORDER) if (fcart[c] === 'miso') delete fcart[c]; fcart[cat] = key; }
}
export function furnSetToCart() { const th = furnTheme(), k = grade === 2 ? th + '2' : th; for (const c of FURN_ORDER) if (furnHave(c) !== k) fcart[c] = k; }
export const furnCart = () => fcart;
// 미리보기 그리기 (창을 그린 뒤 ui/town.js가 불러요)
export function drawFurnPreview() { const cv = document.getElementById('fuPrev'); if (cv) drawShopTo(cv, { preview: fcart, rows: 8, time: 0 }); }

function tile(cat, key) {
  const I = itemInfo(cat, key), mine = furnHave(cat) === key, lock = key === 'miso' ? bondLv('miso') < MISO_SET.heart : itemLocked(cat, key);
  const k = PIC_K[cat], img = cat === 'table' ? pic(I.spr.replace('table_', 'chair_'), k) + pic(I.spr, k) : pic(I.spr, k);
  const inCart = fcart[cat] === key;
  return `<button type="button" class="fu-tile${mine ? ' mine' : ''}${lock ? ' lock' : ''}${inCart ? ' pick' : ''}" data-ts="fbuy" data-c="${cat}" data-k="${key}" ${mine || lock ? 'disabled' : ''}>
    <i class="fu-m">+${I.mood}</i>${inCart ? '<i class="fu-pk">담음</i>' : ''}<span class="fu-pic">${img}</span><b>${I.name}</b>
    <small>${mine ? '설치됨' : lock ? `${hearts(I.heart)} 필요` : wonShort(furnPrice(cat, key))}</small></button>`;
}

function themeTab(th) {
  const T = FURN_THEMES[th], n = withFurn(fcart, () => themeCount(th)), key = () => (grade === 2 ? th + '2' : th);
  const miss = setMissing(th, grade), lock = itemLocked('wall', key());
  return `<div class="fu-grade"><button type="button" data-ts="fgr" data-g="1" class="${grade === 1 ? 'sel' : ''}">일반</button><button type="button" data-ts="fgr" data-g="2" class="${grade === 2 ? 'sel' : ''}">고급 <small>${hearts(FURN_PREM_HEART)}</small></button></div>
    <p class="fu-bonus ${n >= FURN_THEME_NEED ? 'on' : ''}">${n >= FURN_THEME_NEED ? '★' : `${n}/${FURN_THEME_NEED}`} ${T.bonusText}${miss.length > 1 && !lock ? ` <button type="button" class="fu-setbtn" data-ts="fset">6개 다 담기 · ${Math.round((1 - FURN_SET_RATE) * 100)}% 싸게</button>` : ''}</p>
    <div class="fu-grid">${FURN_ORDER.map(c => tile(c, key())).join('')}</div>`;
}

function specialTab() {
  const own = misoOwned(), lock = bondLv('miso') < MISO_SET.heart, inCart = FURN_ORDER.every(c => fcart[c] === 'miso');
  const pics = FURN_ORDER.map(c => pic(c === 'table' ? 'chair_miso' : itemInfo(c, 'miso').spr, 1)).join('');
  return `<p class="fu-bonus">친밀도로 여는 물건 · 어느 테마로든 셉니다</p>
    <div class="fu-grid two">${Object.keys(FURN_SPECIAL).map(k => tile(FURN_SPECIAL[k].cat, k)).join('')}</div>
    <div class="fu-set${own ? ' mine' : ''}${lock ? ' lock' : ''}${inCart ? ' pick' : ''}"><div class="fu-set-pics">${pics}</div>
      <b>${MISO_SET.name}</b><small>${MISO_SET.note}</small><small>6가지 한 번에 · 분위기 ${MISO_SET.mood} · 테마 보너스 넷 다</small>
      <button type="button" class="btn ${own || lock ? '' : 'primary'}" data-ts="fbuy" data-c="wall" data-k="miso" ${own || lock ? 'disabled' : ''}>${own ? '설치됨' : lock ? `${hearts(MISO_SET.heart)} 필요` : inCart ? '담음 · 빼기' : `담기 · ${won(misoPrice())}`}</button></div>`;
}

// 위: 가게 미리보기(창 너비를 꽉 채워요, 늘 위에 붙어 있음) · 그 아래 가진 물건(아이콘 한 줄) · 효과 한 줄
function topHTML(head) {
  const now = mood(), next = withFurn(fcart, mood), on = withFurn(fcart, themesOn), disc = misoDisc();
  const owned = FURN_ORDER.map(c => { const k = furnHave(c); return k ? `<span class="fu-own" title="${itemInfo(c, k).name}">${pic(itemInfo(c, k).spr, c === 'wall' || c === 'floor' ? 0.5 : 1)}</span>` : `<span class="fu-own none" title="${FURN_CATS[c].name}"></span>`; }).join('');
  const eff = `분위기 <b>${now}</b>${next !== now ? ` → <b class="up">${next}</b>` : ''}<small>/100</small>${on.length ? ` · ${on.map(t => `★${FURN_THEMES[t].short || FURN_THEMES[t].name}`).join(' ')}` : ''}${disc ? ` · <span class="fu-disc">♥ ${Math.round(disc * 100)}%</span>` : ''}`;
  return `<div class="fu-top">${head}<canvas id="fuPrev" class="fu-prev" width="160" height="128" aria-label="가게 미리보기"></canvas>
    <div class="fu-side"><div class="fu-owned">${owned}</div><div class="fu-mood">${eff}</div></div></div>`;
}
// 아래에 떠 있는 버튼: 초기화 · 구매하기 (담은 개수·잔고는 버튼 위 작은 글)
function footHTML() {
  const n = cartList(fcart).length, price = cartPrice(fcart), set = cartIsSet(fcart);
  return `<div class="fu-float"><p class="fu-sum">${n ? `${n}개 담음${set ? ' · 세트 15% 할인' : ''}` : '물건을 눌러 담아 보세요'} · 잔고 ${wonShort(G.cash)}</p>
    <div class="fu-btns"><button type="button" class="btn" data-ts="freset" ${n ? '' : 'disabled'}>초기화</button>
    <button type="button" class="btn primary big" data-ts="fcart" ${n && price <= G.cash ? '' : 'disabled'}>${!n ? '구매하기' : price > G.cash ? '잔고가 모자랍니다' : `구매하기 · ${won(price)}`}</button></div></div>`;
}

function buildTab() {
  const lv = shopLv(), B = nextBuild();
  if (!B) return `<p class="ts-note">지금 가게 「${GRADE_NAMES[lv]}」 · 탁자 ${TABLES.length}개. 더 넓히는 공사는 준비 중입니다</p>`;
  const lock = bondLv('miso') < B.heart, price = buildPrice();
  return `<div class="fu-build">
      <div class="fu-b-row"><span>지금</span><b>${GRADE_NAMES[lv]}</b><small>탁자 ${TABLES.length}개</small></div>
      <div class="fu-b-arrow">▼ 홀을 두 줄 넓혀요</div>
      <div class="fu-b-row next"><span>공사 뒤</span><b>${B.name}</b><small>탁자 ${B.tables}개</small></div>
      <p class="fu-bonus">주간 임대료 +${wonShort(B.rent)} · 공사는 오늘 밤에 끝납니다</p>
    </div>
    <div class="mk-foot"><button type="button" class="btn primary big mk-buy" data-ts="fbuild" ${lock || price > G.cash ? 'disabled' : ''}>${lock ? `${hearts(B.heart)} 필요` : `확장공사 · ${won(price)}`}</button>
    <div class="mk-sum"><span></span><span>잔고 ${wonShort(G.cash)}</span></div></div>`;
}

export function furnHTML() {
  const tab = furnTheme();
  const tabs = FURN_THEME_IDS.map(id => `<button type="button" class="fu-tab${id === tab ? ' sel' : ''}" data-ts="fth" data-t="${id}">${FURN_THEMES[id].short || FURN_THEMES[id].name}${themeCount(id) ? `<i>${themeCount(id)}</i>` : ''}</button>`).join('')
    + `<button type="button" class="fu-tab${tab === 'sp' ? ' sel' : ''}" data-ts="fth" data-t="sp">특별 <small>♥4</small></button><button type="button" class="fu-tab${tab === 'build' ? ' sel' : ''}" data-ts="fth" data-t="build">확장공사</button>`;
  return `${topHTML(`<div class="ts-head"><b>미소 가구</b>${heartsHTML('miso')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>`)}
    <div class="fu-tabs">${tabs}</div>
    ${furnLocked() ? '<p class="ts-note">미소 사장님과 조금 더 친해지면 살 수 있습니다</p>' : ''}
    ${tab === 'sp' ? specialTab() : tab === 'build' ? buildTab() : themeTab(tab)}
    ${tab === 'build' ? '' : footHTML()}`;
}
