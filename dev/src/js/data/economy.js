// 돈과 하루 (단위: 원·초)
export const START_CASH = 1500000;   // 개업 비용을 치르고 남은 돈 (자기 돈 300만 + 창업 대출 500만으로 시작)
export const START_LOAN = 5000000;   // 창업 대출
export const WEEK_RENT = 350000;     // 주간 임대료 (7일차 밤에 내요)
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
// 평판(별점)이 손님 수와 기준 가격에 주는 영향
export const ratingSpawnMul = r => 0.55 + 0.15 * r;
export const ratingPriceMul = r => 1 + 0.08 * (r - 3); // 별 하나에 8%: ★4면 8% 비싸도, ★5면 16% 비싸도 「적당하다」
// 개업 초기: 아직 가게를 아는 사람이 적어 손님이 덜 와요 (1일차 30%쯤 → 12일차 100%)
//  v0.35: 6~8일차에 손님이 두 배 가까이 늘어 갑자기 어려웠어요(메뉴 셋 · 마을 홍보까지 겹쳐서) → 더 천천히 늘게
const OPENING = [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.92, 0.96, 1];
export const openingMul = day => OPENING[Math.min(OPENING.length, Math.max(1, day)) - 1];
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
