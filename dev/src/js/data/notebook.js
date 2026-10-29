// 손님층 수첩 (v0.90 사용자 요청 — 계산대 「손님층」 탭): 장사하면서 알아낸 것이 저절로 적혀요 (1장부터)
//  칸 네 개: 좋아하는 메뉴 · 많이 오는 때 · 값 느낌 · 기다림. 처음엔 「?」, 조건을 채우면 한 칸씩 열려요
//  need: 열리는 수 · of: 무엇을 세나 (sold 그 손님층에게 판 그릇 · came 주문한 손님 · face 가격 표정 본 횟수 · served 계산한 손님)
export const NOTE_KEYS = ['fav', 'hour', 'price', 'wait'];
export const NOTE = {
  fav: { name: '좋아하는 메뉴', of: 'sold', need: 25, goal: t => `${t}에게 25그릇 팔기` },
  hour: { name: '많이 오는 때', of: 'came', need: 50, goal: t => `${t} 손님 주문 50번 받기` },
  price: { name: '값 느낌', of: 'face', need: 30, goal: t => `${t} 가격 표정 30번 보기` },
  wait: { name: '기다림', of: 'served', need: 80, goal: t => `${t} 손님 80명 받기` },
};
export const NOTE_TYPES = ['student', 'worker', 'elder'];
// 값 느낌 (data/customers.js priceMul) · 기다림 (patience): 그 손님층의 실제 성질을 말로
//  [이 값보다 작으면, 칸에 적는 말, 풀이, 알림 말]
export const PRICE_FEEL = [
  [0.9, '값에 민감합니다', '조금만 비싸도 표정이 굳습니다', '값에 민감합니다'],
  [1.05, '보통입니다', '적당한 값이면 괜찮아합니다', '값을 보통으로 봅니다'],
  [9, '비싸도 괜찮아합니다', '맛있으면 값을 덜 따집니다', '조금 비싸도 괜찮아합니다'],
];
export const WAIT_FEEL = [
  [0.9, '금방 지칩니다', '음식이 늦으면 먼저 일어납니다', '오래 못 기다립니다'],
  [1.15, '보통입니다', '너무 늦지만 않으면 기다립니다', '보통으로 기다립니다'],
  [9, '오래 기다려 줍니다', '바빠도 느긋하게 기다립니다', '오래 기다려 줍니다'],
];
// 시간 막대 (9시~20시)
export const NOTE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
