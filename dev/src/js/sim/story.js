// 이야기 규칙: 퀘스트 세기·끝내기, 장면 차례, 메뉴 열기. 화면은 만지지 않고 사건만 남겨요.
//  emit('story') = 보여 줄 장면이 생겼어요 (ui/story.js가 차례대로 보여 줘요)
import { G } from '../save/state.js';
import { ratingNow, resetReviews } from './rating.js';
import { addBond } from './bond.js';
import { QUESTS, SCENES, CAST } from '../data/story.js';
import { PREP_FIRST_DAY } from '../data/menu.js';
import { START_CASH, START_LOAN } from '../data/economy.js';
import { emit, defineCmd } from './events.js';
import { tutSceneDone } from './tutorial.js';

// 메뉴가 열렸는지 (조리대·주문·손님 메뉴가 모두 이걸 봐요)
export const menuOpen = m => G.story ? G.story.menus.includes(m) : m === 'tteok';
// 끝낸 퀘스트가 남긴 오래 가는 효과 (예: 'oldTaste' — 떡볶이 만족 +)
export const storyPerk = k => !!(G.story && (G.story.perks || []).includes(k));
export const questActive = id => !!G.story && G.story.active.includes(id);
const isDone = id => G.story.done.includes(id);
// 진행도 (화면용): [지금, 목표]
export const questProg = id => [Math.min(QUESTS[id].need, G.story.prog[id] || 0), QUESTS[id].need];
// 진행도는 다 찼는데 다른 퀘스트를 기다리는 중인지
export const questWaiting = id => (G.story.prog[id] || 0) >= QUESTS[id].need && !(QUESTS[id].after || []).every(isDone);

function start(id) {
  const S = G.story;
  if (isDone(id) || S.active.includes(id)) return;
  S.active.push(id);
  S.prog[id] = S.prog[id] || 0;
  if (QUESTS[id].kind === 'mood' && moodNow) S.prog[id] = Math.min(QUESTS[id].need, Math.max(S.prog[id], moodNow()));
}
// 분위기는 sim/furniture.js가 알려 줘요 (서로 부르지 않게 함수만 받아 둬요)
let moodNow = null;
export function setMoodSource(f) { moodNow = f; }

function openMenu(m, now) {
  const S = G.story;
  if (S.menus.includes(m) || S.soon.includes(m)) return;
  if (!now) { S.soon.push(m); return; }
  S.menus.push(m); S.fresh.push(m);
  G.prep[m] = PREP_FIRST_DAY[m] || 0;
}
// 새 메뉴 개발로 바로 열기 (sim/upgrade.js menuDev)
export function storyOpenMenu(m) { openMenu(m, true); }

function queueScene(id) {
  const sc = SCENES[id];
  // 조건에 따라 다른 장면 (예: 별점이 3.5 이상이면 좋은 기사)
  if (sc.alt && sc.alt.cond === 'rating35' && ratingNow() < 3.5) id = sc.alt.else;
  G.story.queue.push(id);
}

function complete(id) {
  const S = G.story, q = QUESTS[id];
  S.active = S.active.filter(x => x !== id);
  S.done.push(id); S.today.push(id);
  emit('toast', `퀘스트 완료 · ${q.title}`, 'quest');
  emit('track', 'quest', { id });
  emit('sfx', 'perfect');
  const g = q.give || {};
  if (g.menuNext) openMenu(g.menuNext, false);
  if (g.menuNow) openMenu(g.menuNow, true);
  if (g.bond) addBond(g.bond[0], g.bond[1], '부탁', true); // 부탁 퀘스트 +5 (sim/bond.js)
  if (g.perk) S.perks = (S.perks || []).concat(g.perk);
  if (g.guild && G.guild) { G.guild.member = true; emit('toast', '골목 상인회에 가입했습니다', 'good'); }
  for (const s of g.scenes || []) queueScene(s);
  // 기다리던 퀘스트 시작 · 기다리던 완료
  for (const qid in QUESTS) if (QUESTS[qid].needs && QUESTS[qid].needs.every(isDone)) start(qid);
  for (const qid of S.active.slice()) if (canFinish(qid)) complete(qid);
  if (g.scenes) emit('story');
  emit('quest');
}
const canFinish = id => (G.story.prog[id] || 0) >= QUESTS[id].need && (QUESTS[id].after || []).every(isDone);

