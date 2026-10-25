// 마을 규칙 (data/town.js): 밤·새벽 행동 칸 · 피로 · 청소/위생 · 이웃 이야기(소개 손님) · 전단지 · 새벽 장보기 · 오픈 준비
// 화면은 만지지 않고 사건만: emit('town', 무엇, …) → ui/town.js · 저장은 emit('prep')(ui/feedback.js가 저장해요)
import { G } from '../save/state.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import {
  PLACES, PLACE_ACTS, ACTS, NIGHT_SLOTS, DAWN_SLOTS, FATIGUE_MAX, FATIGUE_SLOW, HYGIENE_DECAY, CLEAN_GAIN, HYGIENE_LOW,
  FLYER_MUL, SETUP_MUL, SETUP_UNTIL, MARKET_PACK, MARKET_DEAL, REFERRAL_AT, CHATS, JUNG_HELLO,
} from '../data/town.js';
import { seedRand, rand } from '../engine/random.js';
import { emit, defineCmd } from './events.js';
import { menuOpen } from './story.js';
import { costOf } from './market.js';

export const newTown = () => ({ on: false, part: 'night', used: 0, fatigue: 0, hygiene: 100, flyer: 0, setup: 0, referral: [], talked: [], chat: {}, marketIn: false, bought: {}, deal: null, seen: false, visits: 0 });
// 마을이 켜져 있나 (1장부터, 영업을 한 번 마친 밤부터)
export const townMode = () => !!(G.town && G.town.on);
export const slotsMax = () => (G.town.part === 'dawn' ? DAWN_SLOTS : NIGHT_SLOTS);
export const slotsLeft = () => slotsMax() - G.town.used;
// 장소가 지금 열려 있나 · 지금 할 수 있는 일
export const placeOpen = id => !PLACES[id].open || PLACES[id].open === G.town.part;
export const actNow = (place, act) => placeOpen(place) && PLACE_ACTS[place].includes(act) && (ACTS[act].when === 'any' || ACTS[act].when === G.town.part)
  && !(act === 'talk' && G.town.talked.includes(PLACES[place].who));

// 다음 날로 넘어가는 밤 (sim/day.js nextDay): 1장부터는 골목으로
export function townEnterNight() {
  const T = G.town;
  if (!T.on && !(G.story && G.story.ch >= 1)) return false;
  const first = !T.on;
  T.on = true; T.part = 'night'; T.used = 0; T.talked = []; T.marketIn = false; T.bought = {}; T.deal = null; T.referral = [];
  for (const m of MENU_IDS) G.prep[m] = 0; // 재료는 이제 새벽 시장에서 (밤 주문 없음)
  if (first && !T.seen) { T.seen = true; G.story.queue.push('town1'); }
  return true;
}

// 칸 쓰기: 모자라면 그만큼 피로
function useSlots(n) {
  const T = G.town, before = slotsLeft();
  T.used += n;
  const over = Math.max(0, n - Math.max(0, before));
  if (over) { T.fatigue = Math.min(FATIGUE_MAX, T.fatigue + over); emit('toast', `무리했습니다. 피로가 쌓였습니다 (피로 ${T.fatigue})`, 'warn'); }
}

defineCmd('townAct', ({ place, act }) => {
  const T = G.town, A = ACTS[act];
  if (!townMode() || G.phase !== 'prep' || !PLACES[place] || !A) return false;
  if (!actNow(place, act)) { emit('toast', placeOpen(place) ? '지금은 할 수 없습니다' : `${PLACES[place].name}은 지금 닫혀 있습니다`, 'info'); return false; }
  if (A.money && G.cash < A.money) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  if (act === 'ledger') { emit('town', 'ledger'); return true; }
  if (act === 'open') { emit('town', 'open'); return true; }
  if (act === 'sleep') { goDawn(); return true; }
  if (act === 'market') {
    if (!T.marketIn) { useSlots(A.cost); T.marketIn = true; T.visits++; emit('town', 'chat', JUNG_HELLO[Math.min(T.visits, JUNG_HELLO.length) - 1]); }
    emit('town', 'market'); emit('prep'); return true;
  }
  useSlots(A.cost);
  if (A.money) G.cash -= A.money;
  if (act === 'clean') { T.hygiene = Math.min(100, T.hygiene + CLEAN_GAIN); emit('toast', `가게를 구석구석 닦았습니다 (위생 ${T.hygiene})`, 'good'); emit('sfx', 'trash'); }
  else if (act === 'talk') {
    const who = PLACES[place].who, list = CHATS[who], k = (T.chat[who] || 0) % list.length;
    T.chat[who] = (T.chat[who] || 0) + 1; T.talked.push(who); T.referral.push(who);
    emit('town', 'chat', list[k]);
  }
  else if (act === 'flyer') { T.flyer = G.day; emit('toast', '골목 게시판에 전단지를 붙였습니다. 내일 손님이 조금 더 옵니다', 'good'); emit('sfx', 'page'); }
  else if (act === 'setup') { T.setup = G.day; emit('toast', '메뉴판을 닦고 그릇을 가지런히 놓았습니다. 오늘 오전엔 손이 빠릅니다', 'good'); }
  emit('prep');
  return true;
});

