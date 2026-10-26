// 미소 가구·인테리어 (2장부터 — 미소 꽃집이 바뀌어요). 규칙은 sim/furniture.js, 화면은 ui/furn.js, 그림은 dev/art_pack.py FURN
//  산 것은 바로 가게에 들어가요. 효과는 분위기 점수(0~100) 하나로 모여요
//  분위기: 손님 만족 + 분위기 ÷ 250 (최대 +0.4) · 가게 앞을 지나는 사람의 입장 × (1 + 분위기 ÷ 1000) (최대 +10%)
//  같은 테마 4개 이상이면 그 테마 보너스, 6개 다 같은 테마면 분위기 +10
//  일반(♥) · 고급(♥♥♥, 값·분위기 두 배쯤) · 친밀도 전용(♥♥♥♥ 행운목·골목 옛 사진 — 어느 테마로든 셈) · 미소 컬렉션(♥♥♥♥♥, 분위기 100)
//  물건 이름(G.furn.have 값): 'retro' 일반 · 'retro2' 고급 · 'lucky'·'old' 친밀도 전용 · 'miso' 미소 컬렉션

// 카테고리 (가게에 놓이는 자리는 정해져 있어요 — render/view.js · data/layout.js FURN_SPOTS)
//  화분·액자는 두 개 한 벌로 (값·분위기는 두 개 합) · prem: 고급 [값, 분위기]
export const FURN_CATS = {
  wall: { name: '벽지', price: 40000, mood: 6, prem: [120000, 12] },
  floor: { name: '바닥', price: 50000, mood: 6, prem: [150000, 12] },
  window: { name: '창문', price: 30000, mood: 4, prem: [90000, 8] },
  plant: { name: '화분 2개', price: 30000, mood: 6, prem: [100000, 12] },
  frame: { name: '액자 2개', price: 20000, mood: 4, prem: [80000, 10] },
  table: { name: '식탁·의자', price: 120000, mood: 8, prem: [300000, 16] },
};
export const FURN_ORDER = ['wall', 'floor', 'window', 'plant', 'frame', 'table'];
// 카테고리마다 아틀라스 그림 이름 앞부분 (그림은 앞부분_테마)
export const FURN_SPR = { wall: 'wall', floor: 'floor', window: 'win', plant: 'plant', frame: 'frame', table: 'table' };

