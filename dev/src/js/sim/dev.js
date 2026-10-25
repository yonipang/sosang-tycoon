// 개발자 모드: 원하는 날·장면으로 바로 가기 (처음 화면 「개발자 모드」). 퀘스트·메뉴·도구를 그 시점에 맞춰 채워요.
// 화면은 만지지 않아요 — 준비 화면으로 가는 건 ui가 setPhase로.
import { G, newGame } from '../save/state.js';
import { PREP_FIRST_DAY } from '../data/menu.js';
import { START_CASH } from '../data/economy.js';
import { defineCmd, emit } from './events.js';
import { forceIncident } from './incidents.js';
import { townEnterNight } from './town.js';

const PRO = ['p_stir', 'p_serve', 'p_book', 'p_keys'];
// 가 볼 수 있는 곳: day(그날 준비 화면) · ch · title · done · active · queue(보여 줄 장면) · menus · toolsOpen · tools · decor · shop
export const DEV_JUMPS = [
  { id: 'p1', name: '프롤로그 1일차 · 첫 연출부터', day: 1, fresh: true },
  { id: 'p1b', name: '프롤로그 1일차 · 연출 없이 영업', day: 1, ch: 0, title: '알바생', active: PRO, queue: [] },
  { id: 'p3', name: '프롤로그 3일차 (인수 전날)', day: 3, ch: 0, title: '알바생', done: ['p_stir', 'p_serve', 'p_book'], active: ['p_keys'], prog: { p_keys: 2 } },
  { id: 'c1h', name: '1장 4일차 · 인수 연출부터', day: 4, ch: 0, title: '알바생', done: PRO, queue: ['handover', 'paper0', 'ch1'] },
  { id: 'c1', name: '1장 4일차 · 개업 첫날', day: 4, ch: 1, title: '사장 지망생', shop: '골목분식', done: PRO, queue: ['ch1'] },
  { id: 'c1k', name: '1장 5일차 · 김밥·장사 도구', day: 5, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note'], active: ['c1_stock', 'c1_kimbap'], queue: ['tools'], menus: ['tteok', 'kimbap'], fresh: ['kimbap'], decor: [] },
  { id: 'c1f', name: '1장 6일차 · 튀김 (도구 다 있음)', day: 6, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer'], active: ['c1_stock'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
  { id: 'c1t', name: '1장 6일차 전날 밤 · 마을 첫 밤 (밤·새벽·시장)', day: 6, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer'], active: ['c1_stock'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'], town: true },
  { id: 'c1w', name: '1장 7일차 · 고정비 내는 날', day: 7, ch: 1, title: '사장 지망생', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock'], active: ['c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
  { id: 'c2', name: '8일차 · 1장 끝 (2장 준비 중)', day: 8, ch: 2, title: '초보 사장', shop: '골목분식', done: [...PRO, 'c1_first', 'c1_note', 'c1_kimbap', 'c1_tools', 'c1_fryer', 'c1_stock', 'c1_week'], menus: ['tteok', 'kimbap', 'twigim'], toolsOpen: true, tools: ['tray', 'timer', 'warmer'], decor: ['plant'] },
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
    toolsOpen: !!J.toolsOpen, tools: J.tools || [],
  });
  for (const q of S.done) S.prog[q] = 99;
  for (const m of S.menus) G.prep[m] = G.prep[m] || PREP_FIRST_DAY[m];
  if (J.ch >= 1) G.cash = START_CASH;
  if (J.town) { G.history.push({ day: J.day - 1, revenue: 150000, net: 60000, served: 35, missed: 2, rating: 4, prep: {}, sold: { tteok: 15, kimbap: 10, twigim: 8 } }); townEnterNight(); } // 마을 첫 밤부터
});
// 영업 중: 돌발 이벤트 바로 일으키기 · 돈 더하기
defineCmd('devIncident', ({ id }) => { forceIncident(id); emit('toast', '개발자: 돌발 이벤트를 일으켰습니다', 'info'); });
defineCmd('devCash', () => { G.cash += 1000000; emit('toast', '개발자: 100만 원을 더했습니다', 'info'); emit('prep'); });
