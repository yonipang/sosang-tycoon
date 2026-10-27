// 하루의 흐름: 준비(prep: 가격·재료 주문) → 아침 재료 도착 → 낮 영업(day) → 마감 정산(receipt) → (7일마다) 고정비 내는 날(weekly: 임대료·대출·공과금 고지서) → 다음 날 준비
// 재료는 원재료마다 유통기한(INGREDIENTS.shelf)까지 남겨 두고 다음 날 써요. 먼저 받은 재료부터 써요 (sim/pantry.js).
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, ING_IDS, INGREDIENTS, PRICE_STEP, PRICE_MIN, PRICE_MAX, PREP_STEP, PREP_MAX } from '../data/menu.js';
import { DAY_SEC, DAY_MIN, CLOSE_CAP_MIN, WEEK_RENT, LOAN_WEEKLY, LOAN_RATE, UTIL_BASE, UTIL_PER_DISH, PLAYER_SPEED, RUSH_QTY, RUSH_MUL, RUSH_SEC, ratingSpawnMul, openingMul, fameMul } from '../data/economy.js';
import { SPAWN_PER_HOUR, FOOT_PER_HOUR } from '../data/customers.js';
import { SEATS, PLAYER_START } from '../data/layout.js';
import { REVIEW_TEMPLATES } from '../data/reviews.js';
import { seedRand, rand, newSeed, pick } from '../engine/random.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';
import { spawnPasser, shopCustomers, planRegulars, tickRegulars, spawnParty, freeChars } from './customers.js';
import { planIncidents, tickIncidents, closeIncidents } from './incidents.js';
import { districtVisitMul } from '../data/district.js';
import { startDawnCook } from './player.js';
import { menuOpen, storyNote, storyOpenDay, storyNextDay } from './story.js';
import { readyCap } from './tools.js';
import { tutNote, tutEndDay } from './tutorial.js';
import { costOf, ingCost, marketNextDay, costBreakdown } from './market.js';
import { invOf, invServings, stockInMenu, stockIn, useFifo, stockOf, takeMenu, giveMenu, shortIng, todayMenus, menuOn } from './pantry.js';
import { upgradeEndDay } from './upgrade.js';
import { bookEndDay } from './book.js';
import { townOpenRest } from './town.js';
import { furnOpen, buildRent, syncLayout, mood } from './furniture.js';
import { ratingNow, reviewsFromDay } from './rating.js';
import { WEEK_RATING } from '../data/story.js';
import { rushMul, rushSec, guildDues } from './guild.js';
import { townEnterNight, townSpeedMul, setupUntil, referralPlan, townEndDay, dirty, metPlan } from './town.js';
import { PEOPLE_INFO } from '../data/people.js';
import { bloggerToday, bloggerEndDay } from './traffic.js';
import { PROMO } from '../data/town.js';

export const openMenus = () => MENU_IDS.filter(m => menuOpen(m));
export const prepCost = () => todayMenus().reduce((s, m) => s + G.prep[m] * costOf(m), 0); // 주문 금액 (아침 도착 때 결제 — 프롤로그·1장 첫날, 메뉴 한 벌씩)
const ingZeros = () => Object.fromEntries(ING_IDS.map(i => [i, 0]));
export const rushCost = m => Math.round(costOf(m) * RUSH_QTY * rushMul() / 100) * 100; // 냉장고 Lv3(상인회)면 웃돈이 적어요
export const isWeeklyNight = () => G.day % 7 === 0;

export function setPhase(p) { G.phase = p; emit('phase', p); }

