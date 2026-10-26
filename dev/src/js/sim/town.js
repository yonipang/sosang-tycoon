// 마을 규칙 (data/town.js): 밤·새벽 한 턴 행동 칸 · 피로 · 청소/위생 · 이웃 이야기(소개 손님) · 홍보(계산대: 인스타·블로거 — 효과는 sim/traffic.js) · 새벽 장보기 · 오픈 준비
// 화면은 만지지 않고 사건만: emit('town', 무엇, …) → ui/town.js · 저장은 emit('prep')(ui/feedback.js가 저장해요)
import { G } from '../save/state.js';
import { MENU_IDS, INGREDIENTS } from '../data/menu.js';
import {
  PLACES, PLACE_ACTS, ACTS, NIGHT_SLOTS, DAWN_SLOTS, TURN_SLOTS, NIGHT_START, DAWN_START, FATIGUE_MAX, FATIGUE_SLOW, HYGIENE_DECAY, CLEAN_GAIN, HYGIENE_LOW,
  SETUP_MUL, SETUP_UNTIL, MARKET_DEAL, REFERRAL_AT, CHATS, JUNG_HELLO,
} from '../data/town.js';
import { seedRand, rand } from '../engine/random.js';
import { emit, defineCmd } from './events.js';
import { ingCost } from './market.js';
import { openIngs, stockIn } from './pantry.js';

export const newTown = () => ({ turn: 1, rest: 0, on: false, part: 'night', used: 0, fatigue: 0, hygiene: 100, flyer: 0, setup: 0, referral: [], talked: [], chat: {}, marketIn: false, bought: {}, deal: null, seen: false, visits: 0 });
// 마을이 켜져 있나 (1장부터, 영업을 한 번 마친 밤부터)
export const townMode = () => !!(G.town && G.town.on);
// 칸: 밤·새벽 한 턴에 TURN_SLOTS개 (used = 이번 턴에 쓴 칸, 일찍 자서 건너뛴 밤 칸도 들어가요)
export const slotsMax = () => TURN_SLOTS;
export const slotsLeft = () => TURN_SLOTS - G.town.used;
// 지금 시각 (분): 밤 21:00부터 한 칸에 한 시간 · 새벽은 05:00부터
//  새벽은 05:00~08:00 (칸을 넘겨 써도 08:00에서 멈춰요 — 영업은 09:00)
export const townClock = () => (G.town.part === 'dawn' ? DAWN_START + Math.min(DAWN_SLOTS, Math.max(0, G.town.used - NIGHT_SLOTS)) * 60 : NIGHT_START + Math.min(NIGHT_SLOTS - 1, G.town.used) * 60);
// 칸을 넘겨 쓸 수 있는 한도 (피로 최대만큼) — 더는 할 수 없어요
export const slotsHardMax = () => TURN_SLOTS + FATIGUE_MAX;
// 장소가 지금 열려 있나 · 지금 할 수 있는 일
export const placeOpen = id => !PLACES[id].open || PLACES[id].open === G.town.part;
export const actNow = (place, act) => placeOpen(place) && PLACE_ACTS[place].includes(act) && (ACTS[act].when === 'any' || ACTS[act].when === G.town.part)
  && !(act === 'talk' && G.town.talked.includes(PLACES[place].who))
  && !(act === 'clean' && G.town.hygiene >= 100) && !(act === 'setup' && G.town.setup === G.day) // 할 필요가 없는 일은 막아요
  && !(act === 'insta' && G.town.insta === G.day) && !(act === 'blogger' && G.town.blogDay === G.day);

// 다음 날로 넘어가는 밤 (sim/day.js nextDay): 1장부터는 골목으로
export function townEnterNight() {
  const T = G.town;
  if (!T.on && !(G.story && G.story.ch >= 1)) return false;
  const first = !T.on;
  T.on = true; T.part = 'night'; T.used = 0; T.rest = 0; T.talked = []; T.marketIn = false; T.bought = {}; T.deal = null; T.referral = [];
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
  if (A.cost && G.town.used + A.cost > slotsHardMax() && !(act === 'market' && G.town.marketIn)) { emit('toast', '너무 지쳐서 더는 할 수 없습니다. 가게 문을 열 시간입니다', 'warn'); return false; }
  if (act === 'ledger') { emit('town', 'ledger'); return true; }
  if (act === 'recipe') { emit('town', 'recipe'); return true; }
  if (act === 'counter') { emit('town', 'counter'); return true; }
  if (act === 'book') { emit('town', 'book'); return true; }
  if (act === 'open') { emit('town', 'open'); return true; }
  if (act === 'sleep') { goDawn('sleep'); return true; }
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
  else if (act === 'insta') { T.insta = G.day; emit('toast', '오늘 만든 음식 사진을 인스타에 올렸습니다. 내일 학생 손님이 더 들어옵니다', 'good'); emit('sfx', 'page'); }
  else if (act === 'blogger') { T.blogDay = G.day; emit('toast', '파워블로거에게 연락했습니다. 내일 점심 무렵 찾아옵니다. 맛있게 만들어 보세요', 'good'); emit('sfx', 'coin'); }
  else if (act === 'setup') { T.setup = G.day; emit('toast', '메뉴판을 닦고 그릇을 가지런히 놓았습니다. 오늘 오전엔 손이 빠릅니다', 'good'); }
  if (T.part === 'night' && T.used >= NIGHT_SLOTS) goDawn('auto'); // 밤 칸을 다 쓰면 새벽
  emit('prep');
  return true;
});

