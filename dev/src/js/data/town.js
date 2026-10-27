// 마을: 밤·새벽에 걸어 다니는 골목 지도 (1장부터). 그리기는 render/town.js · 움직임 ui/town.js, 규칙은 sim/town.js
// 하루: 영업 → 영수증 → 준비 시간 한 턴 TURN_SLOTS시간(21시부터, 4시간을 쓰면 새벽 5시로 — 시계·하늘빛만 바뀌어요) → 아무 때나 「가게 열기」
//  v0.59 사용자 요청: 밤·새벽을 나누지 않아요. 모든 곳이 늘 열려 있고 장보기·청소·오픈 준비를 아무 차례로 해요. 남긴 시간은 쉬는 시간
// 행동 칸: 걷는 건 공짜, 일을 하면 칸을 써요. 칸이 없는데 더 하면 피로가 쌓여요(다음 날 사장 걸음이 느려져요)

// 마을 지도: 위에서 비스듬히 내려다본 골목 (16px 칸 = data/layout.js TILE, 가로 MAP_W × 세로 MAP_H). 어느 방향으로든 걸어 다녀요
//  윗줄: 우리 집 · 꽃집 · 우리 가게 · 세탁소 / 가운데 골목길 / 아랫줄: 식자재 마트 · 게시판 쉼터 · 빈 가게(임대, 우리 가게 건널목 바로 건너편) · 작은 공원 / 아래 큰길
//  양쪽 끝(0칸 · 22~23칸)은 위아래로 이어진 골목이에요. 건물은 지붕을 낮춘 마을용 그림(tw_ — dev/art_pack.py TW_CUT)
//  칸 줄: 0~5 윗줄 건물 · 6~7 보도 · 8~9 찻길 · 10~17 아랫줄(건물·쉼터·공원) · 18~19 보도 · 20~21 큰길 · 22~23 보도
export const MAP_W = 41; // v0.48: 동쪽 블록(카페·약국·빌라 / 학원·놀이터·버스 정류장)을 더해 24 → 41
export const MAP_H = 24;
// 바닥: 'road' 찻길 · 'grass' 잔디 · 나머지는 보도블록
export const ROAD_ROWS = [8, 9, 20, 21];
export const PARK = { x0: 17, x1: 22, y0: 11, y1: 17 };
export const PARK2 = { x0: 31, x1: 39, y0: 11, y1: 17 }; // 놀이터 (동쪽 블록)
export const CROSSWALKS = [12, 30]; // 건널목 (왼쪽 칸 x — 3칸 너비)
// 건물 [그림, 왼쪽 x, 바닥 y] (픽셀) — 건물 그림이 덮는 칸은 못 지나가요
export const BUILDINGS = [
  ['tw_home', 16, 96], ['tw_flower', 112, 96], ['tw_bunsik', 192, 96], ['tw_laundry', 272, 96],
  ['tw_market', 16, 288], ['tw_vacant', 192, 288],
  // 동쪽 블록 (v0.48)
  ['tw_cafe', 392, 96], ['tw_pharm', 472, 96], ['tw_home', 552, 96], ['tw_acad', 392, 288],
];
// 간판 [그림, x, y] — 그림의 영어 STORE·MARKET 판을 덮어요 (가게: x+9, 바닥−50 / 마트: x+32, 바닥−63)
export const SIGNS = [['sign_flower', 121, 46], ['sign', 201, 46], ['sign_laundry', 281, 46], ['sign_mart', 48, 225], ['sign_vacant', 201, 238], ['sign_cafe', 401, 46], ['sign_pharm', 481, 46], ['sign_acad', 425, 196]];
// 물건 { spr, x 왼쪽, y 바닥, block: 못 지나가는 칸 [[칸x, 칸y]], use: 누르거나 부딪히면 (USES) · only: 그때만 보여요 (ui/town.js propOn) }
//  가게 앞 꾸밈(막지 않음)은 가게마다 달라요: 꽃집 꽃수레 → 2장 가구점 탁자·상자 · 세탁소 빨래 → 2장 철물점 공구·상자 · 분식 입간판·의자 · 마트 과일 상자
export const MAP_PROPS = [
  { spr: 'lamp', x: 98, y: 126, block: [[6, 7]] }, { spr: 'lamp', x: 354, y: 126, block: [[22, 7]] },
  // 게시판 쉼터 (8~11칸)
  { spr: 'board', x: 150, y: 200, block: [[9, 12], [10, 12]] }, { spr: 'bench', x: 144, y: 272, block: [[9, 16], [10, 16], [11, 16]], use: 'rest' },
  // 작은 공원 (17~22칸)
  { spr: 'tree', x: 276, y: 220, block: [[18, 13]] }, { spr: 'pine', x: 340, y: 202, block: [[22, 12]] }, { spr: 'tree2', x: 316, y: 262, block: [[21, 16]] },
  { spr: 'bench', x: 288, y: 284, block: [[18, 17], [19, 17], [20, 17]], use: 'rest' }, { spr: 'bush', x: 336, y: 238, block: [[21, 14]] },
  // 가게 앞 꾸밈
  { spr: 'fl_cart', x: 152, y: 99, only: 'flower1' },
  { spr: 'gs_table', x: 150, y: 99, only: 'flower2' }, { spr: 'gs_box', x: 113, y: 99, only: 'flower2' },
  { spr: 'aframe', x: 227, y: 100 }, { spr: 'stool', x: 244, y: 100 }, { spr: 'stool', x: 258, y: 100 },
  { spr: 'clothes', x: 304, y: 97, only: 'laundry1' },
  { spr: 'tools', x: 312, y: 99, only: 'laundry2' }, { spr: 'gs_boxes', x: 274, y: 99, only: 'laundry2' },
  { spr: 'gs_box', x: 22, y: 291 }, { spr: 'gs_box', x: 104, y: 291 },
  // 동쪽 블록 (v0.48): 카페 · 약국 · 빌라 / 학원 · 분수 · 놀이터 · 버스 정류장 · 포장마차
  { spr: 'aframe', x: 434, y: 100 },
  { spr: 'vending', x: 538, y: 101, block: [[33, 6]], use: 'drink' },
  { spr: 'lamp', x: 610, y: 126, block: [[38, 7]] },
  { spr: 'fountain', x: 488, y: 214, block: [[30, 12], [31, 12]], use: 'fountain' },
  { spr: 'slide', x: 508, y: 270, block: [[32, 16]], use: 'slide' },
  { spr: 'swing', x: 562, y: 230, block: [[35, 13], [39, 13]], use: 'swing' },
  { spr: 'bench', x: 584, y: 272, block: [[36, 16], [37, 16], [38, 16]], use: 'rest' },
  { spr: 'tree', x: 600, y: 198, block: [[38, 11]] },
  { spr: 'busstop', x: 548, y: 383, block: [[35, 23], [36, 23], [37, 23], [38, 23]], use: 'bus' }, // 큰길 건너 정류장
  { spr: 'cart', x: 296, y: 318, block: [[18, 19], [19, 19], [20, 19]], use: 'cart' },
  // 윗줄 양 끝
  { spr: 'bush', x: 2, y: 48, block: [[0, 2]] }, { spr: 'pine', x: 358, y: 80, block: [[23, 4]] },
];
// 밤 불빛 [x, y, 반지름, 세기] — 우리 가게 창·문 · 가로등 머리 · 마트 창
export const LIGHTS = [[248, 75, 22, 0.42], [216, 88, 16, 0.3], [105, 72, 10, 0.55], [361, 72, 10, 0.55], [72, 250, 20, 0.3],
  [452, 75, 22, 0.4], [617, 72, 10, 0.55], [440, 250, 18, 0.28], [318, 300, 14, 0.35]]; // 카페 창 · 동쪽 가로등 · 학원 창 · 포장마차

