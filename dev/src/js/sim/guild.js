// 상인회 규칙 (data/guild.js): 문 철물이 생기는 때 · 가입 · 설비 맡기기 · 도구 등급 업 · 설비 효과 값
//  G.guild = { seen: 문 회장님이 왔나, due: 오는 날, member: 회원인가, eq: { 설비: 1~3 }, tools2: [등급 올린 도구], visits, tradeDay }
import { G } from '../save/state.js';
import {
  EQUIP, TOOL_UP, GUILD_DUES, MOON_DISC, MOON_CHATS, MOON_FIRST,
  EQ_STIR_SLOW, EQ_ROLL_TAPS, EQ_FRY_ZONE, EQ_SHELF_PLUS, EQ_RUSH, EQ_PAY_SEC, EQ_PAY_WAIT,
} from '../data/guild.js';
import { RUSH_MUL, RUSH_SEC, PAY_STEP_SEC } from '../data/economy.js';
import { BOND_TRADE } from '../data/bond.js';
import { emit, defineCmd } from './events.js';
import { josa } from '../engine/util.js';
import { bondLv, addBond } from './bond.js';

export const newGuild = () => ({ seen: false, due: 0, member: false, eq: { stove: 1, mat: 1, fryer: 1, fridge: 1, register: 1 }, tools2: [], visits: 0, tradeDay: 0 });
// 문 철물이 문을 열었나 (2장 · 미소 가구 다음 날 밤부터)
export const guildOpen = () => !!(G.guild && G.guild.seen);
export const guildMember = () => !!(G.guild && G.guild.member);
export const eqLv = id => (G.guild && G.guild.eq[id]) || 1;
export const toolUp = id => !!(G.guild && G.guild.tools2.includes(id));
const moonOff = () => Object.keys(MOON_DISC).filter(k => bondLv('moon') >= +k).reduce((d, k) => Math.max(d, MOON_DISC[k]), 0);
export const moonDisc = moonOff;
export const eqPrice = id => { const L = EQUIP[id].lv[eqLv(id)]; return L ? Math.round(L.price * (1 - moonOff()) / 100) * 100 : 0; };
export const toolUpPrice = id => Math.round(TOOL_UP[id].price * (1 - moonOff()) / 100) * 100;
// 주간 회비 (sim/day.js 고지서)
export const guildDues = () => (guildMember() ? GUILD_DUES : 0);

// ── 설비 효과 (Lv) ──
export const stirSpeedMul = () => (eqLv('stove') >= 2 ? EQ_STIR_SLOW : 1);
export const rollTaps = base => (eqLv('mat') >= 2 ? EQ_ROLL_TAPS : base);
export const fryZone = () => (eqLv('fryer') >= 2 ? EQ_FRY_ZONE : null);
export const cookTwice = station => eqLv(station) >= 3; // 한 번에 2그릇
export const shelfPlus = () => (eqLv('fridge') >= 2 ? EQ_SHELF_PLUS : 0);
export const rushMul = () => (eqLv('fridge') >= 3 ? EQ_RUSH.mul : RUSH_MUL);
export const rushSec = () => (eqLv('fridge') >= 3 ? EQ_RUSH.sec : RUSH_SEC);
export const payStepSec = () => (eqLv('register') >= 2 ? EQ_PAY_SEC : PAY_STEP_SEC);
export const payWaitMul = () => (eqLv('register') >= 3 ? EQ_PAY_WAIT : 1);

// 문 회장님 오시는 날 정하기 · 그 밤에 장면 (sim/town.js townEnterNight)
export function guildNight() {
  const Gd = G.guild;
  if (!Gd || Gd.seen) return;
  if (!Gd.due) return;
  if (G.day >= Gd.due) { Gd.seen = true; G.story.queue.push('moon1'); }
}
// 철물점에 들를 때 미소 사장님 대화처럼: 첫 방문 · 차례대로
export function moonChat() {
  const Gd = G.guild;
  Gd.visits++;
  return Gd.visits === 1 ? MOON_FIRST : MOON_CHATS[(Gd.visits - 2) % MOON_CHATS.length];
}
function moonTrade() { if (G.guild.tradeDay !== G.day) { G.guild.tradeDay = G.day; addBond('moon', BOND_TRADE, '거래'); } }
const okHere = () => G.phase === 'prep' && G.town && G.town.guildIn && guildMember();

// 설비 맡기기: 다음 Lv로
defineCmd('equipUp', ({ id }) => {
  const E = EQUIP[id], lv = eqLv(id), L = E && E.lv[lv];
  if (!L || !okHere()) return false;
  if (bondLv('moon') < L.heart) { emit('toast', '문 회장님과 조금 더 친해져야 합니다', 'info'); return false; }
  const price = eqPrice(id);
  if (price > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  G.cash -= price;
  G.guild.eq[id] = lv + 1;
  emit('track', 'equip_up', { id, lv: lv + 1 });
  emit('toast', `${josa(E.name, '을/를')} 손봤습니다 · Lv${lv + 1} ${L.text}`, 'good');
  emit('sfx', 'coin');
  moonTrade();
  emit('prep');
  return true;
});
// 장사 도구 등급 업
defineCmd('toolUp', ({ id }) => {
  const T = TOOL_UP[id];
  if (!T || !okHere() || toolUp(id) || !(G.story.tools || []).includes(id)) return false;
  if (bondLv('moon') < T.heart) { emit('toast', '문 회장님과 조금 더 친해져야 합니다', 'info'); return false; }
  const price = toolUpPrice(id);
  if (price > G.cash) { emit('toast', '잔고가 모자랍니다', 'warn'); return false; }
  G.cash -= price;
  G.guild.tools2.push(id);
  emit('track', 'tool_up', { id });
  emit('toast', `${josa(T.name, '으로/로')} 바꿨습니다 · ${T.text}`, 'good');
  emit('sfx', 'coin');
  moonTrade();
  emit('prep');
  return true;
});
