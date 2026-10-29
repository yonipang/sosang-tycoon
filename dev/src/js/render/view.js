// 가게 그리기: 캔버스 1픽셀 = 그림 1픽셀, 화면에서는 정수 배로 키워요(픽셀이 뭉개지지 않게).
import { G } from '../save/state.js';
import { baseOf, AUTO_COOK, MENUS } from '../data/menu.js';
import { freshLeft, freshQ } from '../sim/kitchen.js';
import { W, H, TILE, DOOR, FRONT_Y, FURNITURE, STATIONS, SEATS, TABLES, TABLE_LIFT, DECOR, REGISTER, FURN_SPOTS } from '../data/layout.js';
import { takeoutWaiting } from '../sim/incidents.js';
import { SPR, ATLAS_URL } from '../art/atlas.js';
import { isSeated } from '../sim/customers.js';
import { handsCount, ticketsCount, stationMenus } from '../sim/player.js';
import { menuOpen, questActive } from '../sim/story.js';
import { TUT_SPOT } from '../data/tutorial.js';
import { CAST } from '../data/story.js';
import { ohInShop, tutAsk } from '../sim/tutorial.js';
import { furnSpr, furnHave, chairSpr, withFurn } from '../sim/furniture.js';

export let VW = W * TILE;
export let VH = H * TILE; // 가게 등급(확장공사)이 바뀌면 fitView에서 다시 (data/layout.js applyShopLv)
let cv, ctx, atlas, scale = 3, ready = false;
let t = 0; // 그리기용 시계 (초)
const marks = []; // 누른 자리 표시

export function initView(canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  cv.width = VW; cv.height = VH;
  atlas = new Image();
  atlas.onload = () => { ready = true; };
  atlas.src = ATLAS_URL;
}
export const viewReady = () => ready;

// 화면 크기에 맞춰 배율 정하기: 그림 1픽셀이 기기 화면 픽셀 정수 개가 되게 (휴대폰에서도 또렷하게)
export function fitView(availW, availH) {
  if (VH !== H * TILE || VW !== W * TILE) { VW = W * TILE; VH = H * TILE; cv.width = VW; cv.height = VH; }
  const dpr = window.devicePixelRatio || 1;
  const dev = Math.floor(Math.min(availW / VW, availH / VH) * dpr);
  scale = Math.max(1, dev) / dpr;
  cv.style.width = VW * scale + 'px';
  cv.style.height = VH * scale + 'px';
  return scale;
}
export const viewScale = () => scale;
// 칸 좌표 → 캔버스 요소 안의 CSS 픽셀 (떠오르는 글자 자리용)
export const tileToCss = (x, y) => ({ x: (x + 0.5) * TILE * scale, y: (y + 0.5) * TILE * scale });
// 화면 누른 자리 → 칸 좌표 (소수점까지 — 사람 그림을 눌렀는지 보려고)
export function cssToTile(px, py) { return { x: px / scale / TILE, y: py / scale / TILE }; }

export function addMark(x, y, kind) { marks.push({ x, y, kind, t: 0 }); }

function spr(name, dx, dy, flip, sw, sh, sy0) {
  const r = SPR[name]; if (!r) return;
  const w = sw || r[2], h = sh || r[3], oy = sy0 || 0;
  if (flip) {
    ctx.save(); ctx.translate(Math.round(dx) + w, Math.round(dy)); ctx.scale(-1, 1);
    ctx.drawImage(atlas, r[0], r[1] + oy, w, h, 0, 0, w, h); ctx.restore();
  } else ctx.drawImage(atlas, r[0], r[1] + oy, w, h, Math.round(dx), Math.round(dy), w, h);
}
// 가운데 x에 맞춰 그리기 (그림 너비가 물건마다 달라요)
function sprCx(name, cx, y) { const r = SPR[name]; if (r) spr(name, Math.round(cx - r[2] / 2), y); }
// 바닥 무늬를 칸마다 깔아요
function tileFill(name, x0, y0, x1, y1) {
  const r = SPR[name];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const sx = (x * TILE) % r[2], sy = (y * TILE) % r[3];
    ctx.drawImage(atlas, r[0] + sx, r[1] + sy, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }
}

