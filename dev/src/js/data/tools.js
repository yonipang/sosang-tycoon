// 장사 도구: 1장 중간(김밥이 열릴 무렵, 손이 모자라기 시작할 때) 오 사장님 권유로 준비 화면에 열려요. 한 번 사면 계속 써요.
//  effect — hands: 손에 드는 수 +n · cookEase: 미니게임 「완벽」·「좋음」 구간 넓히기 · ready: 새벽에 미리 만들어 둘 수 있는 그릇 (메뉴: 최대 수, 직접 미니게임으로)
export const TOOLS = {
  tray: { name: '서빙 쟁반', price: 50000, desc: '음식을 한 번에 3개까지 듭니다', effect: { hands: 1 } },
  timer: { name: '주방 타이머', price: 40000, desc: '조리할 때 「완벽」 구간이 넓어집니다', effect: { cookEase: true } },
  warmer: { name: '보온 통', price: 80000, desc: '새벽에 떡볶이를 4그릇까지 미리 끓여 둡니다. 화구를 누르면 바로 나갑니다', effect: { ready: { tteok: 4 } } },
};
export const TOOL_IDS = ['tray', 'timer', 'warmer'];
// 주방 타이머가 있을 때 미니게임 구간 (data/menu.js COOK_GAMES 대신)
export const COOK_EASE = {
  stir: { zone: { perfect: 0.13, good: 0.27 } },
  roll: { perfect: 2.1, good: 3.1 },
  fry: { perfect: [0.6, 0.79], good: [0.5, 0.9] },
};
