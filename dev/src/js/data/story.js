import { MARKET_NEWS } from './market.js';
// 메인 이야기 — 프로토타입에는 프롤로그와 1장만 넣어요 (기획서 「메인 퀘스트 라인」 탭).
// 게임 안 글: 사실(설명)은 합니다체, 사람 말은 그 사람 말투 그대로. {shop}은 가게 이름으로 바뀌어요.

// 등장인물: char = 아틀라스 캐릭터 그림 번호 (0은 주인공). 오 사장님(18)은 손님으로 오지 않아요 (data/customers.js PEOPLE에서 뺐어요)
export const CAST = {
  me: { name: '나', char: 0 },
  meThink: { name: '나 · 속마음', char: 0, think: true },
  oh: { name: '오 사장님', char: 18 },
  ohPhone: { name: '오 사장님 · 전화', char: 18 },
  jung: { name: '정 사장 · 식자재', char: 19 },
  park: { name: '박 할머니', char: 13 },
  // 돌발 이벤트 (data/incidents.js)
  kids: { name: '학원 끝난 아이', char: 2 },
  kids2: { name: '학원 끝난 아이들', char: 5 },
  caller: { name: '포장 손님 · 전화', char: 12 },
  blogger: { name: '카메라 든 손님', char: 16 },
  rainy: { name: '비 맞은 손님', char: 12 },
  foreman: { name: '공사장 반장님', char: 4 },
  inspector: { name: '구청 위생과', char: 8 },
  youtuber: { name: '먹방 유튜버', char: 10 },
  // 뒤의 장에서 나와요 (1장까지는 오 사장님이 멘토로 거의 다 이끌어요 — 사람이 한꺼번에 많이 나오지 않게)
  choi: { name: '최 사장 · 옆 세탁소', char: 7 },
  miso: { name: '미소 사장 · 옆 가게', char: 9 },
};

// 장: 준비 화면 이야기 카드 머리에 보여요
export const CHAPTERS = [
  { name: '프롤로그', sub: '알바 마지막 사흘' },
  { name: '1장', sub: '개업' },
  { name: '2장', sub: '첫 단골 (준비 중)' },
];

