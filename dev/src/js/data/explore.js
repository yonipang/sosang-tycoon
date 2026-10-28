// 동네 탐방 (2장부터, v0.78): 장사 끝난 뒤 하루 한 번, 새벽 첫차로 골목 밖 동네를 걸어 다녀요 — 데이브 더 다이버의 탐험처럼
//  기획서 탭 「동네 탐방 — 밤 탐험」 (10-28 사용자 결정): 준비 시간과 따로 하루 한 번 무료 · 체력은 탐방 안에서만(다음 날과 상관없음)
//  체력이 0이 되면 가방 일부를 두고 택시로 돌아와요 · 골목처럼 걸어 다녀요 · 첫 동네 재래시장
//  규칙은 sim/explore.js, 그리기 render/explore.js, 화면 ui/explore.js (골목 화면 ui/town.js 안에서)
//  지도는 날마다 조금씩 달라요: 가게 자리 순서 · 문 닫은 가게 · 길 가운데 노점 · 사건 자리 (그날 씨앗)

export const EX_STAMINA = 100;   // 체력
export const EX_STEP = 0.4;      // 한 칸 걸을 때 드는 체력
export const EX_BAG = 4;         // 가방 칸
export const EX_EVENTS = 7;      // 한 번 갈 때 생기는 사건 수 (다 하려면 체력이 모자라요 — 고르는 게 재미)
export const EX_CLOCK = '05:30'; // 새벽 첫차

// 재래시장 지도 (16px 칸): 위 가게 줄(0~5줄) · 길 A(6~11줄, 6줄은 가게 앞 진열) · 아래 가게 줄(12~17줄, 가게 사이 1칸 골목으로 지나가요) · 길 B(18~23줄)
//  가게 한 자리 = 너비 80px(5칸) + 사이 16px. 왼쪽 2칸 · 오른쪽 2칸은 위아래로 이어진 길. 버스 정류장은 왼쪽 아래
export const MK = { W: 45, H: 24, SLOTS: 7, X0: 32, STEP: 96, BOT1: 88, BOT2: 280, START: [7, 22] }; // 정류장 오른쪽 (v0.81: 정류장 뒤에 가려 안 보였어요)

// 가게 종류 (간판·진열 그림은 dev/art_pack.py market_sprites — mk_s_ · mk_d_)
//  owner: 가게 앞에 서 있는 사장님 그림 (캐릭터 번호) · w: 가게 앞 진열 그림 너비(px — 막히는 칸)
export const SHOP_TYPES = {
  fruit: { name: '싱싱과일', owner: 3, w: 48 },
  veg: { name: '초록채소', owner: 4, w: 48 },
  flower: { name: '꽃집', owner: 17, w: 48 },
  fish: { name: '바다수산', owner: 11, w: 61 },
  tteok: { name: '할매떡집', owner: 14, w: 40 },
  mill: { name: '참방앗간', owner: 8, w: 47 },
  banchan: { name: '엄마반찬', owner: 5, w: 40 },
  dried: { name: '건어물', owner: 12, w: 45 },
  gukbap: { name: '순대국밥', owner: 2, w: 46 },
  goods: { name: '만물잡화', owner: 4, w: 58 },
};
export const SHOP_IDS = Object.keys(SHOP_TYPES);
export const EX_CLOSED = 3;      // 날마다 문 닫은 가게 수 (14자리 중)
export const EX_CHARS = { cart: 15, stall: 14, kid: 15, grandma: 13 }; // 노점 아주머니 · 파라솔 할머니 · 길 잃은 아이 · 아이 할머니 (캐릭터 번호)
export const EX_CARRY = 2;       // 짐을 들고 걸으면 체력이 이만큼 배로 들어요
// 저장 칸 G.explore (save/state.js): last 마지막으로 다녀온 날 · runs 횟수 · memos 동네 메모 id · flyer 전단 효과
export const newExplore = () => ({ last: 0, runs: 0, memos: [], flyer: null });

