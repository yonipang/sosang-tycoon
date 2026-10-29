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
// 갈 수 있는 동네 (v0.82: 아파트 단지) — 버스 정류장에서 하루 한 곳
//  when·clock 위 막대 시각 · bus 정류장 버튼 · sub 그 동네에 많은 사람 · intro 처음 내렸을 때 한 줄
export const EX_AREAS = {
  market: { name: '재래시장', when: '새벽', clock: '05:30', bus: '새벽 첫차로 재래시장 가기', sub: '상인 · 어르신 · 갓 나온 재료', intro: '새벽 시장이 막 문을 엽니다.' },
  apt: { name: '아파트 단지', when: '아침', clock: '07:30', bus: '아침 버스로 아파트 단지 가기', sub: '학생 · 직장인 · 집이 많은 동네', intro: '출근하고 등교하는 사람들로 단지가 북적입니다.' },
  office: { ch: 3, name: '오피스 거리', when: '출근길', clock: '08:30', bus: '출근 버스로 오피스 거리 가기', sub: '직장인 · 점심 장사 · 비싼 임대료', intro: '출근하는 직장인들이 빌딩 안으로 바쁘게 들어갑니다.' }, // v0.84 사용자 요청 · ch: 3장부터 열려요 (v0.87 사용자 결정)
};
export const EX_AREA_IDS = Object.keys(EX_AREAS);