// 캐릭터: 한 장에 16×32 그림이 줄마다 — 0 서 있기 4장 · 1 숨쉬기 24장 · 2 걷기 24장 · 3 앉기 12장
function drawChar(ch, x, y, dir, mode, phase) {
  const r = SPR['char' + ch]; if (!r) return;
  let row, f;
  // 앉기: 0~5 오른쪽 · 6~11 왼쪽 보기. 고개를 돌리는 프레임은 빼고 첫 장(먹을 때만 두 장을 번갈아)을 써요
  if (mode === 'sit' || mode === 'sitEat') { row = 3; f = (dir === 2 ? 6 : 0) + (mode === 'sitEat' ? Math.floor(phase * 2) % 2 : 0); }
  else if (mode === 'walk') { row = 2; f = dir * 6 + Math.floor(phase * 10) % 6; }
  else { row = 1; f = dir * 6 + Math.floor(phase * 6) % 6; }
  const sit = mode === 'sit' || mode === 'sitEat';
  const dx = Math.round(x * TILE) + (sit ? (dir === 2 ? -SIT_SHIFT : SIT_SHIFT) : 0), dy = Math.round(y * TILE - 16 - (sit ? SIT_LIFT : 0));
  ctx.drawImage(atlas, r[0] + f * 16, r[1] + row * 32, 16, 32, dx, dy, 16, 32);
}

function bubble(x, y, w, h) {
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = 'rgba(59,42,32,.35)'; ctx.fillRect(x + 1, y + h, w - 2, 1);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(x + Math.floor(w / 2) - 1, y + h, 2, 2);
}
// 그림을 담은 말풍선: 그림 크기에 맞춰 만들고 그림은 정가운데에 (cx: 가운데 x, bottom: 꼬리 위 y)
function iconBubble(name, cx, bottom) {
  const r = SPR[name], w = r[2] + 4, h = r[3] + 4;
  const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
  bubble(x, y, w, h);
  spr(name, x + 2, y + 2);
  return { x, y, w, h };
}
// 그림을 (cx, cy) 가운데에 맞춰 그려요
function sprC(name, cx, cy) { const r = SPR[name]; spr(name, Math.round(cx - r[2] / 2), Math.round(cy - r[3] / 2)); }
function bar(x, y, w, frac, col) {
  ctx.fillStyle = 'rgba(40,28,20,.6)'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * frac)), 1);
}
const patCol = f => f > 0.5 ? '#7cc95a' : f > 0.25 ? '#f2b134' : '#e0533a';

// 시간에 따라 빛깔: 아침은 맑게, 저녁은 노을, 마감 뒤는 푸른 밤
function tint(min) {
  const h = 9 + min / 60;
  let c = null;
  if (h < 10) c = [255, 230, 180, 0.10 * (10 - h)];
  else if (h >= 17 && h < 20) c = [255, 140, 60, 0.16 * (h - 17) / 3];
  else if (h >= 20) c = [40, 50, 110, Math.min(0.32, 0.16 + 0.16 * (h - 20))];
  if (!c) return;
  ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
  ctx.fillRect(0, 0, VW, VH);
}