// 장소: door 문 앞 칸(걸어가 서는 곳) · rect 누르는 곳 [x, y, w, h] · who 앞에 서 있는 사람 (v0.59부터 늘 열려 있어요)
export const PLACES = {
  home: { name: '우리 집', short: '집', door: [3, 6], rect: [16, 11, 96, 85] },
  flower: { name: '미소 꽃집', short: '꽃집', door: [8, 6], rect: [112, 8, 80, 88], who: 'miso' },
  shop: { name: '우리 가게', short: '우리 가게', door: [13, 6], rect: [192, 8, 80, 88] },
  laundry: { name: '최 사장 세탁소', short: '세탁소', door: [18, 6], rect: [272, 8, 80, 88], who: 'choi' },
  board: { name: '골목 게시판', short: '게시판', door: [10, 13], rect: [146, 170, 28, 34] },
  market: { name: '정 사장 식자재', short: '식자재', door: [4, 18], rect: [16, 191, 112, 97], who: 'jung' },
};
// 사람이 서 있는 칸 (data/story.js CAST)
export const TOWN_NPC = { miso: { at: [9, 7] }, choi: { at: [19, 7] }, jung: { at: [5, 18] } };
// 빈 가게: 우리 가게 건널목 바로 건너편. 1~2장은 「임대 문의」만, 3장에 프랜차이즈 「떡볶이 공장」이 들어와요 (기획서 3장)
// 둘러보기만 하는 곳 (누르면 한 줄) — 동쪽 블록 가게들
export const LOOKS = [
  { name: '골목 카페', rect: [392, 8, 80, 88], note: '늦게까지 불이 켜진 동네 카페입니다. 시험 기간이면 학생들로 붐빕니다.' },
  { name: '한 약국', rect: [472, 8, 80, 88], note: '한 약사님의 골목 약국입니다. 오늘은 문을 닫았습니다.' },
  { name: '빌라', rect: [552, 11, 96, 85], note: '창마다 불빛이 하나둘 켜져 있습니다. 이 골목 사람들이 사는 곳입니다.' },
  { name: '학원', rect: [392, 176, 96, 112], note: '중고등학생 학원입니다. 밤 10시가 넘어야 학생들이 우르르 나옵니다.' },
];
// 물건을 쓰면 (sim/town.js townUse): rest 벤치에서 쉬기(1칸 · 피로 −1) · drink 자판기(돈 · 피로 −1, 한 턴에 한 번) · 나머지는 한 줄
export const REST_COST = 1;
export const DRINK_PRICE = 1500;
export const USES = {
  rest: { name: '벤치', act: '앉아서 쉬기', sub: `${REST_COST}시간 · 피로 −1` },
  drink: { name: '음료 자판기', act: '캔커피 뽑기', sub: `${DRINK_PRICE.toLocaleString('ko-KR')}원 · 피로 −1 (한 턴에 한 번)` },
  fountain: { name: '분수', note: '물소리가 시원합니다. 동전 하나를 던져 봅니다. …장사가 잘되게 해 주세요.' },
  slide: { name: '미끄럼틀', note: '아무도 없는 틈에 한 번 타 봅니다. 생각보다 빠릅니다.' },
  swing: { name: '그네', note: '그네에 앉아 잠깐 흔들려 봅니다. 하늘이 가깝습니다.' },
  bus: { name: '버스 정류장', note: '첫차는 새벽 5시 30분입니다. 정류장 광고판에 「떡볶이 공장 곧 오픈!」 전단이 붙어 있습니다.' },
  cart: { name: '포장마차', note: '떡꼬치 굽는 냄새가 납니다. …우리 가게도 지지 말아야지.' },
};
// 골목을 걷는 손님 (밤·새벽): 말을 걸면 다음 날 가게에 올 가능성이 높아져요 (sim/town.js townMeet · sim/day.js)
export const WALKERS = { night: 3, dawn: 2 };
export const MEET_COME = 0.8;   // 이야기한 손님이 다음 영업에 올 확률
export const MEET_LINES = {
  student: [['학원 끝나고 집에 가는 길이에요. 배고프다…', '내일 친구들이랑 떡볶이 먹으러 갈게요!'], ['시험 기간이라 밤새야 해요.', '내일 분식집 들러서 힘내야겠어요.']],
  worker: [['야근하고 이제 퇴근이에요.', '내일 점심은 사장님 가게로 갈게요.'], ['이 골목에 분식집 있었네요?', '내일 동료들이랑 가 볼게요.']],
  elder: [['밤바람이 시원하구먼.', '내일 낮에 한 그릇 먹으러 가야겠어.'], ['젊은 사장이 고생이 많아.', '내일 들를게. 맛있게 해 줘.']],
};
export const VACANT_NOTE = '「임대 문의」 종이가 붙어 있습니다. 우리 가게 바로 건너편인데, 누가 들어올까요?';

