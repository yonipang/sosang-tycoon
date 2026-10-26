// 오 사장님 가게 길잡이 규칙 (data/tutorial.js): 영업 중 일어난 일로 차례를 넘기고, 장면을 줄에 넣고, 시키는 동안 가게 시계를 멈춰요.
// 화면은 만지지 않아요: 장면은 emit('story'), 띠·화살표는 화면이 tutAsk()를 읽어 그려요.
// 끝낸 차례는 G.story.tut에 남아요 (준비 화면에서 저장돼요 — 영업 중에 끄면 그날 차례부터 다시)
import { G } from '../save/state.js';
import { TUTORIAL, TUT_DAYS } from '../data/tutorial.js';
import { SCENES } from '../data/story.js';
import { emit } from './events.js';
import { spawnParty, freeChars } from './customers.js';

// 오늘 가게에 오 사장님이 서 있나 (프롤로그 1~2일차)
export const ohInShop = () => !!(G.story && G.story.ch === 0 && G.day <= TUT_DAYS);
// 길잡이가 켜져 있나 (프롤로그 동안)
export const tutOn = () => !!(G.story && G.story.ch === 0 && G.story.tut);
// 지금 시키는 일 (없으면 null) — { text, at, until }
export function tutAsk() {
  const r = G.run;
  const s = r && r.tutStep && TUTORIAL.find(x => x.id === r.tutStep);
  return s && s.ask && r.tutLive ? s.ask : null;
}
// 시키는 동안은 가게 시계·손님 기다림이 멈춰요 (sim/loop.js · customers.js)
export const tutHold = () => !!tutAsk();

// 오늘 다음 차례
function nextStep() {
  const done = G.story.tut;
  return TUTORIAL.find(s => s.day === G.day && !done.includes(s.id)) || null;
}

function finishStep(s) {
  const r = G.run;
  G.story.tut.push(s.id);
  if (r) { r.tutStep = null; r.tutLive = false; }
  if (r && s.guest) { const ch = freeChars('student')[0]; if (ch !== undefined) spawnParty([ch], { force: true, wants: s.guest }); }
  arm('now');
}

// 차례를 시작해요
function begin(s) {
  const r = G.run;
  r.tutStep = s.id;
  if (s.scene) { G.story.queue.push(s.scene); r.tutLive = true; emit('story'); return; } // 장면을 다 보면 tutSceneDone
  // 시킬 일이 이미 필요 없으면 (예: 손에 이미 들었다) 건너뛰어요
  if (!askNeeded(s.ask)) { finishStep(s); return; }
  r.tutLive = true;
  emit('sfx', 'page');
}
function askNeeded(a) {
  const r = G.run;
  if (a.at === 'seat') return r.customers.some(c => c.state === 'waitFood' && r.hands.some(d => d.menu === c.menu));
  if (a.at === 'register') return r.payLine.length > 0;
  if (a.at === 'stove' && a.until === 'cookStart') return !r.cook;
  return true;
}

// 이 일이 일어나면 기다리던 차례를 시작해요
function arm(kind) {
  const r = G.run;
  if (!r || r.tutStep) return;
  const s = nextStep();
  if (s && s.on === kind) begin(s);
}

// 규칙 코드가 알려 줘요: open · order · cookStart · cookEnd · served · payLine · paid · closing · impatient
export function tutNote(kind) {
  if (!tutOn() || !G.run || G.phase !== 'day') return;
  const r = G.run, cur = r.tutStep && TUTORIAL.find(x => x.id === r.tutStep);
  if (cur && cur.ask && r.tutLive && cur.ask.until === kind) { finishStep(cur); return; }
  arm(kind);
}

// 장면을 다 봤을 때 (sim/story.js sceneDone)
export function tutSceneDone(id) {
  const r = G.run;
  if (!r || !r.tutStep) return;
  const s = TUTORIAL.find(x => x.id === r.tutStep);
  if (s && s.scene === id) finishStep(s);
}

// 영업이 끝나면 오늘 못 한 차례는 건너뛰어요 (장면이 주는 퀘스트는 받아요)
export function tutEndDay() {
  if (!tutOn()) return;
  const S = G.story;
  for (const s of TUTORIAL) {
    if (s.day > G.day || S.tut.includes(s.id)) continue;
    S.tut.push(s.id);
    const sc = s.scene && SCENES[s.scene];
    for (const q of (sc && sc.start) || []) if (!S.done.includes(q) && !S.active.includes(q)) { S.active.push(q); S.prog[q] = S.prog[q] || 0; }
    if (s.scene) S.queue = S.queue.filter((x, i) => i === 0 || x !== s.scene); // 못 본 장면은 다음 날로 넘기지 않아요 (맨 앞은 지금 보고 있을 수 있어요)
  }
}
