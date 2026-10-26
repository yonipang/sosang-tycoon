// 영업 밖 화면: 처음 화면 · 새벽 준비 · 마감 영수증 · 고정비 내는 날(고지서)
import { G, newGame } from '../save/state.js';
import { MENUS, MENU_IDS, INGREDIENTS, MENU_SLOTS, SLOTS_BY_GRADE, GRADE_NAMES, SHOP_GRADE } from '../data/menu.js';
import { CREDITS, CREDITS_THANKS } from '../data/credits.js';
import { GAME_VERSION } from '../data/version.js';
import { $, won, wonShort, clockText, josa } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { prepCost, weekBills } from '../sim/day.js';
import { upgradeOpen, menuLv, lvBasePrice, anyUpReady } from '../sim/upgrade.js';
import { recipeOf, invOf, invToday, invServings, slotsOpen, menuOn, todayMenus } from '../sim/pantry.js';
import { LOAN_RATE } from '../data/economy.js';
import { hasSave, loadGame, clearSave } from '../save/storage.js';
import { CLOUD, cloudLogin, cloudLogout, setCloudApplier, summaryLine } from '../save/cloud.js';
import { cutActive } from './cutscene.js';
import { townMode } from '../sim/town.js';
import { showTown } from './town.js';
import { toast } from './feedback.js';
import { icon } from './icons.js';
import { dayLabel } from './hud.js';
import { playSfx, unlockAudio } from './sfx.js';
import { setMusic, musicWant } from './music.js';
import { LEVELS, setting, stepSetting, setOption, canVibrate, vibeKind, vibrate, installState, promptInstall, WEBAPP_URL } from './settings.js';
import { menuOpen } from '../sim/story.js';
import { costOf, costRatio, marketOn } from '../sim/market.js';
import { questCard, doneCard, incidentCard, talking } from './story.js';
import { TOOLS, TOOL_IDS } from '../data/tools.js';
import { INCIDENTS } from '../data/incidents.js';
import { DEV_JUMPS } from '../sim/dev.js';

const scr = () => $('screen');
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// 같은 화면을 다시 그릴 때(가격·주문량 바꾸기 등)는 스크롤 위치와 펼친 「자세히」를 그대로 둬요. 다른 화면이면 맨 위부터
export function showScreen(html, cls) {
  const s = scr();
  const same = !s.hidden && s.dataset.scr === (cls || ''); // 길잡이가 붙이는 guiding 같은 꼬리표와 상관없이
  const top = s.scrollTop;
  const opened = same ? [...s.querySelectorAll('details')].map(d => d.open) : [];
  s.className = cls || ''; s.dataset.scr = cls || '';
  s.innerHTML = html;
  s.hidden = false;
  if (same) { s.querySelectorAll('details').forEach((d, i) => { if (opened[i]) d.open = true; }); s.scrollTop = top; }
  else s.scrollTop = 0;
}
export function hideScreen() { scr().hidden = true; scr().innerHTML = ''; }

// ── 처음 화면 ──
export function renderTitle() {
  const save = hasSave();
  showScreen(`
    <div class="title">
      <div class="logo-sub">골목 분식집에서 시작하는</div>
      <h1 class="logo">소상공인<br>키우기</h1>
      <div class="hero">${icon('char0', 'big')}${icon('tteok', 'dish')}${icon('kimbap', 'dish')}${icon('twigim', 'dish')}</div>
      ${save ? `<button class="btn primary" data-act="continue">이어하기</button>` : ''}
      <button class="btn ${save ? '' : 'primary'}" data-act="new">${save ? '새로 시작' : '가게 열기'}</button>
      <p class="howto">칸을 눌러 움직입니다. 조리대에서 요리하고, 손님 자리에 내주고, 계산대 뒤에 서면 계산합니다.</p>
      <p class="proto">프로토타입 v${GAME_VERSION} · 프롤로그와 1장</p>
      ${CLOUD.st === 'in' ? `<p class="cl-title">☁ ${escName()} · 클라우드에 자동 저장</p>` : CLOUD.st === 'out' || CLOUD.st === 'na' ? '<button class="btn ghost small" data-act="cloudLogin">구글 로그인</button>' : ''}
      <button class="btn ghost small" data-act="settings" data-from="title">설정</button>
    </div>`, 'scr-title');
}

// ── 준비: 가격 · 재료 주문 (주문한 재료는 아침에 도착) ──
// 가격 장부: 지금 가격에 손님들이 지었던 얼굴 (문라이터식). 가격을 바꾸면 그 가격의 기록이 보여요
const FACE_ORDER = ['love', 'happy', 'meh', 'angry'];
// 원가율: 가격을 바꾸면 바로 바뀌어요 (30% 이하 초록 · 40% 넘으면 빨강) · 시세 소식이 걸리면 ▲/▼
const crClass = r => (r <= 0.3 ? 'good' : r > 0.4 ? 'bad' : '');
function ledgerLine(m) {
  const e = (G.ledger[m] || {})[G.prices[m]];
  const faces = e ? FACE_ORDER.filter(f => e[f]).map(f => `<span class="lf">${icon('face_' + f, 'face')}${e[f]}</span>`).join('') : '';
  const cr = costRatio(m), mk = marketOn(m);
  return `<div class="ledger"><span class="cr ${crClass(cr)}">원가율 ${Math.round(cr * 100)}%${mk ? `<i class="${mk.mul > 1 ? 'up' : 'down'}">${mk.mul > 1 ? '▲' : '▼'}시세</i>` : ''}</span><span class="lg"><small>장부</small>${faces || '<small>이 가격은 기록 없음</small>'}</span></div>`;
}

