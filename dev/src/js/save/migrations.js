// 옛 세이브 보정은 모두 여기에 둬요. 세이브 구조를 바꾸면 기본값을 채우는 줄을 아래에 더해요.
import { newStory } from '../data/story.js';
import { newTown } from '../sim/town.js';
import { TUTORIAL } from '../data/tutorial.js';
import { MENUS, MENU_IDS, INGREDIENTS, ING_IDS, SLOTS_BY_GRADE } from '../data/menu.js';

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
  // 원재료 창고(v0.26) 이전 세이브: 메뉴 한 벌씩이던 재료를 그 메뉴의 원재료로 나눠요 (같은 양 · 같은 기한, 오래가는 재료는 오늘부터 새 기한)
  //  식자재 특가·오늘 산 것도 메뉴로 적혀 있었으면 비워요
  const oldMenus = MENU_IDS.filter(m => Array.isArray(o.inv[m]));
  if (oldMenus.length) {
    const inv = {}, d = o.day || 1;
    for (const m of oldMenus) for (const b of o.inv[m]) for (const i of MENUS[m].recipe) {
      const I = INGREDIENTS[i];
      (inv[i] = inv[i] || []).push({ n: b.n, exp: I.keep ? Math.max(b.exp, d + I.shelf - 1) : b.exp });
    }
    o.inv = inv;
  }
  for (const i of ING_IDS) if (!Array.isArray(o.inv[i])) o.inv[i] = [];
  if (o.town && MENU_IDS.includes(o.town.deal)) o.town.deal = null;
  if (o.town && o.town.bought && Object.keys(o.town.bought).some(k => MENU_IDS.includes(k))) o.town.bought = {};
  if (!Array.isArray(o.menuOff)) o.menuOff = []; // 오늘의 메뉴 이전 세이브: 열린 메뉴를 모두 팔아요
  // 메뉴 업그레이드(v0.27) 이전 세이브: 모두 Lv1, 숙련도는 지금까지 판 그릇(장부 기록)으로
  if (!o.menuLv) o.menuLv = Object.fromEntries(MENU_IDS.map(m => [m, 1]));
  if (!o.mastery) o.mastery = Object.fromEntries(MENU_IDS.map(m => [m, o.history.reduce((s, h) => s + ((h.sold && h.sold[m]) || 0), 0)]));
  if (!o.fans) o.fans = {};
  if (!o.book) o.book = Object.fromEntries(Object.entries(o.fans || {}).map(([ch, f]) => [ch, { first: o.day || 1, visits: (f.n || 0) + 1, sat: null }])); // 손님 수첩(v0.33) 이전: 맛있게 먹은 손님만
  if (!o.board) o.board = { lunch: null, after: null }; // 칠판 추천(v0.31) 이전 세이브
  // 밤·새벽 한 턴(v0.30) 이전 세이브: 새벽이었으면 칸을 밤 4칸 뒤에서 이어 세요
  if (o.town && o.town.on && !o.town.turn) { if (o.town.part === 'dawn') o.town.used = (o.town.used || 0) + 4; o.town.rest = 0; }
  if (o.town) o.town.turn = 1;
  // 친밀도·미소 가구(v0.34) 이전 세이브: 정 사장님은 그동안 장 보러 간 날만큼 (♥♥ 바로 아래까지)
  if (!o.bond) o.bond = { pts: { miso: 0, jung: Math.min(14, (o.town && o.town.visits) || 0), moon: 0 }, day: 0, got: {} };
  if (!o.furn) o.furn = { have: { wall: null, floor: null, window: null, plant: null, frame: null, table: null }, seen: false, visits: 0, tradeDay: 0 };
  // 리뷰 별점(v0.37) 이전 세이브: 옛 별점과 평균이 같은 리뷰 40개로 바꿔요
  if (!Array.isArray(o.revs)) {
    const r = typeof o.rating === 'number' ? Math.max(1, Math.min(5, o.rating)) : 3, lo = Math.floor(r), hi = Math.round((r - lo) * 40);
    o.revs = Array.from({ length: 40 }, (_, i) => Math.min(5, i < hi ? lo + 1 : lo));
    o.rating = o.revs.reduce((a, b) => a + b, 0) / 40; o.ratingN = Math.max(40, o.ratingN || 0);
  }
  if (!o.shopLv) o.shopLv = 1;
  if (!o.menuSlots) o.menuSlots = SLOTS_BY_GRADE[o.shopLv] || 4; // 칸 늘리기(v0.46) 이전 세이브: 확장공사로 늘었던 칸은 그대로
  if (!o.guild) o.guild = { seen: false, due: 0, member: false, eq: { stove: 1, mat: 1, fryer: 1, fridge: 1, register: 1 }, tools2: [], visits: 0, tradeDay: 0 }; // 상인회(v0.41) 이전 세이브 // 확장공사(v0.36) 이전 세이브
  // 2장 이야기(v0.44) 이전 세이브: 1장을 끝냈으면 박 할머니 부탁부터, 미소 가구를 봤으면 미소 사장님 부탁도
  if (o.story && o.story.done.includes('c1_week')) {
    const S = o.story, has = id => S.done.includes(id) || S.active.includes(id) || (S.queue || []).includes(id);
    if (!has('c2_park') && !(S.queue || []).includes('ch2soon')) { S.active.push('c2_park'); S.prog.c2_park = 0; }
    if (o.furn && o.furn.seen && !has('c2_miso')) { S.active.push('c2_miso'); S.prog.c2_miso = 0; }
  }
  // 새 메뉴(v0.45) 이전 세이브: 메뉴마다 칸을 채워요 (가격 · 주문 · 장부 · 레벨 · 숙련도)
  for (const m of MENU_IDS) {
    if (o.prices && o.prices[m] == null) o.prices[m] = MENUS[m].price;
    if (o.prep && o.prep[m] == null) o.prep[m] = 0;
    if (o.ledger && !o.ledger[m]) o.ledger[m] = {};
    if (o.menuLv && !o.menuLv[m]) o.menuLv[m] = 1;
    if (o.mastery && o.mastery[m] == null) o.mastery[m] = 0;
  }
  if (o.market && o.market.id && o.market.until > (o.day || 1)) o.market.until = o.day || 1; // 시세 소식은 하루만(v0.45)
  if (!o.market) o.market = { id: null, until: 0 }; // 재료 시세 이전 세이브
  if (!o.meta) o.meta = { id: 'old' + (o.baseSeed || 0), at: 0 }; // 클라우드 저장 이전 세이브
  return o;
}