// 재래시장 지도 (16px 칸): 위 가게 줄(0~5줄) · 길 A(6~11줄, 6줄은 가게 앞 진열) · 아래 가게 줄(12~17줄, 가게 사이 1칸 골목으로 지나가요) · 길 B(18~23줄)
//  가게 한 자리 = 너비 80px(5칸) + 사이 16px. 왼쪽 2칸 · 오른쪽 2칸은 위아래로 이어진 길. 버스 정류장은 왼쪽 아래
export const MK = { W: 45, H: 24, SLOTS: 7, X0: 32, STEP: 96, BOT1: 88, BOT2: 280, START: [7, 22], VACANT: 10 }; // VACANT: 임대 매물 자리 (아래 줄 넷째 칸, v0.84 — data/move.js) // 정류장 오른쪽 (v0.81: 정류장 뒤에 가려 안 보였어요)

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
// 아파트 단지 지도 (16px 칸, v0.82): 0줄 울타리 · 1~11줄 아파트 4동(사이 잔디) · 12~13줄 현관 앞 길 · 14~15줄 화단 · 16~17줄 큰길
//  18~25줄: 왼쪽 주차장 · 가운데 놀이터 · 오른쪽 상가 3칸 · 26~29줄 단지 앞길(경비실 · 차단기 · 버스 정류장)
export const AP = { W: 44, H: 30, TOWERS: [2, 13, 24, 35], TOWER_BOT: 192, SHOP_X: [384, 464, 544, 624], SHOP_BOT: 400, VACANT: 0 }; // 상가 4칸 붙어 있어요 · VACANT 임대 매물 칸 (v0.84)
// 상가 가게 (간판 mk_s_ · 건물은 시장과 같은 mk_b) — 편의점은 늘, 나머지 둘은 그날 씨앗으로
export const APT_SHOPS = {
  cvs: { name: '편의점', owner: 16 },
  tkd: { name: '태권도', owner: 3 },
  piano: { name: '피아노 학원', owner: 9 },
  math: { name: '수학학원', owner: 7 },
  hair: { name: '미용실', owner: 17 },
  estate: { name: '부동산', owner: 19 },
};
// 단지 사람들 (캐릭터 번호): 경비 아저씨 · 택배 기사 · 부녀회장 · 등교 학생 둘 · 분리수거 아주머니 · 장 본 할머니 · 놀이터 엄마
// 오피스 거리 지도 (16px 칸, v0.84): 1~11줄 빌딩 4채(사이 광장) · 12~14줄 넓은 보도 · 15~18줄 찻길(횡단보도 둘) · 19~21줄 보도(노점·쉼터) · 22~27줄 1층 가게 7칸 · 28~30줄 보도·정류장
export const OF = { W: 44, H: 31, TOWERS: [2, 13, 24, 35], NAMES: ['한빛타워', '누리빌딩', '세종센터', '미래타워'], TOWER_BOT: 192, ROAD: [15, 18], CROSS: [[18, 21], [34, 37]], X0: 32, STEP: 96, SLOTS: 7, SHOP_BOT: 448, VACANT: 4 };
// 1층 가게 (간판 mk_s_ · 건물은 시장과 같은 mk_b) — 날마다 자리 순서가 바뀌어요 (임대 매물 자리는 그대로)
export const OFFICE_SHOPS = {
  salad: { name: '샐러드', owner: 5 },
  bunsik: { name: '분식', owner: 14 },
  cafe: { name: '카페', owner: 9 },
  dosirak: { name: '도시락', owner: 3 },
  print: { name: '인쇄', owner: 12 },
  cvs: { name: '편의점', owner: 16 },
};
// 거리 사람들 (캐릭터 번호): 로비 안내 · 신입 사원 · 팀장님 · 점심 줄 셋 · 배달 기사 · 토스트 노점
export const OF_CHARS = { guard: 20, intern: 4, lead: 8, line: [2, 7, 19], courier: 6, cart: 15 };
export const AP_CHARS = { guard: 20, courier: 6, chair: 5, student: 4, student2: 16, recycle: 10, shopper: 13, mom: 1 };
export const EX_CLOSED = 3;      // 날마다 문 닫은 가게 수 (14자리 중)
export const EX_CHARS = { cart: 15, stall: 14, kid: 15, grandma: 13 }; // 노점 아주머니 · 파라솔 할머니 · 길 잃은 아이 · 아이 할머니 (캐릭터 번호)
export const EX_CARRY = 2;       // 짐을 들고 걸으면 체력이 이만큼 배로 들어요
// 저장 칸 G.explore (save/state.js): last 마지막으로 다녀온 날 · runs 횟수 · memos 동네 메모 id · flyer 전단 효과
export const newExplore = () => ({ last: 0, runs: 0, memos: [], flyer: null, seen: [] }); // seen: 살펴본 임대 매물 동네 (v0.84 — data/move.js)

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
  // 아파트 단지 (v0.82)
  carrot: { name: '텃밭 당근', icon: 'ing_carrot', kind: 'ing', ing: 'carrot', n: 10, text: '당근 10개 → 냉장고' },
  refStudent: { name: '학생들의 약속', icon: 'face_happy', kind: 'ref', type: 'student', text: '다음 영업에 학생 손님 2명' },
  refApt: { name: '단지 어르신들의 약속', icon: 'face_happy', kind: 'ref', type: 'elder', text: '다음 영업에 어르신 손님 2명' },
  refCourier: { name: '택배 기사님들의 약속', icon: 'face_happy', kind: 'ref', type: 'worker', text: '다음 영업에 직장인 손님 2명' },
  flyerStudent: { name: '부녀회 단톡방 소개', icon: 'board', kind: 'flyer', type: 'student', mul: 1.3, days: 3, text: '3일 동안 학생 손님 ↑' },
  flyerWorker: { name: '단지 게시판 전단 자리', icon: 'board', kind: 'flyer', type: 'worker', mul: 1.3, days: 3, text: '3일 동안 직장인 손님 ↑' },
  // 오피스 거리 (v0.84)
  refOffice: { name: '신입 사원들의 약속', icon: 'face_happy', kind: 'ref', type: 'worker', text: '다음 영업에 직장인 손님 2명' },
  refTeam: { name: '팀 점심 약속', icon: 'face_happy', kind: 'ref', type: 'worker', text: '다음 영업에 직장인 손님 2명' },
  flyerOffice: { name: '빌딩 로비 전단 자리', icon: 'board', kind: 'flyer', type: 'worker', mul: 1.35, days: 3, text: '3일 동안 직장인 손님 ↑' },
};

