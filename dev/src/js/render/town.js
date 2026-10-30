// 마을 지도 그리기: 위에서 비스듬히 내려다본 골목 (data/town.js 지도). 움직임·누르기는 ui/town.js
// 순서: 바닥(보도·찻길·잔디) → 건물·물건·사람을 발끝(바닥 y) 순서로 → 밤빛·새벽빛 → 불빛 → 「!」
import { SPR, ATLAS_URL } from '../art/atlas.js';
import { TILE } from '../data/layout.js';
import { MAP_W, MAP_H, ROAD_ROWS, PARK, PARK2, CROSSWALKS, BUILDINGS, SIGNS, MAP_PROPS, LIGHTS } from '../data/town.js';

let twAtlas = null;
let twc = null; // 지금 그리는 캔버스 붓

function twSpr(name, x, y) {
  const r = SPR[name]; if (!r) return;
  twc.drawImage(twAtlas, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]);
}
// 사람: x 가운데 · y 발끝. 줄 1 숨쉬기 · 2 걷기 (방향 0 오른쪽 · 1 위 · 2 왼쪽 · 3 아래)
// 그 순간의 그림 칸 [아틀라스 x, y, 그릴 x, y] (테두리도 같은 칸으로)
function twFrame(a, t) {
  const r = SPR['char' + a.char]; if (!r) return null;
  if (a.sit) { const f = (a.dir === 2 ? 6 : 0) + Math.floor(t * 4) % 6; return [r[0] + f * 16, r[1] + 3 * 32, Math.round(a.x - 8), Math.round(a.y - 36)]; } // 벤치에 앉기: 앉은 줄(3) — 오른쪽 보기 0~5 · 왼쪽 보기 6~11
  const row = a.moving ? 2 : 1, f = a.dir * 6 + Math.floor(t * (a.moving ? 10 : 6)) % 6;
  return [r[0] + f * 16, r[1] + row * 32, Math.round(a.x - 8), Math.round(a.y - 32)];
}
function twPerson(a, t) {
  const F = twFrame(a, t); if (!F) return;
  if (!a.sit) { twc.fillStyle = 'rgba(0,0,0,.22)'; twc.fillRect(Math.round(a.x - 5), Math.round(a.y - 1), 10, 2); } // 발밑 그림자
  twc.drawImage(twAtlas, F[0], F[1], 16, 32, F[2], F[3], 16, 32);
}
// 상호작용 버튼이 가리키는 것에 흰 테두리 (v0.91 사용자 요청): 그림 모양 그대로 1픽셀 바깥 줄 — 밤빛 위에 그려 또렷하게
let olc = null;
export function outlineSprite(ctx, img, sx, sy, w, h, dx, dy, a) {
  olc = olc || document.createElement('canvas');
  if (olc.width < w + 2 || olc.height < h + 2) { olc.width = w + 2; olc.height = h + 2; }
  const o = olc.getContext('2d');
  o.clearRect(0, 0, olc.width, olc.height);
  for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) o.drawImage(img, sx, sy, w, h, ox, oy, w, h);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = '#fff'; o.fillRect(0, 0, w + 2, h + 2);
  o.globalCompositeOperation = 'destination-out'; o.drawImage(img, sx, sy, w, h, 1, 1, w, h);
  o.globalCompositeOperation = 'source-over';
  const ga = ctx.globalAlpha; ctx.globalAlpha = a;
  ctx.drawImage(olc, 0, 0, w + 2, h + 2, dx - 1, dy - 1, w + 2, h + 2);
  ctx.globalAlpha = ga;
}
export function outlineRect(ctx, x, y, w, h, a) {
  const ga = ctx.globalAlpha; ctx.globalAlpha = a;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y - 1, w, 1); ctx.fillRect(x, y + h, w, 1); ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
  ctx.globalAlpha = ga;
}
function twFocus(F, S, t) {
  const a = 0.75 + 0.25 * Math.sin(t * 6);
  if (F.person) {
    const A = S.actors.find(q => Math.abs(q.x - F.person[0]) < 1.5 && Math.abs(q.y - F.person[1]) < 1.5);
    const fr = A && twFrame(A, t + A.char);
    if (fr) outlineSprite(twc, twAtlas, fr[0], fr[1], 16, 32, fr[2], fr[3], a);
  } else if (F.bld) {
    const [px, py] = F.bld;
    const B = BUILDINGS.find(([n, x, bot]) => { const m = (S.swap && S.swap[n]) || n; return px >= x && px < x + SPR[m][2] && Math.abs(bot - py) <= 16; });
    if (B) { const m = (S.swap && S.swap[B[0]]) || B[0], r = SPR[m]; outlineSprite(twc, twAtlas, r[0], r[1], r[2], r[3], B[1], B[2] - r[3], a); }
    else if (F.rect) outlineRect(twc, F.rect[0], F.rect[1], F.rect[2], F.rect[3], a); // 건물이 아닌 곳 (게시판)
  } else if (F.prop) {
    const r = SPR[F.prop.spr]; if (r) outlineSprite(twc, twAtlas, r[0], r[1], r[2], r[3], F.prop.x, F.prop.y - r[3], a);
  } else if (F.rect) outlineRect(twc, F.rect[0], F.rect[1], F.rect[2], F.rect[3], a);
}