function drawRoom() {
  // 뒷벽(0~1줄), 주방 바닥(2~3줄), 홀(4줄~앞벽 위), 앞벽, 보도
  const wall = furnSpr('wall', 'wall');
  for (let x = 0; x < W; x += 3) spr(wall, x * TILE, 0, false, Math.min(48, (W - x) * TILE), 32);
  // 미소 가구: 뒷벽 창문·액자 (설비 뒤에 걸려요)
  if (furnHave('window')) for (const [x, y] of FURN_SPOTS.window) sprCx(furnSpr('window'), x, y);
  if (furnHave('frame')) for (const [x, y] of FURN_SPOTS.frame) sprCx(furnSpr('frame'), x, y);
  tileFill(furnSpr('kfloor', 'floor_kitchen'), 0, 2, W, 4);
  tileFill(furnSpr('floor', 'floor_dining'), 0, 4, W, FRONT_Y);
  tileFill('sidewalk', 0, FRONT_Y, W, H);
  // 앞벽: 낮은 벽(유리창 대신) — 문 칸만 비워요
  for (let x = 0; x < W; x++) {
    if (x >= DOOR.x && x < DOOR.x + DOOR.w) continue;
    spr('wall_front', x * TILE, FRONT_Y * TILE, false, 16, 16, 16);
  }
  tileFill(furnSpr('floor', 'floor_dining'), DOOR.x, FRONT_Y, DOOR.x + DOOR.w, FRONT_Y + 1); // 문 칸(두 칸)도 홀 바닥 위에 도어매트 (v0.73 사용자 요청)
  { // 도어매트 한 장을 문 너비로 (가운데 줄무늬를 늘려요)
    const r = SPR.doormat, x0 = DOOR.x * TILE, y0 = FRONT_Y * TILE, w = DOOR.w * TILE;
    ctx.drawImage(atlas, r[0], r[1], 8, 16, x0, y0, 8, 16);
    ctx.drawImage(atlas, r[0] + 7, r[1], 2, 16, x0 + 8, y0, w - 16, 16);
    ctx.drawImage(atlas, r[0] + 8, r[1], 8, 16, x0 + w - 8, y0, 8, 16);
  }
  // 주방과 홀 사이 얇은 그림자
  ctx.fillStyle = 'rgba(40,28,20,.18)'; ctx.fillRect(0, 4 * TILE, VW, 1);
}

// 자동 주방 (v0.83 시험): 만드는 중이면 조리대 위 막대 · 다 된 그릇은 말풍선(그릇 수 · 「완벽」 남은 시간 막대 — 초록 완벽 · 노랑 좋음 · 회색 식음)
function kitchenHint() {
  const r = G.run;
  for (const id in r.kit || {}) {
    const st = STATIONS[id], K = r.kit[id];
    const [x, y] = st.tiles[0], cx = x * TILE + (st.tiles.length > 2 ? 16 : 8), bob = Math.round(Math.sin(t * 5) * 1.5);
    if (K.shelf.length) {
      const d = K.shelf[0], q = freshQ(d);
      const b = iconBubble(d.menu, cx, y * TILE + bob);
      if (K.shelf.length > 1) { ctx.fillStyle = '#e0533a'; ctx.fillRect(b.x + b.w - 5, b.y - 2, 6, 6); ctx.fillStyle = '#fff'; digit(K.shelf.length, b.x + b.w - 3, b.y - 1); }
      bar(b.x, b.y + b.h + 1, b.w, q === 2 ? freshLeft(d) : 1, q === 2 ? '#6fd36f' : q === 1 ? '#f2c94c' : '#9a9a9a');
    } else { // 프렙 통에 미리 만들어 둔 그릇이 주문을 기다리면 그 그릇을 보여 줘요
      const t2 = r.tickets.find(q => MENUS[q.menu] && MENUS[q.menu].station === id && r.ready && (r.ready[q.menu] || []).length && ticketsCount(q.menu) > handsCount(q.menu));
      if (t2) iconBubble(t2.menu, cx, y * TILE + bob);
    }
    if (K.cur) {
      for (let i = 0; i < 3; i++) { // 김
        const k = (t * 1.5 + i / 3) % 1;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillRect(x * TILE + 4 + i * 4 + Math.round(Math.sin((t + i) * 6)), y * TILE + 2 - Math.round(k * 10), 2, 2);
      }
      bar(cx - 8, y * TILE + 22, 16, Math.min(1, K.cur.t / K.cur.dur), '#ffd34a');
    }
  }
}
function stationHint() {
  if (!G.run) return;
  if (AUTO_COOK) { kitchenHint(); return; }
  for (const id in STATIONS) {
    const st = STATIONS[id]; if (!st.menu || !menuOpen(st.menu)) continue;
    const ms = stationMenus(st), needOf = m => Math.max(0, ticketsCount(m) - handsCount(m));
    const need = ms.reduce((s, m) => s + needOf(m), 0);
    if (need <= 0) continue;
    const first = (G.run.tickets.find(t => ms.includes(t.menu) && needOf(t.menu) > 0) || {}).menu || ms[0]; // 먼저 들어온 주문 메뉴
    const [x, y] = st.tiles[0];
    const bob = Math.round(Math.sin(t * 5) * 1.5);
    const bx = x * TILE + (st.tiles.length > 2 ? 8 : 0), by = y * TILE - 14 + bob;
    const b = iconBubble(first, bx + 8, by + 14);
    if (need > 1) { ctx.fillStyle = '#e0533a'; ctx.fillRect(b.x + b.w - 5, b.y - 2, 6, 6); ctx.fillStyle = '#fff'; digit(need, b.x + b.w - 3, b.y - 1); }
  }
}
// 아주 작은 숫자 (3×4 픽셀)
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function digit(n, x, y) {
  const s = DIG[Math.min(9, n)];
  for (let i = 0; i < 15; i++) if (s[i] === '1') ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
}

