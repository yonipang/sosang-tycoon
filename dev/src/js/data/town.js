// 마을: 밤·새벽에 걸어 다니는 가게 앞 골목 (1장부터). 그리기는 render/cut.js(골목 그림)·ui/town.js, 규칙은 sim/town.js
// 하루: 영업 → 영수증 → 밤(21시~, 행동 칸 4) → 집에서 자기 → 새벽(5시~, 행동 칸 3) → 가게에서 「가게 열기」
// 행동 칸: 걷는 건 공짜, 일을 하면 칸을 써요. 칸이 없는데 더 하면 피로가 쌓여요(다음 날 사장 걸음이 느려져요)

// 골목 그림 (픽셀): 가로 TOWN_W · 걷는 줄 y TOWN_Y. 건물 [그림, 왼쪽 x]
export const TOWN_W = 600;
export const TOWN_Y = 166;
export const TOWN_WORLD = {
  w: 600,
  stores: [['st_home', 6], ['st_flower', 112], ['st_bunsik', 200], ['st_laundry', 288], ['st_market', 456]],
  signs: [['sign_mart', 488, 81], ['sign_flower', 121, 94], ['sign_laundry', 297, 94]], // 영어 판 자리를 한글 간판으로 (마트 456+32·144-133+70 · 가게 x+9·144-118+68)
  shopX: 200,
  lamps: [98, 374],
};
export const TOWN_PROPS = [{ spr: 'lamp', x: 98, y: 174 }, { spr: 'lamp', x: 374, y: 174 }, { spr: 'board', x: 400, y: 156 }];

// 장소: x 문 앞(걸어가 서는 곳) · from~to 누를 수 있는 가로 범위 · open: 'night'|'dawn'|없으면 늘 · who 앞에 서 있는 사람
export const PLACES = {
  home: { name: '우리 집', short: '집', x: 50, from: 0, to: 105 },
  flower: { name: '미소 꽃집', short: '꽃집', x: 150, from: 106, to: 199, who: 'miso', open: 'night' },
  shop: { name: '우리 가게', short: '우리 가게', x: 224, from: 200, to: 287 },
  laundry: { name: '최 사장 세탁소', short: '세탁소', x: 312, from: 288, to: 385, who: 'choi', open: 'night' },
  board: { name: '골목 게시판', short: '게시판', x: 412, from: 386, to: 450, open: 'night' },
  market: { name: '정 사장 식자재', short: '식자재', x: 511, from: 451, to: 600, who: 'jung', open: 'dawn' },
};
// 사람이 서 있는 곳 (data/story.js CAST)
export const TOWN_NPC = { miso: { x: 132, open: 'night' }, choi: { x: 342, open: 'night' }, jung: { x: 536, open: 'dawn' } };

// 행동 칸
export const NIGHT_SLOTS = 4;
export const DAWN_SLOTS = 3;
export const NIGHT_START = 21 * 60; // 밤 21:00부터 한 칸에 한 시간
export const DAWN_START = 5 * 60;   // 새벽 05:00부터
// 피로: 칸을 넘겨 쓴 만큼 +1 (최대 3). 밤에 칸을 남기고 자면 −1. 피로 하나에 사장 걸음 8% 느려져요
export const FATIGUE_MAX = 3;
export const FATIGUE_SLOW = 0.08;

// 할 일 (cost: 행동 칸 · money: 원)
//  clean 청소: 위생 +60 (영업하면 하루 −25). 위생이 40 아래면 손님 만족이 떨어지고 리뷰에 나와요
//  talk 이웃과 이야기: 다음 날 그 이웃 소개로 손님 한 팀이 와요
//  flyer 전단지: 다음 날 가게 앞 손님 +15%
//  market 장보기: 새벽에 정 사장 가게 (그날 처음 들어갈 때 한 칸) · 5인분씩, 그날 특가 한 가지
//  setup 오픈 준비(진열): 오늘 11시까지 사장 걸음 +15%
export const ACTS = {
  ledger: { name: '장부·가격 보기', cost: 0, when: 'any' },
  clean: { name: '청소하기', cost: 1, when: 'night' },
  talk: { name: '이야기하기', cost: 1, when: 'night' },
  flyer: { name: '전단지 붙이기', cost: 1, when: 'night', money: 5000 },
  sleep: { name: '자러 가기', cost: 0, when: 'night' },
  market: { name: '장보기', cost: 1, when: 'dawn' },
  setup: { name: '오픈 준비 (진열)', cost: 1, when: 'dawn' },
  open: { name: '가게 열기', cost: 0, when: 'dawn' },
};
// 장소마다 할 수 있는 일
export const PLACE_ACTS = {
  home: ['sleep'],
  flower: ['talk'],
  shop: ['ledger', 'clean', 'setup', 'open'],
  laundry: ['talk'],
  board: ['flyer'],
  market: ['market'],
};
export const HYGIENE_DECAY = 25;
export const CLEAN_GAIN = 60;
export const HYGIENE_LOW = 40;
export const HYGIENE_SAT = 0.5;      // 위생이 낮을 때 손님 만족 −0.5
export const FLYER_MUL = 1.15;
export const SETUP_MUL = 1.15;
export const SETUP_UNTIL = 120;      // 영업 시작부터 120분(11시)까지
export const MARKET_PACK = 5;        // 한 번에 5인분
export const MARKET_DEAL = 0.85;     // 오늘 특가 15% 싸게
export const REFERRAL_AT = [120, 300]; // 소개 손님이 오는 때 (영업 시작부터 분)

// 이웃 이야기 (차례대로, 다 하면 처음부터). 사람 말투 그대로
export const CHATS = {
  miso: [
    [['miso', '어머, 사장님 이제 퇴근해요? 고생 많았어요.'], ['miso', '우리 가게 손님들한테 떡볶이집 얘기 좀 해 둘게요. 꽃 사러 왔다가 배고프다는 분 많거든요.']],
    [['miso', '오늘 장미가 잘 나갔어요. 근처에 기념일인 커플이 많은가 봐요.'], ['miso', '데이트하고 출출할 때 떡볶이만 한 게 없죠. 소개해 드릴게요!']],
    [['miso', '가게 앞에 화분 하나 두니까 사람들이 한 번씩 더 쳐다보더라고요.'], ['miso', '사장님네도 가게 앞을 예쁘게 해 봐요. 다 장사예요, 장사.']],
  ],
  choi: [
    [['choi', '어, 분식집 사장. 오늘도 늦게까지 하네.'], ['choi', '우리 세탁소 손님들 기다리는 동안 출출하대. 내가 말 좀 해 줄게.']],
    [['choi', '내가 이 골목에서만 20년이야. 장사는 버티는 놈이 이기는 거야.'], ['choi', '내일 우리 단골 하나 보낼게. 잘해 줘.']],
    [['choi', '요새 앞 건물 월세가 또 올랐다더라. 건물주들은 참….'], ['choi', '그래도 사장은 열심히 하니까 괜찮을 거야. 손님 하나 또 보낼게.']],
  ],
};
// 시장 정 사장 인사 (새벽 첫 방문)
export const JUNG_HELLO = [
  [['jung', '어이, 오 사장 후배라며? 그 양반한테 얘기 들었어.'], ['jung', '재료는 새벽에 와야 제일 싱싱해. 오늘 특가도 한번 봐.']],
  [['jung', '왔어? 오늘도 일찍 나왔네.'], ['jung', '특가는 먼저 오는 사람이 임자야.']],
];
