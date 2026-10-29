// 골목 상인회 (2장 — 문 회장님의 「문 철물」, 옛 세탁소 자리). 규칙은 sim/guild.js, 화면은 ui/guild.js
//  가입: 문 회장님 부탁(상인회 회의 김밥) → 가입비 → 상인회원. 회비는 주마다 고정비 고지서에 한 줄
//  설비: 맛(만족)은 올리지 않고 속도·여유만 — Lv2 더 쉽게(♥) · Lv3 한 번에 둘(♥♥♥). 맡기면 그날 밤 손봐서 다음 영업부터
//  장사 도구 등급 업(♥♥♥♥): 1장에 산 도구를 한 단계 위로
import { AUTO_COOK } from './menu.js';
export const GUILD_JOIN_FEE = 50000;
export const GUILD_DUES = 10000;       // 주마다
export const MOON_DISC = { 2: 0.05 };  // 문 회장님 ♥♥: 설비 5% 할인

// lv: [Lv1(지금) 설명, Lv2 { price, heart, text }, Lv3 { … }]
export const EQUIP = {
  stove: { name: '떡볶이 화구', spr: 'stove', lv: [AUTO_COOK ? '한 그릇 6초' : '졸이기 바늘 보통', { price: 150000, heart: 1, text: AUTO_COOK ? '만드는 시간이 20% 줄어듭니다' : '졸이기 바늘이 15% 느려집니다' }, { price: 400000, heart: 3, text: AUTO_COOK ? '주문이 밀리면 한 번에 2그릇' : '한 번 졸이면 2그릇' }] },
  mat: { name: '김밥 작업대', spr: 'mat', lv: [AUTO_COOK ? '한 줄 5초' : '6번 눌러 말기', { price: 150000, heart: 1, text: AUTO_COOK ? '만드는 시간이 20% 줄어듭니다' : '5번만 눌러도 말립니다' }, { price: 400000, heart: 3, text: AUTO_COOK ? '주문이 밀리면 한 번에 2줄' : '한 번에 2줄' }] },
  fryer: { name: '튀김기', spr: 'fryer', lv: [AUTO_COOK ? '한 접시 5초' : '노릇한 구간 보통', { price: 150000, heart: 1, text: AUTO_COOK ? '만드는 시간이 20% 줄어듭니다' : '노릇한 구간이 넓어집니다' }, { price: 400000, heart: 3, text: AUTO_COOK ? '주문이 밀리면 한 번에 2개' : '한 번에 2개' }] },
  fridge: { name: '냉장고', spr: 'fridge', lv: ['—', { price: 200000, heart: 1, text: '새로 산 재료 유통기한 +1일' }, { price: 500000, heart: 3, text: '급구매 웃돈 1.6배 → 1.3배 · 도착 20초 → 10초' }] },
  register: { name: '계산대', spr: 'register', lv: ['한 명 계산 0.35초', { price: 100000, heart: 1, text: '한 명 계산 0.25초' }, { price: 300000, heart: 3, text: '카드 단말기 · 계산 줄 손님이 50% 더 기다려 줍니다' }] },
};
export const EQUIP_IDS = ['stove', 'mat', 'fryer', 'fridge', 'register'];
// Lv별 수치 (sim/guild.js · sim/tools.js · sim/player.js · sim/day.js가 봐요)
export const EQ_STIR_SLOW = 0.85;      // 화구 Lv2: 바늘 빠르기 ×
export const EQ_ROLL_TAPS = 5;         // 작업대 Lv2: 말기 횟수
export const EQ_FRY_ZONE = { perfect: [0.6, 0.8], good: [0.47, 0.9] }; // 튀김기 Lv2: 구간
export const EQ_SHELF_PLUS = 1;        // 냉장고 Lv2: 유통기한 +
export const EQ_RUSH = { mul: 1.3, sec: 10 };  // 냉장고 Lv3
export const EQ_PAY_SEC = 0.25;        // 계산대 Lv2
export const EQ_PAY_WAIT = 1.5;        // 계산대 Lv3: 계산 줄 기다림 ×

// 장사 도구 등급 업 (♥♥♥♥): 1장 도구(data/tools.js)를 가진 사람만
export const TOOL_UP = {
  tray: { name: '큰 쟁반', price: 250000, heart: 4, text: '손에 4개까지 듭니다' },
  warmer: { name: '큰 프렙 통', price: 300000, heart: 4, text: '프렙을 30그릇까지 만들어 둡니다' }, // v0.65 보온 통 → 프렙 통
  timer: { name: '디지털 타이머', price: 200000, heart: 4, text: AUTO_COOK ? '다 된 음식이 「완벽」으로 남는 시간이 2배' : '「완벽」 구간이 조금 더 넓어집니다' },
};
export const TOOL_UP_IDS = ['tray', 'warmer', 'timer'];
// 디지털 타이머 구간 (주방 타이머보다 조금 더 넓게)
export const COOK_EASE2 = {
  stir: { zone: { perfect: 0.2, good: 0.34 } },
  roll: { perfect: 2.8, good: 3.7 },
  fry: { perfect: [0.53, 0.86], good: [0.42, 0.94] },
};

// 문 회장님 말 (철물점에 들를 때, 차례대로)
export const MOON_CHATS = [
  [['moon', '왔나. 설비 손볼 데 있으면 말해. 공구는 다 있어.'], ['moon', '자네 가게 얘기는 내가 상인회에 좋게 해 뒀어. 내일 누가 들를 거야.']],
  [['moon', '이 골목 가게들은 다 내 손을 한 번씩 거쳤지.'], ['moon', '오 사장 그 양반 튀김기도 내가 몇 번을 고쳤는지 몰라.']],
  [['moon', '장사는 결국 손이 덜 가는 쪽이 이겨. 설비에 돈 아끼지 마.'], ['moon', '상인회 사람들한테 자네 김밥 소문 좀 내 놨어.']],
];
export const MOON_FIRST = [['moon', '오, 왔구먼. 자네가 오가네 이어받은 사장이지?'], ['moon', '들어와 봐. 안쪽이 상인회 사무실이야.']];
