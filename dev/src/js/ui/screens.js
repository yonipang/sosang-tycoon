// 영업 밖 화면: 처음 화면 · 새벽 준비 · 마감 영수증 · 주간 정산
import { G, newGame } from '../save/state.js';
import { MENUS, MENU_IDS, MENU_UNLOCK, menuOpen } from '../data/menu.js';
import { WEEK_RENT, LOAN_WEEKLY } from '../data/economy.js';
import { $, won, wonShort, clockText, josa } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { prepCost, invCount } from '../sim/day.js';
import { hasSave, loadGame, clearSave } from '../save/storage.js';
import { icon } from './icons.js';
import { dayLabel } from './hud.js';
import { playSfx, unlockAudio } from './sfx.js';

const scr = () => $('screen');
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

export function showScreen(html, cls) {
  const s = scr();
  s.className = cls || '';
  s.innerHTML = html;
  s.hidden = false;
  s.scrollTop = 0;
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
      <div class="namebox">
        <label for="shopName">가게 이름</label>
        <input id="shopName" maxlength="8" value="골목분식" autocomplete="off">
      </div>
      <button class="btn ${save ? '' : 'primary'}" data-act="new">${save ? '새로 시작' : '가게 열기'}</button>
      <p class="howto">칸을 눌러 움직입니다. 조리대에서 요리하고, 손님 자리에 내주고, 계산대 뒤에 서면 계산합니다.</p>
      <p class="proto">프로토타입 · 1단계 「분식집의 하루」</p>
      <footer class="credits">그림 <a href="https://limezu.itch.io/" target="_blank" rel="noopener">LimeZu</a> Modern Interiors · Exteriors<br>글꼴 Neo둥근모 Pro (SIL OFL 1.1)</footer>
    </div>`, 'scr-title');
}

// ── 준비: 가격 · 재료 주문 (주문한 재료는 아침에 도착) ──
// 가격 장부: 지금 가격에 손님들이 지었던 얼굴 (문라이터식). 가격을 바꾸면 그 가격의 기록이 보여요
const FACE_ORDER = ['love', 'happy', 'meh', 'angry'];
function ledgerLine(m) {
  const e = (G.ledger[m] || {})[G.prices[m]];
  const faces = e ? FACE_ORDER.filter(f => e[f]).map(f => `<span class="lf">${icon('face_' + f, 'face')}${e[f]}</span>`).join('') : '';
  return `<div class="ledger"><small>장부</small>${faces || '<small>이 가격은 기록 없음</small>'}</div>`;
}

export function renderPrep() {
  const last = G.history[G.history.length - 1];
  const cost = prepCost();
  const after = G.cash - cost;
  const step = (act, m, label, value) => `<div class="step"><button data-act="${act}" data-m="${m}" data-d="-1" aria-label="${label} 줄이기">−</button><b>${value}</b><button data-act="${act}" data-m="${m}" data-d="1" aria-label="${label} 늘리기">+</button></div>`;
  const cards = MENU_IDS.map(m => {
    if (!menuOpen(m, G.day)) return ''; // 아직 안 여는 메뉴는 보여 주지 않아요 (열리는 날 「새 메뉴」로 등장)
    const M = MENUS[m];
    const isNew = G.day > 1 && G.day === MENU_UNLOCK[m];
    const had = last ? (last.stockStart ? last.stockStart[m] : last.prep[m]) : 0;
    const soldOut = last && had && last.sold[m] >= had;
    const inv = invCount(m), soon = (G.inv[m] || []).filter(b => b.exp <= G.day).reduce((s, b) => s + b.n, 0);
    // 꼭 볼 것만 칩으로: 새 메뉴 · 어제 품절 · 남은 재료(오늘까지 써야 하는 게 있으면 빨갛게)
    const chips = (isNew ? '<span class="tag new">새 메뉴</span>' : '')
      + (soldOut ? '<span class="tag hot">어제 품절</span>' : '')
      + (inv ? `<span class="tag ${soon ? 'warn' : ''}">재고 ${inv}${soon ? ` · 오늘까지 ${soon}` : ''}</span>` : '');
    return `<div class="mcard">
      <div class="mhead">${icon(m, 'dish')}<b>${M.name}</b><span class="tags">${chips}</span></div>
      <div class="row"><span>가격</span>${step('price', m, `${M.name} 가격`, won(G.prices[m]))}</div>
      ${ledgerLine(m)}
      <div class="row"><span>주문</span>${step('prep', m, `${M.ing} 주문`, `${G.prep[m]}인분`)}</div>
      <details class="more"><summary>자세히</summary>
        <p>원가 ${won(M.cost)} · 한 그릇 남는 돈 ${won(G.prices[m] - M.cost)}<br>${josa(M.ing, '은/는')} ${M.shelf > 1 ? `${M.shelf}일 동안` : '받은 날만'} 쓸 수 있습니다<br>오늘 쓸 수 있는 양 ${inv + G.prep[m]}인분${last ? ` · 어제 ${last.sold[m]}인분 판매` : ''}</p>
      </details>
    </div>`;
  }).join('');
  showScreen(`
    <div class="prep">
      <div class="phase-tag night">${G.day === 1 ? '개업 전날 밤' : '전날 밤 22:00'}</div>
      <h2>${dayLabel(G.day)} 준비</h2>
      <p class="yday">${last ? `어제 매출 <b>${wonShort(last.revenue)}</b> · 손님 ${last.served}명` : '주문한 재료는 아침에 도착합니다'}</p>
      ${cards}
      <div class="sum">
        <div><span>주문</span><b>−${won(cost)}</b></div>
        <div><span>잔고</span><b class="${after < 0 ? 'neg' : ''}">${won(after)}</b></div>
        ${G.day % 7 === 0 ? `<div class="due"><span>오늘 밤 주간 정산</span><b>−${wonShort(WEEK_RENT + Math.min(LOAN_WEEKLY, G.loan))}</b></div>` : ''}
      </div>
      <button class="btn primary big" data-act="open">가게 열기 · 09:00</button>
      <button class="btn ghost small" data-act="toTitle">처음 화면</button>
    </div>`, 'scr-prep');
}

// ── 마감 영수증 ──
// 내일로 넘어가는 재료 (남은 것만)
function leftLine(R) {
  const left = MENU_IDS.filter(m => R.leftover && R.leftover[m]).map(m => `${MENUS[m].name} ${R.leftover[m]}`).join(' · ');
  return left ? `<div class="ln note"><span>내일 쓸 재료</span><b>${left}인분</b></div>` : '';
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
    best ? `<div class="hl">${icon(best, 'hl-ic')}<small>오늘의 인기 메뉴</small><b>${MENUS[best].name} ${R.sales[best].n}그릇</b></div>` : `<div class="hl"><small>오늘의 인기 메뉴</small><b>아직 없음</b></div>`,
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
        <div class="rc-foot">잔고 ${won(G.cash)}</div>
      </div>
      </details>
      <button class="btn primary big" data-act="afterReceipt">${G.day % 7 === 0 ? '주간 정산 보기' : '다음 날 준비'}</button>
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
export function renderWeekly() {
  const W = G.lastWeekly;
  showScreen(`
    <div class="weekly">
      <div class="phase-tag night">일요일 밤</div>
      <h2>${W.week}주차 정산</h2>
      <div class="paper">
        <div class="ln"><span>이번 주 매출</span><b>${won(W.sales)}</b></div>
        <div class="ln minus"><span>가게 임대료</span><b>−${won(W.rent)}</b></div>
        <div class="ln minus"><span>창업 대출 상환</span><b>−${won(W.loanPay)}</b></div>
        <div class="dash"></div>
        <div class="ln total"><span>잔고</span><b class="${G.cash < 0 ? 'neg' : ''}">${won(G.cash)}</b></div>
        <div class="ln note"><span>남은 대출</span><b>${won(W.loanLeft)}</b></div>
      </div>
      ${G.cash < 0 ? `<p class="warn">잔고가 모자랍니다. 다음 주에는 가격이나 주문량을 다시 살펴보세요. (프로토타입에서는 그대로 이어집니다)</p>` : ''}
      <button class="btn primary big" data-act="afterWeekly">다음 주 시작</button>
    </div>`, 'scr-weekly');
}

export function renderPause() {
  showScreen(`
    <div class="pause">
      <h2>잠깐 쉬는 중</h2>
      <button class="btn primary big" data-act="resume">계속하기</button>
      ${G.run && !G.run.closing ? `<button class="btn" data-act="closeEarly">오늘 영업 일찍 마감하기</button><p class="pause-note">새 손님은 받지 않고, 안에 있는 손님만 마저 받습니다</p>` : ''}
      <button class="btn ghost" data-act="toTitle">처음 화면 (오늘 영업은 저장되지 않습니다)</button>
    </div>`, 'scr-pause');
}

// 화면 버튼 → 명령
export function initScreens(onStart) {
  scr().addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    unlockAudio();
    const a = b.dataset.act, m = b.dataset.m, d = +b.dataset.d;
    if (a === 'new') { if (hasSave() && !confirmNew(b)) return; clearSave(); newGame(($('shopName').value || '').trim().slice(0, 8)); playSfx('page'); onStart(); }
    else if (a === 'continue') { if (loadGame()) { playSfx('page'); onStart(); } }
    else if (a === 'price') { runCmd('setPrice', { menu: m, delta: d }); playSfx('tap'); }
    else if (a === 'prep') { runCmd('setPrep', { menu: m, delta: d }); playSfx('tap'); }
    else if (a === 'open') runCmd('openShop');
    else if (a === 'afterReceipt') { playSfx('page'); runCmd('afterReceipt'); }
    else if (a === 'afterWeekly') { playSfx('page'); runCmd('afterWeekly'); }
    else if (a === 'resume') { runCmd('pause', { on: false }); }
    else if (a === 'closeEarly') { runCmd('pause', { on: false }); runCmd('closeEarly'); playSfx('page'); }
    else if (a === 'toTitle') { if (G.run) runCmd('pause', { on: false }); G.run = null; G.phase = 'title'; renderTitle(); }
  });
}
// 이어하기가 있을 때 새로 시작은 한 번 더 눌러야 해요 (창 띄우지 않고)
function confirmNew(b) {
  if (b.dataset.sure) return true;
  b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 새로 시작합니다';
  return false;
}