// 바닥: 보이는 칸만
function twGround(x0, y0, x1, y1) {
  const pv = SPR.pave, gr = SPR.grass;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const px = tx * TILE, py = ty * TILE;
    if (ROAD_ROWS.includes(ty)) { twc.fillStyle = '#34333f'; twc.fillRect(px, py, TILE, TILE); continue; }
    if ([PARK, PARK2].some(P => tx >= P.x0 && tx <= P.x1 && ty >= P.y0 && ty <= P.y1)) { twc.drawImage(twAtlas, gr[0], gr[1], 16, 16, px, py, 16, 16); continue; }
    // 보도블록 그림(32×32)의 한 칸을 잘라 써요
    twc.drawImage(twAtlas, pv[0] + (tx % 2) * 16, pv[1] + (ty % 2) * 16, 16, 16, px, py, 16, 16);
  }
  // 찻길: 연석 · 가운데 점선 · 건널목
  for (let i = 0; i < ROAD_ROWS.length; i += 2) {
    const top = ROAD_ROWS[i] * TILE, bot = (ROAD_ROWS[i + 1] + 1) * TILE, mid = (top + bot) / 2;
    if (bot < y0 * TILE || top > (y1 + 1) * TILE) continue;
    twc.fillStyle = '#5c5a6a'; twc.fillRect(0, top, MAP_W * TILE, 2); twc.fillRect(0, bot - 2, MAP_W * TILE, 2);
    twc.fillStyle = '#c9b88e'; for (let x = 4; x < MAP_W * TILE; x += 20) twc.fillRect(x, mid - 1, 10, 2);
    twc.fillStyle = '#e8e4da'; for (const cx of CROSSWALKS) for (let y = top + 4; y < bot - 3; y += 5) twc.fillRect(cx * TILE + 2, y, 44, 3); // 건널목 (가게 앞 · 동쪽)
  }
  // 공원 · 놀이터 테두리
  for (const P of [PARK, PARK2]) {
    const px0 = P.x0 * TILE, py0 = P.y0 * TILE, pw = (P.x1 - P.x0 + 1) * TILE, ph = (P.y1 - P.y0 + 1) * TILE;
    twc.fillStyle = '#7a6a58'; twc.fillRect(px0, py0, pw, 1); twc.fillRect(px0, py0 + ph - 1, pw, 1); twc.fillRect(px0, py0, 1, ph); twc.fillRect(px0 + pw - 1, py0, 1, ph);
  }
}

function twRadial(x, y, r, a) {
  const g = twc.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,200,110,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)');
  twc.fillStyle = g; twc.fillRect(x - r, y - r, r * 2, r * 2);
}

// 할 일이 있는 곳 「!」 (말풍선이 위아래로 살짝 흔들려요)
function twMark(x, y, t) {
  const by = Math.round(y + Math.sin(t * 5 + x) * 1.5), bx = Math.round(x - 5);
  twc.fillStyle = '#fffaf0';
  twc.fillRect(bx + 1, by, 9, 10); twc.fillRect(bx, by + 1, 11, 8); twc.fillRect(bx + 4, by + 10, 2, 2);
  twc.fillStyle = '#e0533a'; twc.fillRect(bx + 4, by + 2, 2, 4); twc.fillRect(bx + 4, by + 7, 2, 1);
}

