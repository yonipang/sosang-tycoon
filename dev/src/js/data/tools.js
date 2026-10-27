// 장사 도구: 1장 중간(김밥이 열릴 무렵, 손이 모자라기 시작할 때) 오 사장님 권유로 준비 화면에 열려요. 한 번 사면 계속 써요.
//  effect — hands: 손에 드는 수 +n · cookEase: 미니게임 「완벽」·「좋음」 구간 넓히기 · prep: 준비 시간에 미리 만들어 둘 수 있는 그릇 수 (v0.65 — 전에는 보온 통 ready)
export const TOOLS = {
  tray: { name: '서빙 쟁반', price: 50000, desc: '음식을 한 번에 3개까지 듭니다', effect: { hands: 1 } },
  timer: { name: '주방 타이머', price: 40000, desc: '조리할 때 「완벽」 구간이 더 넓어집니다', effect: { cookEase: true } },
  // v0.65 사용자 결정: 보온 통 → 프렙 통 (id는 옛 세이브를 위해 그대로 warmer)
  warmer: { name: '프렙 통', price: 80000, desc: '준비 시간에 가게 조리대에서 메뉴를 미리 만들어 둡니다(미니게임 없음). 주문이 오면 바로 나갑니다', effect: { prep: 6 } },
};
export const TOOL_IDS = ['tray', 'timer', 'warmer'];
// 주방 타이머가 있을 때 미니게임 구간 (data/menu.js COOK_GAMES 대신)
export const COOK_EASE = {
  stir: { zone: { perfect: 0.17, good: 0.31 } },
  roll: { perfect: 2.5, good: 3.4 },
  fry: { perfect: [0.56, 0.83], good: [0.45, 0.92] },
};
// 프렙 (v0.65 사용자 결정): 한 번 만드는 데 1시간 · 미니게임 없이 「좋음」 · 팔지 못한 건 마감 때 버려요 · 큰 프렙 통(상인회)은 PREP_BIG그릇
export const PREP_COST = 1;
export const PREP_Q = 1;
export const PREP_BIG = 12;
