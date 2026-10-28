// 개발자 모드: 원하는 날·장면으로 바로 가기 (처음 화면 「개발자 모드」). 퀘스트·메뉴·도구를 그 시점에 맞춰 채워요.
// 화면은 만지지 않아요 — 준비 화면으로 가는 건 ui가 setPhase로.
import { G, newGame } from '../save/state.js';
import { PREP_FIRST_DAY } from '../data/menu.js';
import { START_CASH } from '../data/economy.js';
import { defineCmd, emit } from './events.js';
import { forceIncident } from './incidents.js';
import { townEnterNight } from './town.js';
import { addReviews } from './rating.js';

const PRO = ['p_stir', 'p_serve', 'p_book', 'p_ahead', 'p_keys'];
// 가 볼 수 있는 곳: day(그날 준비 화면) · ch · title · done · active · queue(보여 줄 장면) · menus · toolsOpen · tools · decor · shop · town(마을 밤부터) · mastery(메뉴 숙련도) · cash(잔고) · bond(친밀도 점수) · furnSeen(미소 가구 장면 건너뛰기) · guild(상인회 상태)
export const DEV_JUMPS = [
  { id: 'p1', name: '프롤로그 1일차 · 첫 연출부터', day: 1, fresh: true },
  { id: 'p1b', name: '프롤로그 1일차 · 연출 없이 영업 (오 사장님 가게 길잡이)', day: 1, ch: 0, title: '알바생', active: ['p_keys'], queue: [] },
  { id: 'p2', name: '프롤로그 2일차 · 미리 만들기 길잡이', day: 2, ch: 0, title: '알바생', done: ['p_stir', 'p_serve', 'p_book'], active: ['p_keys'], prog: { p_keys: 1 } },
  { id: 'p3', name: '프롤로그 3일차 (인수 전날 · 오 사장님 전화)', day: 3, ch: 0, title: '알바생', done: ['p_stir', 'p_serve', 'p_book', 'p_ahead'], active: ['p_keys'], prog: { p_keys: 2 } },
  { id: 'c1h', name: '1장 4일차 · 인수 연출부터', day: 4, ch: 0, title: '알바생', done: PRO, queue: ['handover', 'paper0', 'ch1'] },
  { id: 'c1', name: '1장 4일차 · 개업 첫날', day: 4, ch: 1, title: '사장 지망생', shop: '골목분식', done: PRO, queue: ['ch1'] },
  { id: 'c1k', name: '1장 5일차 · 김밥·장사 도구', day: 5, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note'], active: ['c1_stock', 'c1_kimbap'], queue: ['tools'], menus: ['tteok', 'kimbap'], fresh: ['kimbap'], decor: [] },
  { id: 'c1f', name: '1장 6일차 · 튀김 (도구 다 있음)', day: 6, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer'], active: ['c1_stock'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
  { id: 'c1t', name: '1장 6일차 전날 밤 · 마을 첫 밤 (준비 시간·시장)', day: 6, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer'], active: ['c1_stock'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true },
  { id: 'c1w', name: '1장 7일차 · 첫 주 정리', day: 7, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock'], active: ['c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
  { id: 'c2u', name: '9일차 전날 밤 · 메뉴 연구 칠판 (숙련도 넉넉히, 마을)', day: 9, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, mastery: { tteok: 160, kimbap: 70, twigim: 28 } },
  { id: 'c2f', name: '9일차 전날 밤 · 미소 가구 개업 (돈 60만 원, 마을)', day: 9, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, cash: 600000 },
  { id: 'c2f5', name: '9일차 전날 밤 · 미소 가구 ♥♥♥♥♥ (고급·특별·확장공사, 돈 400만 원)', day: 9, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, cash: 4000000, bond: { miso: 80, jung: 30 } },
  { id: 'c2m', name: '10일차 전날 밤 · 문 철물 개업 (상인회 부탁부터)', day: 10, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, furnSeen: true, guild: { due: 10 }, cash: 1500000 },
  { id: 'c2g', name: '10일차 전날 밤 · 상인회원 (문 회장 ♥♥♥♥ · 돈 300만 원)', day: 10, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, furnSeen: true, guild: { seen: true, due: 10, member: true }, bond: { moon: 50, miso: 15, jung: 30 }, cash: 3000000 },
  { id: 'c2j', name: '10일차 전날 밤 · 정 사장 ♥♥♥♥♥ (특가 2개·빼 둔 재료·배달)', day: 10, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, furnSeen: true, guild: { seen: true, due: 10, member: true }, bond: { moon: 50, miso: 15, jung: 80 }, cash: 3000000 },
  { id: 'c2k', name: '12일차 전날 밤 · 2장 김 대리 부탁 (점심에 기다리다 간 손님 없는 날)', day: 12, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week', 'c2_park', 'c2_moon', 'c2_join'], active: ['c2_kim', 'c2_miso'], perks: ['oldTaste'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, furnSeen: true, guild: { seen: true, due: 10, member: true }, bond: { moon: 20, miso: 10, jung: 20 }, cash: 1500000 },
  { id: 'c2e', name: '14일차 전날 밤 · 2장 끝 직전 (주간 정산 때 별점 3.5 이상이면 「동네 사장」)', day: 14, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week', 'c2_park', 'c2_moon', 'c2_join', 'c2_kim', 'c2_doyun', 'c2_miso'], active: ['c2_end'], perks: ['oldTaste'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, furnSeen: true, guild: { seen: true, due: 10, member: true }, bond: { moon: 30, miso: 20, jung: 30 }, cash: 2000000 },
  { id: 'c2o', name: '8일차 전날 밤 · 2장 여는 장면 (바로: 아침 골목 → 「2장 · 골목 사람들」 · 오 사장님 전화)', day: 8, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true, queue: ['ch2soon'] },
  { id: 'c2', name: '8일차 · 2장 첫날 (박 할머니 부탁)', day: 8, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
];

defineCmd('devJump', ({ id }) => {
  const J = DEV_JUMPS.find(j => j.id === id);
  if (!J) return;
  newGame(J.shop);
  if (J.fresh === true) return;
  const S = G.story;
  G.day = J.day;
  Object.assign(S, {
    ch: J.ch, title: J.title, done: J.done || [], active: J.active || [], prog: { ...(J.prog || {}) },
    queue: J.queue || [], menus: J.menus || ['tteok'], fresh: J.fresh || [], decor: J.decor || [],
    toolsOpen: !!J.toolsOpen, tools: J.tools || [], perks: J.perks || [],
  });
  if (J.ch >= 2 && !J.active) S.active = ['c2_park'].concat(J.furnSeen ? ['c2_miso'] : []); // 2장: 박 할머니 부탁부터
  for (const q of S.done) S.prog[q] = 99;
  for (const m of S.menus) G.prep[m] = G.prep[m] || PREP_FIRST_DAY[m];
  if (J.ch >= 1) G.cash = START_CASH;
  if (J.ch >= 2) addReviews(Array.from({ length: 30 }, (_, i) => (i % 3 ? 4 : 5))); // 2장: 리뷰가 조금 쌓인 가게
  if (J.cash) G.cash = J.cash;
  if (J.furnSeen) G.furn.seen = true;
  if (J.guild) Object.assign(G.guild, J.guild);
  if (J.bond) Object.assign(G.bond.pts, J.bond);
  if (J.mastery) Object.assign(G.mastery, J.mastery);
  if (J.town) { G.history.push({ day: J.day - 1, revenue: 150000, net: 60000, served: 35, missed: 2, rating: 4, prep: {}, sold: { tteok: 15, kimbap: 10, twigim: 8 } }); townEnterNight(); } // 마을 첫 밤부터
});
// 영업 중: 돌발 이벤트 바로 일으키기 · 돈 더하기
defineCmd('devIncident', ({ id }) => { forceIncident(id); emit('toast', '개발자: 돌발 이벤트를 일으켰습니다', 'info'); });
defineCmd('devCash', () => { G.cash += 1000000; emit('toast', '개발자: 100만 원을 더했습니다', 'info'); emit('prep'); });
