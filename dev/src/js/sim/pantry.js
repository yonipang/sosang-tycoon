// 재료 창고 (원재료 · 유통기한): 저장되는 창고 G.inv[재료] = [{ n: 인분, exp: 이 날까지 }] · 영업 중 재료 수 G.run.ing[재료]
// 메뉴 한 그릇 = recipe 재료 하나씩 (data/menu.js). 먼저 받은 것부터 쓰고, 기한이 지나면 마감 때 버려요 (sim/day.js endDay)
// 오늘의 메뉴: G.menuOff = 오늘 쉬는 메뉴 (가게 장부에서 빼고 올려요)
import { G } from '../save/state.js';
import { shelfPlus } from './guild.js';
import { MENUS, MENU_IDS, INGREDIENTS, ING_IDS, SLOTS_BY_GRADE } from '../data/menu.js';
import { emit, defineCmd } from './events.js';
import { menuOpen } from './story.js';

export const recipeOf = m => MENUS[m].recipe;
export const menusUsing = i => MENU_IDS.filter(m => recipeOf(m).includes(i));
// 창고에 있는 양 · 오늘까지 써야 하는 양 (오늘 지나면 버려요)
export const invOf = i => (G.inv[i] || []).reduce((s, b) => s + b.n, 0);
export const invToday = i => (G.inv[i] || []).filter(b => b.exp <= G.day).reduce((s, b) => s + b.n, 0);
// 창고 재료로 만들 수 있는 그릇 수
export const invServings = m => Math.min(...recipeOf(m).map(invOf));
// 열린 메뉴가 쓰는 재료 (식자재 가게에 나오는 재료)
export const openIngs = () => ING_IDS.filter(i => menusUsing(i).some(m => menuOpen(m)));

// 재료를 n인분 들여놓아요 (오늘부터 shelf일 동안 쓸 수 있어요)
export function stockIn(i, n, plus = 0) { if (n > 0) G.inv[i].push({ n, exp: G.day + INGREDIENTS[i].shelf - 1 + shelfPlus() + plus }); } // 냉장고 Lv2(상인회) +1일 · plus: 정 사장님이 따로 빼 둔 재료
export function stockInMenu(m, n) { for (const i of recipeOf(m)) stockIn(i, n); }
// 먼저 받은 재료부터 n인분 써요
export function useFifo(i, n) {
  const b = G.inv[i].sort((a, c) => a.exp - c.exp);
  while (n > 0 && b.length) { const k = Math.min(n, b[0].n); b[0].n -= k; n -= k; if (!b[0].n) b.shift(); }
}

// ── 오늘의 메뉴 ──
export const slotsOpen = () => SLOTS_BY_GRADE[(G.shopLv || 1)]; // 가게 등급(확장공사 — sim/furniture.js)
export const menuOn = m => menuOpen(m) && !(G.menuOff || []).includes(m);
export const todayMenus = () => MENU_IDS.filter(menuOn);
defineCmd('menuToggle', ({ menu }) => {
  if (G.phase !== 'prep' || !menuOpen(menu)) return false;
  const off = G.menuOff;
  if (off.includes(menu)) {
    if (todayMenus().length >= slotsOpen()) { emit('toast', '오늘의 메뉴 칸이 꽉 찼습니다. 다른 메뉴를 먼저 빼 보세요', 'warn'); return false; }
    G.menuOff = off.filter(x => x !== menu);
  } else {
    if (todayMenus().length <= 1) { emit('toast', '메뉴가 하나는 있어야 가게를 열 수 있습니다', 'warn'); return false; }
    off.push(menu);
  }
  emit('sfx', 'tap');
  emit('prep');
  return true;
});

// 칸의 메뉴를 다른 메뉴로 바꾸기 (오늘의 메뉴 칸을 눌러 고를 때)
defineCmd('menuSwap', ({ off, on }) => {
  if (G.phase !== 'prep' || !menuOpen(on) || !menuOpen(off) || !menuOn(off) || menuOn(on)) return false;
  G.menuOff = G.menuOff.filter(x => x !== on).concat(off);
  emit('sfx', 'tap');
  emit('prep');
  return true;
});

// ── 영업 중 ── (G.run.ing: 영업을 시작할 때 창고에서 꺼낸 재료 수)
export const stockOf = m => Math.min(...recipeOf(m).map(i => G.run.ing[i] || 0));
export function takeMenu(m, n = 1) { for (const i of recipeOf(m)) G.run.ing[i] -= n; }
export function giveMenu(m, n = 1) { for (const i of recipeOf(m)) G.run.ing[i] += n; }
// 그 메뉴에서 가장 먼저 떨어지는 재료
export const shortIng = m => recipeOf(m).reduce((a, i) => ((G.run.ing[i] || 0) < (G.run.ing[a] || 0) ? i : a));

// 담기 도우미: 오늘 팔 양 { 메뉴: 그릇 } → 모자란 재료 { 재료: 묶음 수 } (여러 메뉴가 같이 쓰는 재료는 합쳐서)
export function cartFor(plan) {
  const need = {};
  for (const m in plan) for (const i of recipeOf(m)) need[i] = (need[i] || 0) + plan[m];
  const cart = {};
  for (const i in need) { const lack = need[i] - invOf(i); if (lack > 0) cart[i] = Math.ceil(lack / INGREDIENTS[i].pack); }
  return cart;
}