// 손님층 표시 (v0.76): 머리 왼쪽 작은 네모 — 색은 영수증 시간대 막대와 같아요 (style.css .t-*)
//  학생 = 책가방 · 직장인 = 넥타이 · 어르신 = 지팡이 (흰 5×5 그림)
export const TYPE_BADGE = {
  student: ['#e4703a', ['.###.', '#####', '#...#', '#####', '#####']],
  worker: ['#3c5aa6', ['.###.', '..#..', '.###.', '.###.', '..#..']],
  elder: ['#8c9a6a', ['.##..', '#..#.', '#..#.', '...#.', '...#.']],
};
function typeBadge(type, x, y) {
  const [col, g] = TYPE_BADGE[type];
  ctx.fillStyle = '#3b2a20'; ctx.fillRect(x, y, 9, 9);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, 7, 7);
  ctx.fillStyle = '#fff';
  for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) if (g[r][k] === '#') ctx.fillRect(x + 2 + k, y + 2 + r, 1, 1);
}
// 자기 자리에 도착해 앉아 있는지 (걸어가는 중이면 서 있는 그림)
const sittingNow = c => isSeated(c) && !c.moving && c.x === SEATS[c.seat].x && c.y === SEATS[c.seat].y;
const SIT_LIFT = 16; // 앉은 그림을 위로 올리는 픽셀: 엉덩이가 의자 방석 위에 오게 (발은 탁자 뒤로 숨어요 — drawFrame 그리는 순서)
const SIT_SHIFT = 3; // 탁자 쪽으로 당기는 픽셀: 등받이가 등 뒤로 보이게
function drawCustomerUI(c) {
  const px = Math.round(c.x * TILE), top = Math.round(c.y * TILE - 9 - (sittingNow(c) ? SIT_LIFT : 0)); // 머리 바로 위
  if (c.tag && c.tag.state === 'on' && c.state !== 'leave') { // 돌발 이벤트 손님: 머리 옆 빨간 「!」 (통통)
    const bx = px + 12, by = top - 12 + Math.round(Math.sin(t * 6 + c.id) * 1.2);
    ctx.fillStyle = '#3b2a20'; ctx.fillRect(bx - 1, by - 1, 7, 9);
    ctx.fillStyle = '#e0533a'; ctx.fillRect(bx, by, 5, 7);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 2, by + 1, 1, 3); ctx.fillRect(bx + 2, by + 5, 1, 1);
  }
  if (c.type && TYPE_BADGE[c.type] && c.y < FRONT_Y) typeBadge(c.type, px - 3, top + 2); // 손님층 표시 (v0.76 사용자 요청: 누가 학생·직장인·어르신인지)
  if (c.faceT > 0 && c.face) { spr('face_' + c.face, px + 3, top - 10); return; }
  if (c.state === 'reading') {
    bubble(px + 2, top - 8, 12, 7);
    ctx.fillStyle = '#3b2a20';
    for (let i = 0; i < 3; i++) if (Math.floor(t * 3) % 4 > i) ctx.fillRect(px + 4 + i * 3, top - 5, 2, 2);
  } else if (c.state === 'waitFood') {
    iconBubble(c.menu, px + 8, top - 2);
    bar(px, top - 1, 16, c.patience / c.patMax, patCol(c.patience / c.patMax));
  } else if (c.state === 'queue' || (c.state === 'payLine' && G.run.payLine[0] === c.id && !c.moving)) {
    if (c.state === 'payLine') { bubble(px + 3, top - 9, 10, 8); ctx.fillStyle = '#f2b134'; ctx.fillRect(px + 6, top - 7, 4, 4); ctx.fillStyle = '#c4861c'; ctx.fillRect(px + 7, top - 6, 2, 2); }
    bar(px, top, 16, c.patience / c.patMax, patCol(c.patience / c.patMax));
  }
}

