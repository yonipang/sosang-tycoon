// 가게 배치 (가로 10칸, 한 칸 16px). 가게 등급(확장공사 — 미소 가구)마다 홀이 아래로 두 줄씩 길어져요
//  1등급(세로 13칸): y0~1 뒷벽 · y2 주방 설비 · y3 주방 바닥 · y4~10 홀(2인 네모 탁자 6개 · 퇴식대는 왼쪽 아래 문 옆 · 계산대는 오른쪽 아래) · y11 앞벽(문 x5) · y12 가게 앞 보도
//  2등급(세로 15칸): 홀 y4~12 · 탁자 8개 · 앞벽 y13 · 보도 y14
//  배치는 applyShopLv(등급)로 바꿔요 — 배열·물건은 그 자리에서 고쳐 쓰고(다른 파일이 같은 것을 봐요), H·FRONT_Y·WALK_Y는 let
export const W = 10;
export let H = 13;
export const TILE = 16;
export let FRONT_Y = H - 2;  // 앞벽 줄
export let WALK_Y = H - 1;   // 가게 앞 보도 줄
export const DOOR = { x: 5, y: FRONT_Y };
export let layoutLv = 0;     // 지금 깔린 배치의 등급
// 등급마다 홀 탁자 줄 수 (줄마다 탁자 2개 — x2·x6)
const TABLE_ROWS = [0, 3, 4, 5];
export const SHOP_LV_MAX = 2; // 지금 만들 수 있는 등급 (3등급은 다음에)
export const KITCHEN_ROWS = [2, 3];
// 탁자 그림을 올리는 픽셀: 의자 다리 끝(그림 y22)과 탁자 다리 끝이 같은 높이가 되게
export const TABLE_LIFT = 10;
// 2인 네모 탁자(1칸). 자리는 탁자 왼쪽(x-1)·오른쪽(x+1). 한 탁자에는 한 일행만 (합석 없음)
// w: 탁자 가로 칸 수 (2칸 탁자를 쓰면 2, 그림은 table2)
export const TABLES = [];
export const onTable = (t, x, y) => y === t.y && x >= t.x && x < t.x + t.w;
// 그릴 것 (그림 이름, 왼쪽 위 칸, 크기는 그림 그대로). 막힌 칸은 solid.
// station이 붙은 것은 그 조리대의 메뉴가 열려야 보여요 (sim/story.js menuOpen)
export const FURNITURE = [];
const BACK_FURNITURE = [
  { spr: 'menuboard', x: 8, y: 0 },
  { spr: 'fridge', x: 0, y: 0 },
  { spr: 'stove', x: 1, y: 1 }, { spr: 'pot', x: 1, y: 1.25, over: true },
  { spr: 'counter', x: 2, y: 1, station: 'mat' }, { spr: 'mat', x: 2.5, y: 1.55, over: true, station: 'mat' },
  { spr: 'fryer', x: 4, y: 1, station: 'fryer' },
  { spr: 'counter', x: 6, y: 1 }, { spr: 'counter', x: 8, y: 1 }, // x6~7: 빈 조리대 자리 (v0.66 퇴식대를 홀로 옮기고 비움 — 새 갈래 메뉴의 조리대가 들어올 곳)
];
// 퇴식대 (v0.67 사용자 요청: 홀 왼쪽 아래 문 옆, 작게 — v0.66엔 오른쪽 위였어요): 빈 그릇이 놓인 낮은 선반 2칸 · 칸은 applyShopLv에서
// 조리대: 누를 수 있는 칸과 사장이 서는 칸
export const STATIONS = {
  stove: { menu: 'tteok', tiles: [[1, 1], [1, 2]], stand: [[1, 3]], label: '떡볶이 화구' },
  mat: { menu: 'kimbap', tiles: [[2, 1], [3, 1], [2, 2], [3, 2]], stand: [[2, 3], [3, 3]], label: '김밥 자리' },
  fryer: { menu: 'twigim', tiles: [[4, 1], [5, 1], [4, 2], [5, 2]], stand: [[4, 3], [5, 3]], label: '튀김기' },
  trash: { menu: null, tiles: [], stand: [], label: '퇴식대' }, // v0.67: 홀 왼쪽 아래 (applyShopLv)
  fridge: { menu: null, tiles: [[0, 0], [0, 1], [0, 2]], stand: [[0, 3]], label: '냉장고' }, // 재료 보기·급구매
};
export const REGISTER = { tiles: [], stand: [] }; // 계산대 (홀 오른쪽 아래 2×2)
// 자리: face = 앉아서 보는 쪽, table = 몇 번 탁자
export const SEATS = [];
export const PAY_SPOTS = [];   // 계산 줄 (앞부터 — 맨 앞은 계산대 왼쪽에서 오른쪽을 봐요)
export const QUEUE_SPOTS = []; // 가게 앞 대기 줄
export const DOOR_OUT = { x: 5, y: 0 };
export const PLAYER_START = { x: 4, y: 4 };
// 장식 (이야기로 생겨요 — G.story.decor). 놓일 칸은 처음부터 막아 둬요 (생겨도 길이 바뀌지 않게)
export const DECOR = { plant: { spr: 'plant', x: 9, y: 4 } };
// 미소 가구 자리 (data/furniture.js): 창문·액자는 뒷벽 맨 윗줄(그림 가운데 픽셀 x, 위 y) · 화분은 홀 왼쪽 위·아래 두 칸(놓일 칸은 처음부터 막아 둬요)
export const FURN_SPOTS = { window: [[80, 0]], frame: [[40, 2], [119, 2]], plant: [] };

