// 미소 가구 규칙 (data/furniture.js): 사기 · 분위기 점수 · 테마 보너스 · 가게 그림 이름
//  G.furn = { have: { 카테고리: 테마 | null }, seen: 2장 첫 장면을 봤나, visits: 들른 날 수 }
import { G } from '../save/state.js';
import {
  FURN_CATS, FURN_ORDER, FURN_SPR, FURN_THEMES, FURN_NAMES, FURN_THEME_NEED, FURN_SET_RATE, FURN_SET_MOOD,
  MOOD_MAX, MOOD_SAT_DIV, MOOD_SAT_MAX, MOOD_ENTER_DIV, FURN_HEART,
} from '../data/furniture.js';
import { emit, defineCmd } from './events.js';
import { josa } from '../engine/util.js';
import { bondLv, misoDisc, addBond } from './bond.js';
import { BOND_TRADE } from '../data/bond.js';

export const newFurn = () => ({ have: { wall: null, floor: null, window: null, plant: null, frame: null, table: null }, seen: false, visits: 0, tradeDay: 0 });
// 2장부터 미소 꽃집이 가구점으로
export const furnOpen = () => !!(G.story && G.story.ch >= 2);
export const furnHave = cat => (G.furn && G.furn.have[cat]) || null;
// 값: 미소 사장님 친밀도 할인 (100원 단위)
export const furnPrice = cat => Math.round(FURN_CATS[cat].price * (1 - misoDisc()) / 100) * 100;
// 세트: 그 테마로 아직 안 바꾼 것만, 낱개 합의 85%
export const setMissing = th => FURN_ORDER.filter(c => furnHave(c) !== th);
export const setPrice = th => Math.round(setMissing(th).reduce((s, c) => s + furnPrice(c), 0) * FURN_SET_RATE / 100) * 100;
export const furnLocked = () => bondLv('miso') < FURN_HEART;

export const themeCount = th => FURN_ORDER.filter(c => furnHave(c) === th).length;
export const themeOn = () => Object.keys(FURN_THEMES).find(th => themeCount(th) >= FURN_THEME_NEED) || null;
export function mood() {
  if (!G.furn) return 0;
  let m = FURN_ORDER.reduce((s, c) => s + (furnHave(c) ? FURN_CATS[c].mood : 0), 0);
  if (Object.keys(FURN_THEMES).some(th => themeCount(th) === FURN_ORDER.length)) m += FURN_SET_MOOD;
  return Math.min(MOOD_MAX, m);
}

// ── 영업에 주는 영향 (sim/customers.js · sim/traffic.js) ──
export function moodSat(type) {
  const th = themeOn(), T = th && FURN_THEMES[th];
  return Math.min(MOOD_SAT_MAX, mood() / MOOD_SAT_DIV) + ((T && T.sat && T.sat[type]) || 0);
}
export function moodEnterMul(type) {
  const th = themeOn(), T = th && FURN_THEMES[th];
  return (1 + mood() / MOOD_ENTER_DIV) * ((T && T.enter && T.enter[type]) || 1);
}
export const eatMul = () => { const th = themeOn(); return (th && FURN_THEMES[th].eat) || 1; };

// 가게 그림: 바꾼 카테고리는 그 테마 그림, 아니면 원래 그림 (render/view.js)
export const furnSpr = (cat, base) => (furnHave(cat) ? FURN_SPR[cat] + '_' + furnHave(cat) : base);

// 사기: { cat, theme } 하나 · { set: theme } 모자란 것 한 번에. 미소 가구 창이 열려 있을 때만 (G.town.furnIn)
defineCmd('furnBuy', ({ cat, theme, set }) => {
  const th = set || theme;
  if (!furnOpen() || G.phase !== 'prep' || !G.town || !G.town.furnIn || !FURN_THEMES[th]) return false;
  if (furnLocked()) { emit('toast', '미소 사장님과 조금 더 친해져야 합니다', 'info'); return false; }
  const cats = set ? setMissing(th) : [cat];
  if (!cats.length || cats.some(c => !FURN_CATS[c] || furnHave(c) === th)) return false;
  const price = set ? setPrice(th) : furnPrice(cat);
  if (price > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  G.cash -= price;
  for (const c of cats) G.furn.have[c] = th;
  emit('toast', set ? `${FURN_THEMES[th].name} 세트로 가게를 꾸몄습니다 · 분위기 ${mood()}` : `${josa(FURN_NAMES[cat][th], '을/를')} 들였습니다 · 분위기 ${mood()}`, 'good');
  emit('sfx', 'coin');
  if (G.furn.tradeDay !== G.day) { G.furn.tradeDay = G.day; addBond('miso', BOND_TRADE, '거래'); }
  emit('prep');
  return true;
});