// 간판은 자기 건물과 같은 순서로 (건물 바로 위에)
const twSignKey = SIGNS.map(([, x, y]) => {
  const b = BUILDINGS.find(([n, bx, bot]) => x >= bx && x < bx + SPR[n][2] && y < bot && y > bot - SPR[n][3]);
  return b ? b[2] : y;
});

// S: { cam:{x,y}, vw, vh, actors:[{char,x,y,dir,moving,sit}], time, night, dawn, marks:[{x,y}], swap:{ 간판: 바꿀 그림 }, only:{ 꾸밈 이름: 보이나 }, focus: 흰 테두리 { person:[x,y] | bld:[x,y] | prop | rect } }
export function drawTown(canvas, S) {
  if (!twAtlas) { twAtlas = new Image(); twAtlas.src = ATLAS_URL; }
  if (!twAtlas.complete) return;
  if (canvas.width !== S.vw || canvas.height !== S.vh) { canvas.width = S.vw; canvas.height = S.vh; }
  twc = canvas.getContext('2d');
  twc.imageSmoothingEnabled = false;
  const t = S.time, cx0 = Math.round(S.cam.x), cy0 = Math.round(S.cam.y);
  twc.setTransform(1, 0, 0, 1, 0, 0);
  twc.fillStyle = '#1b1c2a'; twc.fillRect(0, 0, S.vw, S.vh);
  twc.translate(-cx0, -cy0);
  const x0 = Math.max(0, Math.floor(cx0 / TILE)), y0 = Math.max(0, Math.floor(cy0 / TILE));
  const x1 = Math.min(MAP_W - 1, Math.floor((cx0 + S.vw) / TILE)), y1 = Math.min(MAP_H - 1, Math.floor((cy0 + S.vh) / TILE));
  twGround(x0, y0, x1, y1);
  // 건물·간판·물건·사람: 바닥 y 순서
  const items = [];
  for (const [n, x, bot] of BUILDINGS) { const m = (S.swap && S.swap[n]) || n; items.push({ y: bot, d: () => twSpr(m, x, bot - SPR[m][3]) }); } // swap: 바뀐 건물 (3장 공사 가림막 · 떡볶이 공장)
  SIGNS.forEach(([n, x, y], i) => items.push({ y: twSignKey[i] + 0.1, d: () => twSpr((S.swap && S.swap[n]) || n, x, y) })); // swap: 바뀐 간판 (2장 미소 가구)
  for (const p of MAP_PROPS) if (!p.only || (S.only && S.only[p.only])) items.push({ y: p.y, d: () => twSpr(p.spr, p.x, p.y - SPR[p.spr][3]) }); // only: 장에 따라 바뀌는 가게 앞 꾸밈
  for (const a of S.actors) items.push({ y: a.y + 0.5, d: () => twPerson(a, t + a.char) });
  items.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // 밤빛 · 새벽빛 → 따뜻한 불빛 (더하기로 밝혀요)
  if (S.night || S.dawn) {
    twc.fillStyle = S.night ? 'rgba(20,24,66,.5)' : 'rgba(60,80,145,.3)';
    twc.fillRect(cx0, cy0, S.vw, S.vh);
    twc.globalCompositeOperation = 'lighter';
    const fl = 0.92 + Math.sin(t * 9) * 0.05;
    for (const [x, y, r, a] of LIGHTS) twRadial(x, y, r * (S.night ? 1.6 : 1.2), a * (S.night ? 0.55 : 0.25) * fl);
    if (S.night) for (const p of MAP_PROPS) if (p.spr === 'lamp') twRadial(p.x + 7, p.y - 2, 26, 0.16 * fl); // 가로등 불빛 웅덩이
    twc.globalCompositeOperation = 'source-over';
  }
  if (S.focus) twFocus(S.focus, S, t);
  for (const m of S.marks || []) twMark(m.x, m.y, t);
  twc.setTransform(1, 0, 0, 1, 0, 0);
}
