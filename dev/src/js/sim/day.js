// 하루의 흐름: 준비(prep: 가격·재료 주문) → 아침 재료 도착 → 낮 영업(day) → 마감 정산(receipt) → (7일마다) 주간 정산(weekly) → 다음 날 준비
// 재료는 유통기한(MENUS.shelf)까지 남겨 두고 다음 날 써요. 먼저 받은 재료부터 써요.
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, PRICE_STEP, PRICE_MIN, PRICE_MAX, PREP_STEP, PREP_MAX } from '../data/menu.js';
import { DAY_SEC, DAY_MIN, CLOSE_CAP_MIN, WEEK_RENT, LOAN_WEEKLY, PLAYER_SPEED, RUSH_QTY, RUSH_MUL, RUSH_SEC, ratingSpawnMul, openingMul } from '../data/economy.js';
import { SPAWN_PER_HOUR, FOOT_PER_HOUR } from '../data/customers.js';
import { SEATS, PLAYER_START } from '../data/layout.js';
import { REVIEW_TEMPLATES } from '../data/reviews.js';
import { seedRand, rand, newSeed, pick } from '../engine/random.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';
import { spawnPasser, shopCustomers, planRegulars, tickRegulars } from './customers.js';
import { planIncidents, tickIncidents, closeIncidents } from './incidents.js';
import { districtVisitMul } from '../data/district.js';
import { startDawnCook } from './player.js';
import { menuOpen, storyNote, storyOpenDay, storyNextDay } from './story.js';
import { readyCap } from './tools.js';

export const openMenus = () => MENU_IDS.filter(m => menuOpen(m));
export const prepCost = () => openMenus().reduce((s, m) => s + G.prep[m] * MENUS[m].cost, 0); // 주문 금액 (아침 도착 때 결제)
export const invCount = m => (G.inv[m] || []).reduce((s, b) => s + b.n, 0);
const zeros = () => Object.fromEntries(MENU_IDS.map(m => [m, 0]));
export const rushCost = m => Math.round(MENUS[m].cost * RUSH_QTY * RUSH_MUL / 100) * 100;
// 재료를 n인분 들여놓아요 (오늘부터 shelf일 동안 쓸 수 있어요)
function stockIn(m, n) { if (n > 0) G.inv[m].push({ n, exp: G.day + MENUS[m].shelf - 1 }); }
// 먼저 받은 재료부터 n인분 써요
function useFifo(m, n) {
  const b = G.inv[m].sort((a, c) => a.exp - c.exp);
  while (n > 0 && b.length) { const k = Math.min(n, b[0].n); b[0].n -= k; n -= k; if (!b[0].n) b.shift(); }
}
export const isWeeklyNight = () => G.day % 7 === 0;

export function setPhase(p) { G.phase = p; emit('phase', p); }