// 퀘스트
//  kind: 무엇을 세나 (sim/story.js storyNote) — cook(완벽 조리) · paid(계산한 손님 수) · receipt(마감 영수증) · dayEnd(마친 영업일)
//        dayServed(하루 받은 손님, 그날 최고) · note(냉장고 뒤 쪽지) · served(그 메뉴를 내준 수) · cleanDay(재료가 안 떨어진 날)
//        weekly(고정비 내기) · pay(준비 화면에서 돈 내기, cost원) · buyTool(장사 도구 사기) · ahead(미리 만든 음식 내주기)
//  menu: 그 메뉴만 셈 · need: 몇 번 · needs: 이 퀘스트들이 끝나면 저절로 시작 · after: 이 퀘스트들이 끝나야 완료
//  give: 끝나면 — scenes(대화 장면 차례로) · menuNext(다음 날부터 여는 메뉴) · menuNow(바로 여는 메뉴)
export const QUESTS = {
  p_stir: { who: 'oh', title: '떡볶이는 팔로 저어', goal: '떡볶이 완벽 조리', kind: 'cook', menu: 'tteok', need: 3 },
  p_serve: { who: 'oh', title: '손님은 끝까지', goal: '계산까지 마친 손님', kind: 'paid', need: 5 },
  p_book: { who: 'oh', title: '오늘 장부', goal: '마감 영수증 보기', kind: 'receipt', need: 1 },
  p_ahead: { who: 'oh', title: '손이 놀 때', goal: '미리 만든 음식 내주기', kind: 'ahead', need: 2 }, // 사흘 안에 못 해도 인수는 돼요 (1장에서도 셀 수 있어요)
  p_keys: { who: 'oh', title: '사흘만 맡아 봐', goal: '영업 사흘 마치기', kind: 'dayEnd', need: 3, after: ['p_stir', 'p_serve', 'p_book'], wait: '오 사장님의 다른 부탁을 마저 들어 보세요', give: { scenes: ['handover', 'paper0', 'ch1'] } },
  c1_first: { who: 'oh', title: '첫 손님들', goal: '하루에 손님 10명 받기', kind: 'dayServed', need: 10, give: { scenes: ['plant'] } },
  c1_note: { who: 'park', title: '김밥도 있었잖아', goal: '냉장고 뒤 쪽지 찾기', kind: 'note', need: 1, give: { scenes: ['note', 'tools'], menuNext: 'kimbap' } },
  c1_kimbap: { who: 'park', title: '그 시절 그 김밥', goal: '김밥 내주기', kind: 'served', menu: 'kimbap', need: 3, give: { scenes: ['choi'] } },
  c1_tools: { who: 'oh', title: '도구를 들여라', goal: '장사 도구 하나 사기', kind: 'buyTool', need: 1 },
  c1_fryer: { who: 'oh', title: '튀김기 살리기', goal: '수리비 3만 원 내기', kind: 'pay', cost: 30000, need: 1, give: { scenes: ['fryer'], menuNow: 'twigim' } },
  c1_stock: { who: 'oh', title: '내일 장 보기', goal: '재료가 떨어지지 않은 날', kind: 'cleanDay', need: 1 },
  c1_week: { who: 'me', title: '첫 주 버티기', goal: '첫 주 고정비 내기 (임대료·대출·공과금)', kind: 'weekly', need: 1, needs: ['c1_first', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock'], give: { scenes: ['paper1', 'ch2soon'] } },
};

// 대화 장면
//  lines: [누가(CAST, null이면 설명 글), 말, 가리킬 곳(준비 화면 data-guide — price·order·quest·open)]
//  when: 'now' = 영업 중에도 바로 (가게를 잠깐 멈춰요) · 없으면 다음 준비 화면에서
//  paper: 골목 신문 한 장 · ask: 'shop' = 가게 이름 짓기 · cut: 먼저 보여 줄 연출 (data/cutscenes.js)
//  startFirst: 장면을 열 때 start를 먼저 · 끝나면 — start(퀘스트 시작) · title(칭호) · ch(장) · decor(가게 장식)
//  money: 'start' = 내 돈으로 새로 시작 (잔고·대출을 처음 값으로) · opens: 'tools' = 준비 화면에 장사 도구 칸
//  alt: 조건에 따라 바꿔 보여 주는 장면 (sim/story.js pickScene)
export const SCENES = {
  intro: {
    cut: 'opening', // 2년 전 낮 → 지금 밤, 가게 앞 연출 (data/cutscenes.js). 끝나면 준비 화면에서 오 사장님이 하나씩 짚어 줘요
    startFirst: true, // 줄을 보기 전에 퀘스트를 먼저 시작해요 (할 일 카드를 가리키려고)
    lines: [
      ['oh', '장사 준비는 전날 밤에 해. 할 건 딱 두 가지야.'],
      ['oh', '하나, 가격. 떡볶이 한 그릇 4,000원. 비싸면 손님이 돌아가고, 싸면 남는 게 없다.', 'price'],
      ['oh', '둘, 재료. 오늘 밤에 시키면 내일 아침에 온다. 모자라면 손님을 놓치고, 남으면 버리게 돼.', 'order'],
      ['oh', '내 부탁은 하나다. 사흘만 이 가게를 맡아 봐. 나머진 가게에서 하나씩 시킬게.', 'quest'],
      ['oh', '다 됐으면 「가게 열기」. 아침 아홉 시에 문 연다. 이틀은 내가 옆에 서 있을 테니 걱정 마.', 'open'],
    ],
    start: ['p_keys'], title: '알바생',
  },
  // ── 오 사장님 가게 길잡이 (data/tutorial.js) — 'tip' 줄은 장사 요령 카드: ['tip', 글, 가리킬 곳, 그림(아이콘 이름 · 여럿이면 배열)]
  tut_hi: {
    when: 'now',
    lines: [
      ['oh', '자, 문 열었다. 오늘은 내가 여기 서서 볼 테니까 겁먹지 마.'],
      ['oh', '손님 오면 하나씩 알려 줄게. 시키는 대로만 해 봐.'],
    ],
  },
  tut_cooked: {
    when: 'now',
    lines: [
      ['tip', '바늘이 가운데 왔을 때 누르면 「완벽」입니다. 완벽하게 만든 음식을 먹은 손님은 별점을 후하게 주고, 가끔 팁도 줍니다.', null, ['tteok', 'face_love']],
      ['oh', '떡볶이는 팔로 젓는 거다. 오늘내일 완벽하게 세 번 만들어 봐.'],
    ],
    start: ['p_stir'],
  },
  tut_paid: {
    when: 'now',
    lines: [
      ['tip', '계산까지 마쳐야 돈이 들어옵니다. 계산 줄에서 오래 기다린 손님은 기분이 나빠져 별점을 낮게 줍니다.', null, ['register', 'face_angry']],
      ['oh', '그래, 그게 장사 한 바퀴다. 주문 받고, 만들고, 갖다주고, 계산하고.'],
      ['oh', '오늘은 이렇게 다섯 명만 끝까지 받아 봐.'],
    ],
    start: ['p_serve'],
  },
  tut_close: {
    when: 'now',
    lines: [
      ['oh', '마감이다. 남은 손님까지 다 받으면 오늘 장부가 나온다.'],
      ['oh', '장부는 끝까지 봐. 오늘 얼마 남았는지 모르고 장사하면 망한다.'],
    ],
    start: ['p_book'],
  },
  tut_d2: {
    when: 'now',
    lines: [
      ['oh', '어제 잘했다. 오늘은 점심때 손님이 몰릴 거다.'],
      ['oh', '그러니까 손이 놀 때 미리 만들어 둬. 주문 들어오면 바로 내주게.'],
    ],
    start: ['p_ahead'],
  },
  tut_ahead: {
    when: 'now',
    lines: [
      ['tip', '미리 만든 음식은 손에 들고 있다가 주문이 들어오면 바로 내줄 수 있습니다. 손에 들 수 있는 만큼만 만들 수 있고, 마감까지 못 팔면 버립니다.', null, ['tteok', 'tteok']],
      ['oh', '너무 많이 만들면 다 버린다. 손님 보면서 해.'],
    ],
  },
  tut_wait: {
    when: 'now',
    lines: [
      ['oh', '저 손님 봐라. 머리 위 막대가 줄고 있지?'],
      ['tip', '손님 머리 위 막대는 기다릴 수 있는 시간입니다. 막대가 다 줄면 손님이 화를 내며 그냥 나갑니다.', null, ['face_angry']],
      ['oh', '바쁠 땐 오래 기다린 손님부터 챙겨.'],
    ],
  },
  tut_d3: {
    when: 'now',
    lines: [
      ['ohPhone', '나다. 오늘은 허리 때문에 병원 가는 날이라 못 나간다.'],
      ['ohPhone', '사흘째니까 혼자 해 봐. 내가 가르친 대로만 하면 된다.'],
    ],
  },
  handover: {
    cut: 'handover', // 사흘째 밤, 가게 앞: 고민 → 결심 → 열쇠 (data/cutscenes.js). 끝나면 가게 이름 짓기
    lines: [],
    ask: 'shop',
    money: 'start', // 오 사장님 가게 돈은 사장님이 정리해 가고, 내 돈(+창업 대출)으로 새로 시작해요
  },
  paper0: {
    paper: {
      no: 1, head: '{shop}, 새 사장 맞았다', sub: '30년 오가네 분식, 알바생에게 열쇠 넘겨',
      body: '골목 분식집 「오가네 분식」이 문을 닫는 대신 2년 차 알바생에게 가게를 넘겼다. 오 사장은 「맛은 몰라도 성실함은 내가 보증한다」고 말했다.',
    },
    title: '사장 지망생', ch: 1,
  },
  ch1: {
    lines: [
      [null, '혼자 여는 첫날 아침. 문 앞에 낯익은 얼굴이 서 있습니다.'],
      ['park', '어머, 주인 바뀌었다며? 오 사장한테 다 들었어.'],
      ['park', '옛날엔 여기 김밥도 팔았잖아. 그게 참 맛있었는데.'],
      ['me', '김밥이요? 레시피를 모르는데…'],
      ['park', '오 사장 그 양반, 중요한 건 다 냉장고 뒤에 붙여 놨었어.'],
      [null, '전화가 울립니다.'],
      ['ohPhone', '첫날이다. 긴장되지? 오늘 재료는 내가 마지막으로 거래처에 시켜 놨다. 모자라면 손님 그냥 돌아가니까 잘 봐 둬.'],
      ['ohPhone', '당분간은 내가 전화로 봐 줄게. 할 일은 준비 화면에 적어 둬라.', 'quest'],
    ],
    start: ['c1_first', 'c1_note', 'c1_stock'],
  },
  note: {
    when: 'now',
    lines: [
      [null, '냉장고 뒤에 기름때 묻은 쪽지가 붙어 있습니다.'],
      [null, '「김빱 — 밥은 식초 쪼금, 김은 반짝이는 쪽이 밖으로. 말 때는 빨리빨리!」'],
      ['me', '맞춤법은 여전하시네…'],
      [null, '내일부터 김밥을 팝니다. 김밥 한 줄에는 쌀·김·계란·당근이 하나씩 들어갑니다.'],
    ],
    start: ['c1_kimbap'],
  },
  tools: {
    lines: [
      ['ohPhone', '내일부터 김밥도 한다며? 할머니가 벌써 동네방네 소문냈다.'],
      ['ohPhone', '근데 메뉴가 늘면 손이 모자라. 손 두 개로 다 하려다 망한 가게 여럿 봤다.'],
      ['ohPhone', '도구를 들여. 쟁반 하나면 한 번에 셋 나르고, 타이머 하나면 덜 태운다.', 'tools'],
      ['ohPhone', '보온 통 있으면 새벽에 떡볶이를 미리 끓여 둘 수 있고. 점심 장사가 편해진다.', 'tools'],
      ['meThink', '사장님 말투가 꼭 장사 선생님 같다. …아니, 원래 선생님이었지.'],
    ],
    opens: 'tools', start: ['c1_tools'], startFirst: true, // 도구 칸을 먼저 열어 가리켜요
  },
  plant: {
    lines: [
      ['ohPhone', '들었다. 하루에 손님 열 명 넘게 받았다며.'],
      ['ohPhone', '개업 축하 화분 하나 보냈다. 물 주는 거 잊지 마라. 그거 죽으면 가게도 시든다.'],
      [null, '가게에 화분이 생겼습니다.'],
    ],
    decor: 'plant',
  },
  choi: { // (옛 세이브와 이름을 맞추려고 장면 이름은 그대로) 튀김기 수리 — 오 사장님 전화
    lines: [
      ['ohPhone', '할머니가 김밥 맛있다더라. 잘했다.'],
      ['ohPhone', '이제 튀김이다. 그 튀김기, 내가 고쳐 놓고 나왔어야 했는데.'],
      ['ohPhone', '수리 기사 불러 놨다. 수리비 3만 원은 니가 내라. 이제 니 가게니까.', 'quest'],
    ],
    start: ['c1_fryer'],
  },
  fryer: {
    when: 'now',
    lines: [
      [null, '수리 기사가 튀김기를 고쳤습니다. 오늘부터 야채튀김을 팝니다. 튀김가루·양파·당근·식용유가 하나씩 들어갑니다.'],
      ['ohPhone', '튀김은 한 번 지나가면 끝이다. 노릇할 때 바로 건져. 머뭇거리면 탄다.'],
    ],
  },
  paper1: {
    at: 'dawn', // 마을에서는 아침 신문 (새벽에)
    alt: { cond: 'rating35', else: 'paper1b' },
    paper: {
      no: 2, head: '{shop}, 주인 바뀌었다… 맛은 그대로!', sub: '알바생 출신 새 사장의 첫 주',
      body: '김밥과 튀김이 다시 메뉴판에 올랐다. 단골 박 할머니는 「김밥이 돌아왔다」며 반겼다. 전 사장 오 씨는 「전화는 하루 세 번만 받겠다」고 전했다.',
    },
    title: '초보 사장', ch: 2,
  },
  paper1b: {
    at: 'dawn',
    paper: {
      no: 2, head: '{shop}, 주인 바뀌었다… 맛은 글쎄?', sub: '알바생 출신 새 사장의 첫 주',
      body: '김밥과 튀김이 다시 메뉴판에 올랐지만 「아직은 오 사장 맛이 그립다」는 말도 나온다. 새 사장은 「다음 주는 다르다」고 짧게 답했다.',
    },
    title: '초보 사장', ch: 2,
  },
  // 마을 첫 밤 (sim/town.js townEnterNight)
  town1: {
    lines: [
      ['ohPhone', '장사 끝났냐? 이제부터 밤이랑 새벽도 니 시간이다.'],
      ['ohPhone', '밤에는 가게 청소하고, 이웃들이랑 얘기도 좀 하고. 그래야 손님도 소개해 주고 그런다.'],
      ['ohPhone', '재료는 이제 니가 직접 사. 새벽에 골목 끝 정 사장네 식자재 가게 가 봐라. 내 이름 대면 잘해 줄 거다.'],
      ['ohPhone', '그리고 가게 안 칠판. 많이 판 메뉴는 손에 익는다. 손에 익으면 거기서 레시피를 손봐. 손님도 알아보고 값을 더 쳐 준다.'],
      [null, '밤부터 새벽까지 일곱 가지 일을 할 수 있습니다. 밤 네 칸을 다 쓰면 새벽 5시가 되고 정 사장 식자재가 문을 엽니다.'],
      [null, '일곱 칸을 넘기면 피로가 쌓여 걸음이 느려지고, 칸을 남기고 가게를 열면 피로가 풀립니다.'],
      [null, '화면을 누른 채로 끌면 조이스틱이 나와 그쪽으로 걸어갑니다. 가게 문 앞에서 위로 밀거나 사람에게 다가가면 할 수 있는 일이 나옵니다.'],
      ['ohPhone', '할 일 없으면 일찍 들어가서 자고. 새벽에 장 보고, 가게 가서 문 열고.'],
    ],
  },
  // 마을 이전 세이브를 새벽부터 이어 갈 때 (save/migrations.js)
  town1d: {
    lines: [
      ['ohPhone', '일어났냐? 오늘부터 거래처 주문은 끊었다. 재료는 니가 직접 사.'],
      ['ohPhone', '새벽에 골목 끝 정 사장네 식자재 가게 가 봐라. 내 이름 대면 잘해 줄 거다.'],
      ['ohPhone', '그리고 가게 안 칠판. 많이 판 메뉴는 손에 익는다. 손에 익으면 거기서 레시피를 손봐. 손님도 알아보고 값을 더 쳐 준다.'],
      ['ohPhone', '장사 끝나면 밤에는 가게 청소하고, 이웃들이랑 얘기도 좀 하고. 그래야 손님도 소개해 준다.'],
      [null, '밤부터 새벽까지 일곱 가지 일을 할 수 있습니다. 밤 네 칸을 다 쓰면 새벽 5시가 되고 정 사장 식자재가 문을 엽니다.'],
      [null, '일곱 칸을 넘기면 피로가 쌓여 걸음이 느려지고, 칸을 남기고 가게를 열면 피로가 풀립니다.'],
      [null, '화면을 누른 채로 끌면 조이스틱이 나와 그쪽으로 걸어갑니다. 가게 문 앞에서 위로 밀거나 사람에게 다가가면 할 수 있는 일이 나옵니다.'],
    ],
  },
  // 2장 첫 밤: 미소 꽃집이 「미소 가구·인테리어」로 (sim/town.js townEnterNight)
  furn1: {
    lines: [
      [null, '옆집 미소 꽃집 간판이 바뀌었습니다. 「미소 가구·인테리어」.'],
      ['miso', '사장님! 저 가게 바꿨어요. 꽃만으로는 월세 내기가 빠듯해서요.'],
      ['miso', '이제 벽지, 바닥, 식탁 같은 것도 해요. 가게 분위기가 좋으면 손님이 더 오래 기억하거든요.'],
      ['miso', '첫 손님은 사장님이었으면 좋겠어요. 밤에 한번 들러요!'],
      [null, '미소 가구에서 가게를 꾸밀 수 있습니다. 꾸밀수록 분위기가 올라 손님 만족이 오르고, 같은 테마를 네 가지 넘게 맞추면 그 테마를 좋아하는 손님이 더 반깁니다.'],
    ],
  },
  ch2soon: {
    lines: [
      ['ohPhone', '신문 봤다. 첫 주 버틴 거면 반은 한 거다.'],
      ['ohPhone', '근데 단골이 생겨야 진짜 장사야. 그건 다음에 얘기하자.'],
      [null, '프로토타입은 여기까지입니다. 2장 「첫 단골」은 준비 중이며, 영업은 계속할 수 있습니다.'],
    ],
  },
};

// 새 게임의 이야기 상태 (세이브 칸 story)
//  ch 장 · title 칭호 · active 진행 중 퀘스트 · done 끝난 퀘스트 · prog 진행도 · queue 보여 줄 장면
//  menus 연 메뉴 · soon 다음 날 열 메뉴 · fresh 오늘 처음 연 메뉴(「새 메뉴」 표시) · decor 장식 · today 오늘 끝낸 퀘스트
//  toolsOpen 장사 도구 칸이 열렸는지 · tools 산 도구 (data/tools.js) · tut 끝낸 가게 길잡이 차례 (data/tutorial.js)
export function newStory() {
  return { ch: 0, title: '', active: [], done: [], prog: {}, queue: ['intro'], menus: ['tteok'], soon: [], fresh: [], decor: [], today: [], toolsOpen: false, tools: [], tut: [] };
}

// 재료 시세 소식 (data/market.js): 골목 신문 「시세 소식」 한 장씩 — 밤사이 소식이 나면 sim/market.js가 줄에 넣어요
for (const id in MARKET_NEWS) {
  const n = MARKET_NEWS[id];
  SCENES['mk_' + id] = { at: 'dawn', paper: { tag: '시세 소식', head: n.head, sub: n.sub, body: n.body, market: id } };
}
