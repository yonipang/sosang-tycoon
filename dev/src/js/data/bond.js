// 친밀도 (세 사장님 공통 — 미소 · 정 사장 · 문 회장). 규칙은 sim/bond.js
//  하트 5단계, 떨어지지 않아요. 쌓는 법: 이야기하기 +2 · 그날 처음 거래 +1 · 부탁 퀘스트 +5 · 하루에 한 사장님께 최대 +3
export const BOND_WHO = ['miso', 'jung', 'moon'];
export const BOND_NAME = { miso: '미소 사장님', jung: '정 사장님', moon: '문 회장님' };
export const BOND_LV = [5, 15, 30, 50, 80];   // 단계 기준 (누적)
export const BOND_TALK = 2;
export const BOND_TRADE = 1;
export const BOND_FAVOR = 5;
export const BOND_FIRST = 5;                  // 미소 가구 개업 첫 손님 (이야기 대신 한 번만, 하루 한도와 따로)
export const BOND_DAY_MAX = 3;
// 단계마다 열리는 것 (보여 주는 글 — 규칙은 sim/bond.js · sim/furniture.js · sim/town.js)
export const BOND_PERKS = {
  miso: ['일반 가구', '가구 5% 할인', '고급 가구 · 테마 세트 (준비 중)', '친밀도 전용 소품 (준비 중)', '「미소 컬렉션」 (준비 중)'],
  jung: ['오늘의 특가', '단골가 5% 할인', '특가 2개 (준비 중)', '단골가 10% 할인', '새벽 배달 (준비 중)'],
  moon: ['상인회 가입', '설비 5% 할인', '설비 Lv3', '장사 도구 등급 업', '「골목 대표 가게」 명패'],
};
// 할인 (단계 → 비율)
export const MISO_DISC = { 2: 0.05 };
export const JUNG_DISC = { 2: 0.05, 4: 0.10 };
