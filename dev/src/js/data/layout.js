// 1등급 가게 배치 (가로 10칸 × 세로 13칸, 한 칸 16px)
//  y0~1 뒷벽 · y2 주방 설비 · y3 주방 바닥 · y4~10 홀(2인 네모 탁자 6개 · 계산대는 오른쪽 아래) · y11 앞벽(문 x5) · y12 가게 앞 보도
export const W = 10;
export const H = 13;
export const TILE = 16;
export const FRONT_Y = H - 2;  // 앞벽 줄
export const WALK_Y = H - 1;   // 가게 앞 보도 줄
export const DOOR = { x: 5, y: FRONT_Y };
export const KITCHEN_ROWS = [2, 3];
// 탁자 그림을 올리는 픽셀: 의자 다리 끝(그림 y22)과 탁자 다리 끝이 같은 높이가 되게
export const TABLE_LIFT = 10;
// 2인 네모 탁자(1칸). 자리는 탁자 왼쪽(x-1)·오른쪽(x+1). 한 탁자에는 한 일행만 (합석 없음)
// w: 탁자 가로 칸 수 (2칸 탁자를 쓰면 2, 그림은 table2)
export const TABLES = [
  { no: 1, x: 2, y: 5, w: 1 }, { no: 2, x: 6, y: 5, w: 1 },
  { no: 3, x: 2, y: 7, w: 1 }, { no: 4, x: 6, y: 7, w: 1 },
  { no: 5, x: 2, y: 9, w: 1 }, { no: 6, x: 6, y: 9, w: 1 },
];
export const onTable = (t, x, y) => y === t.y && x >= t.x && x < t.x + t.w;
// 그릴 것 (그림 이름, 왼쪽 위 칸, 크기는 그림 그대로). 막힌 칸은 solid.
// station이 붙은 것은 그 조리대의 메뉴가 열려야 보여요 (data/menu.js MENU_UNLOCK)
export const FURNITURE = [
  { spr: 'menuboard', x: 8, y: 0 },
  { spr: 'fridge', x: 0, y: 0 },
  { spr: 'stove', x: 1, y: 1 }, { spr: 'pot', x: 1, y: 1.25, over: true },
  { spr: 'counter', x: 2, y: 1, station: 'mat' }, { spr: 'mat', x: 2.5, y: 1.55, over: true, station: 'mat' },
  { spr: 'fryer', x: 4, y: 1, station: 'fryer' },
  { spr: 'sink', x: 6, y: 1 }, { spr: 'counter', x: 8, y: 1 },
  ...TABLES.map(t => ({ spr: t.w === 2 ? 'table2' : 'table', x: t.x, y: t.y - TABLE_LIFT / TILE })),
  { spr: 'counter', x: 8, y: 9 }, { spr: 'register', x: 9, y: 8.875, over: true },
];
// 조리대: 누를 수 있는 칸과 사장이 서는 칸
export const STATIONS = {
  stove: { menu: 'tteok', tiles: [[1, 1], [1, 2]], stand: [[1, 3]], label: '떡볶이 화구' },
  mat: { menu: 'kimbap', tiles: [[2, 1], [3, 1], [2, 2], [3, 2]], stand: [[2, 3], [3, 3]], label: '김밥 자리' },
  fryer: { menu: 'twigim', tiles: [[4, 1], [5, 1], [4, 2], [5, 2]], stand: [[4, 3], [5, 3]], label: '튀김기' },
  trash: { menu: null, tiles: [[6, 1], [7, 1], [6, 2], [7, 2]], stand: [[6, 3], [7, 3]], label: '퇴식대' },
};
export const REGISTER = { tiles: [[8, 9], [9, 9], [8, 10], [9, 10]], stand: [[8, 8], [9, 8]] };
// 자리: face = 앉아서 보는 쪽, table = 몇 번 탁자
export const SEATS = TABLES.flatMap(t => [
  { x: t.x - 1, y: t.y, face: 'right', table: t.no }, { x: t.x + t.w, y: t.y, face: 'left', table: t.no },
]);
export const PAY_SPOTS = [[7, 10], [6, 10], [4, 10]];   // 계산 줄 (앞부터 — 맨 앞은 계산대 왼쪽에서 오른쪽을 봐요)
export const QUEUE_SPOTS = [[6, WALK_Y], [7, WALK_Y], [4, WALK_Y]]; // 가게 앞 대기 줄
export const DOOR_OUT = { x: 5, y: WALK_Y };
export const PLAYER_START = { x: 4, y: 4 };
// 사장이 못 가는 칸 (자리·탁자·계산대·설비 줄·벽)
export function solidForPlayer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y <= 2 || y >= FRONT_Y) return true;
  if (TABLES.some(t => onTable(t, x, y))) return true;
  if (SEATS.some(s => s.x === x && s.y === y)) return true;
  if (REGISTER.tiles.some(([a, b]) => a === x && b === y)) return true;
  return false;
}
// 손님이 못 가는 칸 (자리는 자기 자리만 — sim/path.js에서 따로 허락)
export function solidForCustomer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y === WALK_Y) return false;
  if (y === FRONT_Y) return x !== DOOR.x;
  return solidForPlayer(x, y);
}