// 이야기로 생긴 장식: 칸 가운데, 발이 칸 아래쪽에 닿게
// 미소 가구로 바꾼 식탁·의자·화분 (sim/furniture.js)
// 미소 가구 주방 (v0.71): 뒷줄 조리대·화구·튀김기는 산 「조리대」 테마 그림으로
const KIT_SPR = { counter: 'kc', stove: 'stove', fryer: 'fryer' };
const fSpr = f => (f.spr === 'table' ? furnSpr('table', 'table') : f.y < 3 && KIT_SPR[f.spr] && furnHave('kitchen') ? KIT_SPR[f.spr] + '_' + furnHave('kitchen') : f.spr);
const plantsNow = () => (furnHave('plant') ? FURN_SPOTS.plant.map(([x, y]) => ({ spr: furnSpr('plant'), x, y })) : []);
const decorNow = () => (G.story ? G.story.decor : []).map(k => DECOR[k]).filter(Boolean);
function drawDecor(d) { const r = SPR[d.spr]; if (r) spr(d.spr, d.x * TILE + 8 - Math.floor(r[2] / 2), (d.y + 1) * TILE - r[3]); }
// 이야기 단서: 냉장고 뒤 쪽지 (찾을 때까지 「!」 말풍선이 통통)
// 포장 전화: 계산대 위에 빨간 「!」 (만든 포장을 여기에 올려 둬요)
function takeoutHint() {
  if (!takeoutWaiting()) return;
  const [tx, ty] = REGISTER.tiles[0], bob = Math.round(Math.sin(t * 5) * 1.5);
  const x = tx * TILE + 11, y = ty * TILE - 18 + bob;
  bubble(x, y, 9, 12);
  ctx.fillStyle = '#e0533a'; ctx.fillRect(x + 4, y + 2, 2, 5); ctx.fillRect(x + 4, y + 8, 2, 2);
}
function clueHint() {
  if (!questActive('c1_note')) return;
  const bob = Math.round(Math.sin(t * 5) * 1.5), x = 8, y = 4 + bob;
  bubble(x, y, 9, 12);
  ctx.fillStyle = '#e0533a'; ctx.fillRect(x + 4, y + 2, 2, 5); ctx.fillRect(x + 4, y + 8, 2, 2);
}