// 새벽 5시: how = 'sleep'(집에서 일찍 잠 — 남은 밤 칸만큼 쉬어요) · 'auto'(밤 칸을 다 씀) · 오늘 특가
function goDawn(how) {
  const T = G.town;
  if (how === 'sleep') { T.rest = (T.rest || 0) + Math.max(0, NIGHT_SLOTS - T.used); T.used = Math.max(T.used, NIGHT_SLOTS); }
  else emit('toast', '새벽 5시가 되었습니다. 정 사장 식자재가 문을 엽니다', 'info');
  T.part = 'dawn'; T.marketIn = false;
  seedRand(G.baseSeed + G.day * 7919 + 211); // 그날 씨앗 (영업 시작 때 다시 정해요)
  const fresh = openIngs().filter(i => !INGREDIENTS[i].keep); // 특가는 신선 재료 하나
  T.deal = fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
  emit('town', 'dawn', how);
  emit('prep');
  emit('story'); // 새벽에 볼 장면 (골목 신문 등)
}

// 시장: 오늘 재료 1인분 값 (특가면 15% 싸게, 10원 단위) — 원재료 낱개로 팔아요 (data/menu.js INGREDIENTS)
export const marketUnit = i => Math.round(ingCost(i) * (G.town.deal === i ? MARKET_DEAL : 1) / 10) * 10;
// 장바구니로 한 번에 사기 (시장 창 아래 「구매하기」): cart { 재료: 몇 묶음 }
defineCmd('marketBuyCart', ({ cart }) => {
  const T = G.town;
  if (!townMode() || T.part !== 'dawn' || !T.marketIn) return false;
  const open = openIngs();
  const list = Object.entries(cart || {}).filter(([i, k]) => k > 0 && open.includes(i));
  if (!list.length) return false;
  const total = list.reduce((s, [i, k]) => s + marketUnit(i) * k * INGREDIENTS[i].pack, 0);
  if (total > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  for (const [i, k] of list) {
    const n = k * INGREDIENTS[i].pack;
    G.cash -= marketUnit(i) * n;
    stockIn(i, n);
    T.bought[i] = (T.bought[i] || 0) + n;
  }
  emit('toast', `재료를 샀습니다 · ${list.map(([i, k]) => `${INGREDIENTS[i].name} ${k * INGREDIENTS[i].pack}`).join(' · ')}`, 'good');
  emit('sfx', 'coin');
  emit('prep');
  return true;
});

// ── 영업에 주는 영향 (sim/day.js · customers.js가 불러요) ──
export const townSpeedMul = () => (townMode() ? 1 - FATIGUE_SLOW * G.town.fatigue : 1) * (townMode() && G.town.setup === G.day ? SETUP_MUL : 1);
export const setupUntil = () => (townMode() && G.town.setup === G.day ? SETUP_UNTIL : -1);
export const dirty = () => townMode() && G.town.hygiene < HYGIENE_LOW;
export const referralPlan = () => (townMode() ? G.town.referral.map((who, i) => ({ who, at: REFERRAL_AT[i % REFERRAL_AT.length] + i * 15, done: false })) : []);
// 가게를 열 때 (sim/day.js openShop): 이번 턴에 칸을 남겼으면(일찍 잔 밤 칸 포함) 피로 하나가 풀려요
export function townOpenRest() {
  if (!townMode()) return;
  const T = G.town, rest = (T.rest || 0) + Math.max(0, TURN_SLOTS - T.used);
  if (rest > 0 && T.fatigue > 0) { T.fatigue--; emit('toast', `칸을 남기고 쉬어서 피로가 조금 풀렸습니다 (피로 ${T.fatigue})`, 'good'); }
  T.rest = 0;
}
// 마감: 위생이 떨어지고 소개 손님은 끝
export function townEndDay() {
  if (!townMode()) return;
  G.town.hygiene = Math.max(0, G.town.hygiene - HYGIENE_DECAY);
  G.town.referral = [];
}
