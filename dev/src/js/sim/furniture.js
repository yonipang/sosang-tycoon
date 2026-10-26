// 미소 가구 규칙 (data/furniture.js): 사기 · 분위기 점수 · 테마 보너스 · 가게 그림 이름 · 확장공사(가게 등급)
//  G.furn = { have: { 카테고리: 물건 이름 | null }, seen: 2장 첫 장면을 봤나, visits: 들른 날 수, tradeDay }
//  물건 이름: 'retro' 일반 · 'retro2' 고급 · 'lucky'·'old' 친밀도 전용 · 'miso' 미소 컬렉션
//  G.shopLv = 가게 등급 (1부터, 확장공사로 오름 — 배치는 data/layout.js applyShopLv)
import { G } from '../save/state.js';
import {
  FURN_CATS, FURN_ORDER, FURN_SPR, FURN_THEMES, FURN_NAMES, FURN_NAMES2, FURN_SPECIAL, MISO_SET, MISO_NAMES, SHOP_BUILD,
  FURN_THEME_NEED, FURN_SET_RATE, FURN_SET_MOOD, MOOD_MAX, MOOD_SAT_DIV, MOOD_SAT_MAX, MOOD_ENTER_DIV, FURN_HEART, FURN_PREM_HEART,
} from '../data/furniture.js';
import { applyShopLv } from '../data/layout.js';
import { emit, defineCmd } from './events.js';
import { josa } from '../engine/util.js';
import { bondLv, misoDisc, addBond } from './bond.js';
import { BOND_TRADE } from '../data/bond.js';

export const newFurn = () => ({ have: { wall: null, floor: null, window: null, plant: null, frame: null, table: null }, seen: false, visits: 0, tradeDay: 0 });
// 2장부터 미소 꽃집이 가구점으로
export const furnOpen = () => !!(G.story && G.story.ch >= 2);
export const furnHave = cat => (G.furn && G.furn.have[cat]) || null;

// 물건 하나: { theme: 테마(null = 어느 테마로든 셈), grade: 1|2|'sp'|'miso', price, mood, name, heart, spr }
export function itemInfo(cat, key) {
  const C = FURN_CATS[cat];
  if (key === 'miso') return { theme: null, grade: 'miso', price: 0, mood: C.prem[1], name: MISO_NAMES[cat], heart: MISO_SET.heart, spr: FURN_SPR[cat] + '_miso' };
  if (FURN_SPECIAL[key]) { const S = FURN_SPECIAL[key]; return { theme: null, grade: 'sp', price: S.price, mood: S.mood, name: S.name, heart: S.heart, spr: FURN_SPR[cat] + '_' + key }; }
  const prem = key.endsWith('2'), th = prem ? key.slice(0, -1) : key;
  return prem ? { theme: th, grade: 2, price: C.prem[0], mood: C.prem[1], name: FURN_NAMES2[cat][th], heart: FURN_PREM_HEART, spr: FURN_SPR[cat] + '_' + key }
    : { theme: th, grade: 1, price: C.price, mood: C.mood, name: FURN_NAMES[cat][th], heart: FURN_HEART, spr: FURN_SPR[cat] + '_' + key };
}
// 값: 미소 사장님 친밀도 할인 (100원 단위)
const misoOff = n => Math.round(n * (1 - misoDisc()) / 100) * 100;
export const furnPrice = (cat, key) => misoOff(itemInfo(cat, key).price);
export const itemLocked = (cat, key) => bondLv('miso') < itemInfo(cat, key).heart;
export const furnLocked = () => bondLv('miso') < FURN_HEART;
// 세트: 그 테마·등급으로 아직 안 바꾼 것만, 낱개 합의 85%
const keyOf = (th, grade) => (grade === 2 ? th + '2' : th);
export const setMissing = (th, grade) => FURN_ORDER.filter(c => furnHave(c) !== keyOf(th, grade));
export const setPrice = (th, grade) => Math.round(setMissing(th, grade).reduce((s, c) => s + furnPrice(c, keyOf(th, grade)), 0) * FURN_SET_RATE / 100) * 100;
export const misoPrice = () => misoOff(MISO_SET.price);
export const misoOwned = () => FURN_ORDER.every(c => furnHave(c) === 'miso');

// 테마 세기: 친밀도 전용·미소 컬렉션은 어느 테마로든 셈
const themeOfHave = c => (furnHave(c) ? itemInfo(c, furnHave(c)).theme : undefined);
export const themeCount = th => FURN_ORDER.filter(c => { const t = themeOfHave(c); return t === th || t === null; }).length;
export const themesOn = () => Object.keys(FURN_THEMES).filter(th => themeCount(th) >= FURN_THEME_NEED);
export const themeOn = () => themesOn().sort((a, b) => themeCount(b) - themeCount(a))[0] || null;
export function mood() {
  if (!G.furn) return 0;
  if (misoOwned()) return MISO_SET.mood;
  let m = FURN_ORDER.reduce((s, c) => s + (furnHave(c) ? itemInfo(c, furnHave(c)).mood : 0), 0);
  if (Object.keys(FURN_THEMES).some(th => themeCount(th) === FURN_ORDER.length)) m += FURN_SET_MOOD;
  return Math.min(MOOD_MAX, m);
}