// 가방에 담는 것: ing 재료(냉장고로) · note 맛의 힌트(숙련도) · ref 소개 손님(다음 영업) · flyer 전단 자리(며칠 동안 그 손님층 ↑)
export const FINDS = {
  fishcake: { name: '갓 만든 어묵', icon: 'ing_fishcake', kind: 'ing', ing: 'fishcake', n: 10, text: '어묵 10개 → 냉장고' },
  ddeok: { name: '갓 뽑은 가래떡', icon: 'ing_ddeok', kind: 'ing', ing: 'ddeok', n: 10, text: '떡 10개 → 냉장고' },
  gochu: { name: '방앗간 고추장', icon: 'ing_gochujang', kind: 'ing', ing: 'gochujang', n: 20, text: '고추장 20 → 냉장고' },
  scallion: { name: '덤으로 받은 대파', icon: 'ing_scallion', kind: 'ing', ing: 'scallion', n: 10, text: '대파 10 → 냉장고' },
  gim: { name: '갓 구운 김', icon: 'ing_gim', kind: 'ing', ing: 'gim', n: 20, text: '김 20장 → 냉장고' },
  egg: { name: '할머니 달걀', icon: 'ing_egg', kind: 'ing', ing: 'egg', n: 10, text: '계란 10개 → 냉장고' },
  noteTteok: { name: '떡볶이 비법 쪽지', icon: 'tteok', kind: 'note', menu: 'tteok', n: 20, text: '떡볶이 숙련도 +20' },
  noteKimbap: { name: '김밥 말기 요령', icon: 'kimbap', kind: 'note', menu: 'kimbap', n: 15, text: '김밥 숙련도 +15' },
  refElder: { name: '시장 어르신들의 약속', icon: 'face_happy', kind: 'ref', type: 'elder', text: '다음 영업에 어르신 손님 2명' },
  refWorker: { name: '새벽 기사님들의 약속', icon: 'face_happy', kind: 'ref', type: 'worker', text: '다음 영업에 직장인 손님 2명' },
  flyerElder: { name: '시장 게시판 전단 자리', icon: 'board', kind: 'flyer', type: 'elder', mul: 1.3, days: 3, text: '3일 동안 어르신 손님 ↑' },
};

// 동네 메모: 눈으로 본 것 한 줄 — 수첩에 쌓이고, 3장 상권 지도(나이스비즈맵)가 열리면 숫자로 다시 나와요
export const MEMOS = {
  mkDawn: '새벽 시장은 5시부터 붐빈다. 상인과 어르신이 많다',
  mkElder: '시장을 오가는 손님은 어르신이 가장 많다',
  mkMeal: '상인들은 새벽에 국밥으로 아침을 먹는다',
  mkPrice: '시장 사람들은 값에 밝다. 100원 차이도 따진다',
  mkWeekend: '주말이면 시장에 사람이 두 배로 는다고 한다',
  mkDeliver: '새벽 배송 기사들이 시장 앞에서 잠깐 쉬어 간다',
};

