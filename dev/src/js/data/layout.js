// 1등급 가게 배치 (가로 8칸 × 세로 11칸, 한 칸 16px)
//  y0~1 뒷벽 · y2 주방 설비 · y3 주방 바닥 · y4~8 홀 · y9 앞벽(문 x5) · y10 가게 앞 보도
export const W = 8;
export const H = 11;
export const TILE = 16;
export const DOOR = { x: 5, y: 9 };
export const KITCHEN_ROWS = [2, 3];
// 그릴 것 (그림 이름, 왼쪽 위 칸, 크기는 그림 그대로). 막힌 칸은 solid.
export const FURNITURE = [
  { spr: 'menuboard', x: 6, y: 0 },
  { spr: 'fridge', x: 0, y: 0 },
  { spr: 'stove', x: 1, y: 1 }, { spr: 'pot', x: 1, y: 1.25, over: true },
  { spr: 'counter_a', x: 2, y: 1 }, { spr: 'mat', x: 2.5, y: 1.2, over: true },
  { spr: 'fryer', x: 4, y: 1 },
  { spr: 'counter_b', x: 6, y: 1 },
  { spr: 'table', x: 2, y: 5 }, { spr: 'table', x: 2, y: 7 },
  { spr: 'counter_b', x: 6, y: 5 }, { spr: 'register', x: 7, y: 4.75, over: true },
];
// 조리대: 누를 수 있는 칸과 사장이 서는 칸
export const STATIONS = {
  stove: { menu: 'tteok', tiles: [[1, 1], [1, 2]], stand: [[1, 3]], label: '떡볶이 화구' },
  mat: { menu: 'kimbap', tiles: [[2, 1], [3, 1], [2, 2], [3, 2]], stand: [[2, 3], [3, 3]], label: '김밥 자리' },
  fryer: { menu: 'twigim', tiles: [[4, 1], [5, 1], [4, 2], [5, 2]], stand: [[4, 3], [5, 3]], label: '튀김기' },
  trash: { menu: null, tiles: [[6, 1], [7, 1], [6, 2], [7, 2]], stand: [[6, 3], [7, 3]], label: '퇴식대' },
};
export const REGISTER = { tiles: [[6, 5], [7, 5], [6, 6], [7, 6]], stand: [[6, 4], [7, 4]] };
// 자리: face = 앉아서 보는 쪽, table = 몇 번 테이블
export const SEATS = [
  { x: 1, y: 5, face: 'right', table: 1 }, { x: 3, y: 5, face: 'left', table: 1 },
  { x: 1, y: 7, face: 'right', table: 2 }, { x: 3, y: 7, face: 'left', table: 2 },
];
export const PAY_SPOTS = [[6, 7], [5, 7], [4, 7]];   // 계산 줄 (앞부터)
export const QUEUE_SPOTS = [[6, 10], [7, 10], [4, 10]]; // 가게 앞 대기 줄
export const DOOR_OUT = { x: 5, y: 10 };
export const PLAYER_START = { x: 4, y: 4 };
// 사장이 못 가는 칸 (자리·탁자·계산대·설비 줄·벽)
export function solidForPlayer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y <= 2 || y >= 9) return true;
  if ((x === 2 && (y === 5 || y === 7))) return true;
  if (SEATS.some(s => s.x === x && s.y === y)) return true;
  if (REGISTER.tiles.some(([a, b]) => a === x && b === y)) return true;
  return false;
}
// 손님이 못 가는 칸 (자리는 자기 자리만 — sim/path.js에서 따로 허락)
export function solidForCustomer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y === 10) return false;
  if (y === 9) return x !== DOOR.x;
  return solidForPlayer(x, y);
}