export function renderPrep() {
  const last = G.history[G.history.length - 1];
  const cost = prepCost();
  const after = G.cash - cost;
  const alba = G.story.ch === 0; // 프롤로그: 아직 알바라 내 돈이 아니에요
  const town = townMode(), dawn = town && G.town.part === 'dawn'; // 마을(1장부터): 재료는 새벽 시장에서 사고, 가게는 새벽에 열어요
  const step = (act, m, label, value) => `<div class="step"><button data-act="${act}" data-m="${m}" data-d="-1" aria-label="${label} 줄이기">−</button><b>${value}</b><button data-act="${act}" data-m="${m}" data-d="1" aria-label="${label} 늘리기">+</button></div>`;
  const cards = MENU_IDS.map(m => {
    if (!menuOn(m)) return ''; // 아직 안 연 메뉴 · 오늘 쉬는 메뉴는 보여 주지 않아요 (이야기로 열리면 「새 메뉴」로 등장)
    const M = MENUS[m];
    const isNew = G.story.fresh.includes(m);
    const had = last ? (last.stockStart ? last.stockStart[m] : last.prep[m]) : 0;
    const soldOut = last && had && last.sold[m] >= had;
    const inv = invServings(m), soon = recipeOf(m).filter(i => invToday(i) > 0).map(i => INGREDIENTS[i].name).join('·');
    // 꼭 볼 것만 칩으로: 새 메뉴 · 어제 품절 · 만들 수 있는 그릇(오늘까지 써야 하는 재료가 있으면 빨갛게)
    const lv = menuLv(m);
    const chips = (lv > 1 ? `<span class="tag lv">Lv${lv}</span>` : '') + (isNew ? '<span class="tag new">새 메뉴</span>' : '')
      + (soldOut ? '<span class="tag hot">어제 품절</span>' : '')
      + (inv ? `<span class="tag ${soon ? 'warn' : ''}">재고 ${inv}${soon ? ` · 오늘까지 ${soon}` : ''}</span>` : '');
    const recipe = recipeOf(m).map(i => { const I = INGREDIENTS[i], t = invToday(i); return `${I.name} <small>${invOf(i)}${t ? ` <em class="today">오늘까지 ${t}</em>` : ''} · ${I.shelf}일</small>`; }).join('<br>');
    return `<div class="mcard">
      <div class="mhead">${icon(m, 'dish')}<b>${M.name}</b><span class="tags">${chips}</span></div>
      <div class="row"${m === 'tteok' ? ' data-guide="price"' : ''}><span>가격</span>${step('price', m, `${M.name} 가격`, won(G.prices[m]))}</div>
      ${ledgerLine(m)}
      ${lv > 1 ? `<div class="lv-base"><span>Lv${lv} 기본 가격</span><b>${won(lvBasePrice(m))}</b></div>` : ''}
      ${town ? `<div class="row"><span>재고</span><b class="stock-n">${inv}그릇${inv ? '' : ' · 새벽 시장에서 사 보세요'}</b></div>` : `<div class="row"${m === 'tteok' ? ' data-guide="order"' : ''}><span>주문</span>${step('prep', m, `${M.ing} 주문`, `${G.prep[m]}인분`)}</div>`}
      <details class="more"><summary>자세히</summary>
        <p>원가 ${won(costOf(m))}${costOf(m) !== M.cost ? ` (평소 ${won(M.cost)})` : ''} · 원가율 ${Math.round(costRatio(m) * 100)}% · 한 그릇 남는 돈 ${won(G.prices[m] - costOf(m))}<br>오늘 만들 수 있는 양 ${inv + (town ? 0 : G.prep[m])}그릇${last ? ` · 어제 ${last.sold[m]}그릇 판매` : ''}</p>
        <p class="recipe"><b>한 그릇에 하나씩</b> <small>(창고 · 받은 날부터 쓸 수 있는 날)</small><br>${recipe}</p>
      </details>
    </div>`;
  }).join('');
  showScreen(`
    <div class="prep">
      <div class="phase-tag night">${dawn ? '새벽 · ' : town ? '밤 · 가게 장부 · ' : '전날 밤 22:00 · '}${G.shop}</div>
      <h2>${dayLabel(G.day)} ${dawn ? '가게 열기' : '준비'}</h2>
      <p class="yday">${last ? `어제 매출 <b>${wonShort(last.revenue)}</b> · 손님 ${last.served}명` : '주문한 재료는 아침에 도착합니다'}</p>
      ${questCard()}
      ${town ? todayCard() : ''}
      ${toolsCard()}
      ${cards}
      <div class="sum">
        ${town ? '' : `<div><span>${alba ? '재료 주문' : '주문'}</span><b>−${won(cost)}</b></div>`}
        ${alba ? '<div class="due soft"><span>오 사장님 가게 돈으로 냅니다</span></div>' : `<div><span>잔고</span><b class="${after < 0 ? 'neg' : ''}">${won(after)}</b></div>`}
        ${G.day % 7 === 0 ? `<div class="due"><span>오늘 밤 고정비</span><b class="nowrap">약 −${wonShort(weekBills(G.day - 1).total)}</b></div>` : ''}
      </div>
      ${!town || dawn ? '<button class="btn primary big" data-act="open" data-guide="open">가게 열기 · 09:00</button>' : '<p class="pause-note">가게는 새벽에 엽니다. 집에서 자고 일어나 보세요</p>'}
      ${town ? '<button class="btn" data-act="toTown">골목으로</button>' : ''}
      <button class="btn ghost small" data-act="toTitle">처음 화면</button>
    </div>`, 'scr-prep');
}