// 동네 메모: 눈으로 본 것 한 줄 — 수첩에 쌓이고, 3장 상권 지도(나이스비즈맵)가 열리면 숫자로 다시 나와요
export const MEMOS = {
  mkDawn: '새벽 시장은 5시부터 붐빈다. 상인과 어르신이 많다',
  mkElder: '시장을 오가는 손님은 어르신이 가장 많다',
  mkMeal: '상인들은 새벽에 국밥으로 아침을 먹는다',
  mkPrice: '시장 사람들은 값에 밝다. 100원 차이도 따진다',
  mkWeekend: '주말이면 시장에 사람이 두 배로 는다고 한다',
  mkDeliver: '새벽 배송 기사들이 시장 앞에서 잠깐 쉬어 간다',
  // 아파트 단지: 주거 상권 (v0.82)
  apMorning: '아침 7~8시, 학생과 직장인이 한꺼번에 단지를 빠져나간다',
  apAfter: '학원·도장이 끝나는 오후 4~7시엔 아이들이 몰려나온다',
  apHouse: '한 동에 100가구, 단지 전체 400가구쯤. 집이 많은 동네는 손님이 날마다 꾸준하다',
  apDeliver: '단지엔 택배·배달이 하루 종일 드나든다. 포장·배달로 먹는 집이 많다',
  apPrice: '편의점 삼각김밥 1,500원 · 컵떡볶이 2,500원. 단지 사람들은 값보다 가까운 곳을 고른다',
  apMoms: '부녀회 단톡방 한 마디가 단지 소문이 된다. 단골 한 명이 손님을 데려온다',
  apRent: '단지 상가 1층은 골목보다 임대료가 비싸다. 대신 날마다 같은 사람들이 지나간다',
  // 오피스 거리: 오피스 상권 (v0.84)
  ofLunch: '점심 12시~1시, 한 시간에 하루 손님 절반이 몰린다',
  ofWeekend: '주말엔 거리가 텅 빈다. 평일 장사로 버텨야 한다',
  ofQuick: '직장인은 빨리 나오는 걸 고른다. 포장해 가는 사람도 많다',
  ofPrice: '오피스 거리 김밥 한 줄 4,500원. 비싸도 빨리 나오면 산다',
  ofCafe: '점심 뒤엔 카페 줄이 점심 줄만큼 길다',
  ofMorning: '출근길 8~9시엔 걸으면서 먹는 아침이 팔린다',
  ofRent: '대로변 1층은 임대료가 가장 비싸다. 골목 안쪽은 훨씬 싸다',
};

