// 연출 그리기: 따로 둔 캔버스(#cutCv)에 밤의 골목을 그려요. 움직임 상태는 ui/cutscene.js가 들고 와요.
import { SPR, ATLAS_URL } from '../art/atlas.js';
import { fxRand } from '../engine/random.js';

export const CUT_W = 128;  // 게임 화면보다 좁게 잘라 크게 보여요 (휴대폰에서 3배)
export const CUT_H = 176;
const WORLD_W = 272, GROUND = 144, ROAD = 176;
const STORES = [['st_flower', 16], ['st_bunsik', 96], ['st_laundry', 176]];
const SHOP_X = 96, SHOP_TOP = GROUND - 118; // 오가네 분식 그림 왼쪽 위
const LAMP_X = 84; // data/cutscenes.js opening props의 가로등 x와 같게
let cutCanvas, cx, cutAtlas, cutStars = null;

export function initCut(canvas) {
  cutCanvas = canvas; cx = cutCanvas.getContext('2d');
  cutCanvas.width = CUT_W; cutCanvas.height = CUT_H;
  cutAtlas = new Image(); cutAtlas.src = ATLAS_URL;
}
// 그림 1픽셀이 기기 화면 픽셀 정수 개가 되게 키워요 (render/view.js fitView와 같은 방법)
export function fitCut(availW, availH) {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.max(1, Math.floor(Math.min(availW / CUT_W, availH / CUT_H) * dpr)) / dpr;
  cutCanvas.style.width = CUT_W * s + 'px'; cutCanvas.style.height = CUT_H * s + 'px';
}

function cspr(name, x, y, flip) {
  const r = SPR[name]; if (!r) return;
  if (flip) { cx.save(); cx.translate(Math.round(x) + r[2], Math.round(y)); cx.scale(-1, 1); cx.drawImage(cutAtlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); cx.restore(); }
  else cx.drawImage(cutAtlas, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]);
}
// 사람: x 가운데 · y 발끝. 줄 1 숨쉬기 · 2 걷기 · 3 앉기(0 오른쪽 · 6 왼쪽)
function person(a, t) {
  const r = SPR['char' + a.char]; if (!r) return;
  let row, f, lift = 0;
  if (a.pose === 'sit' && !a.moving) { row = 3; f = a.dir === 2 ? 6 : 0; lift = 6; }
  else if (a.moving) { row = 2; f = a.dir * 6 + Math.floor(t * 10) % 6; }
  else { row = 1; f = a.dir * 6 + Math.floor(t * 6) % 6; }
  if (a.stool) cspr('stool', a.x - 6, a.y - 13);
  cx.drawImage(cutAtlas, r[0] + f * 16, r[1] + row * 32, 16, 32, Math.round(a.x - 8), Math.round(a.y - 32 - lift), 16, 32);
  if (a.carry) cspr(a.carry, a.x + (a.dir === 2 ? -11 : 2), a.y - 13);
}

function cbubble(x, y, w, h) {
  cx.fillStyle = '#fffaf0';
  cx.fillRect(x + 1, y, w - 2, h); cx.fillRect(x, y + 1, w, h - 2);
  cx.fillRect(x + Math.floor(w / 2) - 1, y + h, 2, 2);
}
// 머리 위 감정 표시
function emote(a, kind, k) {
  const pose = a.pose === 'sit' && !a.moving ? 6 : 0;
  const x = Math.round(a.x - 5), y = Math.round(a.y - 46 - pose - (k < 0.15 ? (0.15 - k) * 20 : 0));
  if (kind === 'sweat') { // 머리 옆 땀방울 (흘러내려요)
    const hx = Math.round(a.x + 6), hy = Math.round(a.y - 28 - pose + Math.min(3, k * 4));
    cx.fillStyle = '#c9ecff'; cx.fillRect(hx + 1, hy, 1, 1); cx.fillRect(hx, hy + 1, 3, 3);
    cx.fillStyle = '#5a8fd0'; cx.fillRect(hx, hy + 4, 3, 1); cx.fillStyle = '#ffffff'; cx.fillRect(hx, hy + 1, 1, 1);
    return;
  }
  cbubble(x, y, 11, 10);
  if (kind === '!') { cx.fillStyle = '#e0533a'; cx.fillRect(x + 5, y + 2, 2, 4); cx.fillRect(x + 5, y + 7, 2, 1); }
  else if (kind === '…') { cx.fillStyle = '#3b2a20'; for (let i = 0; i < 3; i++) if (k * 4 > i) cx.fillRect(x + 2 + i * 3, y + 5, 2, 2); }
  else if (kind === 'heart') { cx.fillStyle = '#e0533a'; cx.fillRect(x + 3, y + 3, 2, 2); cx.fillRect(x + 6, y + 3, 2, 2); cx.fillRect(x + 3, y + 4, 5, 2); cx.fillRect(x + 4, y + 6, 3, 1); cx.fillRect(x + 5, y + 7, 1, 1); }
}

