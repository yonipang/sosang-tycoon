// 메뉴 (프로토타입: 분식집 3종). 가격·원가 단위는 원.
// fair: 손님이 「적당하다」고 느끼는 기준 가격 (손님 유형·평판에 따라 달라져요 — data/customers.js)
// cook: 조리 미니게임 바늘 속도 (높을수록 어려워요)
export const MENUS = {
  tteok: { name: '떡볶이', price: 4000, cost: 1300, fair: 4000, station: 'stove', cook: 1.0 },
  kimbap: { name: '김밥', price: 3500, cost: 1100, fair: 3500, station: 'mat', cook: 0.85 },
  twigim: { name: '튀김', price: 3500, cost: 1200, fair: 3500, station: 'fryer', cook: 1.2 },
};
export const MENU_IDS = ['tteok', 'kimbap', 'twigim'];
export const PRICE_STEP = 500;
export const PRICE_MIN = 1500;
export const PRICE_MAX = 9000;
export const PREP_STEP = 5;
export const PREP_MAX = 80;
export const PREP_FIRST_DAY = { tteok: 25, kimbap: 20, twigim: 15 };
// 조리 결과: 0 보통 · 1 좋음 · 2 완벽 (바늘이 가운데에서 얼마나 가까운지)
export const COOK_ZONE = { perfect: 0.08, good: 0.22 };
export const COOK_TIMEOUT = 3.2; // 초 안에 멈추지 않으면 「보통」으로 나와요
export const QUALITY_NAME = ['보통', '좋음', '완벽'];
