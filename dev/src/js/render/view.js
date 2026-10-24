// 가게 그리기: 캔버스 1픽셀 = 그림 1픽셀, 화면에서는 정수 배로 키워요(픽셀이 뭉개지지 않게).
import { G } from '../save/state.js';
import { W, H, TILE, DOOR, FRONT_Y, FURNITURE, STATIONS, SEATS, TABLES, TABLE_LIFT, DECOR } from '../data/layout.js';
import { SPR, ATLAS_URL } from '../art/atlas.js';
import { isSeated } from '../sim/customers.js';
import { handsCount, ticketsCount } from '../sim/player.js';
import { menuOpen, questActive } from '../sim/story.js';

export const VW = W * TILE;
export const VH = H * TILE;
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
  for (let x = 0; x < W; x += 3) spr('wall', x * TILE, 0, false, Math.min(48, (W - x) * TILE), 32);
  tileFill('floor_kitchen', 0, 2, W, 4);
  tileFill('floor_dining', 0, 4, W, FRONT_Y);
  tileFill('sidewalk', 0, FRONT_Y, W, H);
  // 앞벽: 낮은 벽(유리창 대신) — 문 칸만 비워요
  for (let x = 0; x < W; x++) {
    if (x === DOOR.x) continue;
    spr('wall_front', x * TILE, FRONT_Y * TILE, false, 16, 16, 16);
  }
  spr('doormat', DOOR.x * TILE, FRONT_Y * TILE);
  // 주방과 홀 사이 얇은 그림자
  ctx.fillStyle = 'rgba(40,28,20,.18)'; ctx.fillRect(0, 4 * TILE, VW, 1);
}

function stationHint() {
  if (!G.run) return;
  for (const id in STATIONS) {
    const st = STATIONS[id]; if (!st.menu) continue;
    const need = ticketsCount(st.menu) - handsCount(st.menu);
    if (need <= 0) continue;
    const [x, y] = st.tiles[0];
    const bob = Math.round(Math.sin(t * 5) * 1.5);
    const bx = x * TILE + (st.tiles.length > 2 ? 8 : 0), by = y * TILE - 14 + bob;
    const b = iconBubble(st.menu, bx + 8, by + 14);
    if (need > 1) { ctx.fillStyle = '#e0533a'; ctx.fillRect(b.x + b.w - 5, b.y - 2, 6, 6); ctx.fillStyle = '#fff'; digit(need, b.x + b.w - 3, b.y - 1); }
  }
}
// 아주 작은 숫자 (3×4 픽셀)
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function digit(n, x, y) {
  const s = DIG[Math.min(9, n)];
  for (let i = 0; i < 15; i++) if (s[i] === '1') ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
}

// 자기 자리에 도착해 앉아 있는지 (걸어가는 중이면 서 있는 그림)
const sittingNow = c => isSeated(c) && !c.moving && c.x === SEATS[c.seat].x && c.y === SEATS[c.seat].y;
const SIT_LIFT = 11; // 앉은 그림을 위로 올리는 픽셀: 엉덩이가 의자 방석 높이에 오게 (6이면 의자 앞 바닥에 앉은 것처럼 보여요)
const SIT_SHIFT = 3; // 탁자 쪽으로 당기는 픽셀: 등받이가 등 뒤로 보이게
function drawCustomerUI(c) {
  const px = Math.round(c.x * TILE), top = Math.round(c.y * TILE - 9 - (sittingNow(c) ? SIT_LIFT : 0)); // 머리 바로 위
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
const decorNow = () => (G.story ? G.story.decor : []).map(k => DECOR[k]).filter(Boolean);
function drawDecor(d) { const r = SPR[d.spr]; if (r) spr(d.spr, d.x * TILE + 8 - Math.floor(r[2] / 2), (d.y + 1) * TILE - r[3]); }
// 이야기 단서: 냉장고 뒤 쪽지 (찾을 때까지 「!」 말풍선이 통통)
function clueHint() {
  if (!questActive('c1_note')) return;
  const bob = Math.round(Math.sin(t * 5) * 1.5), x = 8, y = 4 + bob;
  bubble(x, y, 9, 12);
  ctx.fillStyle = '#e0533a'; ctx.fillRect(x + 4, y + 2, 2, 5); ctx.fillRect(x + 4, y + 8, 2, 2);
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
  for (const f of back) spr(f.spr, f.x * TILE, f.y * TILE);
  for (const f of visibleFurniture().filter(f => f.y < 3 && f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  // 김이 나는 냄비
  if (r && r.cook) {
    const st = Object.values(STATIONS).find(s => s.menu === r.cook.menu);
    const [x, y] = st.tiles[0];
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.5 + i / 3) % 1;
      ctx.fillRect(x * TILE + 4 + i * 4 + Math.round(Math.sin((t + i) * 6)), y * TILE + 2 - Math.round(k * 10), 2, 2);
    }
  }
  // 앞쪽: 탁자·의자·계산대·사람을 y순으로
  const items = [];
  for (const f of FURNITURE.filter(f => f.y >= 3)) items.push({ y: f.y + (f.over ? 1.3 : 1), d: () => spr(f.spr, f.x * TILE, f.y * TILE) });
  SEATS.forEach((s, i) => items.push({ y: s.y + 0.4, d: () => spr('chair', s.x * TILE, s.y * TILE - 16, s.face === 'left') }));
  for (const d of decorNow()) items.push({ y: d.y + 1, d: () => drawDecor(d) });
  if (r) {
    for (const c of r.customers) {
      const seated = sittingNow(c);
      if (seated) c.dir = SEATS[c.seat].face === 'right' ? 0 : 2;
      items.push({ y: c.y + (seated ? 0.5 : 0.6) + (c.lane || 0), d: () => drawChar(c.char, c.x, c.y + (c.lane || 0), c.dir, seated ? (c.state === 'eating' ? 'sitEat' : 'sit') : c.moving ? 'walk' : 'idle', t + c.id * 0.37) });
    }
    const p = r.player;
    items.push({ y: p.y + 0.6, d: () => drawChar(0, p.x, p.y, p.dir, p.moving ? 'walk' : 'idle', t) });
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
  if (r) {
    for (const c of r.customers) drawCustomerUI(c);
    // 사장 손에 든 음식
    const p = r.player;
    r.hands.forEach((d, i) => sprC(d.menu, p.x * TILE + 8 + (r.hands.length > 1 ? (i ? 7 : -7) : 0), p.y * TILE - 22));
    tint(r.min);
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
  for (const f of visibleFurniture().filter(f => !f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  SEATS.forEach(s => spr('chair', s.x * TILE, s.y * TILE - 16, s.face === 'left'));
  decorNow().forEach(drawDecor);
  for (const f of visibleFurniture().filter(f => f.over)) spr(f.spr, f.x * TILE, f.y * TILE);
  ctx.fillStyle = night ? 'rgba(30,36,90,.45)' : 'rgba(30,36,90,.3)';
  ctx.fillRect(0, 0, VW, VH);
}
