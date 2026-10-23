// 돈과 하루 (단위: 원·초)
export const START_CASH = 1500000;   // 개업 비용을 치르고 남은 돈 (자기 돈 300만 + 창업 대출 500만으로 시작)
export const START_LOAN = 5000000;   // 창업 대출
export const WEEK_RENT = 350000;     // 주간 임대료 (7일차 밤에 내요)
export const LOAN_WEEKLY = 100000;   // 주간 대출 상환 (원리금, 1년 분할 초안)
export const DAY_SEC = 360;          // 영업 09:00~21:00이 실제 몇 초인지 (게임 1시간 = 30초)
export const DAY_MIN = 720;          // 영업 시간 (게임 분)
export const CLOSE_CAP_MIN = 780;    // 22:00이 되면 남은 손님도 모두 나가요
export const PLAYER_SPEED = 5.5;     // 사장 걷는 속도 (칸/초)
export const HANDS_MAX = 2;
export const PAY_STEP_SEC = 0.35;    // 계산 한 명에 걸리는 시간
export const TIP = { min: 500, max: 1500 };
// 평판(별점)이 손님 수와 기준 가격에 주는 영향
export const ratingSpawnMul = r => 0.55 + 0.15 * r;
export const ratingPriceMul = r => 1 + 0.05 * (r - 3);
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
