// 메뉴 업그레이드 (data/menu.js MENU_LEVELS): 숙련도(그 메뉴를 내준 그릇, 완벽 조리 1.5) + 돈으로 Lv1~5
// 효과: 손님이 적당하다고 느끼는 가격(customers.js reaction·decide) · 만족(satisfaction) · 재방문(가게 앞에서 들어올 확률 — atDoor)
// 저장: G.menuLv { 메뉴: 레벨 } · G.mastery { 메뉴: 숙련도 } · G.fans { 사람(그림 번호): { m: 맛있게 먹은 메뉴, n: 다시 온 횟수 } }
// 영업 중에는 G.run.log에만 모아 두고 마감 때 더해요 (영업 중에 끄면 그날 것은 없던 일)
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, MENU_LEVELS, MENU_LV_MAX, MASTERY_PERFECT, REVISIT_SAT, INGREDIENTS, DEV_OPEN_CH } from '../data/menu.js';
import { emit, defineCmd } from './events.js';
import { menuOpen, storyOpenMenu } from './story.js';
import { todayMenus, slotsOpen } from './pantry.js';
import { josa } from '../engine/util.js';

// 1장(가게를 맡은 뒤)부터, 마을의 우리 가게 「메뉴 연구 칠판」에서 — 장과 상관없이 Lv5까지
export const upgradeOpen = () => !!(G.story && G.story.ch >= 1);
export const menuLv = m => (G.menuLv && G.menuLv[m]) || 1;
export const lvInfo = (m, lv = menuLv(m)) => MENU_LEVELS[lv];
export const fairMul = m => 1 + lvInfo(m).fair;
export const lvSat = m => lvInfo(m).sat;
// 이 레벨의 기본 가격 (처음 가격 × 적당한 가격 배율, 100원 단위) — 가격 장부에 보여 줘요
export const lvBasePrice = m => Math.round(MENUS[m].price * fairMul(m) / 100) * 100;
export const mastery = m => Math.floor((G.mastery && G.mastery[m]) || 0);

// 다음 레벨로 올릴 수 있나: ok · max(최고 레벨) · need(숙련도 모자람) · cash(잔고 모자람) · closed
export function upState(m) {
  if (!upgradeOpen() || !menuOpen(m)) return 'closed';
  const lv = menuLv(m);
  if (lv >= MENU_LV_MAX) return 'max';
  const next = MENU_LEVELS[lv + 1];
  if (mastery(m) < next.need) return 'need';
  if (G.cash < next.cost) return 'cash';
  return 'ok';
}
// 올릴 수 있는 메뉴가 있나 (영수증에서 알려 줘요)
export const anyUpReady = () => MENU_IDS.some(m => upState(m) === 'ok');

defineCmd('menuUp', ({ menu }) => {
  if (G.phase !== 'prep') return false;
  const st = upState(menu);
  if (st !== 'ok') {
    const why = { need: '숙련도가 모자랍니다. 이 메뉴를 더 팔아 보세요', cash: '잔고가 모자랍니다', max: '이미 최고 레벨입니다' }[st];
    if (why) emit('toast', why, 'warn');
    return false;
  }
  const lv = menuLv(menu) + 1, next = MENU_LEVELS[lv];
  G.cash -= next.cost;
  G.menuLv[menu] = lv;
  emit('toast', `${MENUS[menu].name} Lv${lv}! 손님이 적당하다고 느끼는 가격이 ${lvBasePrice(menu).toLocaleString('ko-KR')}원으로 올랐습니다`, 'good');
  emit('sfx', 'perfect');
  emit('prep');
  emit('menuUp', menu);
  emit('track', 'menu_up', { menu, lv });
  return true;
});

