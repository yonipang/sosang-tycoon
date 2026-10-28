// 유동인구 전략 (기획서 「유동인구와 상권 전략」 1단계): 손님 = 시간대·손님층별 지나가는 사람 × 들어오는 비율
// 들어오는 비율 = 기본(sim/day.js enterP — 별점·상권·개업 초기) × 손님층 배율(아래) × 재방문(sim/upgrade.js)
// 손님층 배율 = 메뉴 궁합(그 손님층이 가장 좋아하는 메뉴가 오늘 없으면 ↓) × 전략(칠판 추천 메뉴 · 홍보 — 합쳐 STRATEGY_CAP까지)
// 시간대 기록: G.run.log.hourly { 시: { pass: {손님층: 명}, in: {손님층: 명} } } → 영수증 시간대 그래프
import { flyerMul } from './explore.js';
import { G } from '../save/state.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { CUSTOMER_TYPES, typeLike, BOARD_SLOTS, BOARD_MUL, FIT_MISS, STRATEGY_CAP } from '../data/customers.js';
import { PROMO } from '../data/town.js';
import { emit, defineCmd } from './events.js';
import { menuOn, todayMenus } from './pantry.js';
import { townMode } from './town.js';
import { menuOpen } from './story.js';

// ── 가게 앞 칠판 · 오늘의 추천 (G.board { morning, lunch, after }) ──
export const boardOpen = () => menuOpen('kimbap'); // v0.62 사용자 결정: 김밥이 들어오는 날부터 (메뉴가 둘이어야 고르는 일이 돼요)
export function boardMenuAt(hour) {
  if (!boardOpen() || !G.board) return null;
  for (const k in BOARD_SLOTS) { const S = BOARD_SLOTS[k], m = G.board[k]; if (m && hour >= S.from && hour < S.to && menuOn(m)) return m; }
  return null;
}
defineCmd('boardSet', ({ slot, menu }) => {
  if (G.phase !== 'prep' || !BOARD_SLOTS[slot]) return false;
  if (menu && !menuOn(menu)) return false;
  G.board = G.board || {};
  G.board[slot] = G.board[slot] === menu ? null : menu; // 같은 걸 다시 누르면 비워요
  emit('sfx', 'tap'); emit('prep');
  return true;
});
// 이 손님층이 그 메뉴를 얼마나 좋아하나 (가장 좋아하는 메뉴 = 1)
//  (열린 메뉴 중에서 — 아직 개발하지 않은 새 메뉴는 세지 않아요)
const likeShare = (type, m) => typeLike(type, m) / Math.max(0.01, ...MENU_IDS.filter(menuOpen).map(x => typeLike(type, x)));

// ── 홍보 (계산대) ──
const TW = () => G.town;
export const instaOn = () => townMode() && TW().insta === G.day;
export const bloggerToday = () => townMode() && TW().blogDay === G.day;
const buzzOn = () => { const b = townMode() && TW().buzz; return b && G.day >= b.from && G.day <= b.until ? b : null; };
function promoMul(type) {
  let k = 1;
  if (instaOn() && PROMO.insta.types.includes(type)) k *= PROMO.insta.mul;
  const b = buzzOn();
  if (b && PROMO.blogger.types.includes(type)) k *= b.mul;
  k *= flyerMul(type); // 동네 탐방에서 붙인 전단 (v0.78)
  return k;
}
// 블로거가 다녀간 뒤 (sim/day.js endDay): 만족 4점 이상이면 며칠 동안 직장인·어르신이 더, 아니면 덜 → 리뷰 한 줄
export function bloggerEndDay() {
  if (!bloggerToday()) return null;
  const L = G.run.log, P = PROMO.blogger, good = L.blogSat != null && L.blogSat >= P.sat;
  TW().buzz = { mul: good ? P.good : P.bad, from: G.day + 1, until: G.day + P.days, good };
  L.events.push({ kind: good ? 'blogger' : 'blogBad', menu: L.blogMenu || null, who: '파워블로거' });
  return good;
}

// ── 들어오는 비율: 손님층 배율 ──
// why: 들어온 까닭(말풍선용) — 'board' · 'insta' 중 하나 (없으면 null)
export function typeEnterMul(type, hour) {
  const open = MENU_IDS.filter(menuOpen), top = Math.max(...open.map(x => typeLike(type, x)));
  const fit = open.some(m => typeLike(type, m) === top && menuOn(m)) ? 1 : FIT_MISS;
  const bm = boardMenuAt(hour), board = bm ? 1 + BOARD_MUL * likeShare(type, bm) : 1;
  return fit * Math.min(STRATEGY_CAP, board * promoMul(type));
}
// 칠판·인스타 덕에 들어온 손님이 하는 말 (보이기만 — 규칙은 위 배율)
//  [말, 그 말로 정한 메뉴(없으면 null)] — 메뉴를 말했으면 그 메뉴를 시켜요
export function enterLine(type, hour) {
  const bm = boardMenuAt(hour);
  if (bm && likeShare(type, bm) >= 0.75) return [`${MENUS[bm].name} 추천이래. 먹어 볼까?`, bm];
  if (instaOn() && PROMO.insta.types.includes(type)) return ['인스타 보고 왔어요!', null];
  return null;
}
// 손님이 메뉴를 고를 때: 칠판 메뉴는 조금 더 끌려요
export const boardPick = (m, hour) => (boardMenuAt(hour) === m ? 1.5 : 1);

// ── 시간대 기록 ──
export function logPass(hour, type, n, entered) {
  const H = G.run.log.hourly, h = (H[hour] = H[hour] || { pass: {}, in: {} });
  h.pass[type] = (h.pass[type] || 0) + n;
  if (entered) h.in[type] = (h.in[type] || 0) + n;
}
export const nowHour = () => 9 + Math.floor(G.run.min / 60);