// 오늘의 메뉴 (1장부터, 데이브 더 다이버 초밥 칸처럼): 칸 8개 중 가게 등급만큼 열려 있고 나머지는 자물쇠
// 칸에 올린 메뉴만 오늘 팔아요. 빼면 아래 「쉬는 메뉴」로 · 오늘까지 써야 하는 재료가 있으면 빨갛게
const LOCK_SVG = '<svg class="lock" viewBox="0 0 10 12" width="15" height="18" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="1" width="4" height="1"/><rect x="2" y="2" width="1" height="3"/><rect x="7" y="2" width="1" height="3"/><rect x="1" y="5" width="8" height="6"/><rect x="4" y="7" width="2" height="2" class="kh"/></svg>';
function todayCard() {
  const on = todayMenus(), open = slotsOpen();
  const off = MENU_IDS.filter(m => menuOpen(m) && !menuOn(m));
  const gradeAt = k => SLOTS_BY_GRADE.findIndex(n => n > k); // 이 칸이 열리는 등급
  const todayIngs = m => recipeOf(m).filter(i => invToday(i) > 0).map(i => INGREDIENTS[i].name);
  const slots = Array.from({ length: MENU_SLOTS }, (_, k) => {
    const m = on[k];
    if (m) {
      const t = todayIngs(m), n = invServings(m);
      return `<div class="slot on${t.length ? ' hurry' : ''}">${icon(m, 'dish')}<b>${MENUS[m].name}</b><small class="${n ? '' : 'none'}">${n ? `${n}그릇` : '재료 없음'}</small>${t.length ? `<em class="today">오늘까지 ${t.join('·')}</em>` : ''}${on.length > 1 ? `<button type="button" class="slot-x" data-act="menuToggle" data-m="${m}" aria-label="${MENUS[m].name} 빼기">빼기</button>` : ''}</div>`;
    }
    if (k < open) return `<div class="slot empty"><small>빈 칸</small></div>`;
    return `<div class="slot locked">${LOCK_SVG}<small>${gradeAt(k)}등급</small></div>`;
  }).join('');
  const rest = off.map(m => `<button type="button" class="tm-off" data-act="menuToggle" data-m="${m}">${icon(m, 'dish')}<span>${MENUS[m].name}<small>${invServings(m)}그릇</small></span><b>올리기</b></button>`).join('');
  return `<div class="tmcard" data-guide="today"><div class="q-head"><small>오늘의 메뉴</small><b>${GRADE_NAMES[SHOP_GRADE]} · ${on.length}/${open}칸</b></div>
    <div class="slots">${slots}</div>
    ${rest ? `<div class="tm-rest"><small>쉬는 메뉴 · 올리면 오늘 팝니다</small>${rest}</div>` : ''}
  </div>`;
}

// 장사 도구 (오 사장님 권유로 1장 중간부터): 사면 계속 써요
function toolsCard() {
  const S = G.story;
  if (!S.toolsOpen) return '';
  const rows = TOOL_IDS.map(id => {
    const t = TOOLS[id], own = S.tools.includes(id);
    return `<div class="trow${own ? ' own' : ''}"><div class="t-txt"><b>${t.name}</b><small>${t.desc}</small></div>${own ? '<span class="t-own">있음</span>' : `<button type="button" class="btn small" data-act="buyTool" data-tool="${id}">${won(t.price)}</button>`}</div>`;
  }).join('');
  return `<div class="tcard" data-guide="tools"><div class="q-head"><small>장사 도구</small><b>한 번 사면 계속 씁니다</b></div>${rows}</div>`;
}

