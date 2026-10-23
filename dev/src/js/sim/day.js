// 하루의 흐름: 새벽 준비(prep) → 낮 영업(day) → 마감 정산(receipt) → (7일마다) 주간 정산(weekly) → 다음 날 준비
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, PRICE_STEP, PRICE_MIN, PRICE_MAX, PREP_STEP, PREP_MAX, PREP_FIRST_DAY, MENU_UNLOCK, menuOpen } from '../data/menu.js';
import { DAY_SEC, DAY_MIN, CLOSE_CAP_MIN, WEEK_RENT, LOAN_WEEKLY, PLAYER_SPEED, ratingSpawnMul, openingMul } from '../data/economy.js';
import { SPAWN_PER_HOUR } from '../data/customers.js';
import { SEATS, PLAYER_START } from '../data/layout.js';
import { REVIEW_TEMPLATES } from '../data/reviews.js';
import { seedRand, rand, newSeed, pick } from '../engine/random.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';
import { spawnCustomer } from './customers.js';

export const openMenus = () => MENU_IDS.filter(m => menuOpen(m, G.day));
export const prepCost = () => openMenus().reduce((s, m) => s + G.prep[m] * MENUS[m].cost, 0);
const todayStock = () => Object.fromEntries(MENU_IDS.map(m => [m, menuOpen(m, G.day) ? G.prep[m] : 0]));
export const isWeeklyNight = () => G.day % 7 === 0;

export function setPhase(p) { G.phase = p; emit('phase', p); }

function newRun() {
  return {
    min: 0, speed: 1, paused: false, closing: false,
    stock: todayStock(), prepared: todayStock(), ingredientCost: prepCost(),
    customers: [], nextId: 1, tickets: [], hands: [],
    seats: SEATS.map(() => null), queue: [], payLine: [],
    player: { x: PLAYER_START.x, y: PLAYER_START.y, path: [], speed: PLAYER_SPEED, dir: 3, moving: false, target: null, payT: 0, char: 0 },
    cook: null, spawnAcc: 0,
    log: {
      sales: Object.fromEntries(MENU_IDS.map(m => [m, { n: 0, rev: 0 }])), tips: 0, served: 0,
      missed: { full: 0, wait: 0, price: 0, soldout: 0 }, sats: [], events: [], wasteDishes: 0, faces: {},
    },
  };
}

// ── 새벽 준비 ──
defineCmd('setPrice', ({ menu, delta }) => {
  G.prices[menu] = Math.max(PRICE_MIN, Math.min(PRICE_MAX, G.prices[menu] + delta * PRICE_STEP));
  emit('prep');
});
defineCmd('setPrep', ({ menu, delta }) => {
  G.prep[menu] = Math.max(0, Math.min(PREP_MAX, G.prep[menu] + delta * PREP_STEP));
  emit('prep');
});
defineCmd('openShop', () => {
  const cost = prepCost();
  if (cost > G.cash) { emit('toast', '재료비가 잔고보다 많습니다. 준비량을 줄여 보세요', 'warn'); return false; }
  if (!G.baseSeed) G.baseSeed = newSeed();
  seedRand(G.baseSeed + G.day * 7919);
  G.cash -= cost;
  G.run = newRun();
  setPhase('day');
  emit('sfx', 'open');
  emit('toast', `${G.day}일차 영업 시작! 재료비 ${cost.toLocaleString('ko-KR')}원`, 'good');
  return true;
});
defineCmd('pause', ({ on }) => { if (G.run) G.run.paused = on; emit('pause', on); });
defineCmd('speed', ({ x }) => { if (G.run) G.run.speed = x; });

// ── 영업 중: 시계·손님 들어오기·마감 ──
export function tickDay(dt) {
  const r = G.run;
  r.min += dt * DAY_MIN / DAY_SEC;
  if (!r.closing && r.min >= DAY_MIN) {
    r.closing = true;
    emit('toast', '21시, 영업을 마감합니다. 남은 손님만 받습니다', 'info');
    emit('closing');
  }
  if (!r.closing) {
    const hour = 9 + Math.floor(r.min / 60);
    const perSec = (SPAWN_PER_HOUR[hour] || 0) * ratingSpawnMul(G.rating) * openingMul(G.day) / (DAY_SEC / 12);
    r.spawnAcc += perSec * dt;
    while (r.spawnAcc >= 1) { r.spawnAcc -= 1; if (rand() < 0.92) spawnCustomer(hour); }
    if (rand() < perSec * dt * 0.08) spawnCustomer(hour); // 가끔 한 명씩 더
  }
  if (r.closing && (r.customers.length === 0 || r.min >= CLOSE_CAP_MIN)) endDay();
}