// 오 사장님 가게 길잡이 (sim/tutorial.js): 시키는 곳을 분홍 화살표로 가리키고, 그 둘레가 반짝여요
//  화살표 끝 (x, y) · dir: 'down' 위에서 아래로 · 'left' 오른쪽에서 왼쪽으로
function arrow(x, y, dir) {
  const k = Math.round(Math.sin(t * 7) * 2);
  ctx.save();
  if (dir === 'left') { ctx.translate(x + k, y); ctx.rotate(Math.PI / 2); } else ctx.translate(x, y - Math.abs(k));
  // 아래를 보는 화살표 (끝이 0,0): 검은 테두리 → 분홍
  const shape = (o, col) => { ctx.fillStyle = col; for (let i = 0; i < 6; i++) ctx.fillRect(-1 - i - o, -1 - i - o, 3 + i * 2 + o * 2, 1 + o); ctx.fillRect(-2 - o, -12 - o, 5 + o * 2, 6 + o); };
  shape(1, '#3b2a20'); shape(0, '#ff5fa2');
  ctx.fillStyle = '#ffd1e6'; ctx.fillRect(-1, -11, 1, 4);
  ctx.restore();
}
function glow(x, y, w, h) {
  const a = 0.45 + Math.sin(t * 7) * 0.35;
  ctx.strokeStyle = `rgba(255,95,162,${a.toFixed(2)})`; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w - 1, h - 1);
}
function tutPointer() {
  const a = tutAsk(), r = G.run;
  if (!a || !r) return;
  if (a.at === 'stove') { const [x, y] = STATIONS.stove.tiles[0]; glow(x * TILE - 1, y * TILE - 1, TILE + 2, TILE * 2 + 2); arrow((x + 1) * TILE + 2, y * TILE + 14, 'left'); }
  else if (a.at === 'register') { const [x, y] = REGISTER.tiles[0]; glow(x * TILE - 1, y * TILE - 6, TILE * 2 + 2, TILE + 8); arrow(x * TILE + 24, y * TILE - 4, 'down'); }
  else if (a.at === 'seat') {
    const c = r.customers.filter(q => q.state === 'waitFood' && r.hands.some(d => d.menu === q.menu)).sort((p, q) => p.patience - q.patience)[0];
    if (!c) return;
    const px = Math.round(c.x * TILE), top = Math.round(c.y * TILE - 9 - (sittingNow(c) ? SIT_LIFT : 0));
    glow(px - 1, top - 2, 18, 30);
    arrow(px + 19, top + 12, 'left');
  }
}
// 오 사장님 머리 위: 시킬 때 「!」
function ohMark() {
  if (!tutAsk()) return;
  const x = TUT_SPOT.x * TILE + 3, y = TUT_SPOT.y * TILE - 30 + Math.round(Math.sin(t * 5) * 1.5);
  bubble(x, y, 9, 12);
  ctx.fillStyle = '#ff5fa2'; ctx.fillRect(x + 4, y + 2, 2, 5); ctx.fillRect(x + 4, y + 8, 2, 2);
}

// 아직 안 연 메뉴의 조리대는 그리지 않아요 (이야기로 메뉴가 열리면 생겨요)
const visibleFurniture = () => FURNITURE.filter(f => !f.station || menuOpen(STATIONS[f.station].menu));