function newRun() {
  syncLayout(); // 가게 등급에 맞는 배치 (확장공사)
  return {
    min: 0, speed: 1, paused: false, closing: false,
    ing: Object.fromEntries(ING_IDS.map(i => [i, invOf(i)])), added: ingZeros(), rush: [], rushExtra: 0,
    customers: [], nextId: 1, tickets: [], hands: [],
    seats: SEATS.map(() => null), queue: [], payLine: [],
    player: { x: PLAYER_START.x, y: PLAYER_START.y, path: [], speed: PLAYER_SPEED, dir: 3, moving: false, target: null, payT: 0, char: 0 },
    cook: null, spawnAcc: 0,
    log: {
      sales: Object.fromEntries(MENU_IDS.map(m => [m, { n: 0, rev: 0 }])), tips: 0, served: 0,
      missed: { full: 0, wait: 0, price: 0, soldout: 0 }, sats: [], events: [], wasteDishes: 0, faces: {}, foot: 0, entered: 0,
      mastery: {}, fans: {}, back: {}, hourly: {}, blogSat: null, blogMenu: null, visits: {}, lastSat: {}, // 시간대 기록 · 블로거 만족 (sim/traffic.js)
      // 메뉴 업그레이드: 오늘 숙련도 · 맛있게 먹은 손님 · 다시 온 손님 (sim/upgrade.js, 마감 때 더해요)
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
  if (!todayMenus().length) { emit('toast', '오늘의 메뉴에 메뉴를 하나 이상 올려 보세요', 'warn'); return false; }
  const cost = prepCost();
  if (cost > G.cash) { emit('toast', '주문 금액이 잔고보다 많습니다. 주문량을 줄여 보세요', 'warn'); return false; }
  if (!G.baseSeed) G.baseSeed = newSeed();
  seedRand(G.baseSeed + G.day * 7919);
  G.cash -= cost;
  const ordered = Object.fromEntries(MENU_IDS.map(m => [m, menuOn(m) ? G.prep[m] : 0]));
  for (const m of MENU_IDS) stockInMenu(m, ordered[m]);
  G.run = newRun();
  G.run.ordered = ordered; G.run.orderCost = cost;
  G.run.startIng = { ...G.run.ing };
  G.run.startStock = Object.fromEntries(MENU_IDS.map(m => [m, stockOf(m)])); // 메뉴마다 만들 수 있던 그릇 (어제 품절 표시용)
  G.run.ready = {}; // 새벽에 미리 끓여 둔 그릇 { 메뉴: [품질, …] }
  // 마을(밤·새벽)에서 한 일: 피로·오픈 준비 → 사장 걸음, 이웃 소개 손님
  townOpenRest(); // 칸을 남긴 턴이면 피로가 풀려요
  G.run.player.speed = PLAYER_SPEED * townSpeedMul(); G.run.setupUntil = setupUntil();
  G.run.referral = referralPlan();
  G.run.met = metPlan(); // 골목에서 이야기한 손님 (v0.48)
  G.run.blog = bloggerToday() ? { at: PROMO.blogger.at, done: false } : null; // 어젯밤 섭외한 파워블로거
  planRegulars(G.run); planIncidents(G.run); // 오늘 올 단골 · 오늘 일어날 돌발 (그날 씨앗으로)
  storyOpenDay();
  emit('track', 'day_open', { menus: todayMenus().length, fatigue: (G.town && G.town.fatigue) || 0 }); // 플레이 기록 (ui/analytics.js)
  setPhase('day');
  const n = Object.values(ordered).reduce((a, b) => a + b, 0);
  // 보온 통이 있으면 새벽 6시: 재료가 도착하고, 문 열기 전에 미리 끓여 둘 수 있어요 (그동안 가게 시계는 멈춰요)
  const cap = readyCap(Object.fromEntries(todayMenus().map(m => [m, stockOf(m)])));
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
  tutNote('open');
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
  const cost = rushCost(menu); // 메뉴 한 벌(재료 하나씩) × 5인분
  if (cost > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return; }
  G.cash -= cost;
  r.rushExtra += cost - costOf(menu) * RUSH_QTY;
  r.rush.push({ menu, n: RUSH_QTY, t: rushSec() });
  emit('toast', `${MENUS[menu].ing} ${RUSH_QTY}인분을 급하게 주문했습니다. 곧 도착합니다`, 'info');
  emit('track', 'rush_buy', { menu });
  emit('fridge');
});
// 일찍 마감: 새 손님은 받지 않고, 안에 있는 손님만 마저 받아요
defineCmd('closeEarly', () => {
  const r = G.run;
  if (!r || r.closing) return;
  r.closing = true; r.closeMin = r.min;
  emit('toast', '영업을 마감합니다. 남은 손님만 받습니다', 'info');
  emit('closing');
  tutNote('closing');
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
    tutNote('closing');
  }
  // 가게 앞 보도에 사람이 지나가요. 그중 일부가 들어와 손님이 돼요 (마감 뒤에는 지나가기만)
  const hour = 9 + Math.floor(r.min / 60);
  const foot = FOOT_PER_HOUR[hour] || 8;
  // 들어올 손님 = 시간대 기대값 × 별점 × 인지도(1장부터 리뷰 수 · 프롤로그는 개업 초기) × 상권(경쟁 강도·메뉴 궁합 — data/district.js)
  const visits = r.closing ? 0 : (SPAWN_PER_HOUR[hour] || 0) * ratingSpawnMul(ratingNow()) * (G.story.ch === 0 ? openingMul(G.day) : fameMul(G.ratingN || 0)) * districtVisitMul(todayMenus()); // 손님층마다 다른 몫(칠판·홍보·메뉴 궁합)은 가게 앞에서 (sim/traffic.js)
  r.enterP = Math.min(0.9, visits / foot);
  r.spawnAcc += foot / (DAY_SEC / 12) * dt * (0.85 + rand() * 0.3);
  while (r.spawnAcc >= 1) { r.spawnAcc -= 1; spawnPasser(hour); }
  tickRegulars(); tickIncidents();
  // 오픈 준비 효과가 끝나요 (11시) · 이웃이 소개한 손님이 와요
  if (r.setupUntil >= 0 && r.min >= r.setupUntil) { r.setupUntil = -1; r.player.speed = PLAYER_SPEED * townSpeedMul(); }
  for (const f of r.referral || []) {
    if (f.done || r.closing || r.min < f.at) continue;
    const chars = freeChars().slice(0, 2);
    f.done = true;
    if (chars.length && spawnParty(chars, { force: true, ref: f.who })) emit('toast', `${f.who === 'miso' ? (furnOpen() ? '미소 가구' : '미소 꽃집') : f.who === 'moon' ? '문 철물 상인회' : '최 사장 세탁소'} 소개로 손님이 옵니다`, 'good');
  }
  for (const f of r.met || []) { // 골목에서 이야기한 손님이 찾아와요
    if (f.done || r.closing || r.min < f.at) continue;
    f.done = true;
    if (freeChars().includes(f.char) && spawnParty([f.char], { force: true, ref: 'met' })) emit('toast', `골목에서 이야기 나눈 ${josa((PEOPLE_INFO[f.char] || {}).name || '손님', '이/가')} 찾아왔습니다`, 'good');
  }
  // 파워블로거가 와요 (점심 무렵)
  if (r.blog && !r.blog.done && !r.closing && r.min >= r.blog.at) {
    r.blog.done = true;
    const ch = freeChars().includes(16) ? 16 : freeChars('worker')[0];
    if (ch !== undefined && spawnParty([ch], { force: true, blog: true })) emit('toast', '파워블로거가 왔습니다. 맛있게 만들어 보세요', 'good');
  }
  // 급구매한 재료 도착 (실제 초 기준)
  for (const o of r.rush.slice()) {
    o.t -= dt;
    if (o.t > 0) continue;
    r.rush.splice(r.rush.indexOf(o), 1);
    giveMenu(o.menu, o.n); for (const i of MENUS[o.menu].recipe) { r.added[i] += o.n; stockIn(i, o.n); }
    emit('toast', `${MENUS[o.menu].ing} ${o.n}인분이 도착했습니다`, 'good');
    emit('fridge');
  }
  // 메뉴 재료가 처음 떨어지면 급구매를 알려 줘요 (메뉴마다 한 번) — 어느 재료가 떨어졌는지
  for (const m of todayMenus()) {
    if (r.closing || stockOf(m) > 0 || (r.outHint || {})[m] || r.rush.some(o => o.menu === m)) continue;
    (r.outHint = r.outHint || {})[m] = true;
    emit('toast', `${josa(INGREDIENTS[shortIng(m)].name, '이/가')} 떨어져 ${josa(MENUS[m].name, '을/를')} 못 만듭니다. 냉장고를 눌러 급구매해 보세요`, 'hint');
  }
  // 재료가 다 떨어지면 일찍 마감할 수 있다고 알려 줘요 (한 번만)
  if (!r.closing && !r.soldOutHint && !r.rush.length && todayMenus().every(m => stockOf(m) <= 0) && !r.tickets.length && !r.hands.length) {
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
  if (dirty()) L.events.push({ kind: 'dirty', who: '손님' }); // 위생이 낮으면 리뷰에 나와요
  townEndDay();
  const masteryGain = upgradeEndDay();
  bookEndDay(); // 손님 수첩
  const blog = bloggerEndDay(); // 블로거 평 → 며칠 동안 직장인·어르신 (null = 오늘 안 옴)
  // 팔지 못한 미리 끓인 그릇은 버려요 (그만큼 재료도 썼어요)
  let readyLeft = 0;
  for (const m in r.ready) { const k = Math.min(r.ready[m].length, Math.max(0, stockOf(m))); takeMenu(m, k); readyLeft += k * costOf(m); }
  const revenue = MENU_IDS.reduce((s, m) => s + L.sales[m].rev, 0);
  // 오늘 쓴 재료(재료마다): 처음 재고 + 급구매 − 남은 재고 (먼저 받은 것부터). 그다음 유통기한이 오늘까지인 재료는 버려요
  const used = {}, expired = {};
  let usedCost = 0, expiredCost = 0;
  for (const i of ING_IDS) {
    used[i] = Math.max(0, r.startIng[i] + r.added[i] - r.ing[i]);
    useFifo(i, used[i]); usedCost += used[i] * ingCost(i);
    expired[i] = G.inv[i].filter(b => b.exp <= G.day).reduce((s, b) => s + b.n, 0);
    G.inv[i] = G.inv[i].filter(b => b.exp > G.day);
    expiredCost += expired[i] * ingCost(i);
  }
  usedCost = Math.round(usedCost / 10) * 10; expiredCost = Math.round(expiredCost / 10) * 10;
  r.rush.forEach(o => { G.cash += rushCost(o.menu); r.rushExtra -= rushCost(o.menu) - costOf(o.menu) * o.n; }); // 도착 전 마감한 급구매는 취소
  const leftover = Object.fromEntries(ING_IDS.filter(i => invOf(i) > 0).map(i => [i, invOf(i)])); // 내일로 넘어가는 재료
  const dishWaste = r.hands.reduce((s, d) => s + costOf(d.menu), 0) + L.wasteDishes + readyLeft; // 만들고 못 판 음식 (쓴 재료값 안에 들어 있어요)
  const missed = Object.values(L.missed).reduce((a, b) => a + b, 0);
  const dayRating = L.sats.length ? L.sats.reduce((a, b) => a + b, 0) / L.sats.length : null;
  const before = G.rating;
  const newReviews = reviewsFromDay(L.sats); // 별점 = 최근 리뷰 평균 (sim/rating.js)
  const net = revenue + L.tips - usedCost - expiredCost - r.rushExtra;
  const rec = {
    day: G.day, revenue, tips: L.tips, usedCost, expiredCost, expired, rushExtra: r.rushExtra, dishWaste, leftover, net,
    sales: L.sales, served: L.served, missed: L.missed, missedTotal: missed,
    avgSpend: L.served ? Math.round(revenue / L.served) : 0,
    dayRating, rating: G.rating, ratingDelta: before == null || G.rating == null ? 0 : G.rating - before, ratingN: G.ratingN, newReviews, foot: L.foot, entered: L.entered, closeMin: r.closeMin ?? DAY_MIN,
    cost: costBreakdown(revenue, L.sales, usedCost, expiredCost, r.rushExtra), // 원가율 나누어 보기 (sim/market.js)
    incidents: L.incidents || [], mastery: masteryGain, blog, hourly: L.hourly, reviews: pickReviews(L.events), prices: { ...G.prices }, ordered: r.ordered, faces: L.faces, priceFaces: L.priceFaces,
  };
  G.history.push({ day: G.day, revenue, net, served: L.served, missed, rating: dayRating, prep: { ...r.ordered }, stockStart: { ...r.startStock }, sold: Object.fromEntries(MENU_IDS.map(m => [m, L.sales[m].n])), cost: usedCost + expiredCost + r.rushExtra, inc: r.incidents.filter(x => x.state !== 'wait' && x.state !== 'skip').map(x => x.id) });
  if (G.history.length > 60) G.history.shift();
  G.stats.served += L.served; G.stats.sales += revenue;
  // 가격 장부: 메뉴마다, 가격마다 손님 얼굴을 쌓아 둬요 (준비 화면에서 보여 줘요)
  for (const m of MENU_IDS) {
    const f = L.priceFaces[m]; if (!Object.keys(f).length) continue;
    const book = (G.ledger[m] = G.ledger[m] || {}), p = G.prices[m], e = (book[p] = book[p] || {});
    for (const k in f) e[k] = (e[k] || 0) + f[k];
  }
  // 이야기: 오늘 영업 결과로 퀘스트 세기 (재료가 안 떨어진 날 = 품절로 놓친 손님이 없고, 연 메뉴마다 재료가 남음)
  const clean = !L.missed.soldout && todayMenus().every(m => stockOf(m) > 0);
  tutEndDay(); // 오늘 못 한 길잡이 차례는 건너뛰어요 (주는 퀘스트는 받고 — 영수증 퀘스트도 셀 수 있게 먼저)
  storyNote('receipt'); storyNote('dayServed', { served: L.served }); storyNote('lunchClean', { clean: !L.lunchWait }); storyNote('mood', { mood: mood() }); storyNote('cleanDay', { clean }); storyNote('dayEnd');
  rec.quests = G.story.today.slice();
  G.lastReceipt = rec;
  emit('track', 'day_close', { revenue: rec.revenue + rec.tips, net: rec.net, served: rec.served, missed: rec.missedTotal, rating: G.rating == null ? 0 : Math.round(G.rating * 10) / 10, reviews: G.ratingN || 0 });
  G.run = null;
  setPhase('receipt');
}

// 이번 주 고정비 고지서: 가게 임대료 · 대출 이자 · 대출 원금 · 공과금(전기·가스·수도)
//  upTo: 이 날까지 판 그릇으로 공과금을 셈 (준비 화면에서는 어제까지로 미리 보여 줘요)
export function weekBills(upTo = G.day) {
  const interest = Math.min(LOAN_WEEKLY, Math.round(G.loan * LOAN_RATE / 52 / 100) * 100);
  const principal = Math.min(LOAN_WEEKLY - interest, Math.max(0, G.loan));
  const dishes = G.history.filter(h => h.day > G.day - 7 && h.day <= upTo).reduce((s, h) => s + Object.values(h.sold).reduce((a, b) => a + b, 0), 0);
  const util = Math.round((UTIL_BASE + dishes * UTIL_PER_DISH) / 100) * 100;
  const rent = WEEK_RENT + buildRent(); // 확장공사로 넓힌 만큼 더 (sim/furniture.js)
  const dues = guildDues(); // 상인회 회비 (sim/guild.js)
  return { rent, interest, principal, util, dues, dishes, total: rent + interest + principal + util + dues };
}

// 영수증 다음: 7일째 밤이면 고정비 내는 날(고지서), 아니면 다음 날 준비
defineCmd('afterReceipt', () => {
  if (isWeeklyNight()) {
    G.lastWeekly = { week: G.day / 7, sales: G.weekSales, bills: weekBills(), paid: false };
    setPhase('weekly');
  } else nextDay();
});
// 고지서를 내 손으로 내요 (잔고가 모자라도 일단 냅니다 — 프로토타입)
defineCmd('afterWeekly', () => {
  const W = G.lastWeekly;
  if (W && !W.paid) {
    const B = W.bills;
    G.cash -= B.total;
    G.loan = Math.max(0, G.loan - B.principal);
    G.weekSales = 0;
    W.paid = true;
    emit('toast', `이번 주 고정비 ${B.total.toLocaleString('ko-KR')}원을 냈습니다`, 'info');
    emit('sfx', 'coin');
    storyNote('weekly'); storyNote('weeklyRating', { ok: ratingNow() >= WEEK_RATING }); // 2장 끝 「동네에서 소문」
    emit('track', 'weekly', { bills: B.total, after: Math.round(G.cash / 1000) });
  }
  nextDay();
});

function nextDay() {
  G.day++;
  // 주문량 추천: (어제 판 만큼 + 5인분) − 남아 있는 재료, 5인분 단위
  const last = G.history[G.history.length - 1];
  for (const m of MENU_IDS) {
    if (last && menuOpen(m)) G.prep[m] = Math.min(PREP_MAX, Math.max(0, Math.ceil((last.sold[m] + 5 - invServings(m)) / 5) * 5));
  }
  storyNextDay(); // 예약한 메뉴는 처음 주문량으로 열려요
  townEnterNight(); // 1장부터는 밤 골목으로 (재료는 새벽 시장에서)
  const mk = marketNextDay(); // 재료 시세: 새 소식은 골목 신문으로, 끝난 소식은 알림으로
  if (mk && mk.scene) G.story.queue.push(mk.scene);
  setPhase('prep');
  if (mk && mk.back) emit('toast', mk.back, 'info');
}
