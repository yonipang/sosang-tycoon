// 가게 앞 보도에는 사람이 지나다녀요(유동인구). 가게 문 앞에서 일부가 들어오기로 정하면 손님이 돼요.
// 손님: 일행(1~2명)으로 보도에서 들어와 → 빈 탁자(한 일행에 한 탁자) → 메뉴 보기(가격 반응) → 주문 → 기다림 → 먹기
//       → 일행이 다 먹으면 한 명이 계산 줄에 서서 같이 계산 → 나가기
// 손님 한 명 = 그림 한 장(data/customers.js PEOPLE). 같은 사람은 가게에 동시에 둘이 있을 수 없어요.
import { G } from '../save/state.js';
import { MENUS, MENU_IDS, baseOf } from '../data/menu.js';
import { REGULARS, CUSTOMER_TYPES, typeLike, PEOPLE, PAIR_CHANCE, PATIENCE, READ_MENU_SEC, QUEUE_MAX, CUSTOMER_SPEED, PRICE_REACT, PASSER_SAY_CHANCE, GLANCE_CHANCE, PASSER_LINES, typeMix } from '../data/customers.js';
import { TIP, ratingPriceMul } from '../data/economy.js';
import { W, SEATS, TABLES, PAY_SPOTS, QUEUE_SPOTS, DOOR_OUT } from '../data/layout.js';
import { rand, rint, weighted, fxRand } from '../engine/random.js';
import { emit } from './events.js';
import { findPath, walk } from './path.js';
import { menuOpen, storyNote, storyPerk } from './story.js';
import { LUNCH_FROM, LUNCH_TO, LATE_FROM, OLD_TASTE_SAT } from '../data/story.js';
import { incidentNote } from './incidents.js';
import { dirty } from './town.js';
import { HYGIENE_SAT } from '../data/town.js';
import { TUT_IMPATIENT } from '../data/tutorial.js';
import { tutNote, tutHold } from './tutorial.js';
import { stockOf, takeMenu, giveMenu, menuOn } from './pantry.js';
import { fairMul, lvSat, noteServed, noteSat, revisitMul, noteBack } from './upgrade.js';
import { noteVisit, noteBookSat } from './book.js';
import { PEOPLE_INFO, FAV_CHANCE } from '../data/people.js';
import { typeEnterMul, enterLine, boardPick, logPass, nowHour } from './traffic.js';
import { moodSat, moodEnterMul, eatMul } from './furniture.js';
import { ratingNow } from './rating.js';
import { payWaitMul } from './guild.js';

export const custById = id => G.run.customers.find(c => c.id === id);
const SEATED = ['reading', 'waitFood', 'eating', 'done', 'waitPayer'];
export const isSeated = c => SEATED.includes(c.state) && c.seat >= 0;
const partyOf = c => G.run.customers.filter(q => q.party === c.party && q.state !== 'leave');
const P = c => CUSTOMER_TYPES[c.type].patience;
// 지나가는 사람(아직 가게 손님이 아닌 사람)
const PASSING = ['walk', 'glance', 'pass'];
export const isPasser = c => PASSING.includes(c.state);
export const shopCustomers = () => G.run.customers.filter(c => !isPasser(c));

// 보도를 따라 x에서 toX까지
function sidewalk(fromX, toX) {
  const p = [], s = Math.sign(toX - fromX);
  for (let x = fromX + s; s && x !== toX + s; x += s) p.push([x, DOOR_OUT.y]);
  return p;
}

