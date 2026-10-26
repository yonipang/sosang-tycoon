// 가게 별점 = 리뷰 평균 (data/economy.js REVIEW_*) — 리뷰가 적으면 보통(3) 쪽으로 끌려요(RATING_PRIOR_*). 리뷰가 없으면 별점은 없음(null)
//  G.revs = 최근 리뷰 별(1~5) 목록 · G.ratingN = 지금까지 리뷰 수 · G.rating = 최근 리뷰 평균 (없으면 null)
import { G } from '../save/state.js';
import { REVIEW_RATE, REVIEW_KEEP, RATING_NONE, OH_REVIEWS, OH_REVIEW_TOTAL, RATING_PRIOR_W, RATING_PRIOR_HALF } from '../data/economy.js';
import { rand } from '../engine/random.js';

// 손님 수·가격에 쓰는 별점 (리뷰가 없으면 보통)
export const ratingNow = () => (G.rating == null ? RATING_NONE : G.rating);
export const hasRating = () => G.rating != null;
function recalc() {
  const R = G.revs || [];
  const w = RATING_PRIOR_W * RATING_PRIOR_HALF / (RATING_PRIOR_HALF + (G.ratingN || R.length)); // 리뷰가 적을수록 보통 쪽으로
  G.rating = R.length ? (R.reduce((a, b) => a + b, 0) + RATING_NONE * w) / (R.length + w) : null;
}
// 리뷰 넣기 (별 1~5)
export function addReviews(list) {
  if (!list.length) return;
  G.revs = (G.revs || []).concat(list).slice(-REVIEW_KEEP);
  G.ratingN = (G.ratingN || 0) + list.length;
  recalc();
}
// 마감: 계산한 손님 만족(sats)에서 몇 명이 별을 남겨요 (그날 씨앗 rand). 남긴 리뷰 수를 돌려줘요
export function reviewsFromDay(sats) {
  const list = sats.filter(() => rand() < REVIEW_RATE).map(s => Math.max(1, Math.min(5, Math.round(s))));
  if (!list.length && sats.length) list.push(Math.max(1, Math.min(5, Math.round(sats[0])))); // 손님이 있었으면 하나는 남겨요
  addReviews(list);
  return list.length;
}
// 오가네 분식(프롤로그) 리뷰 · 새 이름으로 바꾸면 0개부터
export function ohReviews() {
  const list = [];
  OH_REVIEWS.forEach((n, i) => { for (let k = 0; k < n; k++) list.push(5 - i); });
  for (let i = list.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [list[i], list[j]] = [list[j], list[i]]; } // 섞기 (보이기만 — 평균은 같아요)
  G.revs = []; G.ratingN = OH_REVIEW_TOTAL - list.length; addReviews(list); // 오래된 가게라 리뷰가 많아요
}
export function resetReviews() { G.revs = []; G.ratingN = 0; G.rating = null; }
