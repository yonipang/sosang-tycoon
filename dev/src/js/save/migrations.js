// 옛 세이브 보정은 모두 여기에 둬요. 세이브 구조를 바꾸면 기본값을 채우는 줄을 아래에 더해요.
import { newStory } from '../data/story.js';

export function migrate(o) {
  if (!o || typeof o !== 'object') throw new Error('세이브 형식이 아니에요');
  if (!o.stats) o.stats = { served: 0, sales: 0 };
  if (!Array.isArray(o.history)) o.history = [];
  if (!o.ledger) o.ledger = { tteok: {}, kimbap: {}, twigim: {} }; // 가격 장부 이전 세이브
  if (!o.inv) o.inv = { tteok: [], kimbap: [], twigim: [] }; // 재료 이월(유통기한) 이전 세이브
  if (!o.story) { // 이야기 이전 세이브: 날짜로 열렸던 메뉴는 그대로, 4일차 이후면 1장부터
    const st = newStory(), d = o.day || 1;
    st.menus = ['tteok', 'kimbap', 'twigim'].filter((m, i) => d >= i + 1);
    st.queue = [];
    if (d >= 4) {
      Object.assign(st, { ch: 1, title: '사장 지망생', active: ['c1_first', 'c1_stock'], done: ['p_stir', 'p_serve', 'p_book', 'p_keys', 'c1_note', 'c1_kimbap', 'c1_fryer'] });
    } else { st.active = ['p_stir', 'p_serve', 'p_book', 'p_keys']; st.prog = { p_keys: d - 1 }; st.title = '알바생'; }
    o.story = st;
  }
  if (!o.story.tools) { o.story.tools = []; o.story.toolsOpen = o.story.ch >= 2 || o.story.done.includes('c1_kimbap'); } // 장사 도구 이전 세이브
  if (!o.meta) o.meta = { id: 'old' + (o.baseSeed || 0), at: 0 }; // 클라우드 저장 이전 세이브
  return o;
}
