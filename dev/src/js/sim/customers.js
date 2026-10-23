// 손님: 보도에서 들어와 → 자리 → 메뉴 보기(가격 반응) → 주문 → 기다림 → 먹기 → 계산 줄 → 나가기
import { G } from '../save/state.js';
import { MENUS, MENU_IDS } from '../data/menu.js';
import { CUSTOMER_TYPES, PATIENCE, READ_MENU_SEC, QUEUE_MAX, CUSTOMER_SPEED, PRICE_REACT, typeMix } from '../data/customers.js';
import { TIP, ratingPriceMul } from '../data/economy.js';
import { SEATS, PAY_SPOTS, QUEUE_SPOTS, DOOR_OUT } from '../data/layout.js';
import { rand, rint, weighted } from '../engine/random.js';
import { CHAR_COUNT } from '../art/atlas.js';
import { emit } from './events.js';
import { findPath, walk } from './path.js';

export const custById = id => G.run.customers.find(c => c.id === id);

// 보도를 따라 x에서 x2까지 (y10)
function sidewalk(fromX, toX) {
  const p = [], s = Math.sign(toX - fromX);
  for (let x = fromX + s; s && x !== toX + s; x += s) p.push([x, DOOR_OUT.y]);
  return p;
}

export function spawnCustomer(hour) {
  const r = G.run;
  const type = weighted(typeMix(hour));
  const fromLeft = rand() < 0.5;
  const sx = fromLeft ? -1 : 8;
  const c = {
    id: r.nextId++, type, char: 1 + Math.floor(rand() * (CHAR_COUNT - 1)),
    x: sx, y: DOOR_OUT.y, dir: fromLeft ? 0 : 2, speed: CUSTOMER_SPEED * (0.9 + rand() * 0.2),
    path: sidewalk(sx, DOOR_OUT.x), state: 'arrive', moving: true,
    seat: -1, menu: null, face: null, faceT: 0, patience: 0, patMax: 1, timer: 0,
    priceSat: 0, quality: -1, foodWaitFrac: 0, payWaited: false, exitX: fromLeft ? 8 : -1,
  };
  r.customers.push(c);
}

const P = c => CUSTOMER_TYPES[c.type].patience;

function freeSeatIndex() { return G.run.seats.findIndex(s => s === null); }

function goToSeat(c, i) {
  const r = G.run;
  r.seats[i] = c.id; c.seat = i;
  const s = SEATS[i];
  c.path = findPath(c, [[s.x, s.y]], 'customer', [[s.x, s.y]]) || [];
  c.state = 'toSeat';
}

function freeSeat(c) {
  const r = G.run;
  if (c.seat >= 0 && r.seats[c.seat] === c.id) r.seats[c.seat] = null;
  c.seat = -1;
  // 밖에서 기다리던 손님을 들여보내요
  const i = freeSeatIndex();
  if (i >= 0 && r.queue.length && !r.closing) {
    const next = custById(r.queue.shift());
    if (next) goToSeat(next, i);
    r.queue.forEach((id, k) => { const q = custById(id); if (q) q.path = sidewalkTo(q, QUEUE_SPOTS[k]); });
  }
}

function sidewalkTo(c, [x, y]) {
  return findPath(c, [[x, y]], 'customer') || [];
}

function leave(c, angry) {
  const r = G.run;
  freeSeat(c);
  r.queue = r.queue.filter(id => id !== c.id);
  r.payLine = r.payLine.filter(id => id !== c.id);
  r.payLine.forEach((id, k) => { const q = custById(id); if (q) q.path = findPath(q, [PAY_SPOTS[k]], 'customer') || []; });
  if (c.menu && c.state === 'waitFood') removeTicket(c);
  const toDoor = c.y >= DOOR_OUT.y ? [] : (findPath(c, [[DOOR_OUT.x, DOOR_OUT.y]], 'customer') || []);
  const startX = toDoor.length ? DOOR_OUT.x : Math.round(c.x);
  c.path = toDoor.concat(sidewalk(startX, c.exitX));
  c.state = 'leave';
  if (angry) { c.face = 'angry'; c.faceT = 1.6; emit('sfx', 'angry'); }
}

function miss(c, reason, kind, menu) {
  const L = G.run.log;
  L.missed[reason]++;
  const sat = { full: 3, wait: 1, price: 1.5, soldout: 2 }[reason];
  L.sats.push(sat);
  L.events.push({ kind, menu, who: CUSTOMER_TYPES[c.type].name });
  emit('float', c.x, c.y - 1.4, { full: '자리 없음', wait: '너무 늦어요', price: '비싸요', soldout: '품절' }[reason], 'bad');
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
  if (handsM <= ticketsM) r.stock[m]++;
}

function reaction(c, m) {
  const fair = MENUS[m].fair * CUSTOMER_TYPES[c.type].priceMul * ratingPriceMul(G.rating);
  const ratio = G.prices[m] / fair;
  return PRICE_REACT.find(p => ratio <= p.max);
}

