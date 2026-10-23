// 영업 밖 화면: 처음 화면 · 새벽 준비 · 마감 영수증 · 주간 정산
import { G, newGame } from '../save/state.js';
import { MENUS, MENU_IDS, MENU_UNLOCK, menuOpen } from '../data/menu.js';
import { WEEK_RENT, LOAN_WEEKLY, openingMul } from '../data/economy.js';
import { $, won, wonShort, clockText } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { prepCost } from '../sim/day.js';
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

// ── 새벽 준비 ──
export function renderPrep() {
  const last = G.history[G.history.length - 1];
  const cost = prepCost();
  const after = G.cash - cost;
  const daysToWeekly = (7 - (G.day % 7)) % 7;
  const cards = MENU_IDS.map(m => {
    const M = MENUS[m], sold = last ? last.sold[m] : null;
    if (!menuOpen(m, G.day)) return ''; // 아직 안 여는 메뉴는 보여 주지 않아요 (열리는 날 「새 메뉴」로 등장)
    const isNew = G.day > 1 && G.day === MENU_UNLOCK[m];
    const prepY = last && last.prep ? last.prep[m] : null;
    let note = '';
    if (sold !== null && prepY !== null) note = sold >= prepY ? `<em class="out">어제 ${sold}인분 · 다 팔림</em>` : `<em>어제 ${sold}인분 판매 · ${prepY - sold}인분 남음</em>`;
    const margin = G.prices[m] - M.cost;
    return `<div class="mcard">
      <div class="mhead">${icon(m, 'dish')}<div><b>${M.name}${isNew ? ' <span class="new">새 메뉴</span>' : ''}</b><small>원가 ${won(M.cost)} · 한 그릇 남는 돈 ${won(margin)}</small>${note}</div></div>
      <div class="row"><span>가격</span><div class="step"><button data-act="price" data-m="${m}" data-d="-1" aria-label="${M.name} 가격 내리기">−</button><b>${won(G.prices[m])}</b><button data-act="price" data-m="${m}" data-d="1" aria-label="${M.name} 가격 올리기">+</button></div></div>
      <div class="row"><span>준비량</span><div class="step"><button data-act="prep" data-m="${m}" data-d="-1" aria-label="${M.name} 준비량 줄이기">−</button><b>${G.prep[m]}인분</b><button data-act="prep" data-m="${m}" data-d="1" aria-label="${M.name} 준비량 늘리기">+</button></div></div>
    </div>`;
  }).join('');
  showScreen(`
    <div class="prep">
      <div class="phase-tag night">새벽 05:00</div>
      <h2>${dayLabel(G.day)} 준비</h2>
      ${last ? `<p class="yday">어제 매출 <b>${wonShort(last.revenue)}</b> · 손님 ${last.served}명 · 놓친 손님 ${last.missed}명</p>` : `<p class="yday">첫 영업입니다. 가격과 준비량을 정하고 가게를 열어 보세요.</p>`}
      ${openingMul(G.day) < 1 ? `<p class="yday">개업 ${G.day}일째 · 아직 가게를 아는 사람이 많지 않습니다</p>` : ''}
      ${cards}
      <div class="sum">
        <div><span>재료비</span><b>−${won(cost)}</b></div>
        <div><span>잔고</span><b>${won(G.cash)} → <span class="${after < 0 ? 'neg' : ''}">${won(after)}</span></b></div>
        ${daysToWeekly === 0 ? `<div class="due"><span>오늘 밤 주간 정산</span><b>임대료 ${wonShort(WEEK_RENT)} · 대출 ${wonShort(Math.min(LOAN_WEEKLY, G.loan))}</b></div>` : `<div class="due soft"><span>주간 정산까지</span><b>${daysToWeekly}일</b></div>`}
      </div>
      <button class="btn primary big" data-act="open">가게 열기 · 09:00</button>
      <button class="btn ghost small" data-act="toTitle">처음 화면</button>
    </div>`, 'scr-prep');
}

// ── 마감 영수증 ──
const MISS_NAME = { full: '자리 없음', wait: '오래 기다림', price: '가격', soldout: '품절' };
export function renderReceipt() {
  const R = G.lastReceipt;
  const lines = MENU_IDS.filter(m => R.sales[m].n).map(m => `<div class="ln"><span>${MENUS[m].name} ×${R.sales[m].n}</span><b>${won(R.sales[m].rev)}</b></div>`).join('') || '<div class="ln"><span>판매 없음</span><b>0원</b></div>';
  const miss = Object.entries(R.missed).filter(([, n]) => n).map(([k, n]) => `<span class="chip">${MISS_NAME[k]} ${n}</span>`).join('');
  const delta = R.ratingDelta;
  const rv = R.reviews.map(v => `<div class="rv"><div class="rs">${stars(v.stars)}<small>${v.who}</small></div><p>${v.text}</p></div>`).join('');
  showScreen(`
    <div class="receipt">
      <div class="paper">
        <div class="rc-head"><b>${G.shop}</b><small>${dayLabel(R.day)} 영업 마감 · ${clockText(R.closeMin ?? 720)}${(R.closeMin ?? 720) < 720 ? ' (일찍 마감)' : ''}</small></div>
        <div class="dash"></div>
        ${lines}
        ${R.tips ? `<div class="ln"><span>팁</span><b>${won(R.tips)}</b></div>` : ''}
        <div class="dash"></div>
        <div class="ln"><span>오늘 매출</span><b>${won(R.revenue + R.tips)}</b></div>
        <div class="ln minus"><span>재료비</span><b>−${won(R.ingredientCost)}</b></div>
        <div class="ln total"><span>오늘 남은 돈</span><b class="${R.net < 0 ? 'neg' : ''}">${won(R.net)}</b></div>
        ${R.waste ? `<div class="ln note"><span>못 팔고 버린 재료</span><b>${won(R.waste)}</b></div>` : ''}
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
      <button class="btn primary big" data-act="afterReceipt">${G.day % 7 === 0 ? '주간 정산 보기' : '다음 날 준비'}</button>
    </div>`, 'scr-receipt');
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
      ${G.cash < 0 ? `<p class="warn">잔고가 모자랍니다. 다음 주에는 가격이나 준비량을 다시 살펴보세요. (프로토타입에서는 그대로 이어집니다)</p>` : ''}
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