// ── 마감 정산 ──
function pickReviews(events) {
  const byKind = {};
  for (const e of events) (byKind[e.kind] = byKind[e.kind] || []).push(e);
  const kinds = Object.keys(byKind).sort((a, b) =>
    (REVIEW_TEMPLATES[b].salience * Math.min(3, byKind[b].length)) - (REVIEW_TEMPLATES[a].salience * Math.min(3, byKind[a].length)));
  return kinds.slice(0, 3).map(k => {
    const e = pick(byKind[k]), t = REVIEW_TEMPLATES[k];
    const menu = e.menu ? MENUS[e.menu].name : '음식';
    return { stars: t.stars, who: e.who, text: pick(t.lines).replace(/\{menu(?::([^}]+))?\}/g, (_, j) => j ? josa(menu, j) : menu) };
  });
}

export function endDay() {
  const r = G.run, L = r.log;
  const revenue = MENU_IDS.reduce((s, m) => s + L.sales[m].rev, 0);
  const leftover = MENU_IDS.reduce((s, m) => s + r.stock[m] * MENUS[m].cost, 0)
    + r.hands.reduce((s, d) => s + MENUS[d.menu].cost, 0) + L.wasteDishes;
  const missed = Object.values(L.missed).reduce((a, b) => a + b, 0);
  const dayRating = L.sats.length ? L.sats.reduce((a, b) => a + b, 0) / L.sats.length : null;
  const before = G.rating;
  if (dayRating !== null) {
    G.rating = G.ratingN ? G.rating * 0.7 + dayRating * 0.3 : dayRating;
    G.ratingN++;
  }
  const net = revenue + L.tips - r.ingredientCost;
  const rec = {
    day: G.day, revenue, tips: L.tips, ingredientCost: r.ingredientCost, waste: leftover, net,
    sales: L.sales, served: L.served, missed: L.missed, missedTotal: missed,
    avgSpend: L.served ? Math.round(revenue / L.served) : 0,
    dayRating, rating: G.rating, ratingDelta: G.rating - before,
    reviews: pickReviews(L.events), prices: { ...G.prices }, prepared: r.prepared, faces: L.faces,
  };
  G.history.push({ day: G.day, revenue, net, served: L.served, missed, rating: dayRating, prep: { ...r.prepared }, sold: Object.fromEntries(MENU_IDS.map(m => [m, L.sales[m].n])) });
  if (G.history.length > 60) G.history.shift();
  G.stats.served += L.served; G.stats.sales += revenue;
  G.lastReceipt = rec;
  G.run = null;
  setPhase('receipt');
}

// 영수증 다음: 7일째 밤이면 주간 정산, 아니면 다음 날 준비
defineCmd('afterReceipt', () => {
  if (isWeeklyNight()) {
    const loanPay = Math.min(LOAN_WEEKLY, G.loan);
    G.lastWeekly = { week: G.day / 7, sales: G.weekSales, rent: WEEK_RENT, loanPay, loanLeft: G.loan - loanPay };
    G.cash -= WEEK_RENT + loanPay;
    G.loan -= loanPay;
    G.weekSales = 0;
    setPhase('weekly');
  } else nextDay();
});
defineCmd('afterWeekly', () => nextDay());

function nextDay() {
  G.day++;
  // 어제 판 만큼 + 5인분을 다음 날 준비량으로 권해요
  const last = G.history[G.history.length - 1];
  for (const m of MENU_IDS) {
    if (G.day === MENU_UNLOCK[m]) G.prep[m] = PREP_FIRST_DAY[m]; // 오늘 처음 여는 메뉴
    else if (last && menuOpen(m, G.day)) G.prep[m] = Math.min(PREP_MAX, Math.max(5, Math.ceil((last.sold[m] + 5) / 5) * 5));
  }
  setPhase('prep');
}
