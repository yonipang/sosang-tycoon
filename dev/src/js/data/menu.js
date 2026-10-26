// 메뉴 (프로토타입: 분식집 3종). 가격·원가 단위는 원.
// fair: 손님이 「적당하다」고 느끼는 기준 가격 (손님 유형·평판에 따라 달라져요 — data/customers.js)
// game: 조리 미니게임 종류 (아래 COOK_GAMES) · cook: 졸이기 바늘 속도 (높을수록 어려워요)
// recipe: 1인분에 하나씩 쓰는 원재료 (아래 INGREDIENTS) · cost: 평소 1인분 원가 = 재료값 합 (시세는 sim/market.js costOf)
// ing: 재료 한 벌 이름 (급구매·주문은 메뉴 한 벌씩)
export const MENUS = {
  tteok: { name: '떡볶이', price: 4000, cost: 1300, fair: 4000, station: 'stove', game: 'stir', cook: 1.0, ing: '떡볶이 재료', recipe: ['ddeok', 'fishcake', 'scallion', 'gochujang'] },
  kimbap: { name: '김밥', price: 3500, cost: 1100, fair: 3500, station: 'mat', game: 'roll', cook: 0.85, ing: '김밥 재료', recipe: ['rice', 'gim', 'egg', 'carrot'] },
  twigim: { name: '야채튀김', price: 3500, cost: 1200, fair: 3500, station: 'fryer', game: 'fry', cook: 1.2, ing: '야채튀김 재료', recipe: ['batter', 'onion', 'carrot', 'oil'] },
};
// 원재료 (식자재 가게에서 낱개로 사요 — 기획서 「마을 가게와 성장 시스템」)
//  pack: 한 묶음 몇 인분 · shelf: 유통기한(받은 날 포함 며칠) · cost: 1인분 값(원) · keep: 오래가는 재료(쌀·김·양념·가루·기름)
//  메뉴가 늘면(메뉴 연구) 여기에 더하고 그 메뉴 recipe에 넣어요. 여러 메뉴가 같은 재료를 나눠 써요(당근: 김밥·튀김)
export const INGREDIENTS = {
  ddeok: { name: '떡', pack: 5, shelf: 2, cost: 500 },
  fishcake: { name: '어묵', pack: 5, shelf: 3, cost: 400 },
  scallion: { name: '대파', pack: 5, shelf: 3, cost: 200 },
  carrot: { name: '당근', pack: 5, shelf: 5, cost: 200 },
  onion: { name: '양파', pack: 5, shelf: 5, cost: 300 },
  egg: { name: '계란', pack: 10, shelf: 7, cost: 300 },
  gochujang: { name: '고추장', pack: 20, shelf: 30, cost: 200, keep: true },
  rice: { name: '쌀', pack: 20, shelf: 30, cost: 300, keep: true },
  gim: { name: '김', pack: 20, shelf: 30, cost: 300, keep: true },
  batter: { name: '튀김가루', pack: 20, shelf: 30, cost: 300, keep: true },
  oil: { name: '식용유', pack: 20, shelf: 30, cost: 400, keep: true },
};
export const ING_IDS = Object.keys(INGREDIENTS);
// 오늘의 메뉴 칸: 8칸을 보여 주고 가게 등급만큼 열려요 (1등급 4칸 · 등급마다 한 칸씩). 가게 등급은 아직 1등급만 (2장 이후)
export const MENU_SLOTS = 8;
export const SLOTS_BY_GRADE = [0, 4, 5, 6, 7, 8];
export const GRADE_NAMES = ['', '골목 작은 가게', '동네 가게', '동네 맛집', '상권 명소', '프랜차이즈 본점'];
export const SHOP_GRADE = 1;
export const MENU_IDS = ['tteok', 'kimbap', 'twigim'];
// 메뉴 업그레이드 (기획서 「마을 가게와 성장 시스템」): Lv1~5. 숙련도 + 돈으로 올려요 (sim/upgrade.js)
//  숙련도 = 그 메뉴를 내준 그릇 (완벽 조리는 MASTERY_PERFECT그릇) — 쌓인 숙련도가 need를 넘으면 cost를 내고 올려요 (숙련도는 줄지 않아요)
//  fair: 손님이 적당하다고 느끼는 가격 +(배율) · sat: 손님 만족 + · back: 재방문률 — 만족 REVISIT_SAT점 이상 먹은 손님은
//  다음에 가게 앞을 지날 때 (back − Lv1 back)만큼 더 잘 들어와요 (Lv1은 지금과 같아요)
export const MENU_LEVELS = [
  null,
  { fair: 0, sat: 0, back: 0.10, need: 0, cost: 0 },
  { fair: 0.05, sat: 0.1, back: 0.13, need: 30, cost: 30000 },
  { fair: 0.10, sat: 0.15, back: 0.16, need: 100, cost: 80000 },
  { fair: 0.15, sat: 0.2, back: 0.19, need: 250, cost: 150000 },
  { fair: 0.20, sat: 0.3, back: 0.22, need: 500, cost: 300000 },
];
export const MENU_LV_MAX = 5;
export const MASTERY_PERFECT = 1.5;
export const REVISIT_SAT = 4;
// 올리는 곳: 우리 가게 「메뉴 연구 칠판」 (마을, 1장부터 · 장과 상관없이 숙련도·돈만 되면 Lv5까지)
// 메뉴는 이야기 퀘스트로 열려요 (떡볶이로 시작 → 김밥 → 튀김). sim/story.js menuOpen
export const PRICE_STEP = 500;
export const PRICE_MIN = 1500;
export const PRICE_MAX = 9000;
export const PREP_STEP = 5;   // 재료 주문 단위(인분)
export const PREP_MAX = 80;
// 처음 주문량 (메뉴가 처음 열린 날의 주문량으로도 써요)
export const PREP_FIRST_DAY = { tteok: 12, kimbap: 8, twigim: 8 };
// 조리 미니게임 (결과: 0 보통 · 1 좋음 · 2 완벽)
//  stir 졸이기(떡볶이): 오가는 바늘을 가운데에서 멈춰요. zone = 가운데에서 떨어진 거리. timeout 초 안에 안 멈추면 보통
//  roll 말기(김밥): taps번 빨리 눌러요. perfect·good = 다 마는 데 걸린 초. timeout 초가 지나면 보통
//  fry 튀기기(튀김): 바늘이 한 번만 지나가요(sec초). 노릇한 구간에서 눌러 건져요. 끝까지 두면 타서 보통
export const COOK_GAMES = {
  stir: { name: '졸이는 중', tip: '바늘이 가운데 오면 눌러 보세요', zone: { perfect: 0.08, good: 0.22 }, timeout: 3.2 },
  roll: { name: '마는 중', tip: '여러 번 빠르게 눌러 보세요', taps: 6, perfect: 1.6, good: 2.6, timeout: 4.5 },
  fry: { name: '튀기는 중', tip: '노릇노릇할 때 눌러 건져 보세요', sec: 1.5, perfect: [0.64, 0.76], good: [0.52, 0.87] }, // 바늘 빠르기를 졸이기와 비슷하게 (한 번 지나가는 데 1.5초)
};
export const QUALITY_NAME = ['보통', '좋음', '완벽'];