// ── 마감 영수증 ──
// 내일로 넘어가는 재료 (남은 것만)
function leftLine(R) {
  const L = R.leftover || {};
  const left = Object.keys(L).filter(i => L[i] && (INGREDIENTS[i] || MENUS[i])).map(i => `${(INGREDIENTS[i] || MENUS[i]).name} ${L[i]}`).join(' · ');
  return left ? `<div class="ln note"><span>내일 쓸 재료</span><b class="left-ings">${left}</b></div>` : '';
}
// 오늘 원가율: 팔린 음식 재료 + 버린 것 + 급구매 웃돈 (메뉴 원가율보다 얼마나 더 들었는지 보여 줘요)
const pct = r => `${Math.round(r * 100)}%`;
function costCard(c) {
  if (!c) return '';
  const P = r => Math.round(r * 100), w = P(c.waste), ru = P(c.rush); // 더해서 맞도록 팔린 몫은 나머지로
  const extra = [w ? `버린 음식·재료 +${w}%` : '', ru ? `급구매 +${ru}%` : ''].filter(Boolean).join(' · ');
  return `<div class="hl wide cost ${crClass(c.total)}"><small>오늘 원가율</small><b>${pct(c.total)}</b><span>팔린 음식 재료 ${P(c.total) - w - ru}%${extra ? ` · ${extra}` : ' · 버린 것 없음!'}</span></div>`;
}
// 오늘 쌓은 숙련도 (메뉴 업그레이드가 열린 뒤)
function masteryCard(g) {
  if (!g || !upgradeOpen()) return '';
  const t = MENU_IDS.filter(m => g[m]).map(m => `${MENUS[m].name} +${Math.round(g[m] * 10) / 10}`).join(' · ');
  if (!t) return '';
  return `<div class="hl wide${anyUpReady() ? ' good' : ''}"><small>메뉴 숙련</small><b>${t}</b>${anyUpReady() ? '<span>메뉴 연구 칠판에서 올릴 수 있는 메뉴가 있습니다</span>' : ''}</div>`;
}
const MISS_NAME = { full: '자리 없음', wait: '오래 기다림', price: '가격', soldout: '품절' };
export function renderReceipt() {
  const R = G.lastReceipt;
  const lines = MENU_IDS.filter(m => R.sales[m].n).map(m => `<div class="ln"><span>${MENUS[m].name} ×${R.sales[m].n}</span><b>${won(R.sales[m].rev)}</b></div>`).join('') || '<div class="ln"><span>판매 없음</span><b>0원</b></div>';
  const miss = Object.entries(R.missed).filter(([, n]) => n).map(([k, n]) => `<span class="chip">${MISS_NAME[k]} ${n}</span>`).join('');
  const delta = R.ratingDelta;
  const rv = R.reviews.map(v => `<div class="rv"><div class="rs">${stars(v.stars)}<small>${v.who}</small></div><p>${v.text}</p></div>`).join('');
  // 한눈에: 오늘 남은 돈(세어 올리기) · 별점 · 하이라이트 카드. 영수증 전체는 「자세히」
  const best = MENU_IDS.filter(m => R.sales[m].n).sort((a, b) => R.sales[b].n - R.sales[a].n)[0];
  const topMiss = Object.entries(R.missed).sort((a, b) => b[1] - a[1])[0];
  const deltaHtml = Math.abs(delta) < 0.05 ? '' : `<small class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(1)}</small>`;
  const cards = [
    doneCard(R.quests),
    incidentCard(R.incidents),
    best ? `<div class="hl">${icon(best, 'hl-ic')}<small>오늘의 인기 메뉴</small><b>${MENUS[best].name} ${R.sales[best].n}그릇</b></div>` : `<div class="hl"><small>오늘의 인기 메뉴</small><b>아직 없음</b></div>`,
    costCard(R.cost),
    masteryCard(R.mastery),
    R.missedTotal ? `<div class="hl warn"><small>놓친 손님</small><b>${R.missedTotal}명 · 주로 ${MISS_NAME[topMiss[0]]}</b></div>` : `<div class="hl good"><small>놓친 손님</small><b>없음!</b></div>`,
    R.foot ? `<div class="hl"><small>가게 앞 유동인구</small><b>${R.foot}명 중 ${R.entered}명 입장</b></div>` : '',
    R.reviews[0] ? `<div class="hl wide"><small>${stars(R.reviews[0].stars)} ${R.reviews[0].who}</small><b>「${R.reviews[0].text}」</b></div>` : '',
  ].join('');
  showScreen(`
    <div class="receipt">
      <div class="rc-hero">
        <small>${dayLabel(R.day)} · 오늘 남은 돈</small>
        <b class="hero-num ${R.net < 0 ? 'neg' : ''}" data-to="${R.net}">0원</b>
        <div class="hero-star">★ ${R.rating.toFixed(1)} ${deltaHtml}</div>
      </div>
      <div class="hls">${cards}</div>
      <details class="more rc-more"><summary>영수증 자세히</summary>
      <div class="paper">
        <div class="rc-head"><b>${G.shop}</b><small>${dayLabel(R.day)} 영업 마감 · ${clockText(R.closeMin ?? 720)}${(R.closeMin ?? 720) < 720 ? ' (일찍 마감)' : ''}</small></div>
        <div class="dash"></div>
        ${lines}
        ${R.tips ? `<div class="ln"><span>팁</span><b>${won(R.tips)}</b></div>` : ''}
        <div class="dash"></div>
        <div class="ln"><span>오늘 매출</span><b>${won(R.revenue + R.tips)}</b></div>
        <div class="ln minus"><span>오늘 쓴 재료값</span><b>−${won(R.usedCost)}</b></div>
        ${R.expiredCost ? `<div class="ln minus"><span>유통기한 지나 버린 재료</span><b>−${won(R.expiredCost)}</b></div>` : ''}
        ${R.rushExtra ? `<div class="ln minus"><span>급구매 웃돈</span><b>−${won(R.rushExtra)}</b></div>` : ''}
        ${R.cost ? `<div class="ln note"><span>원가율 (재료값 ÷ 매출)</span><b>${pct(R.cost.total)}</b></div>` : ''}
        <div class="ln total"><span>오늘 남은 돈</span><b class="${R.net < 0 ? 'neg' : ''}">${won(R.net)}</b></div>
        ${R.dishWaste ? `<div class="ln note"><span>만들고 못 판 음식</span><b>${won(R.dishWaste)}</b></div>` : ''}
        ${leftLine(R)}
        <div class="dash"></div>
        ${R.foot ? `<div class="ln"><span>가게 앞을 지나간 사람</span><b>${R.foot}명</b></div><div class="ln"><span>그중 들어온 사람</span><b>${R.entered}명 (${Math.round(R.entered / R.foot * 100)}%)</b></div>` : ''}
        <div class="ln"><span>받은 손님</span><b>${R.served}명</b></div>
        <div class="ln"><span>손님 한 명당 매출</span><b>${won(R.avgSpend)}</b></div>
        <div class="ln"><span>놓친 손님</span><b>${R.missedTotal}명</b></div>
        ${miss ? `<div class="chips">${miss}</div>` : ''}
        <div class="dash"></div>
        <div class="ln star"><span>가게 별점</span><b>★ ${R.rating.toFixed(1)} ${Math.abs(delta) < 0.05 ? '<small>−</small>' : `<small class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(1)}</small>`}</b></div>
        ${rv ? `<div class="rvs">${rv}</div>` : ''}
        ${G.story.ch === 0 ? '<div class="rc-foot">오늘 번 돈은 오 사장님 가게 돈입니다</div>' : `<div class="rc-foot">잔고 ${won(G.cash)}</div>`}
      </div>
      </details>
      <button class="btn primary big" data-act="afterReceipt">${G.day % 7 === 0 ? '이번 주 고지서 보기' : '다음 날 준비'}</button>
    </div>`, 'scr-receipt');
  countUp(document.querySelector('.hero-num'));
}