// 자고 일어나면 새벽: 칸을 남기고 잤으면 피로가 풀려요 · 오늘 특가
function goDawn() {
  const T = G.town;
  if (T.used < NIGHT_SLOTS && T.fatigue > 0) T.fatigue--;
  T.part = 'dawn'; T.used = 0; T.marketIn = false;
  seedRand(G.baseSeed + G.day * 7919 + 211); // 그날 씨앗 (영업 시작 때 다시 정해요)
  const ms = MENU_IDS.filter(m => menuOpen(m));
  T.deal = ms.length ? ms[Math.floor(rand() * ms.length)] : null;
  emit('town', 'dawn');
  emit('prep');
  emit('story'); // 새벽에 볼 장면 (골목 신문 등)
}

// 시장: 오늘 1인분 값 (특가면 15% 싸게, 10원 단위)
export const marketUnit = m => Math.round(costOf(m) * (G.town.deal === m ? MARKET_DEAL : 1) / 10) * 10;
defineCmd('marketBuy', ({ menu, packs }) => {
  const T = G.town;
  if (!townMode() || T.part !== 'dawn' || !T.marketIn || !menuOpen(menu)) return false;
  const n = (packs || 1) * MARKET_PACK, cost = marketUnit(menu) * n;
  if (n > 0) {
    if (cost > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
    G.cash -= cost;
    G.inv[menu].push({ n, exp: G.day + MENUS[menu].shelf - 1 });
  } else { // 오늘 산 것만 무를 수 있어요
    const back = Math.min(-n, T.bought[menu] || 0);
    if (!back) return false;
    G.cash += marketUnit(menu) * back;
    let k = back;
    const today = G.inv[menu].filter(b => b.exp === G.day + MENUS[menu].shelf - 1).reverse();
    for (const b of today) { const d = Math.min(k, b.n); b.n -= d; k -= d; if (!k) break; }
    G.inv[menu] = G.inv[menu].filter(b => b.n > 0);
  }
  T.bought[menu] = (T.bought[menu] || 0) + (n > 0 ? n : -Math.min(-n, T.bought[menu] || 0));
  emit('sfx', n > 0 ? 'coin' : 'tap');
  emit('prep');
  return true;
});

// ── 영업에 주는 영향 (sim/day.js · customers.js가 불러요) ──
export const townSpeedMul = () => (townMode() ? 1 - FATIGUE_SLOW * G.town.fatigue : 1) * (townMode() && G.town.setup === G.day ? SETUP_MUL : 1);
export const setupUntil = () => (townMode() && G.town.setup === G.day ? SETUP_UNTIL : -1);
export const flyerMul = () => (townMode() && G.town.flyer === G.day ? FLYER_MUL : 1);
export const dirty = () => townMode() && G.town.hygiene < HYGIENE_LOW;
export const referralPlan = () => (townMode() ? G.town.referral.map((who, i) => ({ who, at: REFERRAL_AT[i % REFERRAL_AT.length] + i * 15, done: false })) : []);
// 마감: 위생이 떨어지고 소개 손님은 끝
export function townEndDay() {
  if (!townMode()) return;
  G.town.hygiene = Math.max(0, G.town.hygiene - HYGIENE_DECAY);
  G.town.referral = [];
}