function sky(t) {
  const g = cx.createLinearGradient(0, -220, 0, GROUND);
  g.addColorStop(0, '#0b0e24'); g.addColorStop(0.65, '#1d2340'); g.addColorStop(1, '#3a3160');
  cx.fillStyle = g; cx.fillRect(0, -220, WORLD_W, GROUND + 220);
  if (!cutStars) cutStars = Array.from({ length: 46 }, () => ({ x: Math.floor(fxRand() * WORLD_W), y: Math.floor(-210 + fxRand() * 230), p: fxRand() * 6 }));
  for (const s of cutStars) { cx.fillStyle = Math.sin(t * 2 + s.p) > 0.6 ? '#fffbe0' : '#8f93c0'; cx.fillRect(s.x, s.y, 1, 1); }
  // 달
  cx.fillStyle = '#fff3c4'; cx.beginPath(); cx.arc(214, -96, 9, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#e8d9a0'; cx.fillRect(210, -99, 3, 2); cx.fillRect(217, -93, 2, 2);
}

function ground() {
  const r = SPR.pave;
  for (let x = 0; x < WORLD_W; x += r[2]) cx.drawImage(cutAtlas, r[0], r[1], r[2], r[3], x, GROUND, r[2], r[3]);
  cx.fillStyle = '#5c5a6a'; cx.fillRect(0, ROAD, WORLD_W, 2);
  cx.fillStyle = '#34333f'; cx.fillRect(0, ROAD + 2, WORLD_W, 40);
  cx.fillStyle = '#c9b88e'; for (let x = 4; x < WORLD_W; x += 20) cx.fillRect(x, ROAD + 17, 10, 2);
}

// 따뜻한 불빛 (밤빛을 덮은 뒤에 더해요)
function glow(x, y, w, h, a) {
  cx.fillStyle = `rgba(255,214,130,${a})`;
  cx.fillRect(x, y, w, h);
}

// S: { cam, actors, props, door, fade, emotes, time }
export function drawCut(S) {
  if (!cx || !cutAtlas.complete) return;
  const t = S.time;
  cx.clearRect(0, 0, CUT_W, CUT_H);
  cx.save();
  cx.translate(-Math.round(S.cam.x), -Math.round(S.cam.y));
  sky(t);
  for (const [n, x] of STORES) cspr(n, x, SHOP_TOP);
  cspr('sign', SHOP_X + 9, SHOP_TOP + 68);
  ground();
  // 물건·사람을 발끝 순서로
  const items = S.props.map(p => ({ y: p.y, d: () => cspr(p.spr, p.x, p.y - SPR[p.spr][3]) }));
  for (const id in S.actors) { const a = S.actors[id]; if (!a.hidden) items.push({ y: a.y, d: () => person(a, t + a.char) }); }
  items.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // 밤빛
  cx.fillStyle = 'rgba(22,26,70,.42)'; cx.fillRect(0, -220, WORLD_W, 440);
  // 불빛: 가게 창 · 열린 문 · 가로등
  const fl = 0.9 + Math.sin(t * 9) * 0.05;
  glow(SHOP_X + 41, SHOP_TOP + 86, 31, 22, 0.32);
  if (S.door) { glow(SHOP_X + 18, SHOP_TOP + 92, 12, 23, 0.55); glow(SHOP_X + 12, GROUND, 24, 10, 0.18); }
  glow(SHOP_X + 2, SHOP_TOP + 66, 76, 2, 0.25);
  cx.fillStyle = `rgba(255,214,130,${0.10 * fl})`;
  for (let i = 0; i < 4; i++) { const w = 18 + i * 8; cx.fillRect(LAMP_X + 7 - w / 2, 150 + i * 6, w, 6); } // 가로등 불빛 웅덩이
  glow(LAMP_X + 3, 118, 8, 7, 0.45 * fl); // 가로등 머리
  // 감정 표시 (밝게)
  for (const id in S.emotes) { const e = S.emotes[id], a = S.actors[id]; if (a && !a.hidden) emote(a, e.kind, e.t); }
  cx.restore();
  if (S.fade > 0) { cx.fillStyle = `rgba(8,8,16,${S.fade})`; cx.fillRect(0, 0, CUT_W, CUT_H); }
}