// 큰 숫자를 0에서 세어 올려요 (끝나면 동전 소리)
function countUp(el) {
  if (!el) return;
  const to = +el.dataset.to, t0 = performance.now(), dur = 900;
  const tick = now => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = won(Math.round(to * e / 100) * 100);
    if (k < 1) requestAnimationFrame(tick); else { el.textContent = won(to); playSfx('coin'); }
  };
  requestAnimationFrame(tick);
}

// ── 주간 정산 ──
// 이번 주(최근 7일) 원가율 · 지난주와 견주기
function weekCost(from, to) {
  const days = G.history.filter(h => h.day >= from && h.day <= to && h.cost !== undefined && h.revenue);
  const rev = days.reduce((s, h) => s + h.revenue, 0);
  return rev ? days.reduce((s, h) => s + h.cost, 0) / rev : null;
}
function weekCostLine() {
  const now = weekCost(G.day - 6, G.day), before = weekCost(G.day - 13, G.day - 7);
  if (now === null) return '';
  const diff = before === null ? '' : Math.round(now * 100) === Math.round(before * 100) ? ' <small>지난주와 같음</small>' : ` <small class="${now < before ? 'up' : 'down'}">지난주 ${pct(before)}</small>`;
  return `<div class="ln note"><span>이번 주 원가율</span><b>${pct(now)}${diff}</b></div>`;
}
export function renderWeekly() {
  const W = G.lastWeekly, B = W.bills, after = G.cash - B.total;
  const bill = (name, sub, v) => `<div class="bill"><div><b>${name}</b><small>${sub}</small></div><b>${won(v)}</b></div>`;
  showScreen(`
    <div class="weekly">
      <div class="phase-tag night">일요일 밤 · ${W.week}주차</div>
      <h2>고정비 내는 날</h2>
      <p class="yday">이번 주 매출 <b>${wonShort(W.sales)}</b></p>
      <div class="bills">
        <small class="bills-h">이번 주 고지서</small>
        ${bill('가게 임대료', '건물주 · 매주', B.rent)}
        ${bill('대출 이자', `남은 대출 ${wonShort(G.loan)} · 연 ${Math.round(LOAN_RATE * 100)}%`, B.interest)}
        ${bill('대출 원금', '창업 대출 나눠 갚기', B.principal)}
        ${bill('공과금', `전기·가스·수도 · 이번 주 ${B.dishes}그릇`, B.util)}
        <div class="bill total"><b>합계</b><b>${won(B.total)}</b></div>
      </div>
      <div class="paper">
        ${weekCostLine()}
        <div class="ln"><span>지금 잔고</span><b>${won(G.cash)}</b></div>
        <div class="ln total"><span>내고 나면</span><b class="${after < 0 ? 'neg' : ''}">${won(after)}</b></div>
        <div class="ln note"><span>남는 대출</span><b>${won(Math.max(0, G.loan - B.principal))}</b></div>
      </div>
      ${after < 0 ? `<p class="warn">잔고가 모자랍니다. 다음 주에는 가격이나 주문량을 다시 살펴보세요. (프로토타입에서는 그대로 이어집니다)</p>` : ''}
      <button class="btn primary big" data-act="afterWeekly">모두 내고 다음 주 시작 · ${won(B.total)}</button>
    </div>`, 'scr-weekly');
}

