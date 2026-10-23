// 메뉴 (프로토타입: 분식집 3종). 가격·원가 단위는 원.
// fair: 손님이 「적당하다」고 느끼는 기준 가격 (손님 유형·평판에 따라 달라져요 — data/customers.js)
// game: 조리 미니게임 종류 (아래 COOK_GAMES) · cook: 졸이기 바늘 속도 (높을수록 어려워요)
export const MENUS = {
  tteok: { name: '떡볶이', price: 4000, cost: 1300, fair: 4000, station: 'stove', game: 'stir', cook: 1.0 },
  kimbap: { name: '김밥', price: 3500, cost: 1100, fair: 3500, station: 'mat', game: 'roll', cook: 0.85 },
  twigim: { name: '튀김', price: 3500, cost: 1200, fair: 3500, station: 'fryer', game: 'fry', cook: 1.2 },
};
export const MENU_IDS = ['tteok', 'kimbap', 'twigim'];
export const PRICE_STEP = 500;
export const PRICE_MIN = 1500;
export const PRICE_MAX = 9000;
export const PREP_STEP = 5;
export const PREP_MAX = 80;
export const PREP_FIRST_DAY = { tteok: 25, kimbap: 20, twigim: 15 };
// 조리 미니게임 (결과: 0 보통 · 1 좋음 · 2 완벽)
//  stir 졸이기(떡볶이): 오가는 바늘을 가운데에서 멈춰요. zone = 가운데에서 떨어진 거리. timeout 초 안에 안 멈추면 보통
//  roll 말기(김밥): taps번 빨리 눌러요. perfect·good = 다 마는 데 걸린 초. timeout 초가 지나면 보통
//  fry 튀기기(튀김): 바늘이 한 번만 지나가요(sec초). 노릇한 구간에서 눌러 건져요. 끝까지 두면 타서 보통
export const COOK_GAMES = {
  stir: { name: '졸이는 중', tip: '바늘이 가운데 오면 눌러 보세요', zone: { perfect: 0.08, good: 0.22 }, timeout: 3.2 },
  roll: { name: '마는 중', tip: '여러 번 빠르게 눌러 보세요', taps: 6, perfect: 1.6, good: 2.6, timeout: 4.5 },
  fry: { name: '튀기는 중', tip: '노릇노릇할 때 눌러 건져 보세요', sec: 2.6, perfect: [0.64, 0.76], good: [0.54, 0.86] },
};
export const QUALITY_NAME = ['보통', '좋음', '완벽'];