// 사건: at 'shop:종류'(그 가게가 열린 날만 · 사장님) · 'cart'(길 가운데 노점) · 'stall'(할머니 노점 파라솔) · 'board'(시장 게시판) · 'kid'(길 잃은 아이)
//  choices: { label, cost 체력, pay 돈, give 가방에 담을 것, heal 체력 회복, bond [이웃, 점수], say 결과 한 줄 } — 마지막은 늘 「지나치기」
//   실제로 돕기 (v0.81 사용자 결정 「심부름 + 손기술」):
//   task 심부름 — deliver: 짐(item)을 들고 to 목록 중 열린 곳(멀리 있는 곳 먼저)까지 걸어가 「전해 주기」(들고 걸으면 체력 EX_CARRY배)
//                 escort: 아이가 따라와요. 시장 어딘가에 나타난 할머니를 찾아 「모셔다드리기」(근처 가게 이름이 힌트)
//   mini 손기술 — timing: 움직이는 바늘이 초록 칸에 올 때 누르기(rounds번 중 need번) · mash: 시간 안에 빠르게 눌러 막대 채우기(taps번)
//   fail: 손기술을 놓쳤을 때 한 줄 (체력은 들고 가방엔 안 담겨요)
//  memo: 이 사건을 한 번이라도 하면 남는 동네 메모
export const EX_EVENTS_POOL = [
  { id: 'fishIce', at: 'shop:fish', title: '바다수산 사장님', text: '얼음 상자를 나르느라 정신이 없습니다. 「거기, 이 상자 좀 갖다줄 수 있어요? 손이 모자라서요.」',
    choices: [{ label: '얼음 상자 배달하기', task: { kind: 'deliver', item: '얼음 상자', to: ['shop:gukbap', 'shop:dried', 'shop:banchan', 'cart', 'stall'], verb: '전해 주기' }, give: 'refWorker', say: '「벌써 갖다줬어요? 고마워요! 새벽 배송 기사님들한테 분식집 얘기 해 둘게요.」' }], memo: 'mkDeliver' },
  { id: 'tteokPull', at: 'shop:tteok', title: '할매떡집 할머니', text: '가래떡이 김을 내며 줄줄이 뽑혀 나옵니다. 「분식집 사장이구먼. 떡 자르는 것 좀 거들래?」',
    choices: [{ label: '떡 자르기 돕기', cost: 8, mini: { kind: 'timing', name: '떡 자르기', act: '자르기!', rounds: 3, need: 2, speed: 1.1 }, fail: '「아이고, 삐뚤빼뚤하네. 괜찮여, 다음에 또 와.」', give: 'ddeok', say: '「손이 야무지네. 이건 수고비여.」' }, { label: '떡 한 줄 사 먹기', pay: 2000, heal: 15, say: '따끈한 가래떡에 기운이 납니다.' }] },
  { id: 'millSack', at: 'shop:mill', title: '참방앗간 할아버지', text: '고추 빻는 냄새가 매캐합니다. 「젊은이, 이 자루 좀 단골집에 갖다줄 텐가?」',
    choices: [{ label: '자루 배달하기', task: { kind: 'deliver', item: '고춧가루 자루', to: ['shop:tteok', 'shop:banchan', 'shop:gukbap', 'cart'], verb: '전해 주기' }, give: 'gochu', say: '「옛날식으로 담근 거여. 떡볶이에 넣어 봐.」' }, { label: '빻는 것 구경하기', cost: 6, give: 'noteTteok', say: '「고춧가루는 굵은 거랑 고운 걸 섞어야 맛이 깊어.」' }], memo: 'mkPrice' },
  { id: 'vegDeal', at: 'shop:veg', title: '초록채소 사장님', text: '「대파 오늘 실하게 들어왔어요! 분식집이면 파 많이 쓰죠?」',
    choices: [{ label: '인사하고 덤 받기', cost: 4, give: 'scallion', say: '「단골 되면 더 줄게요!」' }] },
  { id: 'banchanTaste', at: 'shop:banchan', title: '엄마반찬 사장님', text: '반찬통을 정리하던 사장님이 김밥 한 조각을 내밉니다. 「새로 만든 건데 맛 좀 봐 줄래요?」',
    choices: [{ label: '맛보고 이야기 나누기', cost: 5, give: 'noteKimbap', say: '「김밥은 밥을 살살, 끝에서 힘을 줘야 안 터져요.」' }] },
  { id: 'driedGim', at: 'shop:dried', title: '건어물 사장님', text: '김을 굽는 고소한 냄새가 납니다. 「일손이 모자라서… 좀 뒤집어 줄래요?」',
    choices: [{ label: '김 굽기 돕기', cost: 8, mini: { kind: 'timing', name: '김 뒤집기', act: '뒤집기!', rounds: 3, need: 2, speed: 1.3 }, fail: '「앗, 조금 탔네요. 그래도 고마워요.」', give: 'gim', say: '「잘 구웠네! 김밥집에 딱이에요.」' }] },
  { id: 'gukbapMeal', at: 'shop:gukbap', title: '순대국밥', text: '상인들이 국밥 한 그릇씩 비우고 하루를 시작합니다. 김이 모락모락 납니다.',
    choices: [{ label: '국밥 한 그릇 (5,000원)', pay: 5000, heal: 35, say: '든든합니다. 다리에 힘이 붙었습니다.' }], memo: 'mkMeal' },
  { id: 'fruitBox', at: 'shop:fruit', title: '싱싱과일 사장님', text: '과일 상자가 길까지 쌓여 있습니다. 「아이고, 주문 들어온 상자를 갖다줘야 하는데 가게를 비울 수가 없네.」',
    choices: [{ label: '과일 상자 배달하기', task: { kind: 'deliver', item: '과일 상자', to: ['stall', 'shop:veg', 'shop:gukbap', 'cart'], verb: '전해 주기' }, give: 'refElder', say: '「고마워요. 우리 시장 어르신들한테 분식집 소문 내 줄게요.」' }], memo: 'mkElder' },
  { id: 'flowerOne', at: 'shop:flower', title: '꽃집 사장님', text: '「미소 사장님 아는 분이죠? 이거 갖다 드려요. 새벽에 들어온 거예요.」',
    choices: [{ label: '꽃 받아 가기', cost: 3, bond: ['miso', 3], say: '미소 사장님이 좋아할 것 같습니다.' }] },
  { id: 'boardFlyer', at: 'board', title: '시장 게시판', text: '시장 사람들이 오가며 보는 게시판입니다. 빈자리가 조금 있습니다.',
    choices: [{ label: '전단 붙이기', cost: 8, give: 'flyerElder', say: '잘 보이는 자리에 붙였습니다.' }], memo: 'mkWeekend' },
  { id: 'cartSoup', at: 'cart', title: '어묵 노점', text: '「새벽부터 고생이네. 국물 한 잔 하고 가요.」 노점 아주머니가 꼬치를 끼우고 있습니다.',
    choices: [{ label: '국물 한 잔 (1,000원)', pay: 1000, heal: 12, say: '뜨끈한 국물이 목을 타고 내려갑니다.' }, { label: '꼬치 끼우기 돕기', cost: 8, mini: { kind: 'mash', name: '꼬치 끼우기', act: '끼우기!', taps: 16, time: 5 }, fail: '「아이고, 다 흘렸네. 괜찮아요, 국물이나 마시고 가요.」', give: 'fishcake', say: '「손 빠르네! 남는 거 가져가요.」' }] },
  { id: 'stallEgg', at: 'stall', title: '파라솔 할머니', text: '나물을 다듬던 할머니가 손짓합니다. 「이거 좀 같이 다듬어 줄 텨?」',
    choices: [{ label: '나물 다듬기 돕기', cost: 8, mini: { kind: 'mash', name: '나물 다듬기', act: '다듬기!', taps: 14, time: 5 }, fail: '「허허, 손이 아직 서툴구먼.」', give: 'egg', say: '「집에서 키운 닭이 낳은 거여. 가져가.」' }], memo: 'mkDawn' },
  { id: 'lostKid', at: 'kid', title: '길 잃은 아이', text: '아이 하나가 울먹이며 두리번거립니다. 「할머니가 없어졌어요…」',
    choices: [{ label: '할머니 찾아 주기', task: { kind: 'escort', verb: '모셔 드리기' }, give: 'refElder', say: '「아이고, 고마워라! 내 친구들이랑 꼭 먹으러 갈게.」' }] },
];