// ── 영업에 주는 영향 (sim/customers.js) — 테마 보너스는 켜진 테마마다 ──
export function moodSat(type) {
  return Math.min(MOOD_SAT_MAX, mood() / MOOD_SAT_DIV) + themesOn().reduce((s, th) => s + ((FURN_THEMES[th].sat && FURN_THEMES[th].sat[type]) || 0), 0);
}
export function moodEnterMul(type) {
  return (1 + mood() / MOOD_ENTER_DIV) * themesOn().reduce((k, th) => k * ((FURN_THEMES[th].enter && FURN_THEMES[th].enter[type]) || 1), 1);
}
export const eatMul = () => themesOn().reduce((k, th) => Math.min(k, FURN_THEMES[th].eat || 1), 1);

// 가게 그림: 바꾼 카테고리는 그 물건 그림, 아니면 원래 그림 (render/view.js)
export const furnSpr = (cat, base) => (furnHave(cat) ? itemInfo(cat, furnHave(cat)).spr : base);
export const chairSpr = () => (furnHave('table') ? itemInfo('table', furnHave('table')).spr.replace('table_', 'chair_') : 'chair');

// 사기 (미소 가구 창이 열려 있을 때만 — G.town.furnIn)
//  { cat, key } 하나 · { set: 테마, grade: 1|2 } 모자란 것 한 번에 · { miso: true } 미소 컬렉션
defineCmd('furnBuy', ({ cat, key, set, grade, miso }) => {
  if (!furnOpen() || G.phase !== 'prep' || !G.town || !G.town.furnIn) return false;
  let cats, price, k, name;
  if (miso) { cats = FURN_ORDER.filter(c => furnHave(c) !== 'miso'); k = 'miso'; price = misoPrice(); name = MISO_SET.name; if (bondLv('miso') < MISO_SET.heart) return locked(); }
  else if (set) { if (!FURN_THEMES[set]) return false; k = keyOf(set, grade); cats = setMissing(set, grade); price = setPrice(set, grade); name = `${FURN_THEMES[set].name}${grade === 2 ? ' 고급' : ''} 세트`; if (itemLocked('wall', k)) return locked(); }
  else { if (!FURN_CATS[cat] || !key) return false; k = key; cats = [cat]; price = furnPrice(cat, key); name = itemInfo(cat, key).name; if (itemLocked(cat, key)) return locked(); if (FURN_SPECIAL[key] && FURN_SPECIAL[key].cat !== cat) return false; }
  if (!cats.length || (!set && !miso && furnHave(cat) === k)) return false;
  if (price > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  G.cash -= price;
  for (const c of cats) G.furn.have[c] = k;
  emit('toast', set || miso ? `${josa(name, '으로/로')} 가게를 꾸몄습니다 · 분위기 ${mood()}` : `${josa(name, '을/를')} 들였습니다 · 분위기 ${mood()}`, 'good');
  emit('sfx', 'coin');
  trade();
  emit('prep');
  return true;
});
function locked() { emit('toast', '미소 사장님과 조금 더 친해져야 합니다', 'info'); return false; }
function trade() { if (G.furn.tradeDay !== G.day) { G.furn.tradeDay = G.day; addBond('miso', BOND_TRADE, '거래'); } }

// ── 확장공사 (가게 등급) ──
export const shopLv = () => (G && G.shopLv) || 1;
export const nextBuild = () => SHOP_BUILD[shopLv() + 1] || null;
export const buildPrice = () => { const B = nextBuild(); return B ? misoOff(B.price) : 0; };
// 주간 임대료에 더하는 몫 (sim/day.js 고지서)
export const buildRent = () => Object.keys(SHOP_BUILD).filter(lv => shopLv() >= +lv).reduce((s, lv) => s + SHOP_BUILD[lv].rent, 0);
// 배치를 지금 등급에 맞춰요 (바뀌었으면 true — ui가 캔버스 크기를 다시 맞춰요)
export const syncLayout = () => applyShopLv(shopLv());
defineCmd('shopBuild', () => {
  const B = nextBuild();
  if (!furnOpen() || G.phase !== 'prep' || !G.town || !G.town.furnIn || !B) return false;
  if (bondLv('miso') < B.heart) return locked();
  const price = buildPrice();
  if (price > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  G.cash -= price;
  G.shopLv = shopLv() + 1;
  syncLayout();
  emit('toast', `확장공사를 마쳤습니다. 이제 「${B.name}」 · 탁자 ${B.tables}개`, 'good');
  emit('sfx', 'coin');
  trade();
  emit('prep');
  return true;
});
