// 연출 장면 (스타듀밸리 첫 장면처럼 게임 그림으로 움직이는 짧은 장면). 그리기는 render/cut.js, 진행은 ui/cutscene.js
// 좌표는 연출 세계의 픽셀 (화면은 128×176만큼 보여요): 가로 272 · 땅(가게 앞 보도) y144~176 · 차도 y176~208 · 하늘은 y144 위로 (카메라가 위에서 내려와요)
//  actors: 사람 { char 그림 번호, x 가운데, y 발끝, dir 0오른쪽 1위 2왼쪽 3아래, pose 'sit'|'idle', stool 둥근 의자, hidden }
//  props: 물건 { spr, x 왼쪽, y 아래 }
//  steps (차례대로):
//   caption '글' (화면 가운데 글, ''이면 지움) · title [작은 글, 큰 글] · sec 초 동안 기다림
//   pan [x, y] 카메라 이동 (sec 초) · fade 0~1 검은 화면 (sec 초 동안 바뀜)
//   say [누가, 말] 대화 창 (누르면 다음) · emote [누가, '!'|'…'|'sweat'|'heart']
//   show 누가 (나타남) · hide 누가 (가게 안으로 들어가 사라짐) · walk [누가, x, y] 걸어가기 (pan과 같이 쓰면 같이 움직여요)
//   face [누가, 방향] · carry [누가, 물건] · drop 누가 (든 물건 내려놓기) · stand 누가 (의자에서 일어남) · door true|false (가게 문 열림)
//   night true|false (밤/낮) · cam [x, y] (카메라 바로 옮기기) · unprop '그림' (물건 치우기)
// 게임 안 글: 설명(caption)은 합니다체, 사람 말은 그 사람 말투 그대로
export const CUTS = {
  opening: {
    night: false,
    cam: { x: 40, y: 14 },
    actors: {
      oh: { char: 18, x: 152, y: 162, dir: 2, pose: 'sit', stool: true, hidden: true },
      me: { char: 0, x: 30, y: 166, dir: 0 },
    },
    props: [{ spr: 'lamp', x: 84, y: 174 }, { spr: 'notice', x: 146, y: 116 }],
    steps: [
      // ── 2년 전, 낮 ──
      { fade: 1, sec: 0.3 },
      { caption: '2년 전.', sec: 1.8 },
      { caption: '' },
      { fade: 0, sec: 1.0 },
      { walk: ['me', 132, 166], pan: [72, 14], sec: 3.0 },
      { emote: ['me', '!'], sec: 0.8 },
      { face: ['me', 1], sec: 0.4 },
      { say: [null, '가게 창문에 종이 한 장이 붙어 있습니다. 「알바 구함 — 떡볶이 좋아하는 분」'] },
      { say: ['me', '떡볶이라면… 좋아하긴 하는데.'] },
      { door: true, sec: 0.3 },
      { say: ['oh', '(가게 안에서) 거기! 구경만 하지 말고 들어와 봐. 떡볶이 식는다!'] },
      { emote: ['me', 'sweat'], sec: 0.8 },
      { walk: ['me', 120, 150] },
      { hide: 'me', door: false, sec: 0.6 },
      { fade: 1, sec: 1.2 },
      // ── 지금, 밤 ──
      { night: true, cam: [8, -150], unprop: 'notice', show: 'oh' },
      { caption: '그리고 지금.', sec: 1.8 },
      { caption: '오늘도 마지막 손님이 돌아간 밤입니다.', sec: 2.4 },
      { caption: '' },
      { fade: 0, sec: 1.2 },
      { pan: [72, 14], sec: 4.0 },
      { sec: 0.4 },
      { emote: ['oh', 'sweat'], sec: 1.2 },
      { say: ['oh', '아이고, 허리야…'] },
      { door: true, sec: 0.4 },
      { show: 'me', carry: ['me', 'bag'] },
      { walk: ['me', 120, 166] },
      { walk: ['me', 104, 172] },
      { drop: 'me', sec: 0.3 },
      { door: false },
      { walk: ['me', 134, 162] },
      { face: ['me', 0], sec: 0.3 },
      { say: ['me', '사장님, 쓰레기 내놨어요. 들어가 쉬세요.'] },
      { say: ['oh', '어이, 알바. 나 이번 달까지만 한다.'] },
      { emote: ['me', '!'], sec: 0.9 },
      { say: ['me', '네? 가게 접으세요?'] },
      { say: ['oh', '허리가 영 말을 안 들어. 30년 했으면 많이 했지.'] },
      { say: ['me', '그럼 단골들은요? 박 할머니는 매일 오시잖아요.'] },
      { sec: 0.9 },
      { say: ['oh', '그러니까 하는 말이다.'] },
      { say: ['oh', '사흘만 니가 사장이다 생각하고 가게 봐 봐.'] },
      { say: ['oh', '잘하면… 이 가게 니가 해볼래?'] },
      { emote: ['me', '…'], sec: 1.6 },
      { say: ['me', '저요? 저 모아 둔 돈도 별로 없는데요.'] },
      { say: ['oh', '권리금 같은 거 필요 없다. 장사만 제대로 하면 돼.'] },
      { say: ['oh', '2년 동안 니가 떡볶이 젓는 거 봤다. 내 것보다 낫더라.'] },
      { sec: 0.6 },
      { say: ['oh', '…는 거짓말이고. 반쯤은 낫더라.'] },
      { emote: ['me', 'sweat'], sec: 0.9 },
      { say: ['me', '…해 볼게요. 사흘 동안 제대로 해 볼게요!'] },
      { emote: ['oh', 'heart'], sec: 1.0 },
      { stand: 'oh', sec: 0.5 },
      { say: ['oh', '좋다. 들어와. 내일 장사 준비부터 같이 하자.'] },
      { door: true, sec: 0.3 },
      { walk: ['oh', 120, 150] },
      { hide: 'oh' },
      { walk: ['me', 120, 150] },
      { hide: 'me', door: false, sec: 0.8 },
      { fade: 1, sec: 1.2 },
      { title: ['프롤로그', '알바 마지막 사흘'], sec: 2.6 },
      { title: null },
    ],
  },
};
