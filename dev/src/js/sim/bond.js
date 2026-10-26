// 친밀도 규칙 (data/bond.js): 점수 쌓기(하루 한도) · 단계 · 할인
//  G.bond = { pts: { miso, jung, moon }, day: 오늘 날짜, got: { 누구: 오늘 얻은 점수 } }
import { G } from '../save/state.js';
import { BOND_LV, BOND_DAY_MAX, BOND_NAME, BOND_PERKS, MISO_DISC, JUNG_DISC } from '../data/bond.js';
import { emit } from './events.js';
import { josa } from '../engine/util.js';

export const newBond = () => ({ pts: { miso: 0, jung: 0, moon: 0 }, day: 0, got: {} });
export const bondPts = who => (G.bond && G.bond.pts[who]) || 0;
// 단계 0~5
export function bondLv(who) {
  const p = bondPts(who);
  let lv = 0;
  while (lv < BOND_LV.length && p >= BOND_LV[lv]) lv++;
  return lv;
}
// 다음 단계까지 [지금 점수 − 이번 단계 기준, 다음 단계 기준 − 이번 단계 기준] (다 찼으면 null)
export function bondNext(who) {
  const lv = bondLv(who), p = bondPts(who);
  if (lv >= BOND_LV.length) return null;
  const base = lv ? BOND_LV[lv - 1] : 0;
  return [p - base, BOND_LV[lv] - base];
}
// 점수 더하기: 하루에 한 사람에게 BOND_DAY_MAX까지 (free: 한도와 따로 — 첫 방문·부탁 퀘스트)
//  why: 알림에 붙는 말. 오른 만큼 돌려줘요
export function addBond(who, n, why, free) {
  const B = G.bond;
  if (!B || !(who in B.pts)) return 0;
  if (B.day !== G.day) { B.day = G.day; B.got = {}; }
  const room = free ? n : Math.max(0, Math.min(n, BOND_DAY_MAX - (B.got[who] || 0)));
  if (!room) return 0;
  const before = bondLv(who);
  B.pts[who] += room;
  if (!free) B.got[who] = (B.got[who] || 0) + room;
  const after = bondLv(who);
  if (after > before) emit('toast', `${josa(BOND_NAME[who], '과/와')} 더 친해졌습니다 ${'♥'.repeat(after)} · ${BOND_PERKS[who][after - 1]}`, 'good');
  else if (why) emit('toast', `${BOND_NAME[who]} ♥ +${room} (${why})`, 'info');
  return room;
}
const disc = (tab, lv) => Object.keys(tab).filter(k => lv >= +k).reduce((d, k) => Math.max(d, tab[k]), 0);
export const misoDisc = () => disc(MISO_DISC, bondLv('miso'));
export const jungDisc = () => disc(JUNG_DISC, bondLv('jung'));