// 행동 칸
export const NIGHT_SLOTS = 4;
export const DAWN_SLOTS = 3;
// 한 턴 7시간을 이어서 써요. 4시간을 쓰면 시계가 새벽 5시로 넘어가요(보이기만 — 할 수 있는 일은 같아요).
//  7시간을 넘기면 넘긴 만큼 피로 · 가게를 열 때 시간이 남았으면 피로 하나가 풀려요
export const TURN_SLOTS = NIGHT_SLOTS + DAWN_SLOTS;
export const NIGHT_START = 21 * 60; // 밤 21:00부터 한 칸에 한 시간
export const DAWN_START = 5 * 60;   // 새벽 05:00부터
// 피로: 시간을 넘겨 쓴 만큼 +1 (최대 3). 시간을 남기고 가게를 열면 −1. 피로 하나에 사장 걸음 8% 느려져요
export const FATIGUE_MAX = 3;
export const FATIGUE_SLOW = 0.08;

// 할 일 (cost: 행동 칸 · money: 원)
//  clean 청소: 위생 +60 (영업하면 하루 −25). 위생이 40 아래면 손님 만족이 떨어지고 리뷰에 나와요
//  talk 이웃과 이야기: 다음 날 그 이웃 소개로 손님 한 팀이 와요
//  counter 계산대 · 홍보: 우리 가게 계산대에서 인스타 올리기 · 파워블로거 섭외 (아래 PROMO, 칸·돈은 그 일마다)
//  insta 인스타 올리기: 다음 날 학생 손님이 더 들어와요 · blogger 파워블로거 섭외: 다음 날 블로거가 와서 먹고, 만족하면 며칠 동안 직장인·어르신이 더 (아니면 덜) 들어와요
//  market 장보기: 정 사장 가게 (그날 처음 들어갈 때 한 시간 · 특가·단골가·친밀도) — 휴대폰 「식자재 주문」은 정가로 시간 없이 (PHONE_ORDER) · 원재료 낱개(묶음 단위, data/menu.js INGREDIENTS), 그날 신선 재료 특가 한 가지
//  setup 오픈 준비(진열): 오늘 11시까지 사장 걸음 +15%
//  furn 미소 가구(2장부터): 그날 처음 들어갈 때 한 칸 — 미소 사장님과 이야기(친밀도·소개 손님)와 가구 창이 한 번에 (sim/furniture.js)
//  우리 가게는 골목에서 누르면 안으로 들어가요 (ui/town.js 가게 안) — 물건을 누르거나 아래 버튼으로: 냉장고 = 오늘의 메뉴·가격 · 메뉴판 = 메뉴 연구 칠판
//   · 계산대 = 판매 장부·손님 수첩 · 퇴식대 = 청소 · 화구 = 오픈 준비 · 문 = 골목으로 (SHOP_SPOTS)
//  sales 판매 장부: 날마다 매출·남은 돈·손님 (G.history)
//  recipe 메뉴 연구 칠판: 숙련도 + 돈으로 메뉴 레벨 올리기 (sim/upgrade.js, 칸 안 씀)
export const ACTS = {
  ledger: { name: '오늘의 메뉴·가격', cost: 0, when: 'any' },
  pantry: { name: '냉장고', cost: 0, when: 'any' },          // 창고 재료 보기 (v0.46: 오늘의 메뉴는 「가게 열기」에서)
  sales: { name: '판매 장부', cost: 0, when: 'any' },
  recipe: { name: '메뉴 연구 칠판', cost: 0, when: 'any' },
  clean: { name: '청소하기', cost: 1, when: 'any' },
  talk: { name: '이야기하기', cost: 1, when: 'any' },
  counter: { name: '계산대', cost: 0, when: 'any' }, // 판매 장부 · 손님 수첩 (홍보는 v0.54부터 휴대폰에서)
  book: { name: '손님 수첩', cost: 0, when: 'any' },
  insta: { name: '인스타 올리기', cost: 1, when: 'any' },   // 효과는 다가오는 영업일
  blogger: { name: '파워블로거 섭외', cost: 1, when: 'any', money: 50000 },
  furn: { name: '가구 둘러보기', cost: 1, when: 'any' },
  guild: { name: '철물점 · 상인회', cost: 1, when: 'any' },
  sleep: { name: '자고 가게 열기', cost: 0, when: 'any' }, // 집: 남은 시간은 쉬고 「가게 열기」 화면으로 (v0.59)
  market: { name: '장보기', cost: 1, when: 'any' },
  setup: { name: '오픈 준비 (진열)', cost: 1, when: 'any' },
  open: { name: '가게 열기', cost: 0, when: 'any' },
};
// 장소마다 할 수 있는 일
export const PLACE_ACTS = {
  home: ['sleep'],
  flower: ['talk'],
  shop: ['pantry', 'ledger', 'recipe', 'book', 'sales', 'counter', 'insta', 'blogger', 'clean', 'setup', 'open'],
  laundry: ['talk'],
  board: [],
  market: ['market'],
};
// 가게 안에서 누르는 물건: 할 일 · 이름 (칸은 data/layout.js — 냉장고·메뉴판·퇴식대·화구는 STATIONS, 계산대는 REGISTER)
export const SHOP_SPOTS = [
  { act: 'pantry', name: '냉장고 · 창고 재료', station: 'fridge' },
  { act: 'recipe', name: '메뉴판 · 메뉴 연구', tiles: [[8, 0], [9, 0], [8, 1], [9, 1], [8, 2], [9, 2]], stand: [[8, 3], [9, 3]] }, // 메뉴판 · 그 아래 조리대까지 눌러도 돼요 (v0.45: 잘 안 눌린다는 말에 넓힘)
  { act: 'counter', name: '계산대', register: true },
  { act: 'clean', name: '퇴식대 · 청소', station: 'trash' },
  { act: 'setup', name: '화구 · 오픈 준비 (프렙 통이 있으면 조리대 창: 오픈 준비 + 프렙)', station: 'stove' },
  { act: 'exit', name: '문 · 골목으로', door: true },
];
// 2장부터 바뀌는 곳: 미소 꽃집 → 미소 가구·인테리어 (sim/town.js placeName · placeActs)
export const PLACE_CH2 = { flower: { name: '미소 가구·인테리어', short: '가구점', acts: ['furn'] }, laundry: { name: '문 철물 · 상인회', short: '철물점', acts: ['guild'] } }; // laundry는 문 회장님이 온 뒤(sim/guild.js guildOpen)
export const HYGIENE_DECAY = 25;
export const CLEAN_GAIN = 60;
export const HYGIENE_LOW = 40;
export const HYGIENE_SAT = 0.5;      // 위생이 낮을 때 손님 만족 −0.5
// 홍보 (계산대): 손님층마다 들어오는 비율 (sim/traffic.js)
//  insta: 다음 날 학생 ×mul · blogger: 다음 날 블로거가 옴(at: 영업 시작부터 분) → 만족 4점 이상이면 그다음 days일 동안 직장인·어르신 ×good, 아니면 ×bad
export const PROMO = {
  insta: { types: ['student'], mul: 1.3 },
  blogger: { types: ['worker', 'elder'], good: 1.3, bad: 0.9, days: 3, at: 150, sat: 4 },
};
export const SETUP_MUL = 1.15;
export const SETUP_UNTIL = 120;      // 영업 시작부터 120분(11시)까지
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
// 휴대폰 「식자재 주문」(v0.59): 정가(특가·단골가 없음) · 시간 안 씀 · 친밀도 없음 — 바로 가게 냉장고로
export const PHONE_ORDER = { mul: 1 };
// 시장에서 정 사장님과 이야기 (하루 한 번, 칸 안 씀 · 차례대로)
export const JUNG_CHATS = [
  [['jung', '떡은 아침에 뽑은 거라 말랑해. 손으로 눌러 봐.'], ['jung', '오 사장 그 양반도 처음엔 떡을 너무 많이 사서 다 버렸어. 허허.']],
  [['jung', '요즘 채소값이 들쭉날쭉해. 신문 꼭 챙겨 봐.'], ['jung', '쌀 때 많이 사 두는 것도 장사야. 오래가는 것만.']],
  [['jung', '자네 가게 떡볶이 맛있다고 우리 집사람이 그러더라.'], ['jung', '좋은 물건 들어오면 자네 몫 따로 빼 둘게.']],
  [['jung', '새벽 시장은 부지런한 사람 거야. 자네는 부지런하네.'], ['jung', '나중엔 내가 가게 앞까지 갖다줄 수도 있고. 단골이면.']],
];
// 시장 정 사장 인사 (첫 방문)
export const JUNG_HELLO = [
  [['jung', '어이, 오 사장 후배라며? 그 양반한테 얘기 들었어.'], ['jung', '재료는 새벽에 와야 제일 싱싱해. 오늘 특가도 한번 봐.']],
  [['jung', '왔어? 오늘도 일찍 나왔네.'], ['jung', '특가는 먼저 오는 사람이 임자야.']],
];