// 테마: bonus 같은 테마 4개 이상일 때 (sat 손님층 만족 + · enter 손님층 입장 × · eat 먹는 시간 ×)
export const FURN_THEMES = {
  retro: { name: '레트로', bonusText: '어르신 만족 +0.2', sat: { elder: 0.2 } },
  wood: { name: '우드 내추럴', short: '우드', bonusText: '직장인 만족 +0.2', sat: { worker: 0.2 } },
  pastel: { name: '파스텔', bonusText: '학생 입장 +10% (인증샷)', enter: { student: 1.1 } },
  minimal: { name: '미니멀', bonusText: '먹는 시간 −10% (자리가 빨리 남)', eat: 0.9 },
};
export const FURN_THEME_IDS = ['retro', 'wood', 'pastel', 'minimal'];
// 물건 이름 (카테고리 × 테마)
export const FURN_NAMES = {
  wall: { retro: '갈색 체크 벽지', wood: '나무 판자 벽', pastel: '민트 줄무늬 벽지', minimal: '회색 무지 벽지' },
  floor: { retro: '체크 타일 바닥', wood: '밝은 원목 마루', pastel: '분홍 꽃무늬 타일', minimal: '연회색 타일' },
  window: { retro: '빨간 창틀', wood: '원목 창틀', pastel: '하얀 창틀', minimal: '짙은 창틀' },
  plant: { retro: '토분 고무나무', wood: '야자 화분', pastel: '동글동글 화분', minimal: '각진 화분 나무' },
  frame: { retro: '옛 그림 액자', wood: '풍경 액자', pastel: '꽃 그림 액자', minimal: '추상화 액자' },
  table: { retro: '빨간 식탁·의자', wood: '원목 식탁·의자', pastel: '민트 식탁·의자', minimal: '하얀 식탁·의자' },
};
// 고급 (♥♥♥): 식탁보·방석·커튼이 생기고 벽지·바닥·화분·액자가 바뀌어요
export const FURN_NAMES2 = {
  wall: { retro: '다방 녹색 징두리 벽', wood: '짙은 원목 패널', pastel: '민트 꽃무늬 벽지', minimal: '하얀 벽돌 벽' },
  floor: { retro: '옛날 무늬 타일', wood: '헤링본 마루', pastel: '민트 꽃 타일', minimal: '큰 회색 타일' },
  window: { retro: '빨간 커튼 창', wood: '린넨 커튼 창', pastel: '라벤더 커튼 창', minimal: '회색 커튼 창' },
  plant: { retro: '큰 토분 나무', wood: '원목 화분 나무', pastel: '분홍 화분 나무', minimal: '하얀 화분 나무' },
  frame: { retro: '노을 그림', wood: '숲 그림', pastel: '바다 그림', minimal: '거울' },
  table: { retro: '체크 식탁보·방석', wood: '린넨 식탁보·방석', pastel: '레이스 식탁보·방석', minimal: '하얀 식탁보·방석' },
};
export const FURN_PREM_HEART = 3;     // 고급은 ♥♥♥부터
// 친밀도 전용 (♥♥♥♥): 어느 테마로든 셈 (테마 보너스·6개 맞추기에 다 들어가요)
export const FURN_SPECIAL = {
  lucky: { cat: 'plant', name: '미소가 키운 행운목', note: '미소 사장님이 꽃집 때부터 키운 나무', price: 120000, mood: 18, heart: 4 },
  old: { cat: 'frame', name: '골목 옛 사진', note: '30년 전 이 골목 사진', price: 60000, mood: 16, heart: 4 },
};
// 미소 컬렉션 (♥♥♥♥♥): 6가지 한 번에 · 분위기 100 · 어느 테마로든 셈(테마 보너스 넷 다)
export const MISO_SET = { name: '미소 컬렉션', note: '미소 사장님이 사장님 가게만 생각하고 고른 한 벌', price: 1500000, heart: 5, mood: 100 };
export const MISO_NAMES = { wall: '꽃잎 벽지', floor: '따뜻한 무늬 바닥', window: '꽃 상자 창', plant: '꽃 핀 화분', frame: '말린 꽃 액자', table: '분홍 식탁보·방석' };
// 확장공사 (미소 가구 · 가게 등급): 홀이 두 줄 길어져 탁자가 늘고, 오늘의 메뉴 칸도 하나 늘어요 (data/layout.js applyShopLv · data/menu.js SLOTS_BY_GRADE)
//  rent: 넓어진 만큼 주간 임대료가 더 나가요
export const SHOP_BUILD = {
  2: { name: '동네 가게', price: 1500000, heart: 2, rent: 70000, tables: 8 },
};
export const FURN_THEME_NEED = 4;     // 같은 테마 몇 개부터 보너스
export const FURN_SET_RATE = 0.85;    // 세트(모자란 것 한 번에)는 낱개 합의 85%
export const FURN_SET_MOOD = 10;      // 6개 다 같은 테마면 분위기 +10
export const MOOD_MAX = 100;
export const MOOD_SAT_DIV = 250;      // 만족 + 분위기 ÷ 250
export const MOOD_SAT_MAX = 0.4;
export const MOOD_ENTER_DIV = 1000;   // 입장 × (1 + 분위기 ÷ 1000)
export const FURN_HEART = 1;          // 일반 가구를 사려면 미소 사장님 ♥ 1단계

// 미소 가구에 들를 때 미소 사장님 말 (차례대로, 다 하면 처음부터). 첫 방문은 FURN_FIRST
export const FURN_FIRST = [['miso', '어머, 사장님! 진짜 첫 손님으로 와 줬네요.'], ['miso', '천천히 둘러봐요. 같은 느낌으로 맞추면 손님들이 확실히 알아봐요.']];
export const FURN_CHATS = [
  [['miso', '왔어요? 오늘은 뭐 바꿔 볼까요?'], ['miso', '우리 가게 손님한테 떡볶이집 얘기 또 해 둘게요.']],
  [['miso', '할머니들은 옛날 다방 같은 분위기 좋아하시더라고요. 레트로요.'], ['miso', '내일 꽃 사러 오신 분 하나 보낼게요.']],
  [['miso', '학생들은 사진 찍기 좋은 데로 몰려요. 파스텔 같은 거요.'], ['miso', '아, 내일 우리 손님 하나 그쪽으로 보낼게요!']],
  [['miso', '직장인들은 편하게 오래 앉아 있는 걸 좋아해요. 나무 느낌이 편하대요.'], ['miso', '소개도 해 둘게요. 사장님 가게 잘돼야 골목이 살죠.']],
];