// ── 지나가는 사람 (유동인구) ──
// 지금 가게·보도에 없는 사람 (같은 그림은 동시에 둘이 있을 수 없어요). type을 주면 그 유형만, 섞어서
export function freeChars(type) {
  const here = new Set(G.run.customers.map(c => c.char));
  const out = Object.keys(PEOPLE).map(Number).filter(n => !here.has(n) && (!type || PEOPLE[n] === type));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function spawnPasser(hour) {
  const free = freeChars();
  if (!free.length) return false;
  const mix = typeMix(hour);
  const typeCount = {};
  for (const n in PEOPLE) typeCount[PEOPLE[n]] = (typeCount[PEOPLE[n]] || 0) + 1;
  const w = {};
  for (const n of free) w[n] = (mix[PEOPLE[n]] || 0) / typeCount[PEOPLE[n]];
  const lead = +weighted(w);
  const type = PEOPLE[lead];
  const members = [lead];
  const mates = free.filter(n => n !== lead && PEOPLE[n] === type);
  if (mates.length && rand() < PAIR_CHANCE[type]) members.push(mates[Math.floor(rand() * mates.length)]);
  return spawnParty(members, {});
}
// 일행 하나를 보도 끝에서 걸어오게 해요
//  opts: force(문 앞에서 꼭 들어와요 — 단골·돌발 손님) · tag(돌발 이벤트) · reg(단골 이름) · type(유형, 없으면 PEOPLE) · wants(고를 메뉴) · delay(조금 뒤에 따라옴)
export function spawnParty(members, opts) {
  const r = G.run;
  const fromLeft = rand() < 0.5;
  const party = r.nextParty = (r.nextParty || 0) + 1;
  const speed = CUSTOMER_SPEED * (0.9 + rand() * 0.2);
  members.forEach((ch, k) => {
    const sx = (fromLeft ? -1 - k : W + k) + (fromLeft ? -1 : 1) * (opts.delay || 0);
    r.customers.push({
      force: !!opts.force, blog: !!opts.blog, tag: opts.tag || null, reg: opts.reg || null, wants: opts.wants || null,
      id: r.nextId++, char: ch, type: opts.type || PEOPLE[ch], party, lead: k === 0,
      x: sx, y: DOOR_OUT.y, dir: fromLeft ? 0 : 2, speed,
      path: sidewalk(sx, DOOR_OUT.x), state: 'walk', moving: true, lane: fromLeft ? -0.12 : 0.08,
      seat: -1, menu: null, face: null, faceT: 0, patience: 0, patMax: 1, timer: 0,
      priceSat: 0, quality: -1, foodWaitFrac: 0, payWaited: false, exitX: fromLeft ? W + k : -1 - k,
    });
  });
  return true;
}

// 아무도 없는 탁자 (자리 둘 다 비어 있어야 해요)
function freeTable() {
  const r = G.run;
  return TABLES.find(t => SEATS.every((s, i) => s.table !== t.no || r.seats[i] === null));
}

function seatParty(members, table) {
  const r = G.run;
  const seatIdx = SEATS.map((s, i) => i).filter(i => SEATS[i].table === table.no);
  members.forEach((c, k) => {
    const i = seatIdx[k];
    r.seats[i] = c.id; c.seat = i;
    const s = SEATS[i];
    c.path = findPath(c, [[s.x, s.y]], 'customer', [[s.x, s.y]]) || [];
    c.state = 'toSeat';
  });
}

function sidewalkTo(c, spot) { return findPath(c, [spot], 'customer') || []; }

// 탁자가 비면 가게 앞에서 기다리던 일행을 들여보내요
function seatFromQueue() {
  const r = G.run;
  if (r.closing || !r.queue.length) return;
  const t = freeTable(); if (!t) return;
  const first = custById(r.queue[0]); if (!first) { r.queue.shift(); return; }
  const members = r.queue.map(custById).filter(q => q && q.party === first.party);
  r.queue = r.queue.filter(id => !members.some(m => m.id === id));
  seatParty(members, t);
  r.queue.forEach((id, k) => { const q = custById(id); if (q) q.path = sidewalkTo(q, QUEUE_SPOTS[k]); });
}

function freeSeat(c) {
  const r = G.run;
  if (c.seat >= 0 && r.seats[c.seat] === c.id) r.seats[c.seat] = null;
  c.seat = -1;
  seatFromQueue();
}

function leave(c, angry) {
  const r = G.run;
  if (c.menu && c.state === 'waitFood') removeTicket(c);
  freeSeat(c);
  r.queue = r.queue.filter(id => id !== c.id);
  const wasPay = r.payLine.includes(c.id);
  r.payLine = r.payLine.filter(id => id !== c.id);
  if (wasPay) r.payLine.forEach((id, k) => { const q = custById(id); if (q) q.path = findPath(q, [PAY_SPOTS[k]], 'customer') || []; });
  const toDoor = c.y >= DOOR_OUT.y ? [] : (findPath(c, [[DOOR_OUT.x, DOOR_OUT.y]], 'customer') || []);
  const startX = toDoor.length ? DOOR_OUT.x : Math.round(c.x);
  c.path = toDoor.concat(sidewalk(startX, c.exitX));
  c.state = 'leave';
  if (angry) { c.face = 'angry'; c.faceT = 1.6; emit('sfx', 'angry'); }
}

const MISS_SAT = { full: 3, wait: 1, price: 1.5, soldout: 2 };
const MISS_TEXT = { full: '자리 없음', wait: '너무 늦어요', price: '비싸요', soldout: '품절' };
function miss(c, reason, menu, quiet) {
  const L = G.run.log;
  incidentNote('missed', c, reason);
  L.missed[reason]++;
  if (reason === 'wait' && G.run.min >= LUNCH_FROM && G.run.min < LUNCH_TO) L.lunchWait = (L.lunchWait || 0) + 1; // 2장 김 대리 (12~14시)
  L.sats.push(MISS_SAT[reason]);
  if (!quiet) {
    L.events.push({ kind: reason, menu, who: CUSTOMER_TYPES[c.type].name });
    emit('float', c.x, c.y - 1.4, MISS_TEXT[reason], 'bad');
  }
}
// 일행이 함께 나가요 (아직 먹기 전인 사람만 — 먹고 있는 사람은 마저 먹고 계산해요)
function partyLeaves(c, reason, menu) {
  const pre = ['arrive', 'queue', 'toSeat', 'reading', 'waitFood'];
  partyOf(c).forEach(m => {
    if (!pre.includes(m.state)) return;
    miss(m, reason, m.menu || menu, m !== c);
    leave(m, reason !== 'full' || m.state === 'queue');
  });
}

// 주문표에서 빼고, 아직 요리 안 한 몫이면 재료를 돌려놔요
function removeTicket(c) {
  const r = G.run;
  const i = r.tickets.findIndex(t => t.cid === c.id);
  if (i < 0) return;
  r.tickets.splice(i, 1);
  const m = c.menu;
  const handsM = r.hands.filter(d => d.menu === m).length;
  const ticketsM = r.tickets.filter(t => t.menu === m).length;
  if (handsM <= ticketsM) giveMenu(m);
}

// 손에 든 음식 중 주문표에 묶이지 않은 몫 = 주문 없이 미리 만든 것 (재료는 만들 때 이미 썼어요)
export function spareOf(m) {
  const r = G.run;
  return Math.max(0, r.hands.filter(d => d.menu === m).length - r.tickets.filter(t => t.menu === m).length);
}
// 팔 수 있나: 오늘의 메뉴에 있고, 재료가 다 있거나 미리 만든 게 손에 있거나
export const canSell = m => menuOn(m) && (stockOf(m) > 0 || spareOf(m) > 0);

function reaction(c, m) {
  const fair = MENUS[m].fair * fairMul(m) * CUSTOMER_TYPES[c.type].priceMul * ratingPriceMul(ratingNow()) * (c.reg ? REGULARS[c.reg].priceMul : 1); // 메뉴 레벨만큼 적당한 가격이 올라요
  return PRICE_REACT.find(p => G.prices[m] / fair <= p.max);
}

function decide(c) {
  const r = G.run, T = CUSTOMER_TYPES[c.type];
  const w = {};
  for (const m of MENU_IDS.filter(x => menuOn(x))) { const ratio = G.prices[m] / (MENUS[m].fair * fairMul(m) * T.priceMul * ratingPriceMul(ratingNow())); w[m] = typeLike(c.type, m) / (ratio * ratio) * boardPick(m, nowHour()); } // 칠판 추천 메뉴는 조금 더 끌려요
  let m = weighted(w);
  // 좋아하는 메뉴 (손님 수첩): 그 메뉴나 그 메뉴에서 나온 새 메뉴 중에서
  const info = PEOPLE_INFO[c.char], favOpts = info && info.fav ? Object.keys(w).filter(x => baseOf(x) === info.fav && canSell(x)) : [];
  const fav = favOpts.length && rand() < FAV_CHANCE ? weighted(Object.fromEntries(favOpts.map(x => [x, w[x]]))) : null;
  const want = c.wants || (c.reg && REGULARS[c.reg].likes.find(x => menuOpen(x) && canSell(x))) || fav;
  if (want && menuOn(want)) m = want; // 단골은 늘 먹던 것, 돌발 손님은 정해진 것, 메뉴를 말한 손님은 그것, 아니면 좋아하는 메뉴 (오늘 메뉴에 없으면 고르던 대로)
  let re = reaction(c, m);
  c.face = re.face; c.faceT = 1.6;
  r.log.faces[re.face] = (r.log.faces[re.face] || 0) + 1;
  const pf = r.log.priceFaces[m]; pf[re.face] = (pf[re.face] || 0) + 1; // 가격 장부: 이 메뉴·이 가격에 본 얼굴
  if (re.leave && !c.tag && rand() < re.leave) { partyLeaves(c, 'price', m); return; } // 돌발 이벤트 손님은 가격 때문에 그냥 가지 않아요 (기분은 남아요)
  if (!canSell(m)) {
    const alts = MENU_IDS.filter(x => x !== m && canSell(x) && !reaction(c, x).leave);
    if (alts.length && (c.tag || rand() < 0.5)) { m = alts[0]; re = reaction(c, m); } // 돌발 손님은 다른 메뉴라도 먹어요
    else { partyLeaves(c, 'soldout', m); return; }
  }
  if (!spareOf(m)) takeMenu(m); // 미리 만든 게 손에 있으면 그걸로 (재료는 이미 씀)
  c.menu = m; c.priceSat = re.sat;
  r.tickets.push({ cid: c.id, menu: m, table: SEATS[c.seat].table });
  c.patMax = c.patience = PATIENCE.food * P(c);
  c.state = 'waitFood';
  emit('order', c.id, m);
  tutNote('order');
}

// 사장이 음식을 내줬을 때 (sim/player.js)
export function serve(c, dish) {
  const r = G.run;
  c.quality = dish.q;
  c.foodWaitFrac = 1 - c.patience / c.patMax;
  const i = r.tickets.findIndex(t => t.cid === c.id);
  if (i >= 0) r.tickets.splice(i, 1);
  c.state = 'eating';
  c.timer = CUSTOMER_TYPES[c.type].eat * eatMul(); // 미니멀 테마면 빨리 먹고 일어나요
  c.face = dish.q === 2 ? 'love' : dish.q === 1 ? 'happy' : 'meh'; c.faceT = 1.4;
  emit('sfx', 'serve');
  storyNote('served', { menu: c.menu });
  noteServed(c.menu, dish.q); // 숙련도 (메뉴 업그레이드)
  if (dish.ahead) storyNote('ahead');
  incidentNote('served', c, dish.q);
  tutNote('served');
}

function satisfaction(c) {
  let s = 3.5 + c.priceSat + [-0.2, 0.3, 0.8][Math.max(0, c.quality)] + (c.menu ? lvSat(c.menu) : 0); // 메뉴 레벨 만족
  if (c.foodWaitFrac > 0.6) s -= 0.7;
  if (c.payWaited) s -= 0.6;
  if (dirty()) s -= HYGIENE_SAT; // 위생이 낮으면 (data/town.js)
  s += moodSat(c.type); // 가게 분위기 · 테마 (sim/furniture.js)
  if (c.menu === 'tteok' && storyPerk('oldTaste')) s += OLD_TASTE_SAT; // 2장 박 할머니 「그 시절 그 맛」
  return Math.max(1, Math.min(5, s));
}

// 계산: 계산 줄에 선 사람이 자리에 남은 일행 몫까지 같이 내요 (사장이 계산대에서 — sim/player.js)
export function pay(c) {
  const r = G.run, L = r.log;
  const group = [c].concat(partyOf(c).filter(m => m !== c && m.state === 'waitPayer'));
  let total = 0, tips = 0;
  for (const m of group) {
    const T = CUSTOMER_TYPES[m.type], price = G.prices[m.menu];
    m.payWaited = c.payWaited;
    const sat = satisfaction(m);
    if (sat >= 4.5 && rand() < T.tip * 2.5) tips += rint(TIP.min / 100, TIP.max / 100) * 100;
    total += price;
    L.sales[m.menu].n++; L.sales[m.menu].rev += price; L.served++;
    L.sats.push(sat);
    noteSat(m, sat); noteBookSat(m.char, sat);
    if (m.blog) { L.blogSat = sat; L.blogMenu = m.menu; emit('say', m.id, sat >= 4 ? '와, 이건 글 써야겠는데요?' : '음… 무난하네요.'); } // 파워블로거 (sim/traffic.js)
    const kind = m.reg ? 'regular' : m.quality === 2 ? 'perfect' : m.payWaited ? 'payWait' : m.priceSat >= 1 ? 'cheap' : 'normal';
    L.events.push({ kind, menu: m.menu, who: m.reg ? REGULARS[m.reg].name : T.name });
    incidentNote('paid', m);
    if (m.reg) emit('say', m.id, pickLine(REGULARS[m.reg].bye));
  }
  G.cash += total + tips; G.weekSales += total; L.tips += tips;
  emit('float', c.x, c.y - 1.6, '+' + (total + tips).toLocaleString('ko-KR') + '원' + (tips ? ' 팁!' : ''), 'cash');
  emit('sfx', 'coin');
  storyNote('paid', { n: group.length });
  if (r.min >= LATE_FROM) storyNote('lateServed', { n: group.length }); // 2장 도윤 (저녁 7시 넘어)
  for (const m of group) leave(m, false);
  tutNote('paid');
}

// 가게 앞에서: 들어올지 정하고, 안 들어오면 그냥 지나가요 (가끔 멈춰서 보거나 한마디)
function atDoor(c) {
  const r = G.run, members = partyOf(c);
  r.log.foot += members.length;
  // 들어오는 비율 = 기본 × 손님층 배율(메뉴 궁합·칠판·홍보 — sim/traffic.js) × 재방문(메뉴 레벨). 단골·돌발 손님은 꼭 들어와요
  const hour = nowHour();
  const enter = c.force || rand() < Math.min(0.95, (r.enterP || 0) * typeEnterMul(c.type, hour) * revisitMul(c.char) * moodEnterMul(c.type));
  logPass(hour, c.type, members.length, enter);
  if (enter) {
    r.log.entered += members.length;
    members.forEach(m => { m.state = 'arrive'; m.lane = 0; noteVisit(m.char); }); // 손님 수첩
    if (c.reg) emit('say', c.id, pickLine(REGULARS[c.reg].lines));
    else if (c.blog) emit('say', c.id, '여기 맛있다고 해서 왔어요. 사진 좀 찍어도 되죠?');
    else if (!c.force) {
      const back = noteBack(c.char), line = enterLine(c.type, hour);
      // 메뉴 이름을 말한 손님은 그 메뉴를 시켜요 (말과 주문이 어긋나지 않게)
      if (back && fxRand() < 0.5) { emit('say', c.id, `${MENUS[back].name} 생각나서 또 왔어요`); c.wants = back; }
      else if (line && fxRand() < 0.35) { emit('say', c.id, line[0]); if (line[1]) c.wants = line[1]; }
    }
    return;
  }
  const glance = rand() < GLANCE_CHANCE;
  members.forEach(m => { m.state = glance ? 'glance' : 'pass'; m.timer = 0.6 + rand() * 0.5; });
  if (glance) c.dir = 1;
  if (fxRand() < PASSER_SAY_CHANCE) emit('say', c.id, passerLine());
  members.forEach(m => { if (!glance) m.path = m.path.concat(sidewalk(DOOR_OUT.x, m.exitX)); });
}
const pickLine = a => a[Math.floor(fxRand() * a.length)];
function passerLine() {
  const r = G.run, pick = a => a[Math.floor(fxRand() * a.length)];
  const busy = r.queue.length > 0 || !freeTable();
  if (busy && fxRand() < 0.7) return pick(PASSER_LINES.busy);
  if (G.ratingN >= 10 && ratingNow() < 2.8 && fxRand() < 0.6) return pick(PASSER_LINES.bad);
  if (G.day <= 3 && fxRand() < 0.5) return pick(PASSER_LINES.new);
  return pick(fxRand() < 0.5 ? PASSER_LINES.smell : PASSER_LINES.plain);
}

export function updateCustomers(dt) {
  const r = G.run;
  const wdt = tutHold() ? 0 : dt; // 오 사장님이 시키는 동안은 손님이 기다려 줘요 (sim/tutorial.js)
  for (const c of r.customers.slice()) {
    if (c.state === 'leave' && !r.customers.includes(c)) continue;
    if (c.faceT > 0) c.faceT -= dt;
    const arrived = walk(c, dt);
    switch (c.state) {
      case 'walk':
        if (arrived && c.lead) atDoor(c);
        else if (arrived) c.state = 'pass', c.path = sidewalk(Math.round(c.x), c.exitX); // 앞사람이 이미 지나갔으면
        break;
      case 'glance':
        if (!arrived) break;
        c.timer -= dt;
        if (c.timer <= 0) { c.state = 'pass'; c.path = sidewalk(Math.round(c.x), c.exitX); }
        break;
      case 'pass':
        if (arrived) r.customers.splice(r.customers.indexOf(c), 1);
        break;
      case 'arrive': {
        if (!arrived || !c.lead) break; // 일행 중 앞사람이 정해요
        const members = partyOf(c).filter(m => m.state === 'arrive');
        if (r.closing) { members.forEach(m => leave(m, false)); break; }
        const t = !r.queue.length && freeTable();
        if (t) seatParty(members, t);
        else if (r.queue.length + members.length <= QUEUE_MAX) {
          for (const m of members) {
            r.queue.push(m.id); m.state = 'queue';
            m.patMax = m.patience = PATIENCE.queue * P(m);
            m.path = sidewalkTo(m, QUEUE_SPOTS[r.queue.length - 1]);
          }
        } else members.forEach((m, k) => { miss(m, 'full', null, k > 0); leave(m, false); });
        break;
      }
      case 'queue':
        c.patience -= wdt;
        if (r.closing) { leave(c, false); break; }
        if (c.patience <= 0) partyLeaves(c, 'full');
        break;
      case 'toSeat':
        if (arrived) { c.state = 'reading'; c.timer = READ_MENU_SEC * (0.8 + rand() * 0.5); c.dir = SEATS[c.seat].face === 'right' ? 0 : 2; }
        break;
      case 'reading':
        c.timer -= dt;
        if (c.timer <= 0) decide(c);
        break;
      case 'waitFood':
        c.patience -= wdt;
        if (c.patience < c.patMax * TUT_IMPATIENT && !c.tutSeen) { c.tutSeen = true; tutNote('impatient'); }
        if (c.patience <= 0) partyLeaves(c, 'wait', c.menu);
        break;
      case 'eating':
        c.timer -= dt;
        if (c.timer <= 0) c.state = 'done';
        break;
      case 'done': {
        // 일행이 모두 다 먹었으면 앞사람(남은 사람 중 첫째)이 계산 줄로
        const party = partyOf(c);
        if (party.some(m => m.state !== 'done' && m.state !== 'waitPayer')) break;
        if (party[0] !== c) { c.state = 'waitPayer'; break; }
        if (r.payLine.length >= PAY_SPOTS.length) break;
        r.payLine.push(c.id);
        party.forEach(m => { if (m !== c) m.state = 'waitPayer'; });
        c.state = 'payLine';
        freeSeat(c); // 일행이 아직 앉아 있으면 탁자는 비지 않아요
        c.path = findPath(c, [PAY_SPOTS[r.payLine.length - 1]], 'customer') || [];
        c.patMax = c.patience = PATIENCE.pay * P(c) * payWaitMul(); // 카드 단말기(계산대 Lv3)
        tutNote('payLine');
        break;
      }
      case 'payLine':
        if (r.payLine[0] === c.id && arrived) {
          c.dir = 0;
          c.patience -= wdt;
          if (c.patience <= 0) { c.payWaited = true; pay(c); }
        }
        break;
      case 'leave':
        if (arrived) r.customers.splice(r.customers.indexOf(c), 1);
        break;
    }
  }
}

// ── 단골 ── 영업 시작 때 오늘 올지·언제 올지 정하고, 그 시각이 되면 보도에서 걸어와요
export function planRegulars(r) {
  r.regulars = Object.keys(REGULARS).filter(id => (!REGULARS[id].quest || (G.story && G.story.done.includes(REGULARS[id].quest))) && rand() < REGULARS[id].chance)
    .map(id => ({ id, at: REGULARS[id].at[0] + rand() * (REGULARS[id].at[1] - REGULARS[id].at[0]), came: false }));
}
export function tickRegulars() {
  const r = G.run;
  for (const g of r.regulars || []) {
    if (g.came || r.min < g.at || r.closing) continue;
    const R = REGULARS[g.id];
    if (r.customers.some(c => c.char === R.char)) continue;
    g.came = true;
    spawnParty([R.char], { force: true, reg: g.id, type: R.type });
  }
}

