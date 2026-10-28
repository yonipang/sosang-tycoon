// 동네 탐방 지도 그리기 (재래시장, v0.78): 바닥 → 가게·진열·노점·사람을 발끝 순서로 → 새벽빛 → 불빛 → 「!」
//  지도는 sim/explore.js genMarket이 그날 씨앗으로 만들어요. 움직임은 ui/explore.js
import { SPR, ATLAS_URL } from '../art/atlas.js';
import { TILE } from '../data/layout.js';

let XA = null, xc = null;
function xSpr(n, x, y) { const r = SPR[n]; if (r) xc.drawImage(XA, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]); }
const xh = n => (SPR[n] ? SPR[n][3] : 0), xw = n => (SPR[n] ? SPR[n][2] : 0);
function xPerson(a, t) {
  const r = SPR['char' + a.char]; if (!r) return;
  const row = a.moving ? 2 : 1, f = (a.dir ?? 3) * 6 + Math.floor(t * (a.moving ? 10 : 6)) % 6;
  xc.fillStyle = 'rgba(0,0,0,.22)'; xc.fillRect(Math.round(a.x - 5), Math.round(a.y - 1), 10, 2);
  xc.drawImage(XA, r[0] + f * 16, r[1] + row * 32, 16, 32, Math.round(a.x - 8), Math.round(a.y - 32), 16, 32);
}
function xMark(x, y, t) {
  const by = Math.round(y + Math.sin(t * 5 + x) * 1.5), bx = Math.round(x - 5);
  xc.fillStyle = '#fffaf0'; xc.fillRect(bx + 1, by, 9, 10); xc.fillRect(bx, by + 1, 11, 8); xc.fillRect(bx + 4, by + 10, 2, 2);
  xc.fillStyle = '#e0533a'; xc.fillRect(bx + 4, by + 2, 2, 4); xc.fillRect(bx + 4, by + 7, 2, 1);
}
function xGlow(x, y, r, a) {
  const g = xc.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,200,110,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)');
  xc.fillStyle = g; xc.fillRect(x - r, y - r, r * 2, r * 2);
}
const CARTS = ['mk_cart1', 'mk_cart2', 'mk_cart3', 'mk_cart6'], UMBS = ['mk_umb2', 'mk_umb3', 'mk_umb4', 'mk_umb3'];

// S: { map, cam, vw, vh, me, time, marks: [{tx,ty}] }
export function drawExplore(canvas, S) {
  if (!XA) { XA = new Image(); XA.src = ATLAS_URL; }
  if (!XA.complete) return;
  if (canvas.width !== S.vw || canvas.height !== S.vh) { canvas.width = S.vw; canvas.height = S.vh; }
  xc = canvas.getContext('2d'); xc.imageSmoothingEnabled = false;
  const M = S.map, t = S.time, cx = Math.round(S.cam.x), cy = Math.round(S.cam.y);
  xc.setTransform(1, 0, 0, 1, 0, 0);
  xc.fillStyle = '#1b1c2a'; xc.fillRect(0, 0, S.vw, S.vh);
  xc.translate(-cx, -cy);
  // 바닥: 시장 보도 (위 가게 줄 뒤는 어두운 골목)
  const pv = SPR.pave, x0 = Math.max(0, Math.floor(cx / TILE)), x1 = Math.min(M.W - 1, Math.floor((cx + S.vw) / TILE));
  const y0 = Math.max(0, Math.floor(cy / TILE)), y1 = Math.min(M.H - 1, Math.floor((cy + S.vh) / TILE));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const px = tx * TILE, py = ty * TILE;
    if (ty < 6) { xc.fillStyle = '#2b2733'; xc.fillRect(px, py, TILE, TILE); continue; }
    xc.drawImage(XA, pv[0] + (tx % 2) * 16, pv[1] + (ty % 2) * 16, 16, 16, px, py, 16, 16);
  }
  xc.fillStyle = 'rgba(140,100,60,.10)'; xc.fillRect(0, 96, M.W * TILE, (M.H - 6) * TILE); // 시장 바닥은 조금 따뜻하게
  // 물건 · 사람: 발끝(바닥 y) 순서
  const items = [];
  for (const s of M.shops) {
    const top = s.bot - 87;
    items.push({ y: s.bot, d: () => {
      xSpr('mk_b' + s.base, s.x, top);
      if (s.closed) { xSpr('mk_shut', s.x + 6, top + 50); xc.fillStyle = 'rgba(20,20,40,.18)'; xc.fillRect(s.x, top, 80, 87); }
      xSpr('mk_s_' + s.type, s.x + 4, top + 29);
    } });
    if (!s.closed) { const n = 'mk_d_' + s.type; items.push({ y: s.bot + 19, d: () => xSpr(n, s.x + 2, s.bot + 20 - xh(n)) }); }
  }
  for (const p of M.props) {
    const bx = p.tx * TILE, bot = (p.ty + 1) * TILE;
    if (p.kind === 'cart') { const n = CARTS[p.v % 4]; items.push({ y: bot, d: () => xSpr(n, bx + 1, bot - xh(n)) }); }
    else if (p.kind === 'stall') {
      items.push({ y: bot - 2, d: () => { xSpr('mk_bask' + (1 + p.v % 3), bx, bot - 13); xSpr('mk_bask' + (1 + (p.v + 1) % 3), bx + 32, bot - 13); } });
      const n = UMBS[p.v % 4]; items.push({ y: bot, d: () => xSpr(n, bx + 24 - Math.floor(xw(n) / 2), bot - xh(n)) });
    }
    else if (p.kind === 'board') items.push({ y: bot, d: () => xSpr('board', bx + 6, bot - xh('board')) });
    else if (p.kind === 'crate') items.push({ y: bot, d: () => xSpr('mk_crate', bx + 1, bot - xh('mk_crate')) });
    else if (p.kind === 'bus') items.push({ y: bot, d: () => xSpr('busstop', bx, bot - xh('busstop')) });
  }
  for (const a of M.actors) items.push({ y: a.ty * TILE + 13.5, d: () => xPerson({ char: a.char, x: a.tx * TILE + 8, y: a.ty * TILE + 13, dir: 3 }, t + a.char) });
  items.push({ y: S.me.y + 0.5, d: () => xPerson(S.me, t) });
  items.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // 새벽빛 + 가게 불빛
  xc.fillStyle = 'rgba(60,80,145,.28)'; xc.fillRect(cx, cy, S.vw, S.vh);
  xc.globalCompositeOperation = 'lighter';
  const fl = 0.92 + Math.sin(t * 9) * 0.05;
  for (const s of M.shops) if (!s.closed) xGlow(s.x + 54, s.bot - 24, 30, 0.16 * fl);
  for (const p of M.props) if (p.kind === 'cart') xGlow(p.tx * TILE + 24, p.ty * TILE - 6, 26, 0.14 * fl);
  xc.globalCompositeOperation = 'source-over';
  for (const m of S.marks || []) xMark(m.tx * TILE + 8, m.ty * TILE - 34, t);
  xc.setTransform(1, 0, 0, 1, 0, 0);
}