function newRun() {
  return {
    min: 0, speed: 1, paused: false, closing: false,
    stock: Object.fromEntries(MENU_IDS.map(m => [m, invCount(m)])), added: zeros(), rush: [], rushExtra: 0,
    customers: [], nextId: 1, tickets: [], hands: [],
    seats: SEATS.map(() => null), queue: [], payLine: [],
    player: { x: PLAYER_START.x, y: PLAYER_START.y, path: [], speed: PLAYER_SPEED, dir: 3, moving: false, target: null, payT: 0, char: 0 },
    cook: null, spawnAcc: 0,
    log: {
      sales: Object.fromEntries(MENU_IDS.map(m => [m, { n: 0, rev: 0 }])), tips: 0, served: 0,
      missed: { full: 0, wait: 0, price: 0, soldout: 0 }, sats: [], events: [], wasteDishes: 0, faces: {}, foot: 0, entered: 0,
      priceFaces: Object.fromEntries(MENU_IDS.map(m => [m, {}])),
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
// 가게 열기: 주문한 재료가 도착하고(이때 값을 내요) 영업을 시작해요
defineCmd('openShop', () => {
  const cost = prepCost();
  if (cost > G.cash) { emit('toast', '주문 금액이 잔고보다 많습니다. 주문량을 줄여 보세요', 'warn'); return false; }
  if (!G.baseSeed) G.baseSeed = newSeed();
  seedRand(G.baseSeed + G.day * 7919);
  G.cash -= cost;
  const ordered = Object.fromEntries(MENU_IDS.map(m => [m, menuOpen(m) ? G.prep[m] : 0]));
  for (const m of MENU_IDS) stockIn(m, ordered[m]);
  G.run = newRun();
  G.run.ordered = ordered; G.run.orderCost = cost;
  G.run.startStock = { ...G.run.stock };
  G.run.ready = {}; // 새벽에 미리 끓여 둔 그릇 { 메뉴: [품질, …] }
  planRegulars(G.run); planIncidents(G.run); // 오늘 올 단골 · 오늘 일어날 돌발 (그날 씨앗으로)
  storyOpenDay();
  setPhase('day');
  const n = Object.values(ordered).reduce((a, b) => a + b, 0);
  // 보온 통이 있으면 새벽 6시: 재료가 도착하고, 문 열기 전에 미리 끓여 둘 수 있어요 (그동안 가게 시계는 멈춰요)
  const cap = readyCap(G.run.stock);
  if (Object.keys(cap).length) {
    G.run.dawn = { cap };
    emit('toast', `새벽 6시${n ? `, 재료 ${n}인분 도착` : ''}`, 'info');
    emit('dawn', true);
  } else startBusiness(n);
  return true;
});
function startBusiness(n) {
  emit('sfx', 'open');
  emit('toast', `${G.day}일차 영업 시작!${n ? ` 재료 ${n}인분 도착` : ''}`, 'good');
}
// 새벽: 미리 끓이기 (미니게임은 sim/player.js startCook과 같아요)
defineCmd('dawnCook', ({ menu }) => {
  const r = G.run;
  if (!r || !r.dawn || r.cook) return;
  const m = menu || Object.keys(r.dawn.cap)[0];
  if ((r.ready[m] || []).length >= r.dawn.cap[m]) return;
  startDawnCook(m);
});
defineCmd('dawnDone', () => {
  const r = G.run;
  if (!r || !r.dawn || r.cook) return;
  r.dawn = null;
  emit('dawn', false);
  startBusiness(0);
});
// 급구매: 영업 중에 근처 마트에서 재료를 사 와요 (비싸고 조금 기다려야 와요)
defineCmd('rushBuy', ({ menu }) => {
  const r = G.run;
  if (!r || r.closing || !menuOpen(menu)) return;
  const cost = rushCost(menu);
  if (cost > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return; }
  G.cash -= cost;
  r.rushExtra += cost - MENUS[menu].cost * RUSH_QTY;
  r.rush.push({ menu, n: RUSH_QTY, t: RUSH_SEC });
  emit('toast', `${MENUS[menu].ing} ${RUSH_QTY}인분을 급하게 주문했습니다. 곧 도착합니다`, 'info');
  emit('fridge');
});
// 일찍 마감: 새 손님은 받지 않고, 안에 있는 손님만 마저 받아요
defineCmd('closeEarly', () => {
  const r = G.run;
  if (!r || r.closing) return;
  r.closing = true; r.closeMin = r.min;
  emit('toast', '영업을 마감합니다. 남은 손님만 받습니다', 'info');
  emit('closing');
});
defineCmd('pause', ({ on }) => { if (G.run) G.run.paused = on; emit('pause', on); });
defineCmd('speed', ({ x }) => { if (G.run) G.run.speed = x; });
// 대화 장면을 보는 동안 가게를 잠깐 멈춰요 (쉬기 화면은 안 띄워요)
defineCmd('hold', ({ on }) => { if (G.run) G.run.paused = on; });

// ── 영업 중: 시계·손님 들어오기·마감 ──
export function tickDay(dt) {
  const r = G.run;
  r.min += dt * DAY_MIN / DAY_SEC;
  if (!r.closing && r.min >= DAY_MIN) {
    r.closing = true; r.closeMin = DAY_MIN;
    emit('toast', '21시, 영업을 마감합니다. 남은 손님만 받습니다', 'info');
    emit('closing');
  }
  // 가게 앞 보도에 사람이 지나가요. 그중 일부가 들어와 손님이 돼요 (마감 뒤에는 지나가기만)
  const hour = 9 + Math.floor(r.min / 60);
  const foot = FOOT_PER_HOUR[hour] || 8;
  // 들어올 손님 = 시간대 기대값 × 별점 × 개업 초기 × 상권(경쟁 강도·메뉴 궁합 — data/district.js)
  const visits = r.closing ? 0 : (SPAWN_PER_HOUR[hour] || 0) * ratingSpawnMul(G.rating) * openingMul(G.day) * districtVisitMul(openMenus());
  r.enterP = Math.min(0.9, visits / foot);
  r.spawnAcc += foot / (DAY_SEC / 12) * dt * (0.85 + rand() * 0.3);
  while (r.spawnAcc >= 1) { r.spawnAcc -= 1; spawnPasser(hour); }
  tickRegulars(); tickIncidents();
  // 급구매한 재료 도착 (실제 초 기준)
  for (const o of r.rush.slice()) {
    o.t -= dt;
    if (o.t > 0) continue;
    r.rush.splice(r.rush.indexOf(o), 1);
    r.stock[o.menu] += o.n; r.added[o.menu] += o.n; stockIn(o.menu, o.n);
    emit('toast', `${MENUS[o.menu].ing} ${o.n}인분이 도착했습니다`, 'good');
    emit('fridge');
  }
  // 메뉴 재료가 처음 떨어지면 급구매를 알려 줘요 (메뉴마다 한 번)
  for (const m of openMenus()) {
    if (r.closing || r.stock[m] > 0 || (r.outHint || {})[m] || r.rush.some(o => o.menu === m)) continue;
    (r.outHint = r.outHint || {})[m] = true;
    emit('toast', `${josa(MENUS[m].ing, '이/가')} 떨어졌습니다. 냉장고를 눌러 급구매해 보세요`, 'hint');
  }
  // 재료가 다 떨어지면 일찍 마감할 수 있다고 알려 줘요 (한 번만)
  if (!r.closing && !r.soldOutHint && !r.rush.length && openMenus().every(m => r.stock[m] <= 0) && !r.tickets.length && !r.hands.length) {
    r.soldOutHint = true;
    emit('toast', '재료가 모두 떨어졌습니다. 쉬기(❚❚)에서 일찍 마감해 보세요', 'hint');
  }
  if (r.closing && (shopCustomers().length === 0 || r.min >= Math.max(CLOSE_CAP_MIN, r.closeMin + 60))) endDay();
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
  closeIncidents(); // 끝나지 않은 돌발은 실패로
  // 팔지 못한 미리 끓인 그릇은 버려요 (그만큼 재료도 썼어요)
  let readyLeft = 0;
  for (const m in r.ready) { const k = Math.min(r.ready[m].length, Math.max(0, r.stock[m])); r.stock[m] -= k; readyLeft += k * MENUS[m].cost; }
  const revenue = MENU_IDS.reduce((s, m) => s + L.sales[m].rev, 0);
  // 오늘 쓴 재료: 처음 재고 + 급구매 − 남은 재고 (먼저 받은 것부터). 그다음 유통기한이 오늘까지인 재료는 버려요
  const used = {}, expired = {};
  let usedCost = 0, expiredCost = 0;
  for (const m of MENU_IDS) {
    used[m] = Math.max(0, r.startStock[m] + r.added[m] - r.stock[m]);
    useFifo(m, used[m]); usedCost += used[m] * MENUS[m].cost;
    expired[m] = G.inv[m].filter(b => b.exp <= G.day).reduce((s, b) => s + b.n, 0);
    G.inv[m] = G.inv[m].filter(b => b.exp > G.day);
    expiredCost += expired[m] * MENUS[m].cost;
  }
  r.rush.forEach(o => { G.cash += rushCost(o.menu); r.rushExtra -= rushCost(o.menu) - MENUS[o.menu].cost * o.n; }); // 도착 전 마감한 급구매는 취소
  const leftover = Object.fromEntries(MENU_IDS.map(m => [m, invCount(m)]));
  const dishWaste = r.hands.reduce((s, d) => s + MENUS[d.menu].cost, 0) + L.wasteDishes + readyLeft; // 만들고 못 판 음식 (쓴 재료값 안에 들어 있어요)
  const missed = Object.values(L.missed).reduce((a, b) => a + b, 0);
  const dayRating = L.sats.length ? L.sats.reduce((a, b) => a + b, 0) / L.sats.length : null;
  const before = G.rating;
  if (dayRating !== null) {
    G.rating = G.ratingN ? G.rating * 0.7 + dayRating * 0.3 : dayRating;
    G.ratingN++;
  }
  const net = revenue + L.tips - usedCost - expiredCost - r.rushExtra;
  const rec = {
    day: G.day, revenue, tips: L.tips, usedCost, expiredCost, expired, rushExtra: r.rushExtra, dishWaste, leftover, net,
    sales: L.sales, served: L.served, missed: L.missed, missedTotal: missed,
    avgSpend: L.served ? Math.round(revenue / L.served) : 0,
    dayRating, rating: G.rating, ratingDelta: G.rating - before, foot: L.foot, entered: L.entered, closeMin: r.closeMin ?? DAY_MIN,
    incidents: L.incidents || [], reviews: pickReviews(L.events), prices: { ...G.prices }, ordered: r.ordered, faces: L.faces, priceFaces: L.priceFaces,
  };
  G.history.push({ day: G.day, revenue, net, served: L.served, missed, rating: dayRating, prep: { ...r.ordered }, stockStart: { ...r.startStock }, sold: Object.fromEntries(MENU_IDS.map(m => [m, L.sales[m].n])) });
  if (G.history.length > 60) G.history.shift();
  G.stats.served += L.served; G.stats.sales += revenue;
  // 가격 장부: 메뉴마다, 가격마다 손님 얼굴을 쌓아 둬요 (준비 화면에서 보여 줘요)
  for (const m of MENU_IDS) {
    const f = L.priceFaces[m]; if (!Object.keys(f).length) continue;
    const book = (G.ledger[m] = G.ledger[m] || {}), p = G.prices[m], e = (book[p] = book[p] || {});
    for (const k in f) e[k] = (e[k] || 0) + f[k];
  }
  // 이야기: 오늘 영업 결과로 퀘스트 세기 (재료가 안 떨어진 날 = 품절로 놓친 손님이 없고, 연 메뉴마다 재료가 남음)
  const clean = !L.missed.soldout && openMenus().every(m => r.stock[m] > 0);
  storyNote('receipt'); storyNote('dayServed', { served: L.served }); storyNote('cleanDay', { clean }); storyNote('dayEnd');
  rec.quests = G.story.today.slice();
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
    storyNote('weekly');
    G.lastWeekly.quests = G.story.today.slice();
    setPhase('weekly');
  } else nextDay();
});
defineCmd('afterWeekly', () => nextDay());

function nextDay() {
  G.day++;
  // 주문량 추천: (어제 판 만큼 + 5인분) − 남아 있는 재료, 5인분 단위
  const last = G.history[G.history.length - 1];
  for (const m of MENU_IDS) {
    if (last && menuOpen(m)) G.prep[m] = Math.min(PREP_MAX, Math.max(0, Math.ceil((last.sold[m] + 5 - invCount(m)) / 5) * 5));
  }
  storyNextDay(); // 예약한 메뉴는 처음 주문량으로 열려요
  setPhase('prep');
}
