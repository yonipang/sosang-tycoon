// 손님층 수첩 기록 (data/notebook.js · 화면 ui/notebook.js): 1장부터 손님층마다 세다가 조건을 채우면 칸이 열려요
//  G.notebook { 손님층: { sold: { 메뉴: 그릇 }, came, face, served, hrs: { 시: 주문 수 }, got: { 칸: 열린 날 }, seen: 본 칸 수 } }
//  영업 중에 바로 G에 더해요 (저장은 준비 단계에서만이라, 영업 중에 끄면 그날 몫은 없어요)
import { G } from '../save/state.js';
import { MENUS } from '../data/menu.js';
import { CUSTOMER_TYPES } from '../data/customers.js';
import { NOTE, NOTE_KEYS, PRICE_FEEL, WAIT_FEEL } from '../data/notebook.js';
import { josa } from '../engine/util.js';
import { emit, defineCmd } from './events.js';

const on = () => G.story && G.story.ch >= 1 && G.notebook;
export function nbOf(type) {
  const N = (G.notebook = G.notebook || {});
  return (N[type] = N[type] || { sold: {}, came: 0, face: 0, served: 0, hrs: {}, got: {}, seen: 0 });
}
// 읽기만 (화면용 — 없으면 빈 기록)
const EMPTY = { sold: {}, came: 0, face: 0, served: 0, hrs: {}, got: {}, seen: 0 };
export const nbPeek = type => (G.notebook && G.notebook[type]) || EMPTY;
const soldN = b => Object.values(b.sold).reduce((a, n) => a + n, 0);
export const nbCount = (b, k) => (NOTE[k].of === 'sold' ? soldN(b) : b[NOTE[k].of] || 0);
export const nbGot = type => NOTE_KEYS.filter(k => G.notebook && G.notebook[type] && G.notebook[type].got[k]);
export const nbNew = type => { const b = G.notebook && G.notebook[type]; return !!b && Object.keys(b.got).length > (b.seen || 0); };
defineCmd('nbSeen', ({ type }) => { if (!CUSTOMER_TYPES[type]) return; const b = nbOf(type); b.seen = Object.keys(b.got).length; }); // 화면에서 그 손님층을 열어 봤을 때 「새로」를 지워요

// 칸마다 적히는 말 { v: 큰 글자, why: 작은 글자 }
export function nbFav(b) { let best = null; for (const m in b.sold) if (!best || b.sold[m] > b.sold[best]) best = m; return best; }
export function nbPeak(b) { let best = null; for (const h in b.hrs) if (best == null || b.hrs[h] > b.hrs[best]) best = +h; return best; }
export function hourName(h) { const p = h < 11 ? '아침' : h < 14 ? '점심' : h < 18 ? '오후' : '저녁', a = h > 12 ? h - 12 : h, z = h + 1 > 12 ? h + 1 - 12 : h + 1; return `${p} ${a}~${z}시`; }
const feel = (L, x) => L.find(r => x < r[0]);
export function nbText(type, k) {
  const b = nbPeek(type), T = CUSTOMER_TYPES[type];
  if (k === 'fav') { const m = nbFav(b); return m ? { v: MENUS[m].name, menu: m, why: `우리 가게에서 ${josa(MENUS[m].name, '을/를')} 가장 많이 시켰습니다`, say: `${josa(T.name, '은/는')} ${josa(MENUS[m].name, '을/를')} 좋아합니다` } : null; }
  if (k === 'hour') { const h = nbPeak(b); return h != null ? { v: hourName(h), why: '가장 많이 온 시간입니다', say: `${josa(T.name, '은/는')} ${hourName(h)}에 많이 옵니다` } : null; }
  const f = k === 'price' ? feel(PRICE_FEEL, T.priceMul) : feel(WAIT_FEEL, T.patience);
  return { v: f[1], why: f[2], say: `${josa(T.name, '은/는')} ${f[3]}` };
}
function check(type) {
  const b = nbOf(type);
  for (const k of NOTE_KEYS) {
    if (b.got[k] || nbCount(b, k) < NOTE[k].need) continue;
    b.got[k] = G.day;
    const t = nbText(type, k);
    if (t) emit('notebook', type, t.say); // ui/feedback.js: 영업 중 짧은 알림 한 장
    emit('track', 'note_open', { type, key: k });
  }
}

// sim/customers.js decide: 메뉴를 고르며 가격 표정을 지었을 때 · 주문했을 때
export function nbFace(type) { if (!on() || !CUSTOMER_TYPES[type]) return; nbOf(type).face++; check(type); }
export function nbCame(type, hour) { if (!on() || !CUSTOMER_TYPES[type]) return; const b = nbOf(type); b.came++; b.hrs[hour] = (b.hrs[hour] || 0) + 1; check(type); }
// sim/customers.js pay: 계산했을 때
export function nbServed(type, menu) { if (!on() || !CUSTOMER_TYPES[type] || !menu) return; const b = nbOf(type); b.served++; b.sold[menu] = (b.sold[menu] || 0) + 1; check(type); }