// ── 개발자 모드: 원하는 날·장면으로 바로 가기 (sim/dev.js DEV_JUMPS) ──
let devOn = false;
export function renderDev() {
  devOn = true;
  showScreen(`
    <div class="devs">
      <h2>개발자 모드</h2>
      <p class="dev-note">고른 날의 준비 화면으로 바로 갑니다. 지금 세이브는 덮어씁니다. 영업 중 쉬기(❚❚)에서 돌발 이벤트를 바로 일으킬 수 있습니다.</p>
      ${DEV_JUMPS.map(j => `<button class="btn" data-act="devJump" data-j="${j.id}">${j.name}</button>`).join('')}
      <button class="btn ghost small" data-act="toTitle">처음 화면</button>
    </div>`, 'scr-dev');
}

// ── 설정: 소리 · 진동 · 대화 · 홈 화면에 추가 · 계정 · 크레딧 · 처음부터 · 버전 ──
// from: 어디서 열었는지 (title · prep · day · receipt · weekly · pause) — 「돌아가기」로 그 화면에 돌아가요
// 개발자 모드는 숨겨 둬요: 처음 화면에서 연 설정의 버전 글자를 7번 누르면 열려요
let settingsFrom = 'title', musicBefore = null, previewing = false, verTaps = 0;
const lvText = k => setting(k) ? `${LEVELS[setting(k)] * 100}%` : '끔';
const seg = (k, opts) => `<div class="seg">${opts.map(([v, label]) => `<button type="button" data-act="setOpt" data-k="${k}" data-v="${v}" class="${setting(k) === v ? 'on' : ''}">${label}</button>`).join('')}</div>`;
function installRow() {
  const st = installState();
  if (st === 'installed') return '<p class="set-note">홈 화면에서 열려 있습니다.</p>';
  if (st === 'prompt') return '<button type="button" class="btn small" data-act="install">홈 화면에 추가</button>';
  if (st === 'ios') return '<p class="set-note">사파리 아래쪽 공유 버튼 → 「홈 화면에 추가」를 눌러 보세요.</p>';
  if (st === 'manual') return '<p class="set-note">브라우저 메뉴(⋮) → 「홈 화면에 추가」 또는 「앱 설치」를 눌러 보세요.</p>';
  return `<p class="set-note">웹앱 주소에서 추가할 수 있습니다.<br><a href="${WEBAPP_URL}" target="_blank" rel="noopener">${WEBAPP_URL.replace('https://', '')}</a></p>`;
}
// 클라우드 저장 (save/cloud.js): 구글 로그인 버튼 하나. 같은 계정이면 어느 기기에서든 더 최근 세이브를 저절로 써요
const escName = () => String(CLOUD.user ? CLOUD.user.name : '').replace(/[&<>"']/g, '');
function accountRows() {
  const st = CLOUD.st;
  if (st === 'in') return `<div class="row"><span class="cl-name">${escName()}</span><button type="button" class="btn ghost small" data-act="cloudLogout">로그아웃</button></div>`
    + `<p class="set-note">${CLOUD.doc ? `클라우드 · ${summaryLine(CLOUD.doc.data)} 저장` : '아직 클라우드에 올린 세이브가 없습니다.'}<br>같은 계정으로 로그인하면 어느 기기에서든 이어서 할 수 있습니다.</p>`;
  if (st === 'out' || st === 'na') return '<div class="row"><span>구글 로그인</span><button type="button" class="btn small" data-act="cloudLogin">로그인</button></div>'
    + (st === 'na' && CLOUD.err !== 'load' ? `<p class="set-note">Claude 안에서는 로그인할 수 없습니다. 웹앱 주소에서 로그인해 보세요.<br><a href="${WEBAPP_URL}" target="_blank" rel="noopener">${WEBAPP_URL.replace('https://', '')}</a></p>`
      : '<p class="set-note">로그인하면 새벽 준비 때마다 클라우드에 저장되고, 어느 기기에서든 이어서 할 수 있습니다.</p>');
  return '<p class="set-note">연결하는 중…</p>';
}
// 다시 그리기: 처음 화면이나 설정이 떠 있으면 클라우드 상태가 바뀔 때 새로 그려요
export function refreshCloudUI() {
  const s = $('screen');
  if (s.hidden) return;
  if (s.classList.contains('scr-title')) renderTitle();
  else if (s.classList.contains('scr-settings')) renderSettings();
}

export function renderSettings(from) {
  if (from) { settingsFrom = from; musicBefore = musicWant(); previewing = false; verTaps = 0; }
  const step = (k, label) => `<div class="row"><span>${label}</span><div class="step"><button data-act="setLv" data-k="${k}" data-d="-1" aria-label="${label} 줄이기">−</button><b>${lvText(k)}</b><button data-act="setLv" data-k="${k}" data-d="1" aria-label="${label} 키우기">+</button></div></div>`;
  showScreen(`
    <div class="settings">
      <div class="set-head"><h2>설정</h2><button type="button" class="set-x" data-act="settingsClose" aria-label="닫기">✕</button></div>
      <div class="set-card">
        <small class="set-h">소리</small>
        ${step('music', '배경음악')}
        ${step('sfx', '효과음')}
        <div class="row"><span>진동</span>${seg('vibe', [[1, '켬'], [0, '끔']])}</div>
        ${!canVibrate() ? '<p class="set-note">이 기기(브라우저)는 진동을 지원하지 않습니다</p>' : vibeKind() === 'ios' ? '<p class="set-note">아이폰은 짧게 「톡」 한 번씩만 울립니다</p>' : ''}
      </div>
      <div class="set-card">
        <small class="set-h">대화</small>
        <div class="row"><span>글 나오는 방식</span>${seg('talk', [[0, '한 번에'], [1, '한 글자씩']])}</div>
      </div>
      <div class="set-card">
        <small class="set-h">홈 화면에 추가</small>
        ${installRow()}
      </div>
      <div class="set-card">
        <small class="set-h">계정 · 클라우드 저장</small>
        ${accountRows()}
      </div>
      <button class="btn" data-act="credits">크레딧</button>
      <p class="set-ver" data-act="ver">소상공인 키우기 · 프로토타입 v${GAME_VERSION}</p>
      ${hasSave() || G.phase !== 'title' ? '<button type="button" class="set-restart" data-act="restart">처음부터 다시 하기</button>' : ''}
    </div>`, 'scr-settings');
}
function closeSettings() {
  if (previewing) setMusic(musicBefore); // 미리 듣기를 끝내요
  previewing = false;
  const f = settingsFrom;
  if (f === 'prep' && G.phase === 'prep') { if (townMode()) { hideScreen(); showTown(); } else renderPrep(); } // 마을이면 골목으로
  else if (f === 'receipt' && G.phase === 'receipt') renderReceipt();
  else if (f === 'weekly' && G.phase === 'weekly') renderWeekly();
  else if (f === 'pause' && G.run) renderPause();
  else if (f === 'day' && G.run) { hideScreen(); runCmd('hold', { on: false }); }
  else renderTitle();
}
// 위 막대 톱니바퀴: 지금 화면에서 설정 열기 (영업 중이면 가게를 잠깐 멈춰요)
export function openSettingsHere() {
  if (G.phase === 'title' || !$('screen').hidden && $('screen').classList.contains('scr-settings')) return;
  if (G.phase === 'day' && G.run) {
    if (G.run.paused) { renderSettings('pause'); return; }
    runCmd('hold', { on: true }); renderSettings('day'); return;
  }
  renderSettings(G.phase);
}

// ── 엔딩 크레딧 ──
// 게임 엔딩(3년 기한)이 끝나면 올라가요. 엔딩이 생기기 전에는 처음 화면 「크레딧」 버튼으로 같은 화면을 봐요.
export function renderCredits() {
  const blocks = CREDITS.map(c => `<div class="cr-block"><small>${c.head}</small>${c.lines.map((l, i) => i === 0 && c.link ? `<b><a href="${c.link}" target="_blank" rel="noopener">${l}</a></b>` : i === 0 ? `<b>${l}</b>` : `<span>${l}</span>`).join('')}</div>`).join('');
  showScreen(`
    <div class="credits-roll">
      <div class="cr-track">
        <h1 class="logo">소상공인<br>키우기</h1>
        ${blocks}
        <p class="cr-thanks">${CREDITS_THANKS}</p>
      </div>
      <button class="btn ghost small cr-close" data-act="settings">돌아가기</button>
    </div>`, 'scr-credits');
}

export function renderPause() {
  showScreen(`
    <div class="pause">
      <h2>잠깐 쉬는 중</h2>
      <button class="btn primary big" data-act="resume">계속하기</button>
      <button class="btn ghost small" data-act="settings" data-from="pause">설정</button>
      ${G.run && !G.run.closing ? `<button class="btn" data-act="closeEarly">오늘 영업 일찍 마감하기</button><p class="pause-note">새 손님은 받지 않고, 안에 있는 손님만 마저 받습니다</p>` : ''}
      ${devOn && G.run && !G.run.closing ? `<div class="dev-inc"><small>개발자 · 돌발 이벤트 바로</small>${Object.keys(INCIDENTS).map(id => `<button class="btn small" data-act="devInc" data-i="${id}">${INCIDENTS[id].name}</button>`).join('')}<button class="btn small" data-act="devCash">+100만 원</button><button class="btn small" data-act="devMarket">시세 소식 (다음 날)</button></div>` : ''}
      <button class="btn ghost" data-act="toTitle">처음 화면 (오늘 영업은 저장되지 않습니다)</button>
    </div>`, 'scr-pause');
}

// 화면 버튼 → 명령
export function initScreens(onStart) {
  initAsk();
  // 클라우드에 더 최근 세이브가 있을 때: 처음 화면이나 준비 화면(대화·연출 중 아님)에서만 바꿔 넣어요
  setCloudApplier({
    can: () => G.phase === 'title' || (G.phase === 'prep' && !talking() && !cutActive()),
    load: line => {
      if (G.phase === 'title') renderTitle();
      else if (loadGame()) { setMusic(null); onStart(); }
      toast(`클라우드 세이브를 불러왔습니다 · ${line}`, 'good');
    },
  });
  scr().addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    unlockAudio();
    const a = b.dataset.act, m = b.dataset.m, d = +b.dataset.d;
    if (a === 'new') { if (hasSave() && !confirmNew(b)) return; clearSave(); newGame(); playSfx('page'); onStart(); }
    else if (a === 'continue') { if (loadGame()) { playSfx('page'); onStart(); } }
    else if (a === 'price') { runCmd('setPrice', { menu: m, delta: d }); playSfx('tap'); }
    else if (a === 'prep') { runCmd('setPrep', { menu: m, delta: d }); playSfx('tap'); }
    else if (a === 'open') runCmd('openShop');
    else if (a === 'questPay') runCmd('questPay', { id: b.dataset.q });
    else if (a === 'buyTool') runCmd('buyTool', { id: b.dataset.tool });
    else if (a === 'menuToggle') runCmd('menuToggle', { menu: m });
    else if (a === 'afterReceipt') { playSfx('page'); runCmd('afterReceipt'); }
    else if (a === 'afterWeekly') { playSfx('page'); runCmd('afterWeekly'); }
    else if (a === 'credits') { playSfx('page'); renderCredits(); }
    else if (a === 'dev') { playSfx('page'); renderDev(); }
    else if (a === 'settings') { playSfx('page'); renderSettings(b.dataset.from); }
    else if (a === 'settingsClose') { playSfx('page'); closeSettings(); }
    else if (a === 'setLv') {
      stepSetting(b.dataset.k, d);
      if (b.dataset.k === 'music') { previewing = true; setMusic(setting('music') ? 'oh' : musicBefore); } // 크기를 바꾸면 테마곡을 미리 들려줘요
      playSfx('tap'); renderSettings();
    }
    else if (a === 'setOpt') { setOption(b.dataset.k, +b.dataset.v); playSfx('tap'); if (b.dataset.k === 'vibe' && +b.dataset.v) vibrate([12, 40, 12]); renderSettings(); } // 진동을 켜면 한 번 울려 봐요
    else if (a === 'cloudLogin') { playSfx('tap'); cloudLogin(); }
    else if (a === 'cloudLogout') { playSfx('tap'); cloudLogout(); }
    else if (a === 'install') { promptInstall().then(() => renderSettings()); }
    else if (a === 'restart') {
      playSfx('tap');
      askConfirm('정말 처음부터 다시 할까요?<br><small>지금까지의 가게 진행은 지워지고 되돌릴 수 없습니다.</small>', '다시 시작', () => {
        clearSave(); setMusic(null); G.run = null; G.phase = 'title'; renderTitle(); playSfx('page');
      });
    }
    else if (a === 'ver') { if (settingsFrom === 'title' && ++verTaps >= 7) { verTaps = 0; playSfx('perfect'); renderDev(); } }
    else if (a === 'devJump') { clearSave(); runCmd('devJump', { id: b.dataset.j }); playSfx('page'); onStart(); }
    else if (a === 'devInc') { runCmd('pause', { on: false }); runCmd('devIncident', { id: b.dataset.i }); }
    else if (a === 'devCash') { runCmd('devCash'); }
    else if (a === 'devMarket') { runCmd('devMarket'); }
    else if (a === 'toTown') { playSfx('page'); hideScreen(); showTown(); }
    else if (a === 'resume') { runCmd('pause', { on: false }); }
    else if (a === 'closeEarly') { runCmd('pause', { on: false }); runCmd('closeEarly'); playSfx('page'); }
    else if (a === 'toTitle') { if (G.run) runCmd('pause', { on: false }); G.run = null; G.phase = 'title'; renderTitle(); }
  });
}
// 확인 창 (되돌릴 수 없는 일 앞에서): 취소가 왼쪽, 창 밖을 눌러도 취소
let askOk = null;
function askConfirm(html, okLabel, onOk) {
  const m = $('askModal');
  m.innerHTML = `<div class="qm-card ask-card" role="alertdialog"><p>${html}</p><div class="ask-btns"><button type="button" class="btn" data-ask="no">취소</button><button type="button" class="btn danger-fill" data-ask="yes">${okLabel}</button></div></div>`;
  m.hidden = false; askOk = onOk;
}
function initAsk() {
  $('askModal').addEventListener('click', e => {
    const b = e.target.closest('[data-ask]');
    if (!b && e.target !== $('askModal')) return;
    const ok = b && b.dataset.ask === 'yes' ? askOk : null;
    $('askModal').hidden = true; $('askModal').innerHTML = ''; askOk = null;
    if (ok) ok(); else playSfx('tap');
  });
}
// 이어하기가 있을 때 새로 시작은 한 번 더 눌러야 해요 (창 띄우지 않고)
function confirmNew(b) {
  if (b.dataset.sure) return true;
  b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 새로 시작합니다';
  return false;
}
