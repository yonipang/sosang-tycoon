// 돈과 하루 (단위: 원·초)
export const START_CASH = 2500000;   // 개업 비용을 치르고 남은 돈 (자기 돈 300만 + 창업 대출 500만으로 시작) · v0.74 사용자 요청 「돈이 빠듯」 150만 → 250만
export const START_LOAN = 5000000;   // 창업 대출
export const WEEK_RENT = 250000;     // 주간 임대료 (v0.77부터 ÷7 해서 매일 내요 — sim/day.js dayBills) · v0.74 사용자 요청 「돈이 빠듯」 35만 → 25만
export const LOAN_WEEKLY = 100000;   // 주간 대출 상환 (원리금: 이자 먼저, 나머지가 원금 — 1년 분할 초안)
export const LOAN_RATE = 0.05;       // 창업 대출 연이율 (이자 = 남은 대출 × 연이율 ÷ 52)
// 공과금 (주마다): 기본(수도·전기 기본요금) + 판 그릇마다 가스·전기
export const UTIL_BASE = 15000;
export const UTIL_PER_DISH = 60;
export const DAY_SEC = 360;          // 영업 09:00~21:00이 실제 몇 초인지 (게임 1시간 = 30초)
export const DAY_MIN = 720;          // 영업 시간 (게임 분)
export const CLOSE_CAP_MIN = 780;    // 22:00이 되면 남은 손님도 모두 나가요
export const PLAYER_SPEED = 5.5;     // 사장 걷는 속도 (칸/초)
export const HANDS_MAX = 2;
export const PAY_STEP_SEC = 0.35;    // 계산 한 명에 걸리는 시간
export const TIP = { min: 500, max: 1500 };
// 급구매: 영업 중 재료가 떨어지면 냉장고에서 근처 마트에 주문 (비싸고, 조금 기다려야 와요)
export const RUSH_QTY = 5;       // 한 번에 몇 인분
export const RUSH_MUL = 1.6;     // 재료값 배율
export const RUSH_SEC = 20;      // 도착까지 실제 초
// 별점 = 리뷰 평균 (실제 지도 앱처럼). 계산한 손님 중 REVIEW_RATE만큼이 그날 만족(반올림)을 별로 남기고, 최근 REVIEW_KEEP개의 평균이 가게 별점 (sim/rating.js)
//  리뷰가 하나도 없으면 별점은 「—」, 손님 수·가격에는 RATING_NONE(보통)으로 셈
//  프롤로그(오가네 분식)는 오 사장님이 쌓아 둔 리뷰로 시작하고, 1장에 새 이름으로 바꾸면 리뷰 0개부터 (OH_REVIEWS: 별 5·4·3·2·1 개수)
export const REVIEW_RATE = 0.2;      // v0.58 사용자 요청 「리뷰 다는 손님이 너무 많아」 0.35 → 0.2 (리뷰 수에 걸린 기준도 같이 줄였어요)
export const REVIEW_KEEP = 100;
export const RATING_NONE = 3;
export const OH_REVIEWS = [22, 24, 10, 3, 1];
export const OH_REVIEW_TOTAL = 400;   // 오가네 분식이 30년 동안 받은 리뷰 수 (평균은 위 60개로)
// 리뷰가 적은 새 가게는 별점이 보통(RATING_NONE) 쪽으로 끌려요 (v0.44 사용자 지적: 5일차 ★4.8은 말이 안 됨)
//  별점 = (리뷰 별 합 + 보통 × 무게) ÷ (리뷰 수 + 무게) · 무게 = RATING_PRIOR_W × HALF ÷ (HALF + 지금까지 리뷰 수)
//  예: 리뷰 15개 평균 4.8 → ★3.7 · 100개 평균 4.5 → ★4.3 · 300개 → ★4.4
export const RATING_PRIOR_W = 10;   // v0.58: 리뷰가 하루에 약 1/3로 줄어서 30 → 10 · 80 → 26 (같은 날짜에 비슷한 별점)
export const RATING_PRIOR_HALF = 26;
// 평판(별점)이 손님 수와 기준 가격에 주는 영향
export const ratingSpawnMul = r => 0.55 + 0.15 * r;
export const ratingPriceMul = r => 1 + 0.08 * (r - 3); // 별 하나에 8%: ★4면 8% 비싸도, ★5면 16% 비싸도 「적당하다」
// 개업 초기: 아직 가게를 아는 사람이 적어 손님이 덜 와요 (1일차 30%쯤 → 12일차 100%)
//  v0.35: 6~8일차에 손님이 두 배 가까이 늘어 갑자기 어려웠어요(메뉴 셋 · 마을 홍보까지 겹쳐서) → 더 천천히 늘게
const OPENING = [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.92, 0.96, 1];
export const openingMul = day => OPENING[Math.min(OPENING.length, Math.max(1, day)) - 1];
// 인지도 (1장부터): 손님 수는 날짜가 아니라 리뷰 수(G.ratingN)로 늘어요 — 잘할수록 리뷰가 쌓여 손님이 늘어요 (v0.37 사용자 결정)
//  [리뷰 수, 배율] 사이는 곧게 이어요. ★4 기준 하루 손님: 0개 약 16명 · 50개 약 27명 · 150개 약 43명 · 400개 약 65명
//  프롤로그(오가네 분식 알바 사흘)는 위 OPENING 그대로
//  v0.58 사용자 요청 「여전히 너무 많이 와요 · 더 줄여도」: 약 45% 줄임 → ★4 기준 리뷰 0개 약 9명 · 16개 15명 · 48개 24명 · 128개 36명
//   (리뷰 다는 손님도 35% → 20%로 줄어서 리뷰 수 기준을 약 1/3로 — 같은 날짜쯤에 같은 손님 수)
export const FAME = [[0, 0.17], [16, 0.28], [48, 0.45], [128, 0.68], [256, 0.85]];
export function fameMul(n) {
  for (let i = 1; i < FAME.length; i++) if (n <= FAME[i][0]) { const [a, x] = FAME[i - 1], [b, y] = FAME[i]; return x + (y - x) * (n - a) / (b - a); }
  return FAME[FAME.length - 1][1];
}
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
