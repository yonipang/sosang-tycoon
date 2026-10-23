// 손님 유형과 시간대별 손님 흐름
// priceMul: 적당하다고 느끼는 가격 배율 · patience: 기다림 배율 · likes: 메뉴 고르는 무게 · tip: 팁 확률 · eat: 먹는 시간(초)
export const CUSTOMER_TYPES = {
  student: { name: '학생', priceMul: 0.85, patience: 1.0, likes: { tteok: 4, twigim: 3, kimbap: 1 }, tip: 0.03, eat: 7 },
  worker: { name: '직장인', priceMul: 1.1, patience: 0.75, likes: { kimbap: 4, tteok: 2, twigim: 1 }, tip: 0.12, eat: 5 },
  elder: { name: '어르신', priceMul: 0.95, patience: 1.4, likes: { kimbap: 2, tteok: 2, twigim: 1 }, tip: 0.1, eat: 8 },
};
// 시각(9~20시)마다 들어오려는 손님 수 기대값 — 점심·하교·퇴근에 몰려요
export const SPAWN_PER_HOUR = { 9: 2, 10: 3, 11: 5, 12: 8, 13: 6, 14: 3, 15: 4, 16: 6, 17: 4, 18: 6, 19: 5, 20: 2 };
// 시각마다 손님 구성 (주택가 골목 기준)
export function typeMix(hour) {
  if (hour < 11) return { elder: 5, worker: 4, student: 1 };
  if (hour < 14) return { worker: 6, elder: 3, student: 1 };
  if (hour < 15) return { elder: 5, worker: 3, student: 2 };
  if (hour < 18) return { student: 6, elder: 2, worker: 2 };
  return { worker: 5, student: 3, elder: 2 };
}
// 기다림 (초, 유형 patience를 곱해요)
export const PATIENCE = { queue: 22, food: 32, pay: 18 };
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