// 사건: at 'shop:종류'(그 가게가 열린 날만 · 사장님) · 'cart'(길 가운데 노점) · 'stall'(할머니 노점 파라솔) · 'board'(시장 게시판) · 'kid'(길 잃은 아이)
//  choices: { label, cost 체력, pay 돈, give 가방에 담을 것, heal 체력 회복, bond [이웃, 점수], say 결과 한 줄 } — 마지막은 늘 「지나치기」
//   실제로 돕기 (v0.81 사용자 결정 「심부름 + 손기술」):
//   task 심부름 — deliver: 짐(item)을 들고 to 목록 중 열린 곳(멀리 있는 곳 먼저)까지 걸어가 「전해 주기」(들고 걸으면 체력 EX_CARRY배)
//                 escort: 아이가 따라와요. 시장 어딘가에 나타난 할머니를 찾아 「모셔다드리기」(근처 가게 이름이 힌트)
//   mini 손기술 — timing: 움직이는 바늘이 초록 칸에 올 때 누르기(rounds번 중 need번) · mash: 시간 안에 빠르게 눌러 막대 채우기(taps번)
//   fail: 손기술을 놓쳤을 때 한 줄 (체력은 들고 가방엔 안 담겨요)
//  area: 'market'(없으면) · 'apt' · 'any'(어느 동네든 — 길 잃은 아이)
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
  { id: 'lostKid', at: 'kid', area: 'any', title: '길 잃은 아이', text: '아이 하나가 울먹이며 두리번거립니다. 「할머니가 없어졌어요…」',
    choices: [{ label: '할머니 찾아 주기', task: { kind: 'escort', verb: '모셔 드리기' }, give: 'refElder', say: '「아이고, 고마워라! 내 친구들이랑 꼭 먹으러 갈게.」' }] },
  // ── 아파트 단지 (v0.82): area 'apt' ── at 'guard'·'courier'·'chair'·'students'·'recycle'·'shopper'·'bench'(벤치) · 'shop:종류'(상가) · 'board'(단지 게시판)
  { id: 'apGuard', area: 'apt', at: 'guard', title: '경비 아저씨', text: '경비실 앞에 택배 상자가 산더미입니다. 「아이고, 이걸 언제 다 올려 보내나…」',
    choices: [{ label: '택배 상자 배달하기', task: { kind: 'deliver', item: '택배 상자', to: ['door'], verb: '전해 주기' }, give: 'refApt', say: '「고마워요! 경로당 어르신들한테 분식집 얘기 해 둘게.」' }], memo: 'apHouse' },
  { id: 'apShopper', area: 'apt', at: 'shopper', title: '장 본 할머니', text: '양손 가득 장바구니를 든 할머니가 숨을 고릅니다. 「아이고, 우리 집이 저 끝 동인데…」',
    choices: [{ label: '장바구니 들어 드리기', task: { kind: 'deliver', item: '장바구니', to: ['door'], verb: '전해 주기' }, give: 'refApt', say: '「착하기도 하지. 친구들 데리고 꼭 갈게.」' }], memo: 'apHouse' },
  { id: 'apCourier', area: 'apt', at: 'courier', title: '택배 기사님', text: '현관 앞에 상자를 내리던 기사님이 땀을 닦습니다. 「오늘 물량이 장난 아니네요.」',
    choices: [{ label: '상자 쌓기 돕기', cost: 8, mini: { kind: 'timing', name: '상자 쌓기', act: '쌓기!', rounds: 3, need: 2, speed: 1.2 }, fail: '「으앗, 와르르! 괜찮아요, 제가 할게요.」', give: 'refCourier', say: '「덕분에 빨리 끝났네요! 기사님들이랑 점심 먹으러 갈게요.」' }], memo: 'apDeliver' },
  { id: 'apRecycle', area: 'apt', at: 'recycle', title: '분리수거 아주머니', text: '분리수거함 앞에 상자와 병이 잔뜩 쌓여 있습니다. 「오늘이 분리수거 날이라…」',
    choices: [{ label: '분리수거 돕기', cost: 8, mini: { kind: 'mash', name: '분리수거', act: '나르기!', taps: 15, time: 5 }, fail: '「어머, 병 깨질라. 괜찮아요, 마음만 받을게요.」', give: 'carrot', say: '「손이 빠르네! 텃밭에서 키운 건데 가져가요.」' }], memo: 'apHouse' },
  { id: 'apStudents', area: 'apt', at: 'students', title: '등교하는 학생들', text: '가방을 멘 학생들이 수다를 떨며 지나갑니다. 「학원 끝나고 뭐 먹지?」',
    choices: [{ label: '가게 이야기 해 주기', cost: 5, give: 'refStudent', say: '「떡볶이요? 오늘 학원 끝나고 가 볼게요!」' }], memo: 'apMorning' },
  { id: 'apChair', area: 'apt', at: 'chair', title: '부녀회장님', text: '벤치에 앉은 부녀회장님이 휴대폰을 들여다봅니다. 「우리 단톡방에 새 가게 소식 올라오면 다들 가 보거든요.」',
    choices: [{ label: '가게 소개 부탁드리기', cost: 4, give: 'flyerStudent', say: '「애들 학원 끝나고 들르기 좋겠네. 올려 줄게요.」' }], memo: 'apMoms' },
  { id: 'apBoard', area: 'apt', at: 'board', title: '단지 게시판', text: '관리사무소 공지 옆에 빈자리가 조금 있습니다. 출근길 사람들이 힐끗 보고 지나갑니다.',
    choices: [{ label: '전단 붙이기', cost: 8, give: 'flyerWorker', say: '출근길에 잘 보이는 자리에 붙였습니다.' }], memo: 'apMorning' },
  { id: 'apBench', area: 'apt', at: 'bench', title: '단지 벤치', text: '나무 그늘 아래 벤치가 비어 있습니다.',
    choices: [{ label: '잠깐 앉아 쉬기', heal: 12, say: '아침 바람이 시원합니다. 다리가 조금 풀렸습니다.' }] },
  { id: 'apCvs', area: 'apt', at: 'shop:cvs', title: '편의점', text: '진열대에 삼각김밥과 컵떡볶이가 줄지어 있습니다. 아침 손님이 줄을 섭니다.',
    choices: [{ label: '커피 한 잔 (1,500원)', pay: 1500, heal: 20, say: '따뜻한 커피에 정신이 듭니다.' }, { label: '값 둘러보기', cost: 3, say: '삼각김밥 1,500원, 컵떡볶이 2,500원. 아침엔 다들 바쁘게 집어 갑니다.' }], memo: 'apPrice' },
  { id: 'apTkd', area: 'apt', at: 'shop:tkd', title: '태권도 관장님', text: '「태권!」 소리가 쩌렁쩌렁합니다. 관장님이 문 앞을 쓸고 있습니다.',
    choices: [{ label: '아이들 간식 이야기', cost: 5, give: 'refStudent', say: '「운동 끝나면 애들이 배고파해요. 분식집 알려 줄게요!」' }], memo: 'apAfter' },
  { id: 'apPiano', area: 'apt', at: 'shop:piano', title: '피아노 학원 원장님', text: '창문 너머로 연습곡이 들립니다. 원장님이 화분에 물을 줍니다.',
    choices: [{ label: '학원 끝나는 시간 묻기', cost: 4, give: 'refStudent', say: '「여섯 시에 끝나요. 애들 보내 볼게요.」' }], memo: 'apAfter' },
  { id: 'apMath', area: 'apt', at: 'shop:math', title: '수학학원 원장님', text: '칠판에 오늘 진도가 빼곡합니다. 「저녁 수업 전에 애들이 꼭 뭘 먹고 와요.」',
    choices: [{ label: '간식 이야기 나누기', cost: 4, give: 'refStudent', say: '「분식집 생겼어요? 쉬는 시간에 보내 볼게요.」' }], memo: 'apAfter' },
  { id: 'apHair', area: 'apt', at: 'shop:hair', title: '미용실 원장님', text: '「어서 와요~」 드라이기 소리 사이로 동네 소식이 오갑니다.',
    choices: [{ label: '동네 이야기 듣기', cost: 5, give: 'noteTteok', say: '「요즘 애들은 매운 거 좋아해요. 떡볶이는 소스가 생명이지!」' }], memo: 'apMoms' },
  { id: 'apEstate', area: 'apt', at: 'shop:estate', title: '부동산 사장님', text: '유리문에 매물 종이가 빼곡합니다. 사장님이 커피를 들고 나옵니다.',
    choices: [{ label: '동네 이야기 듣기', cost: 4, say: '「여기 상가 1층은 비싸요. 그래도 단지 사람들이 매일 지나가니까.」' }], memo: 'apRent' },
  // ── 오피스 거리 (v0.84): area 'office' ── at 'guard'(로비 안내)·'intern'·'lead'·'line'(점심 줄)·'courier'·'bench' · 'cart'(토스트 노점) · 'shop:종류' · 'board'(빌딩 게시판)
  { id: 'ofIntern', area: 'office', at: 'intern', title: '신입 사원', text: '커피 캐리어를 양손에 든 신입 사원이 쩔쩔맵니다. 「선배님들 커피를… 다른 빌딩 회의실로 가져가야 하는데…」',
    choices: [{ label: '커피 같이 날라 주기', task: { kind: 'deliver', item: '커피 캐리어', to: ['door'], verb: '전해 주기' }, give: 'refOffice', say: '「살았어요! 동기들이랑 점심 먹으러 꼭 갈게요.」' }], memo: 'ofCafe' },
  { id: 'ofGuard', area: 'office', at: 'guard', title: '로비 안내 데스크', text: '빌딩 앞 안내 직원이 출입증을 확인하고 있습니다. 「로비에 전단 두는 자리가 있긴 한데요.」',
    choices: [{ label: '전단 놓게 부탁드리기', cost: 4, give: 'flyerOffice', say: '「점심 메뉴 고민하는 분들 많으니까 잘 보일 거예요.」' }], memo: 'ofWeekend' },
  { id: 'ofLead', area: 'office', at: 'lead', title: '팀장님', text: '휴대폰을 보던 팀장님이 한숨을 쉽니다. 「오늘 팀 점심 어디로 가지… 맨날 거기서 거기네.」',
    choices: [{ label: '우리 가게 소개하기', cost: 4, give: 'refTeam', say: '「골목 분식? 애들이 좋아하겠네. 이번 주에 한번 가 볼게요.」' }], memo: 'ofLunch' },
  { id: 'ofLine', area: 'office', at: 'line', title: '점심 줄', text: '아직 아침인데 도시락 가게 앞에 미리 예약하려는 줄이 섰습니다. 「점심엔 줄이 이것보다 세 배예요.」',
    choices: [{ label: '줄 선 사람들과 이야기', cost: 5, say: '「빨리 나오는 데가 최고죠. 점심시간 한 시간밖에 없거든요.」' }], memo: 'ofQuick' },
  { id: 'ofCourier', area: 'office', at: 'courier', title: '배달 기사님', text: '오토바이 짐칸에 상자가 가득합니다. 「점심 전에 이걸 다 돌려야 하는데…」',
    choices: [{ label: '짐 싣기 돕기', cost: 8, mini: { kind: 'mash', name: '짐 싣기', act: '싣기!', taps: 15, time: 5 }, fail: '「괜찮아요, 제가 할게요. 마음만 받을게요.」', give: 'refCourier', say: '「덕분에 빨리 출발하네요! 동료들한테 얘기할게요.」' }], memo: 'ofLunch' },
  { id: 'ofToast', area: 'office', at: 'cart', title: '토스트 노점', text: '출근길 사람들이 토스트를 하나씩 받아 걸어갑니다. 아주머니 손이 바쁩니다.',
    choices: [{ label: '토스트 굽기 돕기', cost: 8, mini: { kind: 'timing', name: '토스트 뒤집기', act: '뒤집기!', rounds: 3, need: 2, speed: 1.2 }, fail: '「어머, 조금 탔네. 괜찮아요.」', give: 'egg', say: '「손이 야무지네! 남는 달걀 가져가요.」' }, { label: '토스트 하나 (2,500원)', pay: 2500, heal: 18, say: '따끈한 토스트에 힘이 납니다.' }], memo: 'ofMorning' },
  { id: 'ofBench', area: 'office', at: 'bench', title: '빌딩 앞 쉼터', text: '나무 그늘 아래 벤치가 비어 있습니다. 출근하는 발소리가 끊이지 않습니다.',
    choices: [{ label: '잠깐 앉아 쉬기', heal: 12, say: '숨을 고르니 다리가 조금 풀렸습니다.' }] },
  { id: 'ofBoard', area: 'office', at: 'board', title: '빌딩 게시판', text: '동호회 모집, 분실물 안내 사이에 빈자리가 있습니다.',
    choices: [{ label: '전단 붙이기', cost: 8, give: 'flyerWorker', say: '점심 메뉴를 찾는 사람들 눈높이에 붙였습니다.' }], memo: 'ofRent' },
  { id: 'ofCafe', area: 'office', at: 'shop:cafe', title: '카페', text: '출근길 커피를 사려는 줄이 문밖까지 섰습니다.',
    choices: [{ label: '아메리카노 (2,000원)', pay: 2000, heal: 20, say: '쌉쌀한 커피에 정신이 번쩍 듭니다.' }], memo: 'ofCafe' },
  { id: 'ofBunsik', area: 'office', at: 'shop:bunsik', title: '분식 사장님', text: '같은 분식집입니다. 사장님이 김밥을 쉬지 않고 맙니다. 「점심엔 손이 열 개라도 모자라요.」',
    choices: [{ label: '값 둘러보기', cost: 3, say: '김밥 한 줄 4,500원, 떡볶이 5,000원. 골목보다 꽤 비쌉니다.' }, { label: '김밥 마는 법 구경하기', cost: 6, give: 'noteKimbap', say: '「속을 적게, 빠르게. 점심엔 속도가 맛이에요.」' }], memo: 'ofPrice' },
  { id: 'ofSalad', area: 'office', at: 'shop:salad', title: '샐러드 사장님', text: '「요즘 직장인들은 가볍게 먹으려고 해요. 그래도 금요일엔 다들 떡볶이 생각나나 봐요.」',
    choices: [{ label: '이야기 나누기', cost: 4, give: 'noteTteok', say: '「매운 걸로 스트레스 푸는 사람 많아요. 맵기 단계 있으면 좋아하더라고요.」' }], memo: 'ofQuick' },
  { id: 'ofDosirak', area: 'office', at: 'shop:dosirak', title: '도시락 사장님', text: '도시락 수십 개를 쌓아 두고 이름표를 붙이고 있습니다. 「회사 단체 주문이에요.」',
    choices: [{ label: '도시락 포장 돕기', cost: 8, mini: { kind: 'mash', name: '포장하기', act: '포장!', taps: 14, time: 5 }, fail: '「아이고, 순서가 섞였네. 괜찮아요.」', give: 'refTeam', say: '「손 빠르네! 단체 주문 넘칠 때 그쪽 얘기 해 줄게요.」' }], memo: 'ofLunch' },
  { id: 'ofPrint', area: 'office', at: 'shop:print', title: '인쇄 가게 사장님', text: '「명함이요? 전단이요? 오늘 찍으면 내일 나와요.」',
    choices: [{ label: '전단 찍기 (10,000원)', pay: 10000, give: 'flyerOffice', say: '「로비 쪽에 몇 장 놓아 줄게요. 이 동네 사람들은 다 지나가니까.」' }], memo: 'ofRent' },
  { id: 'ofCvs', area: 'office', at: 'shop:cvs', title: '편의점', text: '샌드위치와 삼각김밥이 출근길에 순식간에 팔려 나갑니다.',
    choices: [{ label: '값 둘러보기', cost: 3, say: '삼각김밥 1,500원, 샌드위치 3,500원. 아침은 다들 여기서 해결합니다.' }], memo: 'ofMorning' },
];