export function drawFrame(dt) {
  if (!ready) return;
  t += dt;
  ctx.clearRect(0, 0, VW, VH);
  drawRoom();
  const r = G.run;
  // 뒤쪽 설비(벽에 붙은 것)
  const back = visibleFurniture().filter(f => f.y < 3 && !f.over);
  for (const f of back) spr(fSpr(f), f.x * TILE, f.y * TILE);
  for (const f of visibleFurniture().filter(f => f.y < 3 && f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  // 김이 나는 냄비
  if (r && r.cook) {
    const st = Object.values(STATIONS).find(s => s.menu === baseOf(r.cook.menu)); // 새 메뉴(치즈 떡볶이 등)는 기본 메뉴 조리대 — v0.64 고침: 전에는 못 찾아 그리기가 멈췄어요
    const [x, y] = st.tiles[0];
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.5 + i / 3) % 1;
      ctx.fillRect(x * TILE + 4 + i * 4 + Math.round(Math.sin((t + i) * 6)), y * TILE + 2 - Math.round(k * 10), 2, 2);
    }
  }
  // 앞쪽: 탁자·의자·계산대·사람을 y순으로
  const items = [];
  for (const f of FURNITURE.filter(f => f.y >= 3)) items.push({ y: f.y + (f.over ? 1.3 : 1), d: () => spr(fSpr(f), f.x * TILE, f.y * TILE) });
  // 같은 줄은 의자(0.2) → 앉은 손님(0.3) → 탁자(0.375) 순서: 발이 탁자에 올라가 보이지 않게
  SEATS.forEach((s, i) => items.push({ y: s.y + 0.2, d: () => spr(chairSpr(), s.x * TILE, s.y * TILE - 16, s.face === 'left') }));
  for (const d of decorNow()) items.push({ y: d.y + 1, d: () => drawDecor(d) });
  for (const d of plantsNow()) items.push({ y: d.y + 1, d: () => drawDecor(d) });
  if (r) {
    for (const c of r.customers) {
      const seated = sittingNow(c);
      if (seated) c.dir = SEATS[c.seat].face === 'right' ? 0 : 2;
      items.push({ y: c.y + (seated ? 0.3 : 0.6) + (c.lane || 0), d: () => drawChar(c.char, c.x, c.y + (c.lane || 0), c.dir, seated ? (c.state === 'eating' ? 'sitEat' : 'sit') : c.moving ? 'walk' : 'idle', t + c.id * 0.37) });
    }
    const p = r.player;
    items.push({ y: p.y + 0.6, d: () => drawChar(0, p.x, p.y, p.dir, p.moving ? 'walk' : 'idle', t) });
    // 프롤로그 1~2일차: 오 사장님이 화분 자리에 서서 지켜봐요 (시킬 때는 그쪽을 봐요)
    if (ohInShop()) {
      const a = tutAsk(), dir = a && a.at === 'stove' ? 1 : a && a.at === 'register' ? 3 : 2;
      items.push({ y: TUT_SPOT.y + 0.6, d: () => drawChar(CAST.oh.char, TUT_SPOT.x, TUT_SPOT.y, dir, 'idle', t * 0.8 + 2) });
    }
    // 탁자 위 음식
    SEATS.forEach((s, i) => {
      const c = r.seats[i] && r.customers.find(q => q.id === r.seats[i]);
      const tb = TABLES.find(q => q.no === s.table);
      if (c && c.state === 'eating') {
        // 탁자 위 작은 음식: 왼쪽 자리 손님 몫은 탁자 왼쪽, 오른쪽 자리 몫은 오른쪽에
        const sm = c.menu + '_s', sw = SPR[sm][2];
        const dx = s.face === 'right' ? tb.x * TILE + 1 : (tb.x + tb.w) * TILE - 1 - sw;
        items.push({ y: s.y + 1.05, d: () => spr(sm, dx, s.y * TILE - TABLE_LIFT + 2) });
      }
    });
  }
  items.sort((a, b) => a.y - b.y).forEach(o => o.d());
  stationHint();
  clueHint();
  takeoutHint();
  if (r) {
    for (const c of r.customers) drawCustomerUI(c);
    // 사장 손에 든 음식
    const p = r.player;
    r.hands.forEach((d, i) => sprC(d.menu, p.x * TILE + 8 + (r.hands.length > 1 ? (i ? 7 : -7) : 0), p.y * TILE - 22));
    tint(r.min);
    ohMark(); tutPointer(); // 길잡이 화살표는 맨 위에 밝게
  }
  // 누른 자리
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i]; m.t += dt;
    if (m.t > 0.35) { marks.splice(i, 1); continue; }
    const k = m.t / 0.35, s = 4 + k * 6;
    ctx.strokeStyle = `rgba(255,250,240,${1 - k})`; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(m.x * TILE + 8 - s) + 0.5, Math.round(m.y * TILE + 8 - s) + 0.5, Math.round(s * 2), Math.round(s * 2));
  }
}