// ── 새 메뉴 개발 (2장부터 · 메뉴 연구 칠판): 기본 메뉴 레벨 + 개발비 → 메뉴가 하나 더 생겨요 (data/menu.js VARIANT_IDS) ──
export const devOpen = () => !!(G.story && G.story.ch >= DEV_OPEN_CH);
// ok · done(이미 있음) · base(기본 메뉴가 아직) · lv(기본 메뉴 레벨 모자람) · cash · closed
export function devState(m) {
  const M = MENUS[m];
  if (!devOpen() || !M.base) return 'closed';
  if (menuOpen(m)) return 'done';
  if (!menuOpen(M.base)) return 'base';
  if (menuLv(M.base) < M.lv) return 'lv';
  if (G.cash < M.dev) return 'cash';
  return 'ok';
}
export const anyDevReady = () => MENU_IDS.some(m => devState(m) === 'ok');
defineCmd('menuDev', ({ menu }) => {
  if (G.phase !== 'prep' || !MENUS[menu]) return false;
  const st = devState(menu), M = MENUS[menu];
  if (st !== 'ok') {
    const why = { lv: `${MENUS[M.base].name} Lv${M.lv}이 되어야 개발할 수 있습니다`, cash: '잔고가 모자랍니다' }[st];
    if (why) emit('toast', why, 'warn');
    return false;
  }
  G.cash -= M.dev;
  storyOpenMenu(menu);
  emit('track', 'menu_dev', { menu });
  const full = todayMenus().length > slotsOpen(); // 오늘의 메뉴 칸이 꽉 찼으면 쉬는 메뉴로
  if (full) G.menuOff.push(menu);
  const fresh = M.recipe.filter(i => !MENU_IDS.some(x => x !== menu && menuOpen(x) && MENUS[x].recipe.includes(i))).map(i => INGREDIENTS[i].name);
  emit('toast', `새 메뉴 「${M.name}」 개발!${fresh.length ? ` ${josa(fresh.join('·'), '은/는')} 새벽 시장에서 살 수 있습니다` : ''}${full ? ' · 오늘의 메뉴 칸이 꽉 차서 쉬는 메뉴에 넣었습니다' : ''}`, 'good');
  emit('sfx', 'perfect');
  emit('prep');
  emit('menuUp', menu);
  return true;
});

// ── 영업 중 ──
// 음식을 내줄 때: 숙련도 (완벽 조리는 1.5그릇)
export function noteServed(m, q) {
  const L = G.run.log;
  L.mastery[m] = (L.mastery[m] || 0) + (q === 2 ? MASTERY_PERFECT : 1);
}
// 계산할 때: 만족한 손님은 다음에 또 올 손님 (단골·돌발 손님은 빼요)
export function noteSat(c, sat) {
  if (sat >= REVISIT_SAT && !c.reg && !c.tag) G.run.log.fans[c.char] = c.menu;
}
// 가게 앞에서: 그 사람이 맛있게 먹은 메뉴의 재방문률만큼 더 잘 들어와요 (Lv1이면 1배)
export function revisitMul(char) {
  const f = G.fans && G.fans[char];
  if (!f || !menuOpen(f.m)) return 1;
  return 1 + lvInfo(f.m).back - MENU_LEVELS[1].back;
}
// 다시 온 손님 (들어왔을 때) — 그 메뉴가 Lv2 이상이면 한마디 할 메뉴 이름을 돌려줘요
export function noteBack(char) {
  const f = G.fans && G.fans[char];
  if (!f) return null;
  G.run.log.back[char] = 1;
  return menuLv(f.m) >= 2 && menuOpen(f.m) ? f.m : null;
}
// 마감: 오늘 쌓은 숙련도·다시 올 손님을 더해요 → 오늘 숙련도 { 메뉴: + }
export function upgradeEndDay() {
  const L = G.run.log, gain = {};
  for (const m in L.mastery) { G.mastery[m] = (G.mastery[m] || 0) + L.mastery[m]; gain[m] = L.mastery[m]; }
  for (const ch in L.back) if (G.fans[ch]) G.fans[ch].n = L.fans[ch] ? G.fans[ch].n + 1 : Math.max(0, G.fans[ch].n - 1); // 다시 와서 또 맛있게 먹어야 셉니다 (실망하면 한 번 빠져요)
  for (const ch in L.fans) G.fans[ch] = { m: L.fans[ch], n: (G.fans[ch] && G.fans[ch].n) || 0 };
  return gain;
}
