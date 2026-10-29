// 오 사장님 가게 길잡이 (프롤로그 1~2일차): 오 사장님이 가게 안에 서서 하나씩 시키고 퀘스트를 줘요 (데이브 더 다이버 반초 스시처럼)
// 규칙은 sim/tutorial.js, 띠·화살표는 ui/story.js(updateTutBar)·render/view.js. 3일차는 오 사장님이 병원에 가서 전화로만
//
// 차례대로 하나씩 해요 (그날 것만). on: 이 일이 일어나면 시작 — 'now'는 앞 차례가 끝나자마자
//   open 영업 시작 · order 첫 주문 · cookStart/cookEnd 조리 시작/끝(자동 주방은 끝 = 들기) · aheadStart 미리 만들기 시작(자동 주방) · served 내주기 · payLine 계산 줄 · paid 계산 · closing 마감 · impatient 손님이 지쳐 감
// 그다음 하나:
//   scene: 대화·요령 장면 (data/story.js SCENES — 가게를 잠깐 멈춰요). 장면을 다 보면 다음 차례
//   ask: 띠 + 화살표로 시켜요. until 일이 일어나면 다음 차례. 시키는 동안은 시계·손님 기다림이 멈춰요
//        at: 'stove' 떡볶이 화구 · 'seat' 음식을 기다리는 손님 · 'register' 계산대
//   guest: 이 차례가 끝나면 그 메뉴를 먹으러 손님 한 명이 바로 와요 (손님을 오래 기다리지 않게)
// 그날 끝까지 못 한 차례는 건너뛰어요 (장면이 주는 퀘스트는 그대로 받아요)
import { AUTO_COOK } from './menu.js';
const TUTORIAL_ALL = [
  { id: 'd1_hi', day: 1, on: 'open', scene: 'tut_hi', guest: 'tteok' },
  AUTO_COOK // v0.83 시험: 자동 주방 — 화구가 알아서 끓이고, 다 되면 들기만
    ? { id: 'd1_order', day: 1, on: 'order', ask: { text: '첫 주문 들어왔다! 화구가 알아서 끓인다. 다 되면 화구를 눌러 들어 봐.', at: 'stove', until: 'cookEnd' } }
    : { id: 'd1_order', day: 1, on: 'order', ask: { text: '첫 주문 들어왔다! 떡볶이 화구를 눌러 봐.', at: 'stove', until: 'cookStart' } },
  { id: 'd1_cooked', day: 1, on: AUTO_COOK ? 'now' : 'cookEnd', scene: 'tut_cooked' },
  { id: 'd1_serve', day: 1, on: 'now', ask: { text: '떡볶이 들었지? 주문한 손님 자리를 눌러서 갖다줘.', at: 'seat', until: 'served' } },
  { id: 'd1_pay', day: 1, on: 'payLine', ask: { text: '다 먹은 손님이 계산 줄에 섰다. 계산대를 눌러.', at: 'register', until: 'paid' } },
  { id: 'd1_paid', day: 1, on: 'now', scene: 'tut_paid' },
  { id: 'd1_close', day: 1, on: 'closing', scene: 'tut_close' },
  { id: 'd2_hi', day: 2, on: 'open', scene: 'tut_d2', guest: AUTO_COOK ? 'tteok' : undefined },
  { id: 'd2_ahead', day: 2, on: 'now', ask: { text: '주문이 없어도 화구를 누르면 미리 만든다. 하나 만들어 봐.', at: 'stove', until: AUTO_COOK ? 'aheadStart' : 'cookStart' } }, // 자동 주방: 주문 몫이 아니라 미리 만들기를 시작해야 넘어가요
  { id: 'd2_made', day: 2, on: 'cookEnd', scene: 'tut_ahead', guest: 'tteok' },
  { id: 'd2_wait', day: 2, on: 'impatient', scene: 'tut_wait' },
  { id: 'd3_phone', day: 3, on: 'open', scene: 'tut_d3' },
];
// 자동 주방(v0.88 사용자 요청): 「미리 만들기」 차례는 빼요
export const TUTORIAL = AUTO_COOK ? TUTORIAL_ALL.filter(s => s.id !== 'd2_ahead' && s.id !== 'd2_made') : TUTORIAL_ALL;
// 오 사장님이 서 있는 칸 (1장부터 화분이 놓이는 자리 — 처음부터 막힌 칸이라 길이 바뀌지 않아요)
export const TUT_SPOT = { x: 11, y: 7 }; // v0.72: 계산대 아래 (화분 자리)
// 오 사장님이 가게에 있는 날 (프롤로그)
export const TUT_DAYS = 2;
// 손님이 「지쳐 간다」고 보는 때: 기다릴 수 있는 시간이 이만큼 남았을 때
export const TUT_IMPATIENT = 0.4;