// 규칙 코드가 「이런 일이 있었다」고 알려 주면 맞는 퀘스트를 세요
//  d: { menu, q(조리 결과), n(사람 수), served(그날 받은 손님), clean(재료가 안 떨어진 날) }
export function storyNote(kind, d = {}) {
  const S = G.story;
  if (!S) return;
  for (const id of S.active.slice()) {
    const q = QUESTS[id];
    if (q.kind !== kind || (q.menu && d.menu !== q.menu)) continue;
    const before = S.prog[id] || 0;
    if (kind === 'cook') S.prog[id] = before + (d.q === 2 ? 1 : 0);
    else if (kind === 'cookStreak') S.prog[id] = d.q === 2 ? before + 1 : 0; // 연달아: 「완벽」이 아니면 처음부터
    else if (kind === 'lunchClean') S.prog[id] = before + (d.clean ? 1 : 0);
    else if (kind === 'lateServed') S.prog[id] = before + (d.n || 1);
    else if (kind === 'mood') S.prog[id] = Math.max(before, d.mood || 0);
    else if (kind === 'weeklyRating') S.prog[id] = before + (d.ok ? 1 : 0);
    else if (kind === 'paid') S.prog[id] = before + (d.n || 1);
    else if (kind === 'dayServed') S.prog[id] = Math.max(before, d.served || 0);
    else if (kind === 'cleanDay') S.prog[id] = before + (d.clean ? 1 : 0);
    else if (kind === 'profitDay') S.prog[id] = before + (d.profit > 0 ? 1 : 0); // 순이익이 플러스인 날 (v0.77)
    else S.prog[id] = before + 1;
    S.prog[id] = Math.min(q.need, S.prog[id]);
    if (S.prog[id] !== before) emit('quest');
    if (S.active.includes(id) && canFinish(id)) complete(id);
  }
}

// 영업 시작 · 다음 날: 오늘 끝낸 퀘스트 비우기, 예약한 메뉴 열기
export function storyOpenDay() { if (G.story) G.story.today = []; }
export function storyNextDay() {
  const S = G.story;
  const soon = S.soon;
  S.fresh = []; S.soon = [];
  for (const m of soon) openMenu(m, true);
}

// 장면을 열 때 (startFirst면 퀘스트·칭호를 먼저)
defineCmd('sceneOpen', () => {
  const S = G.story, sc = SCENES[S.queue[0]];
  if (!sc || !sc.startFirst) return;
  for (const q of sc.start || []) start(q);
  if (sc.title) S.title = sc.title;
  if (sc.opens === 'tools') S.toolsOpen = true;
  emit('quest');
  if (G.phase === 'prep') emit('prep');
});

// 장면을 다 보면: 퀘스트 시작 · 칭호 · 장 · 장식 · 가게 이름
defineCmd('sceneDone', ({ name }) => {
  const S = G.story, id = S.queue.shift();
  const sc = SCENES[id];
  if (!sc) return;
  if (sc.ask === 'shop') { G.shop = (name || '').trim().slice(0, 8) || '골목분식'; resetReviews(); emit('toast', '새 이름으로 지도에 올렸습니다. 리뷰 0개부터 — 리뷰가 쌓일수록 손님이 늘어납니다', 'info'); } // 별점은 새 가게부터 (sim/rating.js)
  for (const q of sc.start || []) start(q);
  if (sc.title) S.title = sc.title;
  if (sc.ch !== undefined) S.ch = sc.ch;
  if (sc.ch === 3 && !S.c3) S.c3 = G.day; // 3장 시작한 날 (sim/rival.js c3Day)
  if (sc.decor && !S.decor.includes(sc.decor)) S.decor.push(sc.decor);
  if (sc.opens === 'tools') S.toolsOpen = true;
  // 가게를 넘겨받을 때: 오 사장님 가게 돈은 사장님이 정리해 가고, 내 돈과 창업 대출로 새로 시작
  tutSceneDone(id);
  // 휴대폰 「최근 통화」(ui/town.js): 전화 장면은 기록해 두고 다시 읽을 수 있게 (v0.54)
  if ((sc.lines || []).some(l => CAST[l[0]] && CAST[l[0]].phone)) S.calls = [{ id, day: G.day }, ...(S.calls || [])].slice(0, 12);
  emit('track', 'scene', { id }); // 어디까지 봤나 (그만둔 지점)
  if (sc.ch !== undefined) emit('track', 'chapter', { to: sc.ch });
  if (sc.money === 'start') { G.cash = START_CASH; G.loan = START_LOAN; G.weekSales = 0; emit('toast', `가게 통장 · ${START_CASH.toLocaleString('ko-KR')}원으로 시작합니다`, 'good'); }
  emit('quest');
  if (G.phase === 'prep') emit('prep');
});

// 휴대폰을 처음 열 때 안내 카드 한 번 (v0.61 · G.story.phoneSeen)
defineCmd('phoneHelp', () => {
  const S = G.story;
  if (!S || S.phoneSeen) return false;
  S.phoneSeen = true; S.queue.unshift('phone1');
  emit('story');
  return true;
});

// 준비 화면에서 돈 내는 퀘스트 (예: 튀김기 수리비)
defineCmd('questPay', ({ id }) => {
  const q = QUESTS[id];
  if (!q || q.kind !== 'pay' || !questActive(id) || G.phase !== 'prep') return;
  if (G.cash < q.cost) { emit('toast', '잔고가 모자랍니다', 'warn'); return; }
  G.cash -= q.cost;
  emit('sfx', 'coin');
  G.story.prog[id] = q.need;
  complete(id);
  emit('prep');
});

// 냉장고를 눌렀을 때 쪽지를 찾는 퀘스트가 있으면 쪽지를 찾아요 (true면 냉장고 창은 안 열어요)
export function storyFridge() {
  if (!questActive('c1_note')) return false;
  storyNote('note');
  return true;
}

