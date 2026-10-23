// 게임 상태 G: 저장되는 것(G.*)과 하루 영업 중에만 쓰는 것(G.run)으로 나뉘어요.
// 세이브 호환: 저장 키·버전은 바꾸지 않아요. 새 칸은 기본값과 함께 추가만 하고, 옛 세이브 보정은 save/migrations.js에.
import { MENUS, MENU_IDS, PREP_FIRST_DAY } from '../data/menu.js';
import { START_CASH, START_LOAN } from '../data/economy.js';
import { migrate } from './migrations.js';

export const SAVE_KEY = 'sosang-tycoon-save-v1';
export const SAVE_V = 1;
// 저장하는 칸 (순서대로 직렬화)
// prep = 오늘 아침 도착할 재료 주문량(인분) · inv = 가게 재료 { 메뉴: [{ n: 인분, exp: 이 날까지 쓸 수 있음 }] }
const SAVE_ORDER = ['v', 'shop', 'day', 'cash', 'loan', 'rating', 'ratingN', 'prices', 'prep', 'inv', 'ledger', 'history', 'weekSales', 'baseSeed', 'stats'];

export const G = { phase: 'title', run: null };

export function newGame(shopName) {
  Object.assign(G, {
    v: SAVE_V,
    shop: shopName || '골목분식',
    day: 1,
    cash: START_CASH,
    loan: START_LOAN,
    rating: 3.0,
    ratingN: 0,
    prices: Object.fromEntries(MENU_IDS.map(m => [m, MENUS[m].price])),
    prep: { ...PREP_FIRST_DAY },
    inv: Object.fromEntries(MENU_IDS.map(m => [m, []])),
    ledger: Object.fromEntries(MENU_IDS.map(m => [m, {}])), // 가격 장부 { 메뉴: { 가격: { love, happy, meh, angry } } }
    history: [],
    weekSales: 0,
    baseSeed: 0,
    stats: { served: 0, sales: 0 },
    phase: 'prep',
    run: null,
  });
}

export function serialize() {
  const o = {};
  for (const k of SAVE_ORDER) o[k] = G[k];
  return JSON.stringify(o);
}

export function deserialize(text) {
  const o = migrate(JSON.parse(text));
  newGame(o.shop);
  for (const k of SAVE_ORDER) if (o[k] !== undefined) G[k] = o[k];
  G.v = SAVE_V;
  G.phase = 'prep'; // 영업 중에 껐다면 그날 아침 준비부터 다시 해요
  G.run = null;
}