function decide(c) {
  const r = G.run, T = CUSTOMER_TYPES[c.type];
  const w = {};
  for (const m of MENU_IDS) { const ratio = G.prices[m] / (MENUS[m].fair * T.priceMul); w[m] = T.likes[m] / (ratio * ratio); }
  let m = weighted(w);
  let re = reaction(c, m);
  c.face = re.face; c.faceT = 1.6;
  r.log.faces[re.face] = (r.log.faces[re.face] || 0) + 1;
  if (re.leave && rand() < re.leave) { miss(c, 'price', 'price', m); leave(c, true); return; }
  if (r.stock[m] <= 0) {
    const alts = MENU_IDS.filter(x => x !== m && r.stock[x] > 0 && !reaction(c, x).leave);
    if (alts.length && rand() < 0.5) { m = alts[0]; re = reaction(c, m); }
    else { miss(c, 'soldout', 'soldout', m); leave(c, true); return; }
  }
  r.stock[m]--;
  c.menu = m; c.priceSat = re.sat;
  r.tickets.push({ cid: c.id, menu: m, table: SEATS[c.seat].table });
  c.patMax = c.patience = PATIENCE.food * P(c);
  c.state = 'waitFood';
  emit('order', c.id, m);
}

// 사장이 음식을 내줬을 때 (sim/player.js)
export function serve(c, dish) {
  c.quality = dish.q;
  c.foodWaitFrac = 1 - c.patience / c.patMax;
  removeTicketNoReturn(c);
  c.state = 'eating';
  c.timer = CUSTOMER_TYPES[c.type].eat;
  c.face = dish.q === 2 ? 'love' : dish.q === 1 ? 'happy' : 'meh'; c.faceT = 1.4;
  emit('sfx', 'serve');
}
function removeTicketNoReturn(c) {
  const r = G.run, i = r.tickets.findIndex(t => t.cid === c.id);
  if (i >= 0) r.tickets.splice(i, 1);
}

function satisfaction(c) {
  let s = 3.5 + c.priceSat + [-0.2, 0.3, 0.8][Math.max(0, c.quality)];
  if (c.foodWaitFrac > 0.6) s -= 0.7;
  if (c.payWaited) s -= 0.6;
  return Math.max(1, Math.min(5, s));
}

// 계산 (사장이 계산대에서 — sim/player.js)
export function pay(c) {
  const r = G.run, L = r.log, T = CUSTOMER_TYPES[c.type];
  const price = G.prices[c.menu];
  const sat = satisfaction(c);
  let tip = 0;
  if (sat >= 4.5 && rand() < T.tip * 2.5) tip = rint(TIP.min / 100, TIP.max / 100) * 100;
  G.cash += price + tip; G.weekSales += price;
  L.sales[c.menu].n++; L.sales[c.menu].rev += price; L.tips += tip; L.served++;
  L.sats.push(sat);
  const who = T.name;
  if (c.quality === 2) L.events.push({ kind: 'perfect', menu: c.menu, who });
  else if (c.payWaited) L.events.push({ kind: 'payWait', menu: c.menu, who });
  else if (c.priceSat >= 1) L.events.push({ kind: 'cheap', menu: c.menu, who });
  else L.events.push({ kind: 'normal', menu: c.menu, who });
  emit('float', c.x, c.y - 1.6, '+' + (price + tip).toLocaleString('ko-KR') + '원' + (tip ? ' 팁!' : ''), 'cash');
  emit('sfx', 'coin');
  leave(c, false);
}

export function updateCustomers(dt) {
  const r = G.run;
  for (const c of r.customers.slice()) {
    if (c.faceT > 0) c.faceT -= dt;
    const arrived = walk(c, dt);
    switch (c.state) {
      case 'arrive':
        if (!arrived) break;
        if (r.closing) { leave(c, false); break; }
        { const i = freeSeatIndex();
          if (i >= 0 && !r.queue.length) goToSeat(c, i);
          else if (r.queue.length < QUEUE_MAX) {
            r.queue.push(c.id); c.state = 'queue';
            c.patMax = c.patience = PATIENCE.queue * P(c);
            c.path = sidewalkTo(c, QUEUE_SPOTS[r.queue.length - 1]);
          } else { miss(c, 'full', 'full'); leave(c, false); }
        }
        break;
      case 'queue':
        c.patience -= dt;
        if (r.closing) { leave(c, false); break; }
        if (c.patience <= 0) { miss(c, 'full', 'full'); leave(c, true); }
        break;
      case 'toSeat':
        if (arrived) { c.state = 'reading'; c.timer = READ_MENU_SEC; c.dir = SEATS[c.seat].face === 'right' ? 0 : 2; }
        break;
      case 'reading':
        c.timer -= dt;
        if (c.timer <= 0) decide(c);
        break;
      case 'waitFood':
        c.patience -= dt;
        if (c.patience <= 0) { miss(c, 'wait', 'wait', c.menu); leave(c, true); }
        break;
      case 'eating':
        c.timer -= dt;
        if (c.timer <= 0) c.state = 'waitPayLine';
        break;
      case 'waitPayLine':
        if (r.payLine.length < PAY_SPOTS.length) {
          r.payLine.push(c.id);
          freeSeat(c);
          c.path = findPath(c, [PAY_SPOTS[r.payLine.length - 1]], 'customer') || [];
          c.state = 'payLine';
          c.patMax = c.patience = PATIENCE.pay * P(c);
        }
        break;
      case 'payLine':
        if (r.payLine[0] === c.id && arrived) {
          c.dir = 1;
          c.patience -= dt;
          if (c.patience <= 0) { c.payWaited = true; pay(c); }
        }
        break;
      case 'leave':
        if (arrived) r.customers.splice(r.customers.indexOf(c), 1);
        break;
    }
  }
}

// 그림·화면용: 손님이 앉아 있는지
export const isSeated = c => ['reading', 'waitFood', 'eating', 'waitPayLine'].includes(c.state);