// 준비·정산 화면 뒤에 비치는 가게 (손님 없이)
export function drawIdle(dt, night) {
  if (!ready) return;
  t += dt;
  ctx.clearRect(0, 0, VW, VH);
  drawRoom();
  for (const f of visibleFurniture().filter(f => !f.over)) spr(fSpr(f), f.x * TILE, f.y * TILE);
  SEATS.forEach(s => spr(chairSpr(), s.x * TILE, s.y * TILE - 16, s.face === 'left'));
  decorNow().forEach(drawDecor);
  plantsNow().forEach(drawDecor);
  for (const f of visibleFurniture().filter(f => f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  ctx.fillStyle = night ? 'rgba(30,36,90,.45)' : 'rgba(30,36,90,.3)';
  ctx.fillRect(0, 0, VW, VH);
}

// 마을 · 가게 안 (밤·새벽, 손님 없이): 사장이 걸어 다니고 물건을 눌러요 (ui/town.js). 마을 캔버스에 그려요
//  S: { me: { x, y, dir, moving }, time, dawn, marks: [{ x, y }] (칸 — 누를 수 있는 물건 위 작은 점) }
//  S.preview: 미소 가구 장바구니를 얹어서 · S.rows: 위에서 몇 줄만 (미리보기) · S.me 없으면 사장 없이
export function drawShopTo(canvas, S) {
  if (!ready) return;
  if (S.preview) { withFurn(S.preview, () => drawShopTo(canvas, { ...S, preview: null })); return; }
  const keep = ctx, ch = S.rows ? S.rows * TILE : VH;
  if (canvas.width !== VW || canvas.height !== ch) { canvas.width = VW; canvas.height = ch; }
  ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, VW, VH);
  drawRoom();
  for (const f of visibleFurniture().filter(f => f.y < 3 && !f.over)) spr(fSpr(f), f.x * TILE, f.y * TILE);
  for (const f of visibleFurniture().filter(f => f.y < 3 && f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  const items = [];
  for (const f of FURNITURE.filter(f => f.y >= 3)) items.push({ y: f.y + (f.over ? 1.3 : 1), d: () => spr(fSpr(f), f.x * TILE, f.y * TILE) });
  SEATS.forEach(s => items.push({ y: s.y + 0.2, d: () => spr(chairSpr(), s.x * TILE, s.y * TILE - 16, s.face === 'left') }));
  for (const d of decorNow()) items.push({ y: d.y + 1, d: () => drawDecor(d) });
  for (const d of plantsNow()) items.push({ y: d.y + 1, d: () => drawDecor(d) });
  const me = S.me;
  if (me) items.push({ y: me.y + 0.6, d: () => drawChar(0, me.x, me.y, me.dir, me.moving ? 'walk' : 'idle', S.time) });
  items.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // 밤엔 가게 불을 켠 느낌으로 살짝만 어둡게
  if (!S.rows) { ctx.fillStyle = S.dawn ? 'rgba(60,80,145,.12)' : 'rgba(30,36,90,.16)'; ctx.fillRect(0, 0, VW, VH); }
  const bob = Math.round(Math.sin(S.time * 4) * 1.5);
  for (const m of S.marks || []) { // 누를 수 있는 물건: 노란 점
    ctx.fillStyle = 'rgba(59,42,32,.6)'; ctx.fillRect(Math.round(m.x * TILE) - 2, Math.round(m.y * TILE) - 2 + bob, 5, 5);
    ctx.fillStyle = '#f5d76e'; ctx.fillRect(Math.round(m.x * TILE) - 1, Math.round(m.y * TILE) - 1 + bob, 3, 3);
  }
  ctx = keep;
}
export const shopViewSize = () => ({ w: VW, h: VH });