// 등급 lv의 배치를 깔아요 (같은 등급이면 그대로 — 바뀌었으면 true)
export function applyShopLv(lv) {
  lv = Math.max(1, Math.min(SHOP_LV_MAX, lv || 1));
  if (lv === layoutLv) return false;
  layoutLv = lv;
  const rows = TABLE_ROWS[lv], last = 4 + rows * 2; // 홀 마지막 줄 (1등급 10 · 2등급 12)
  H = last + 3; FRONT_Y = H - 2; WALK_Y = H - 1;
  DOOR.y = FRONT_Y; DOOR_OUT.y = WALK_Y;
  TABLES.length = 0;
  for (let i = 0; i < rows; i++) TABLES.push({ no: i * 2 + 1, x: 2, y: 5 + i * 2, w: 1 }, { no: i * 2 + 2, x: 6, y: 5 + i * 2, w: 1 });
  SEATS.length = 0;
  for (const t of TABLES) SEATS.push({ x: t.x - 1, y: t.y, face: 'right', table: t.no }, { x: t.x + t.w, y: t.y, face: 'left', table: t.no });
  REGISTER.tiles = [[8, last - 1], [9, last - 1], [8, last], [9, last]]; REGISTER.stand = [[8, last - 2], [9, last - 2]];
  PAY_SPOTS.length = 0; PAY_SPOTS.push([7, last], [6, last], [4, last]);
  QUEUE_SPOTS.length = 0; QUEUE_SPOTS.push([6, WALK_Y], [7, WALK_Y], [4, WALK_Y]);
  FURNITURE.length = 0;
  STATIONS.trash.tiles = [[0, last], [1, last]]; STATIONS.trash.stand = [[2, last], [0, last - 1]];
  const TRASH_FURNITURE = [{ spr: 'table2', x: 0, y: last - TABLE_LIFT / TILE }, { spr: 'plate', x: 0.1, y: last - 0.75, over: true }, { spr: 'plate', x: 0.95, y: last - 0.7, over: true }];
  FURNITURE.push(...BACK_FURNITURE, ...TRASH_FURNITURE, ...TABLES.map(t => ({ spr: t.w === 2 ? 'table2' : 'table', x: t.x, y: t.y - TABLE_LIFT / TILE })),
    { spr: 'counter', x: 8, y: last - 1 }, { spr: 'register', x: 9, y: last - 1.125, over: true });
  FURN_SPOTS.plant = [[0, 4], [0, last - 2]]; // 아래 화분은 퇴식대 위로 (v0.67)
  return true;
}
applyShopLv(1);
// 사장이 못 가는 칸 (자리·탁자·계산대·설비 줄·벽)
export function solidForPlayer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y <= 2 || y >= FRONT_Y) return true;
  if (TABLES.some(t => onTable(t, x, y))) return true;
  if (SEATS.some(s => s.x === x && s.y === y)) return true;
  if (REGISTER.tiles.some(([a, b]) => a === x && b === y)) return true;
  if (STATIONS.trash.tiles.some(([a, b]) => a === x && b === y)) return true; // 홀 퇴식대 (v0.66)
  if (Object.values(DECOR).some(d => d.x === x && d.y === y)) return true;
  if (FURN_SPOTS.plant.some(([a, b]) => a === x && b === y)) return true;
  return false;
}
// 손님이 못 가는 칸 (자리는 자기 자리만 — sim/path.js에서 따로 허락)
export function solidForCustomer(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  if (y === WALK_Y) return false;
  if (y === FRONT_Y) return x !== DOOR.x;
  return solidForPlayer(x, y);
}
