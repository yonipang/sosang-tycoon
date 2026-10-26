// 재료 시세 (data/market.js): 오늘 원재료 값 · 메뉴 1인분 원가(재료값 합) · 밤마다 새 시세 소식 · 원가율 계산
// 원가는 그날의 시세로 매겨요 (사들일 때 · 마감 때 쓴 재료값 모두 같은 값)
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, INGREDIENTS } from '../data/menu.js';
import { MARKET_NEWS, MARKET_START_DAY, MARKET_CHANCE, MARKET_REST } from '../data/market.js';
import { seedRand, rand } from '../engine/random.js';
import { emit, defineCmd } from './events.js';
import { menuOpen } from './story.js';

// 지금 나 있는 시세 소식 · 이 재료 / 이 메뉴에 걸린 소식 (없으면 null)
const newsNow = () => { const M = G.market; return M && M.id && MARKET_NEWS[M.id] ? MARKET_NEWS[M.id] : null; };
export const newsMenus = n => MENU_IDS.filter(m => MENUS[m].recipe.some(i => n.ings.includes(i)));
export const ingNews = i => { const n = newsNow(); return n && n.ings.includes(i) ? n : null; };
export const marketOn = m => { const n = newsNow(); return n && newsMenus(n).includes(m) ? n : null; };
// 오늘 재료 1인분 값 (원, 소수 그대로 — 메뉴로 합친 뒤 10원 단위)
export const ingCost = i => INGREDIENTS[i].cost * (ingNews(i) ? ingNews(i).mul : 1);
// 오늘 메뉴 1인분 원가 = 재료값 합 (10원 단위)
export const costOf = m => Math.round(MENUS[m].recipe.reduce((s, i) => s + ingCost(i), 0) / 10) * 10;
// 원가율 (가격 대비 원가, 0~1)
export const costRatio = m => costOf(m) / Math.max(1, G.prices[m]);

// 다음 날로 넘어갈 때 (sim/day.js nextDay): 끝난 소식은 끝내고, 없으면 새 소식을 낼지 정해요
//  돌려주는 것: { scene: 신문 장면 id } 또는 { back: 끝났다는 알림 } 또는 null
export function marketNextDay() {
  const M = G.market;
  if (M.id && G.day > M.until) { const back = MARKET_NEWS[M.id] ? MARKET_NEWS[M.id].back : ''; M.id = null; M.rest = G.day + MARKET_REST; return { back }; }
  if (M.id || G.day < MARKET_START_DAY || G.day < (M.rest || 0)) return null;
  seedRand(G.baseSeed + G.day * 7919 + 101); // 그날 씨앗 (영업 시작 때 다시 정해요)
  if (!M.force && rand() > MARKET_CHANCE) return null;
  const pool = Object.keys(MARKET_NEWS).filter(id => newsMenus(MARKET_NEWS[id]).some(m => menuOpen(m)) && id !== M.last);
  if (!pool.length) return null;
  const id = pool[Math.floor(rand() * pool.length)];
  M.id = id; M.last = id; M.until = G.day + MARKET_NEWS[id].days - 1; M.force = false;
  return { scene: 'mk_' + id };
}

// 개발자 모드: 다음 날 꼭 시세 소식
defineCmd('devMarket', () => { G.market.force = true; G.market.rest = 0; if (G.market.id) G.market.until = 0; emit('toast', '개발자: 다음 날 시세 소식이 납니다', 'info'); });

// 마감 때 원가율 나누어 보기 (sim/day.js endDay)
//  sold 팔린 음식의 재료 · waste 만들고 못 판 음식·남아 버린 재료 · rush 급구매 웃돈 → 매출 대비 비율
export function costBreakdown(revenue, sales, usedCost, expiredCost, rushExtra) {
  if (!revenue) return null;
  const soldCost = MENU_IDS.reduce((s, m) => s + sales[m].n * costOf(m), 0);
  const waste = Math.max(0, usedCost - soldCost) + expiredCost;
  const total = soldCost + waste + rushExtra;
  return { total: total / revenue, sold: soldCost / revenue, waste: waste / revenue, rush: rushExtra / revenue, cost: total };
}
