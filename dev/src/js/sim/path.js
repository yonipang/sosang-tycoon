// 길찾기: 칸 격자 위 4방향 너비 우선 탐색
import { W, H, solidForPlayer, solidForCustomer } from '../data/layout.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// from에서 goals(칸 목록) 중 가장 가까운 곳까지. 반환: 칸 목록(from 다음 칸부터) 또는 null
export function findPath(from, goals, who, allow) {
  const solid = who === 'player' ? solidForPlayer : solidForCustomer;
  const ok = (x, y) => (allow && allow.some(([a, b]) => a === x && b === y)) || !solid(x, y);
  const key = (x, y) => y * W + x;
  const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
  const sx = Math.round(from.x), sy = Math.round(from.y);
  if (goalSet.has(key(sx, sy))) return [];
  const prev = new Map([[key(sx, sy), -1]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = key(nx, ny);
      if (prev.has(k) || !ok(nx, ny)) continue;
      prev.set(k, key(x, y));
      if (goalSet.has(k)) {
        const path = [];
        let c = k;
        while (c !== key(sx, sy)) { path.push([c % W, Math.floor(c / W)]); c = prev.get(c); }
        return path.reverse();
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

// 어떤 칸들(물체)에 붙어 설 수 있는 칸들
export function standAround(tiles, who) {
  const solid = who === 'player' ? solidForPlayer : solidForCustomer;
  const out = [];
  for (const [x, y] of tiles) for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (!solid(nx, ny) && !out.some(([a, b]) => a === nx && b === ny)) out.push([nx, ny]);
  }
  return out;
}

// 길을 따라 움직이기 (ent: x·y·path·speed·dir). 도착하면 true
export function walk(ent, dt) {
  if (!ent.path || !ent.path.length) { ent.moving = false; return true; }
  let left = ent.speed * dt;
  while (left > 0 && ent.path.length) {
    const [tx, ty] = ent.path[0];
    const dx = tx - ent.x, dy = ty - ent.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) ent.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 3 : 1);
    if (d <= left) { ent.x = tx; ent.y = ty; ent.path.shift(); left -= d; }
    else { ent.x += dx / d * left; ent.y += dy / d * left; left = 0; }
  }
  ent.moving = ent.path.length > 0;
  return !ent.moving;
}
