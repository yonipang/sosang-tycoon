// 옛 세이브 보정은 모두 여기에 둬요. 세이브 구조를 바꾸면 기본값을 채우는 줄을 아래에 더해요.
import { newStory } from '../data/story.js';
import { newTown } from '../sim/town.js';
import { TUTORIAL } from '../data/tutorial.js';

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
  // 오 사장님 가게 길잡이(v0.24) 이전 세이브: 지난날 차례는 끝낸 것으로. 프롤로그 3일차 이후면 새 퀘스트 「손이 놀 때」도 끝낸 것으로
  if (!o.story.tut) {
    o.story.tut = TUTORIAL.filter(s => s.day < (o.day || 1) || o.story.ch >= 1).map(s => s.id);
    if (o.story.ch === 0 && (o.day || 1) >= 3 && !o.story.done.includes('p_ahead')) o.story.done.push('p_ahead');
  }
  if (!o.town) o.town = newTown(); // 마을 이전 세이브
  // 마을(v0.20) 전에 1장을 하던 세이브: 다음 밤까지 기다리지 않고 지금(새벽)부터 골목으로. 밤 주문 대신 새벽 시장에서 사요
  //  (1장 첫날 4일차 아침은 오 사장님이 시켜 둔 재료로 여는 날이라 그대로 두고, 그날 밤부터 골목)
  if (o.story && o.story.ch >= 1 && !o.town.on && (o.day || 1) >= 5) {
    Object.assign(o.town, { on: true, part: 'dawn', used: 0, marketIn: false, bought: {}, talked: [], referral: [], seen: true });
    for (const m in o.prep) o.prep[m] = 0;
    if (o.story.queue && !o.story.queue.includes('town1d')) o.story.queue.push('town1d');
  }
  if (!o.market) o.market = { id: null, until: 0 }; // 재료 시세 이전 세이브
  if (!o.meta) o.meta = { id: 'old' + (o.baseSeed || 0), at: 0 }; // 클라우드 저장 이전 세이브
  return o;
}
