// 메인 이야기 — 프로토타입에는 프롤로그와 1장만 넣어요 (기획서 「메인 퀘스트 라인」 탭).
// 게임 안 글: 사실(설명)은 합니다체, 사람 말은 그 사람 말투 그대로. {shop}은 가게 이름으로 바뀌어요.

// 등장인물: char = 아틀라스 캐릭터 그림 번호 (0은 주인공). 오 사장님(18)은 손님으로 오지 않아요 (data/customers.js PEOPLE에서 뺐어요)
export const CAST = {
  me: { name: '나', char: 0 },
  oh: { name: '오 사장님', char: 18 },
  ohPhone: { name: '오 사장님 · 전화', char: 18 },
  park: { name: '박 할머니', char: 13 },
  choi: { name: '최 사장 · 옆 세탁소', char: 7 },
  miso: { name: '미소 사장 · 맞은편 꽃집', char: 9 },
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
//        weekly(주간 정산) · pay(준비 화면에서 돈 내기, cost원)
//  menu: 그 메뉴만 셈 · need: 몇 번 · needs: 이 퀘스트들이 끝나면 저절로 시작 · after: 이 퀘스트들이 끝나야 완료
//  give: 끝나면 — scenes(대화 장면 차례로) · menuNext(다음 날부터 여는 메뉴) · menuNow(바로 여는 메뉴)
export const QUESTS = {
  p_stir: { who: 'oh', title: '떡볶이는 팔로 저어', goal: '떡볶이 완벽 조리', kind: 'cook', menu: 'tteok', need: 3 },
  p_serve: { who: 'oh', title: '손님은 끝까지', goal: '계산까지 마친 손님', kind: 'paid', need: 5 },
  p_book: { who: 'oh', title: '오늘 장부', goal: '마감 영수증 보기', kind: 'receipt', need: 1 },
  p_keys: { who: 'oh', title: '사흘만 맡아 봐', goal: '영업 사흘 마치기', kind: 'dayEnd', need: 3, after: ['p_stir', 'p_serve', 'p_book'], wait: '오 사장님의 다른 부탁을 마저 들어 보세요', give: { scenes: ['handover', 'paper0', 'ch1'] } },
  c1_first: { who: 'me', title: '첫 손님들', goal: '하루에 손님 10명 받기', kind: 'dayServed', need: 10, give: { scenes: ['plant'] } },
  c1_note: { who: 'park', title: '김밥도 있었잖아', goal: '냉장고 뒤 쪽지 찾기', kind: 'note', need: 1, give: { scenes: ['note'], menuNext: 'kimbap' } },
  c1_kimbap: { who: 'park', title: '그 시절 그 김밥', goal: '김밥 내주기', kind: 'served', menu: 'kimbap', need: 3, give: { scenes: ['choi'] } },
  c1_fryer: { who: 'choi', title: '튀김기 살리기', goal: '수리비 3만 원 내기', kind: 'pay', cost: 30000, need: 1, give: { scenes: ['fryer'], menuNow: 'twigim' } },
  c1_stock: { who: 'oh', title: '내일 장 보기', goal: '재료가 떨어지지 않은 날', kind: 'cleanDay', need: 1 },
  c1_week: { who: 'me', title: '첫 주 버티기', goal: '주간 정산 받기', kind: 'weekly', need: 1, needs: ['c1_first', 'c1_kimbap', 'c1_fryer', 'c1_stock'], give: { scenes: ['paper1', 'ch2soon'] } },
};

// 대화 장면
//  lines: [누가(CAST, null이면 설명 글), 말]
//  when: 'now' = 영업 중에도 바로 (가게를 잠깐 멈춰요) · 없으면 다음 준비 화면에서
//  paper: 골목 신문 한 장 · ask: 'shop' = 가게 이름 짓기
//  끝나면 — start(퀘스트 시작) · title(칭호) · ch(장) · decor(가게 장식)
//  alt: 조건에 따라 바꿔 보여 주는 장면 (sim/story.js pickScene)
export const SCENES = {
  intro: {
    lines: [
      ['oh', '어이, 알바. 나 이번 달까지만 한다.'],
      ['me', '네? 가게 접으세요?'],
      ['oh', '허리가 영 말을 안 들어. 30년 했으면 많이 했지.'],
      ['oh', '그래서 말인데… 사흘만 니가 사장이다 생각하고 가게 봐 봐.'],
      ['oh', '잘하면, 이 가게 니가 해볼래?'],
      [null, '사흘 동안 오 사장님의 부탁을 들어 보세요. 할 일은 준비 화면과 영업 중 위 막대에 보입니다.'],
    ],
    start: ['p_stir', 'p_serve', 'p_book', 'p_keys'], title: '알바생',
  },
  handover: {
    lines: [
      ['oh', '사흘 동안 수고했다.'],
      ['oh', '솔직히 반은 망칠 줄 알았는데… 손님들이 또 오겠다더라.'],
      [null, '오 사장님이 가게 열쇠와 쪽지 한 장을 내밉니다.'],
      ['oh', '권리금? 됐다. 대신 간판은 니가 새로 걸어.'],
      ['oh', '그리고 이건 비법이다. 아무한테도 보여 주지 마라.'],
      [null, '쪽지에는 한 줄이 적혀 있습니다. 「떡뽁이는 사랑으로 졸여라」'],
      ['me', '…떡뽁이?'],
    ],
    ask: 'shop',
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
      ['park', '어머, 주인 바뀌었다며?'],
      ['park', '옛날엔 여기 김밥도 팔았잖아. 그게 참 맛있었는데.'],
      ['me', '김밥이요? 레시피를 모르는데…'],
      ['park', '오 사장 그 양반, 중요한 건 다 냉장고 뒤에 붙여 놨었어.'],
      ['ohPhone', '그리고 재료는 밤마다 시켜라. 모자라면 손님 그냥 돌아간다.'],
      [null, '1장 「개업」이 시작됩니다. 할 일을 확인해 보세요.'],
    ],
    start: ['c1_first', 'c1_note', 'c1_stock'],
  },
  note: {
    when: 'now',
    lines: [
      [null, '냉장고 뒤에 기름때 묻은 쪽지가 붙어 있습니다.'],
      [null, '「김빱 — 밥은 식초 쪼금, 김은 반짝이는 쪽이 밖으로. 말 때는 빨리빨리!」'],
      ['me', '맞춤법은 여전하시네…'],
      [null, '내일부터 김밥을 팝니다. 준비 화면에서 김밥 재료를 주문해 보세요.'],
    ],
    start: ['c1_kimbap'],
  },
  plant: {
    lines: [
      ['miso', '안녕하세요, 맞은편 꽃집이에요! 어제 손님 많던데요?'],
      ['miso', '개업 축하 화분이에요. 시들면 저한테 오세요. 유료로 살려 드려요.'],
      [null, '가게에 화분이 생겼습니다.'],
    ],
    decor: 'plant',
  },
  choi: {
    lines: [
      ['choi', '옆 세탁소요. 김밥 냄새가 우리 가게까지 납디다.'],
      ['choi', '근데 저 튀김기, 오 사장 때부터 고장 난 거 알죠?'],
      ['choi', '부품값 3만 원만 주면 내가 고쳐 주지. 손재주 하나는 동네 최고요.'],
    ],
    start: ['c1_fryer'],
  },
  fryer: {
    when: 'now',
    lines: [
      ['choi', '(뚝딱뚝딱) …됐소! 기름 온도 맞춰 놨으니 노릇할 때 건져요.'],
      [null, '튀김기를 고쳤습니다. 오늘부터 튀김을 팝니다.'],
    ],
  },
  paper1: {
    alt: { cond: 'rating35', else: 'paper1b' },
    paper: {
      no: 2, head: '{shop}, 주인 바뀌었다… 맛은 그대로!', sub: '알바생 출신 새 사장의 첫 주',
      body: '김밥과 튀김이 다시 메뉴판에 올랐다. 단골 박 할머니는 「김밥이 돌아왔다」며 반겼다. 맞은편 꽃집 사장은 「화분이 잘 크고 있다」고 전했다.',
    },
    title: '초보 사장', ch: 2,
  },
  paper1b: {
    paper: {
      no: 2, head: '{shop}, 주인 바뀌었다… 맛은 글쎄?', sub: '알바생 출신 새 사장의 첫 주',
      body: '김밥과 튀김이 다시 메뉴판에 올랐지만 「아직은 오 사장 맛이 그립다」는 말도 나온다. 새 사장은 「다음 주는 다르다」고 짧게 답했다.',
    },
    title: '초보 사장', ch: 2,
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
export function newStory() {
  return { ch: 0, title: '', active: [], done: [], prog: {}, queue: ['intro'], menus: ['tteok'], soon: [], fresh: [], decor: [], today: [] };
}
