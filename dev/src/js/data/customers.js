// 손님 유형과 시간대별 손님 흐름
// priceMul: 적당하다고 느끼는 가격 배율 · patience: 기다림 배율 · likes: 메뉴 고르는 무게 · tip: 팁 확률 · eat: 먹는 시간(초)
export const CUSTOMER_TYPES = {
  student: { name: '학생', priceMul: 0.85, patience: 1.0, likes: { tteok: 4, twigim: 3, kimbap: 1 }, tip: 0.03, eat: 7 },
  worker: { name: '직장인', priceMul: 1.1, patience: 0.75, likes: { kimbap: 4, tteok: 2, twigim: 1 }, tip: 0.12, eat: 5 },
  elder: { name: '어르신', priceMul: 0.95, patience: 1.4, likes: { kimbap: 2, tteok: 2, twigim: 1 }, tip: 0.1, eat: 8 },
};
// 손님 한 명 = 그림 한 장 (같은 옷이면 같은 사람이라 가게에 동시에 둘이 올 수 없어요). 0번은 사장.
// 18번은 오 사장님(이야기 인물)이라 손님으로 오지 않아요. 13번 박 할머니는 단골로만 와요 (아래 REGULARS). 7번 최 사장·9번 미소 사장은 손님으로도 와요
export const PEOPLE = {
  1: 'worker', 2: 'student', 3: 'student', 4: 'worker', 5: 'student', 6: 'student', 7: 'elder', 8: 'worker', 9: 'student',
  10: 'worker', 11: 'student', 12: 'worker', 14: 'worker', 15: 'student', 16: 'worker', 17: 'student', 19: 'elder',
};
// 둘이 같이 올 확률 (일행은 한 탁자에 앉고, 한 명이 같이 계산해요)
export const PAIR_CHANCE = { student: 0.45, worker: 0.35, elder: 0.15 };
// 가게 앞 유동인구: 시각마다 가게 앞 보도를 지나가는 일행 수 (게임 1시간 기준)
// 손님은 모두 이 사람들 중에서 들어와요 (들어오는 비율 = 아래 SPAWN_PER_HOUR ÷ 유동인구).
// ※ 프로토타입 값. 실제 개발에서는 게임 속 상권 데이터(나이스비즈맵 유동인구)와 같은 값을 써요.
export const FOOT_PER_HOUR = { 9: 14, 10: 12, 11: 16, 12: 24, 13: 20, 14: 12, 15: 14, 16: 18, 17: 16, 18: 22, 19: 18, 20: 12, 21: 10, 22: 8 };
// 시각(9~20시)마다 들어오는 일행 수 기대값 (가게가 충분히 알려졌을 때) — 점심이 가장 많고, 하교·퇴근에도 몰려요 (아침에 조금 나눠 둠)
// 일행은 평균 1.3명쯤이라 하루 약 36팀 ≈ 47명. 개업 초기에는 data/economy.js openingMul만큼 줄어요
// 가게 앞 칠판 · 오늘의 추천 (1장부터, 가게 장부): 점심·오후 두 칸. 그 시간에 그 메뉴를 좋아하는 손님층이 더 들어와요 (sim/traffic.js)
//  들어오는 비율 × (1 + BOARD_MUL × 그 손님층이 그 메뉴를 좋아하는 정도(가장 좋아하는 메뉴 = 1))
export const BOARD_SLOTS = { lunch: { name: '점심', from: 11, to: 14 }, after: { name: '오후', from: 14, to: 18 } };
export const BOARD_MUL = 0.25;
// 메뉴 궁합: 그 손님층이 가장 좋아하는 메뉴가 오늘의 메뉴에 없으면 그 손님층이 덜 들어와요
export const FIT_MISS = 0.8;
// 전략(칠판 × 홍보)으로 올릴 수 있는 들어오는 비율의 상한
export const STRATEGY_CAP = 1.5; // v0.35: 1.8 → 1.5 (칠판·인스타·블로거가 겹치면 손님이 몰려 너무 바빴어요)
export const SPAWN_PER_HOUR = { 9: 2, 10: 3, 11: 3, 12: 5, 13: 3, 14: 2, 15: 3, 16: 4, 17: 3, 18: 4, 19: 3, 20: 1 };
// 지나가는 사람이 가게 앞에서 하는 말 (말풍선). 상황에 맞는 묶음에서 골라요
export const PASSER_SAY_CHANCE = 0.3;   // 지나가는 일행이 한마디 할 확률
export const GLANCE_CHANCE = 0.35;      // 들어오지 않아도 잠깐 멈춰 가게를 보는 확률
export const PASSER_LINES = {
  new: ['여기 새로 생겼네?', '분식집 생겼다', '다음에 와 봐야지', '언제 생겼지?'],
  smell: ['떡볶이 냄새 좋다', '배고프다…', '김밥 한 줄 할까'],
  busy: ['와, 사람 많다', '줄 서 있네', '여기 맛집인가?'],
  bad: ['여기 별로라던데', '음… 다른 데 가자'],
  plain: ['오늘 점심 뭐 먹지', '버스 놓치겠다!', '날씨 좋다', '아 졸려…', '이따 전화할게'],
};
// 시각마다 손님 구성 (주택가 골목 기준)
export function typeMix(hour) {
  if (hour < 11) return { elder: 5, worker: 4, student: 1 };
  if (hour < 14) return { worker: 6, elder: 3, student: 1 };
  if (hour < 15) return { elder: 5, worker: 3, student: 2 };
  if (hour < 18) return { student: 6, elder: 2, worker: 2 };
  return { worker: 5, student: 3, elder: 2 };
}
// 기다림 (초, 유형 patience를 곱해요)
export const PATIENCE = { queue: 28, food: 40, pay: 22 }; // v0.35 사용자 요청으로 약 25% 늘림 (22·32·18 → 28·40·22)
export const READ_MENU_SEC = 1.4;
export const QUEUE_MAX = 3;
export const CUSTOMER_SPEED = 3.2; // 칸/초
// 가격 반응: 가격 ÷ (기준 가격 × 유형 배율 × 평판 배율)
export const PRICE_REACT = [
  { max: 0.85, face: 'love', name: '반함', sat: 1.0 },
  { max: 1.05, face: 'happy', name: '만족', sat: 0.5 },
  { max: 1.25, face: 'meh', name: '망설임', sat: -0.5, leave: 0.3 },
  { max: 99, face: 'angry', name: '화남', sat: -1.5, leave: 1 },
];
// 단골: 날마다 정해진 무렵에 찾아와요 (손님 목록 PEOPLE과 따로). 오는 날·시각은 그날 씨앗으로 정해요
//  at: [가장 이르게, 가장 늦게] (게임 분, 0 = 09:00) · chance: 오는 날 확률 · likes: 고르는 메뉴 순서 (열린 것 중 첫째)
//  priceMul: 단골이라 가격에 너그러워요 · lines: 들어올 때 · bye: 계산하고 나갈 때
export const REGULARS = {
  park: {
    char: 13, type: 'elder', name: '박 할머니', at: [40, 100], chance: 0.9, likes: ['kimbap', 'tteok'], priceMul: 1.25,
    lines: ['오늘도 왔어~', '늘 먹던 걸로 줘', '아이고 다리야. 앉자 앉자', '오 사장은 잘 지낸대?'],
    bye: ['잘 먹었어. 내일 또 올게', '맛있네. 그 양반 맛이랑 비슷해', '수고해~'],
  },
  // 2장 단골 (quest: 이 퀘스트를 끝내면 오기 시작해요 — data/story.js)
  kim: {
    char: 1, type: 'worker', name: '김 대리', at: [170, 230], chance: 0.75, likes: ['kimbap', 'tteok'], priceMul: 1.15, quest: 'c2_kim',
    lines: ['사장님, 빨리요! 10분이에요', '늘 먹던 걸로요!', '점심은 역시 여기죠'],
    bye: ['잘 먹었습니다! 내일 또 올게요', '오늘도 살았다…', '오후도 힘내 보겠습니다'],
  },
  doyun: {
    char: 6, type: 'student', name: '도윤', at: [600, 670], chance: 0.7, likes: ['tteok', 'twigim'], priceMul: 1.0, quest: 'c2_doyun',
    lines: ['사장님 안녕하세요! 학원 끝났어요', '오늘 쪽지 시험 망했어요… 늘 먹던 걸로요', '배고파요, 사장님!'], // 메뉴 이름은 말하지 않아요 (시키는 것과 어긋나지 않게)
    bye: ['잘 먹었습니다! 공부하러 가요', '내일 또 올게요', '힘 난다!'],
  },
};

