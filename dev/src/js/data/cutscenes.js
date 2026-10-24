// 연출 장면 (스타듀밸리 첫 장면처럼 게임 그림으로 움직이는 짧은 장면). 그리기는 render/cut.js, 진행은 ui/cutscene.js
// 좌표는 연출 세계의 픽셀 (화면은 128×176만큼 보여요): 가로 272 · 땅(가게 앞 보도) y144~176 · 차도 y176~208 · 하늘은 y144 위로 (카메라가 위에서 내려와요)
//  actors: 사람 { char 그림 번호, x 가운데, y 발끝, dir 0오른쪽 1위 2왼쪽 3아래, pose 'sit'|'idle', stool 둥근 의자, hidden }
//  props: 물건 { spr, x 왼쪽, y 아래 }
//  steps (차례대로):
//   caption '글' (화면 가운데 글, ''이면 지움) · title [작은 글, 큰 글] · sec 초 동안 기다림
//   pan [x, y] 카메라 이동 (sec 초) · fade 0~1 검은 화면 (sec 초 동안 바뀜)
//   say [누가, 말] 대화 창 (누르면 다음) · emote [누가, '!'|'…'|'sweat'|'heart']
//   show 누가 (나타남) · walk [누가, x, y] 걸어가기 · face [누가, 방향] · carry [누가, 물건] · drop 누가 (든 물건 내려놓기) · door true|false (가게 문 불빛)
// 게임 안 글: 설명(caption)은 합니다체, 사람 말은 그 사람 말투 그대로
export const CUTS = {
  opening: {
    cam: { x: 8, y: -150 },
    actors: {
      oh: { char: 18, x: 152, y: 162, dir: 2, pose: 'sit', stool: true },
      me: { char: 0, x: 120, y: 147, dir: 3, hidden: true },
    },
    props: [{ spr: 'lamp', x: 84, y: 174 }],
    steps: [
      { fade: 1, sec: 0.4 },
      { caption: '골목 끝, 30년 된 분식집이 하나 있습니다.', sec: 2.8 },
      { caption: '오늘도 마지막 손님이 돌아간 밤입니다.', sec: 2.6 },
      { caption: '' },
      { fade: 0, sec: 1.4 },
      { pan: [72, 14], sec: 4.2 },
      { sec: 0.5 },
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
      { sec: 1.0 },
      { say: ['oh', '그래서 말인데… 사흘만 니가 사장이다 생각하고 가게 봐 봐.'] },
      { say: ['oh', '잘하면, 이 가게 니가 해볼래?'] },
      { emote: ['me', '…'], sec: 1.6 },
      { fade: 1, sec: 1.2 },
      { title: ['프롤로그', '알바 마지막 사흘'], sec: 2.6 },
      { title: null },
    ],
  },
};
