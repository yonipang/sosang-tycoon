// 영업 밖 화면: 처음 화면 · 새벽 준비 · 마감 영수증 · 고정비 내는 날(고지서)
import { G, newGame } from '../save/state.js';
import { MENUS, MENU_IDS, INGREDIENTS, MENU_SLOTS } from '../data/menu.js';
import { CREDITS, CREDITS_THANKS } from '../data/credits.js';
import { GAME_VERSION } from '../data/version.js';
import { $, won, wonShort, clockText, josa } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { prepCost, day1Fixed } from '../sim/day.js';
import { CUSTOMER_TYPES, BOARD_SLOTS } from '../data/customers.js';
import { boardOpen } from '../sim/traffic.js';
import { upgradeOpen, menuLv, lvBasePrice, anyUpReady, devOpen } from '../sim/upgrade.js';
import { recipeOf, invOf, invToday, invServings, slotsOpen, menuOn, todayMenus, nextSlot } from '../sim/pantry.js';
import { hasSave, loadGame, clearSave, backupLocal, localBackupText, swapLocalBackup, saveSummary } from '../save/storage.js';
import { CLOUD, cloudLogin, cloudLogout, setCloudApplier, summaryLine, cloudBackup, cloudRestore, cloudChoose, cloudSaved } from '../save/cloud.js';
import { cutActive } from './cutscene.js';
import { townMode } from '../sim/town.js';
import { showTown, hideTown } from './town.js';
import { toast } from './feedback.js';
import { icon } from './icons.js';
import { dayLabel } from './hud.js';
import { playSfx, unlockAudio } from './sfx.js';
import { setMusic, musicWant } from './music.js';
import { LEVELS, setting, stepSetting, setOption, canVibrate, vibeKind, vibrate, installState, promptInstall, WEBAPP_URL } from './settings.js';
import { menuOpen } from '../sim/story.js';
import { costOf, costRatio, marketOn } from '../sim/market.js';
import { questCard, doneCard, incidentCard, talking, openQuests } from './story.js';
import { QUESTS, CHAPTERS } from '../data/story.js';
import { TOOLS, TOOL_IDS } from '../data/tools.js';
import { INCIDENTS } from '../data/incidents.js';
import { DEV_JUMPS } from '../sim/dev.js';
import { statsChanged } from './analytics.js';
import { FOOT_REPORT } from '../data/district.js';

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
  return `<div class="ledger"><span class="cr ${crClass(cr)}">원가율 ${Math.round(cr * 100)}%${mk ? `<i class="${mk.mul > 1 ? 'up' : 'down'}">${mk.mul > 1 ? '▲' : '▼'}시세</i>` : ''}</span><span class="lg"><small>장부</small>${faces || '<small>이 가격은 기록 없음</small>'}</span></div>${priceFeel(e)}`;
}
// 가격 장부 한 줄 풀이 (v0.76 사용자 요청: 적당한 가격 숫자는 보여 주지 않고, 이 가격에서 본 손님 얼굴로 짐작하게)
function priceFeel(e) {
  const n = e ? FACE_ORDER.reduce((a, f) => a + (e[f] || 0), 0) : 0;
  if (n < 3) return '';
  const k = f => (e[f] || 0) / n;
  const [cls, txt] = k('angry') >= 0.2 ? ['pf-hi', '비싸다는 손님이 많습니다']
    : k('angry') + k('meh') >= 0.35 ? ['pf-mid', '망설이는 손님이 꽤 있습니다']
    : k('love') >= 0.5 ? ['pf-lo', '싸다고 반한 손님이 많습니다']
    : ['pf-ok', '대체로 적당하다는 반응입니다'];
  return `<p class="pfeel ${cls}">${txt}</p>`;
}

export function renderPrep() {
  const last = G.history[G.history.length - 1];
  const cost = prepCost();
  const after = G.cash - cost;
  const alba = G.story.ch === 0; // 프롤로그: 아직 알바라 내 돈이 아니에요
  const town = townMode(), dawn = town && G.town.part === 'dawn'; // 마을(1장부터): 가게는 준비 시간 아무 때나 열어요 (v0.59) · dawn은 글자만
  const fx = day1Fixed() ? ' disabled' : ''; // 첫날은 고정 (v0.84)
  const step = (act, m, label, value) => `<div class="step"><button data-act="${act}" data-m="${m}" data-d="-1" aria-label="${label} 줄이기"${fx}>−</button><b>${value}</b><button data-act="${act}" data-m="${m}" data-d="1" aria-label="${label} 늘리기"${fx}>+</button></div>`;
  // 프롤로그 · 4일차(마을 전): 「오늘의 메뉴」 한 칸 — 메뉴마다 한 줄(가격 · 재료 주문), 원가율·장부는 그 아래 작게 (v0.43 화면 정리)
  const rows = todayMenus().map(m => {
    const M = MENUS[m], isNew = G.story.fresh.includes(m);
    const had = last ? (last.stockStart ? last.stockStart[m] : last.prep[m]) : 0;
    const soldOut = last && had && last.sold[m] >= had;
    const inv = invServings(m);
    const chips = (isNew ? '<span class="tag new">새 메뉴</span>' : '') + (soldOut ? '<span class="tag hot">어제 품절</span>' : '') + (inv ? `<span class="tag">재고 ${inv}</span>` : '');
    return `<div class="pm-row">
      <div class="mhead">${icon(m, 'dish')}<b>${M.name}</b><span class="tags">${chips}</span></div>
      <div class="row"${m === 'tteok' ? ' data-guide="price"' : ''}><span>가격</span>${step('price', m, `${M.name} 가격`, won(G.prices[m]))}</div>
      ${ledgerLine(m)}
      ${boardOpen() ? `<div class="row"><span>칠판 추천</span><span class="b-pick">${boardBtns(m)}</span></div>` : ''}
      <div class="row"${m === 'tteok' ? ' data-guide="order"' : ''}><span>재료 주문</span>${step('prep', m, `${M.ing} 주문`, `${G.prep[m]}인분`)}</div>
    </div>`;
  }).join('');
  const cards = `<div class="tmcard pm-card"><div class="q-head"><small>오늘의 메뉴</small><span class="q-sub">${day1Fixed() ? '첫날은 오 사장님이 정해 둔 대로' : '주문한 재료는 아침에 옵니다'}</span></div>${rows}</div>`;
  if (town) { renderLedger(last, after, dawn); return; } // 1장부터: 오늘의 메뉴 칸 하나로 (화면 정리 — 기획서 「화면 정리」)
  showScreen(`
    <div class="prep">
      <div class="phase-tag night">${dawn ? '새벽 · ' : town ? '밤 · 가게 장부 · ' : '전날 밤 22:00 · '}${G.shop}</div>
      <h2>${dayLabel(G.day)} ${dawn ? '가게 열기' : '준비'}</h2>
      ${last ? `<p class="yday">어제 매출 <b>${wonShort(last.revenue)}</b> · 손님 ${last.served}명</p>` : ''}
      ${questCard()}
      ${toolsCard()}
      ${cards}
      <div class="sum">
        <div><span>재료 주문${alba ? ' <small>· 오 사장님 가게 돈</small>' : ''}</span><b>−${won(cost)}</b></div>
        ${alba ? '' : `<div><span>잔고</span><b class="${after < 0 ? 'neg' : ''}">${won(after)}</b></div>`}
      </div>
      ${!town || dawn ? '<button class="btn primary big" data-act="open" data-guide="open">가게 열기 · 09:00</button>' : '<p class="pause-note">가게는 새벽에 엽니다. 집에서 자고 일어나 보세요</p>'}
      ${town ? '<button class="btn" data-act="toTown">골목으로</button>' : ''}
    </div>`, 'scr-prep');
}

// ── 가게 장부 (1장부터, 마을): 한 화면에 결정 하나 — 오늘의 메뉴 칸이 곧 장부 ──
//  칸 = 이름 · 가격 · 재고 그릇 · 칠판 표시 · 경고 점. 칸을 누르면 메뉴 창(가격 · 원가율 · 칠판 추천 · 쉬기), 이유는 창의 「자세히」에
//  할 일은 한 줄(누르면 퀘스트 창, 낼 돈이 있는 퀘스트만 카드로) · 장사 도구는 살 게 있을 때만
let mmOpen = null; // 열린 메뉴 창
let pickOpen = null; // 열린 칸 고르기 창: 그 칸의 메뉴 또는 '' (빈 칸)
function renderLedger(last, after, dawn) {
  const S = G.story;
  const payQ = S.active.some(id => QUESTS[id].kind === 'pay');
  const qline = payQ ? questCard() : (S.active.length ? `<button type="button" class="qline" data-act="quests" data-guide="quest"><small>${CHAPTERS[S.ch].name}</small><b>할 일${S.active.length ? ` ${S.active.length}` : ''}</b><i>▸</i></button>` : '');
  const tools = S.toolsOpen && TOOL_IDS.some(id => !S.tools.includes(id)) ? toolsCard() : '';
  const bills = ''; // 고정비는 v0.77부터 매일 영수증에서 (일요일 밤 예고 없음)
  showScreen(`
    <div class="prep book">
      <div class="phase-tag night">${dawn ? '새벽' : '밤'} · ${G.shop} · ${dayLabel(G.day)}</div>
      <h2>가게 열기</h2>
      <p class="yday">${last ? `어제 매출 <b>${wonShort(last.revenue)}</b> · 손님 ${last.served}명` : ''}</p>
      ${qline}
      ${todayCard()}
      ${tools}
      ${bills}
      <button class="btn primary big" data-act="open" data-guide="open">가게 열기 · 09:00</button>
      <button class="btn" data-act="toTown">돌아가기</button>
      ${mmOpen && menuOpen(mmOpen) ? menuSheet(mmOpen, last) : pickOpen != null ? pickSheet(pickOpen) : ''}
    </div>`, 'scr-prep');
}
// 칸 고르기 창 (오늘의 메뉴 칸을 누르면): 지금 메뉴(가격·추천 / 빼기) + 이 칸에 올릴 수 있는 메뉴 (v0.45 사용자 요청)
// 개발하고 아직 한 번도 안 판 메뉴 (쉬는 메뉴에 있으면 「NEW」 — v0.64 사용자 요청)
const neverSold = m => MENUS[m].base && !G.history.some(h => h.sold && h.sold[m]);
function pickSheet(cur) {
  const on = cur && menuOn(cur) ? cur : '';
  const can = MENU_IDS.filter(m => menuOpen(m) && !menuOn(m));
  const head = on ? `${icon(on, 'dish')}<b>${MENUS[on].name}</b>` : '<b>빈 칸</b>';
  const now = on ? `<div class="pk-now"><span>${won(G.prices[on])} · ${invServings(on)}그릇</span>
      <button type="button" class="btn small" data-act="mmOpen" data-m="${on}">가격 · 추천</button>
      ${todayMenus().length > 1 ? `<button type="button" class="btn small" data-act="slotOff" data-m="${on}">빼기</button>` : ''}</div>` : '';
  const rows = can.map(m => `<button type="button" class="pk-row" data-act="slotSet" data-m="${m}" data-off="${on}">${icon(m, 'dish')}<span><b>${MENUS[m].name}${neverSold(m) ? ' <i class="bk-new">NEW</i>' : ''}</b><small>${won(G.prices[m])} · ${invServings(m) ? `${invServings(m)}그릇` : '재료 없음'}</small></span><i>${on ? '바꾸기' : '올리기'}</i></button>`).join('');
  return `<div class="mm-back" data-act="mmClose"><div class="mm-card" role="dialog" aria-label="오늘의 메뉴 칸">
    <div class="mm-head">${head}<button type="button" class="ts-x" data-act="mmClose" aria-label="닫기">✕</button></div>
    ${now}
    <small class="pk-h">${on ? '이 칸을 다른 메뉴로' : '이 칸에 올릴 메뉴'}</small>
    ${rows || `<p class="pk-none">올릴 수 있는 다른 메뉴가 없습니다${devOpen() ? '. 메뉴 연구 칠판에서 새 메뉴를 개발해 보세요' : ''}</p>`}
  </div></div>`;
}
// 칠판 추천 버튼 (아침 · 점심 · 오후) — 메뉴 창과 프롤로그 준비 화면이 같이 써요
function boardBtns(m, on = true) {
  const B = G.board || {};
  return Object.keys(BOARD_SLOTS).map(k => { const S = BOARD_SLOTS[k]; return `<button type="button" class="b-m${B[k] === m ? ' on' : ''}" data-act="boardSet" data-slot="${k}" data-m="${m}" ${on ? '' : 'disabled'}><b>${S.name}</b><small>${S.from}~${S.to}시</small></button>`; }).join('');
}
// 메뉴 창 (칸을 누르면): 가격 · 원가율 · 칠판 추천 · 오늘 쉬기 — 원가·재료·Lv는 「자세히」
function menuSheet(m, last) {
  const M = MENUS[m], on = menuOn(m), B = G.board || {}, lv = menuLv(m);
  const inv = invServings(m);
  const step = `<div class="step"><button data-act="price" data-m="${m}" data-d="-1" aria-label="${M.name} 가격 줄이기">−</button><b>${won(G.prices[m])}</b><button data-act="price" data-m="${m}" data-d="1" aria-label="${M.name} 가격 늘리기">+</button></div>`;
  const board = boardBtns(m, on);
  const recipe = recipeOf(m).map(i => { const I = INGREDIENTS[i], t = invToday(i); return `${I.name} ${invOf(i)}${t ? ` <em class="today">오늘까지 ${t}</em>` : ''} <small>· ${I.shelf}일</small>`; }).join('<br>');
  return `<div class="mm-back" data-act="mmClose"><div class="mm-card" role="dialog" aria-label="${M.name}">
    <div class="mm-head">${icon(m, 'dish')}<b>${M.name}</b>${lv > 1 ? `<span class="tag lv">Lv${lv}</span>` : ''}<button type="button" class="ts-x" data-act="mmClose" aria-label="닫기">✕</button></div>
    <div class="row"><span>가격</span>${step}</div>
    ${ledgerLine(m)}
    ${boardOpen() ? `<div class="row"><span>칠판 추천</span><span class="b-pick">${board}</span></div>` : ''}
    <div class="row"><span>재고</span><b class="stock-n">${inv}그릇</b></div>
    <details class="more"><summary>자세히</summary>
      <p>원가 ${won(costOf(m))} · 한 그릇 남는 돈 ${won(G.prices[m] - costOf(m))}${lv > 1 ? ` · Lv${lv} 기본 가격 ${won(lvBasePrice(m))}` : ''}${last ? `<br>어제 ${last.sold[m]}그릇 판매` : ''}</p>
      <p class="recipe">${recipe}</p>
    </details>
  </div></div>`;
}

// 오늘의 메뉴 (1장부터, 데이브 더 다이버 초밥 칸처럼): 칸 8개 중 가게 등급만큼 열려 있고 나머지는 자물쇠
// 칸에 올린 메뉴만 오늘 팔아요. 빼면 아래 「쉬는 메뉴」로 · 오늘까지 써야 하는 재료가 있으면 빨갛게
const LOCK_SVG = '<svg class="lock" viewBox="0 0 10 12" width="15" height="18" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="1" width="4" height="1"/><rect x="2" y="2" width="1" height="3"/><rect x="7" y="2" width="1" height="3"/><rect x="1" y="5" width="8" height="6"/><rect x="4" y="7" width="2" height="2" class="kh"/></svg>';
function todayCard() {
  const on = todayMenus(), open = slotsOpen();
  const off = MENU_IDS.filter(m => menuOpen(m) && !menuOn(m));
  const nx = nextSlot(); // 다음에 늘릴 칸 (지금 장에서 되면 값 · 아니면 몇 장부터)
  const todayIngs = m => recipeOf(m).filter(i => invToday(i) > 0).map(i => INGREDIENTS[i].name);
  const slots = Array.from({ length: MENU_SLOTS }, (_, k) => {
    const m = on[k];
    if (m) {
      const t = todayIngs(m), n = invServings(m), B = G.board || {};
      const marks = Object.keys(BOARD_SLOTS).filter(k => B[k] === m).map(k => `<i class="bmark">★${BOARD_SLOTS[k].name}</i>`).join('');
      const warn = t.length || !n; // 오늘까지 써야 하는 재료 · 재료 없음
      return `<button type="button" class="slot on${warn ? ' hurry' : ''}" data-act="slotPick" data-m="${m}">${warn ? '<i class="wdot"></i>' : ''}${icon(m, 'dish')}<b>${MENUS[m].name}</b><small class="price">${won(G.prices[m])}</small><small class="${n ? '' : 'none'}">${n ? `${n}그릇` : '재료 없음'}</small>${marks}</button>`;
    }
    if (k < open) return `<button type="button" class="slot empty" data-act="slotPick" data-m=""><small>빈 칸</small><b class="slot-plus">+</b></button>`;
    if (nx && k === nx.k && nx.ok) return `<button type="button" class="slot buy" data-act="slotBuy" ${nx.price > G.cash ? 'disabled' : ''}><small>칸 늘리기</small><b class="slot-plus">+</b><small>${wonShort(nx.price)}</small></button>`;
    return `<div class="slot locked" aria-label="잠긴 칸">${LOCK_SVG}</div>`; // 자물쇠만 (v0.46 사용자 요청)
  }).join('');
  return `<div class="tmcard" data-guide="today"><div class="q-head"><small>오늘의 메뉴</small><b>${on.length}/${open}칸</b><span class="q-sub">${off.some(neverSold) ? '<i class="bk-new">NEW</i> 새 메뉴가 쉬는 중 · 칸을 눌러 올려 보세요' : `${off.length ? `쉬는 메뉴 ${off.length}가지 · ` : ''}칸을 눌러 바꾸기`}</span></div>
    <div class="slots">${slots}</div>
  </div>`;
}

// 장사 도구 (오 사장님 권유로 1장 중간부터): 사면 계속 써요
function toolsCard() {
  const S = G.story;
  if (!S.toolsOpen) return '';
  const rows = TOOL_IDS.map(id => {
    const t = TOOLS[id], own = S.tools.includes(id);
    return `<div class="trow${own ? ' own' : ''}"><div class="t-txt"><b>${t.name}</b><small>${t.desc}</small></div>${own ? '<span class="t-own">있음</span>' : `<button type="button" class="btn small" data-act="buyTool" data-tool="${id}" ${t.price > G.cash ? 'disabled' : ''}>${won(t.price)}</button>`}</div>`;
  }).join('');
  return `<div class="tcard" data-guide="tools"><div class="q-head"><small>장사 도구</small><b>한 번 사면 계속 씁니다</b></div>${rows}</div>`;
}

// ── 마감 영수증 ──
// 내일로 넘어가는 재료 (남은 것만)
function leftLine(R) {
  const L = R.leftover || {};
  const left = Object.keys(L).filter(i => L[i] && (INGREDIENTS[i] || MENUS[i])).map(i => `${(INGREDIENTS[i] || MENUS[i]).name} ${L[i]}`).join(' · ');
  return left ? `<div class="ln note wrap"><span>내일 쓸 재료</span><b class="left-ings">${left}</b></div>` : '';
}
// 오늘 원가율: 팔린 음식 재료 + 버린 것 + 급구매 웃돈 (메뉴 원가율보다 얼마나 더 들었는지 보여 줘요)
const pct = r => `${Math.round(r * 100)}%`;
function costCard(c) {
  if (!c) return '';
  const P = r => Math.round(r * 100), w = P(c.waste), ru = P(c.rush); // 더해서 맞도록 팔린 몫은 나머지로
  const extra = [w ? `버린 음식·재료 +${w}%` : '', ru ? `급구매 +${ru}%` : ''].filter(Boolean).join(' · ');
  return `<div class="hl wide cost ${crClass(c.total)}"><small>오늘 원가율</small><b>${pct(c.total)}</b><span>팔린 음식 재료 ${P(c.total) - w - ru}%${extra ? ` · ${extra}` : ' · 버린 것 없음!'}</span></div>`;
}
// 파워블로거가 다녀간 날 (sim/traffic.js bloggerEndDay)
function blogCard(good) {
  if (good === null || good === undefined) return '';
  return `<div class="hl wide ${good ? 'good' : 'warn'}"><small>파워블로거</small><b>${good ? '「맛있다」는 글이 올라갑니다' : '「무난하다」는 글이 올라갑니다'}</b><span>사흘 동안 직장인·어르신이 ${good ? '더' : '조금 덜'} 들어옵니다</span></div>`;
}
// 시간대별 손님 (sim/traffic.js logPass): 색 = 손님층별 들어온 사람 · 회색 = 지나간 사람(3장 상권 지도부터 — FOOT_REPORT)
//  v0.63 사용자 결정: 1장(김밥 들어오는 날, 칠판 추천과 함께)부터 「들어온 손님」만 — 「1장 = 내 가게 장부 읽기, 3장 = 골목 읽기」
//  막대를 누르면 그 시간 숫자 (아래 한 줄)
const HOUR_TYPES = ['worker', 'student', 'elder'];
function hourCard(H) {
  if (!H || !Object.keys(H).length) return '';
  const hours = Array.from({ length: 13 }, (_, i) => 9 + i);
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const inN = h => (H[h] ? sum(H[h].in) : 0), passN = h => (H[h] ? sum(H[h].pass) : 0);
  const val = FOOT_REPORT ? passN : inN, max = Math.max(1, ...hours.map(val));
  const say = h => { const I = (H[h] && H[h].in) || {}, who = HOUR_TYPES.filter(t => I[t]).map(t => `${CUSTOMER_TYPES[t].name} ${I[t]}`).join(' · '); return `${h}시 · ${who || '들어온 손님 없음'}${FOOT_REPORT ? ` · 지나간 사람 ${passN(h)}` : ''}`; };
  const cols = hours.map(h => {
    const ins = HOUR_TYPES.map(t => { const n = (H[h] && H[h].in[t]) || 0; return n ? `<i class="t-${t}" style="height:${n / max * 100}%"></i>` : ''; }).join('');
    return `<button type="button" class="hc" data-act="hourPick" data-t="${say(h)}"><div class="hb">${FOOT_REPORT ? `<div class="hp" style="height:${passN(h) / max * 100}%"></div>` : ''}<div class="hi">${ins}</div></div><small>${h}</small></button>`;
  }).join('');
  const peak = hours.reduce((a, h) => (inN(h) > inN(a) ? h : a), 9), I = (H[peak] && H[peak].in) || {};
  const top = HOUR_TYPES.reduce((a, t) => ((I[t] || 0) > (I[a] || 0) ? t : a));
  return `<div class="hl wide hourly"><small>${FOOT_REPORT ? '시간대별 손님 · 회색은 지나간 사람, 색은 들어온 사람' : '시간대별 들어온 손님 · 막대를 눌러 보세요'}</small><div class="hcols">${cols}</div>
    <div class="hlegend">${HOUR_TYPES.map(t => `<span><i class="t-${t}"></i>${CUSTOMER_TYPES[t].name}</span>`).join('')}</div>
    <span class="h-sum">가장 바빴던 때 ${peak}시 · ${inN(peak)}명 입장 (${CUSTOMER_TYPES[top].name}이 가장 많음)</span></div>`;
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
  // 한 장씩 넘겨요 (화면 정리): ① 오늘 남은 돈 → ② 오늘의 일(퀘스트·돌발·블로거 · 없으면 인기 메뉴·놓친 손님) → ③ 시간대 그래프 → ④ 리뷰·숙련 + 영수증 자세히
  const DETAIL = receiptDetail(R, lines, miss, rv, delta);
  const events = [doneCard(R.quests), incidentCard(R.incidents), blogCard(R.blog), R.cost && R.cost.total > 0.4 ? costCard(R.cost) : ''].filter(Boolean);
  const plain = [
    best ? `<div class="hl wide">${icon(best, 'hl-ic')}<small>오늘의 인기 메뉴</small><b>${MENUS[best].name} ${R.sales[best].n}그릇</b></div>` : '',
    R.missedTotal ? `<div class="hl wide warn"><small>놓친 손님</small><b>${R.missedTotal}명 · 주로 ${MISS_NAME[topMiss[0]]}</b></div>` : `<div class="hl wide good"><small>놓친 손님</small><b>없음!</b></div>`,
  ];
  const day2 = (events.length ? events : plain).slice(0, 3).join('');
  const review = R.reviews[0] ? `<div class="hl wide"><small>${stars(R.reviews[0].stars)} ${R.reviews[0].who}</small><b>「${R.reviews[0].text}」</b></div>` : '';
  const pages = [
    `<div class="rc-hero">
        <small>${dayLabel(R.day)} · ${R.fixed ? '오늘 순이익' : '오늘 총이익'}</small>
        <b class="hero-num ${heroV(R) < 0 ? 'neg' : ''}" data-to="${heroV(R)}">0원</b>
        <div class="hero-star">★ ${R.rating == null ? '—' : R.rating.toFixed(1)} ${deltaHtml}${R.ratingN != null ? `<small class="rv-n">리뷰 ${R.ratingN}개${R.newReviews ? ` (+${R.newReviews})` : ''}</small>` : ''}</div>
        ${R.newFaces ? `<p class="hero-new">리뷰가 쌓여 골목에 새 얼굴이 보이기 시작했습니다${R.newFaces > 1 ? ` (${R.newFaces}명)` : ''} · 손님 수첩</p>` : ''}
      </div>${sumCard(R)}`,
    `<small class="rc-ph">오늘의 일</small><div class="hls">${day2}</div>`,
    (FOOT_REPORT || boardOpen()) && R.hourly && Object.keys(R.hourly).length ? `<div class="hls">${hourCard(R.hourly)}</div>` : '', // 김밥 들어오는 날부터 (v0.63)
    `<div class="hls">${review}${masteryCard(R.mastery)}</div>`,
  ].filter(Boolean);
  rcPage = 0;
  const last = pages.length - 1;
  const PAGES = pages.map((h, k) => `<section class="rc-page" data-p="${k}"${k ? ' hidden' : ''}>${h}${k === last ? DETAIL : ''}</section>`).join('');
  const dots = pages.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('');
  showScreen(`
    <div class="receipt paged" data-pages="${pages.length}">
      ${PAGES}
      <div class="rc-dots">${dots}</div>
      <div class="rc-nav"><button class="btn big rc-prev" data-act="rcPrev" hidden>◂ 이전</button>
      <button class="btn primary big rc-next" data-act="rcNext"${last ? '' : ' hidden'}>다음 ▸</button>
      <button class="btn primary big" data-act="afterReceipt" data-final${last ? ' hidden' : ''}>${G.day % 7 === 0 ? '이번 주 정리 보기' : '다음 날 준비'}</button></div>
      ${last ? '<button class="btn ghost small rc-skip" data-act="afterReceipt">건너뛰기</button>' : ''}
    </div>`, 'scr-receipt');
  countUp(document.querySelector('.hero-num'));
}
// 맨 위 큰 숫자: 1장부터는 순이익(고정비까지 뺀 돈), 프롤로그는 총이익
const heroV = R => (R.fixed ? R.profit : R.net);
// 영수증 첫 장 「오늘 한 장 요약」 (v0.77 사용자 요청 — 데이브 더 다이버 정산처럼): 들어온 돈 · 나간 돈 · 가장 많이 남긴 메뉴 · 최근 7일
//  매출 = 손님 수 × 한 명당 (실제 장사의 기본 공식) · 메뉴가 남긴 돈 = 판 돈 − 그릇 수 × 원가
function sumCard(R) {
  const out = R.usedCost + R.expiredCost + R.rushExtra + (R.fixed ? R.fixed.total : 0);
  const row = (k, sign, v) => `<div class="rio-r"><span>${k}</span><i>${sign}</i><b>${won(v)}</b></div>`;
  const io = `<div class="rio">
    <div class="rio-p in"><div class="rio-h">들어온 돈</div>
      ${row('음식', '+', R.revenue)}${row('팁', '+', R.tips)}
      <div class="rio-r tot"><span>합</span><i>+</i><b>${won(R.revenue + R.tips)}</b></div></div>
    <div class="rio-p out"><div class="rio-h">나간 돈</div>
      ${row('재료값', '−', R.usedCost)}${row('버린 재료', '−', R.expiredCost)}${R.rushExtra ? row('급구매', '−', R.rushExtra) : ''}${R.fixed ? row('고정비', '−', R.fixed.total) : ''}
      <div class="rio-r tot"><span>합</span><i>−</i><b>${won(out)}</b></div></div>
  </div>
  <p class="rio-f">손님 <b>${R.served}명</b> × 한 명당 <b>${won(R.avgSpend)}</b> = 매출 <b>${won(R.revenue)}</b></p>`;
  const gain = m => R.sales[m].rev - R.sales[m].n * costOf(m);
  const sold = MENU_IDS.filter(m => R.sales[m].n);
  const top = sold.sort((a, b) => gain(b) - gain(a))[0];
  const best = top ? `<div class="rs-best">${icon(top, 'rs-ic')}<div><small>가장 많이 남긴 메뉴</small><b>${MENUS[top].name}</b>
    <span>${R.sales[top].n}그릇 × ${won(Math.round(gain(top) / R.sales[top].n))} = <em>${won(gain(top))}</em></span></div></div>` : '';
  const pv = h => h.profit ?? h.net;
  const H = G.history.slice(-7), max = Math.max(1, ...H.map(h => Math.abs(pv(h))));
  const bars = H.map((h, k) => `<div class="rw-c${k === H.length - 1 ? ' today' : ''}"><i class="${pv(h) < 0 ? 'neg' : ''}" style="height:${Math.max(3, Math.round(Math.abs(pv(h)) / max * 40))}px"></i><small>${k === H.length - 1 ? '오늘' : h.day}</small></div>`).join('');
  const week = H.length > 1 ? `<div class="rs-week"><small>최근 ${H.length}일 ${R.fixed ? '순이익' : '총이익'}</small><div class="rw">${bars}</div></div>` : '';
  return `<div class="rsum">${io}${best}${week}</div>`;
}
// 영수증 다음 장 (같은 화면에서 숨기고 보여 줘요 — 다시 그리지 않아서 숫자 세기가 다시 돌지 않아요)
let rcPage = 0;
function receiptNext(d = 1) {
  const box = document.querySelector('.receipt.paged');
  if (!box) return;
  const n = +box.dataset.pages;
  rcPage = Math.max(0, Math.min(n - 1, rcPage + d));
  box.querySelector('.rc-prev').hidden = rcPage === 0; // 이전 장으로
  box.querySelectorAll('.rc-page').forEach(p => { p.hidden = +p.dataset.p !== rcPage; });
  box.querySelectorAll('.rc-dots i').forEach((d, k) => d.classList.toggle('on', k === rcPage));
  const end = rcPage === n - 1;
  box.querySelector('.rc-next').hidden = end;
  box.querySelector('[data-final]').hidden = !end;
  const sk = box.querySelector('.rc-skip'); if (sk) sk.hidden = end;
  playSfx('page');
}
function receiptDetail(R, lines, miss, rv, delta) {
  return `
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
        ${R.fixed ? `<div class="ln"><span>오늘 총이익 (매출 − 재료값)</span><b>${won(R.net)}</b></div>
        <div class="ln minus"><span>가게 임대료</span><b>−${won(R.fixed.rent)}</b></div>
        <div class="ln minus"><span>대출 이자·원금 <small>남은 대출 ${wonShort(G.loan)}</small></span><b>−${won(R.fixed.interest + R.fixed.principal)}</b></div>
        <div class="ln minus"><span>공과금 (전기·가스·수도)</span><b>−${won(R.fixed.util)}</b></div>
        ${R.fixed.dues ? `<div class="ln minus"><span>상인회 회비</span><b>−${won(R.fixed.dues)}</b></div>` : ''}
        <div class="ln total"><span>오늘 순이익</span><b class="${R.profit < 0 ? 'neg' : ''}">${won(R.profit)}</b></div>` : `<div class="ln total"><span>오늘 총이익</span><b class="${R.net < 0 ? 'neg' : ''}">${won(R.net)}</b></div>`}
        ${R.dishWaste ? `<div class="ln note"><span>만들고 못 판 음식</span><b>${won(R.dishWaste)}</b></div>` : ''}
        ${leftLine(R)}
        <div class="dash"></div>
        ${FOOT_REPORT && R.foot ? `<div class="ln"><span>가게 앞을 지나간 사람</span><b>${R.foot}명</b></div><div class="ln"><span>그중 들어온 사람</span><b>${R.entered}명 (${Math.round(R.entered / R.foot * 100)}%)</b></div>` : ''}
        <div class="ln"><span>받은 손님</span><b>${R.served}명</b></div>
        <div class="ln"><span>손님 한 명당 매출</span><b>${won(R.avgSpend)}</b></div>
        <div class="ln"><span>놓친 손님</span><b>${R.missedTotal}명</b></div>
        ${miss ? `<div class="chips">${miss}</div>` : ''}
        <div class="dash"></div>
        <div class="ln star"><span>가게 별점${R.ratingN != null ? ` · 리뷰 ${R.ratingN}개` : ''}</span><b>★ ${R.rating == null ? '—' : R.rating.toFixed(1)} ${Math.abs(delta) < 0.05 ? '<small>−</small>' : `<small class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(1)}</small>`}</b></div>
        ${rv ? `<div class="rvs">${rv}</div>` : ''}
        ${G.story.ch === 0 ? '<div class="rc-foot">오늘 번 돈은 오 사장님 가게 돈입니다</div>' : `<div class="rc-foot">잔고 ${won(G.cash)}</div>`}
      </div>
      </details>`;
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
  const W = G.lastWeekly, S = W.sum || { days: 0, revenue: W.sales || 0, net: 0, fixed: 0, profit: 0, served: 0 };
  const ln = (k, v, cls = '') => `<div class="ln ${cls}"><span>${k}</span><b>${v}</b></div>`;
  showScreen(`
    <div class="weekly">
      <div class="phase-tag night">일요일 밤 · ${W.week}주차</div>
      <h2>이번 주 정리</h2>
      <p class="yday">고정비는 매일 냈습니다 · 이번 주 순이익</p>
      <b class="week-big ${S.profit < 0 ? 'neg' : ''}">${won(S.profit)}</b>
      <div class="paper">
        ${ln(`매출 <small>${S.days}일 · 손님 ${S.served}명</small>`, won(S.revenue))}
        ${ln('총이익 (매출 − 재료값)', won(S.net))}
        ${ln('고정비 (임대료·대출·공과금)', `−${won(S.fixed)}`, 'minus')}
        ${ln('순이익', `<span class="${S.profit < 0 ? 'neg' : ''}">${won(S.profit)}</span>`, 'total')}
        ${weekCostLine()}
        ${ln('별점', `★ ${G.rating == null ? '—' : G.rating.toFixed(1)}`)}
        ${ln('지금 잔고', won(G.cash))}
        ${ln('남은 대출', won(G.loan), 'note')}
      </div>
      <button class="btn primary big" data-act="afterWeekly">다음 주 시작</button>
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
// 기기 저장 · 기기 데이터 불러오기 (v0.57 사용자 요청): 설정 맨 아래 작은 글자 버튼 둘. 이 기기에 따로 한 칸(BACKUP_KEY)
//  「처음부터 다시 하기」·클라우드 세이브로 바꾸기 직전 세이브도 이 칸에 들어가요. 불러오면 지금 진행과 자리를 바꿔요
const localBackup = () => { const t = localBackupText(); return t && saveSummary(t) ? t : ''; };
function deviceLinks() {
  if (G.phase !== 'title' && G.phase !== 'prep') return ''; // 영업 중엔 저장하지 않아요
  const save = hasSave() ? '<button type="button" class="set-mini" data-act="devSave">기기 저장</button>' : '';
  const load = localBackup() ? '<button type="button" class="set-mini" data-act="devLoad">기기 데이터 불러오기</button>' : '';
  return save || load ? `<div class="set-minis">${save}${load}</div>` : '';
}
// 마지막으로 올린 때 · 실패 이유 (v0.56 — 안 올라가면 바로 알 수 있게)
const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function upLine() {
  if (CLOUD.conflict) return '<p class="set-note warn">이 기기와 클라우드가 서로 다른 게임입니다. 고를 때까지 올리지 않습니다.</p>';
  return (CLOUD.upAt ? `<p class="set-note">마지막으로 올린 때: 오늘 ${hhmm(CLOUD.upAt)}</p>` : '')
    + (CLOUD.upErr ? `<p class="set-note warn">올리지 못했습니다: ${CLOUD.upErr}</p>` : '');
}
function accountRows() {
  const st = CLOUD.st;
  if (st === 'in') return `<div class="row"><span class="cl-name">${escName()}</span><button type="button" class="btn ghost small" data-act="cloudLogout">로그아웃</button></div>`
    + `<p class="set-note">${CLOUD.doc ? `클라우드 · ${summaryLine(CLOUD.doc.data)} 저장` : '아직 클라우드에 올린 세이브가 없습니다.'}<br>같은 계정으로 로그인하면 어느 기기에서든 이어서 할 수 있습니다.</p>`
    + upLine();
  if (st === 'out' || st === 'na') return '<div class="row"><span>구글 로그인</span><button type="button" class="btn small" data-act="cloudLogin">로그인</button></div>'
    + (st === 'na' && CLOUD.err !== 'load' ? `<p class="set-note">Claude 안에서는 로그인할 수 없습니다. 웹앱 주소에서 로그인해 보세요.<br><a href="${WEBAPP_URL}" target="_blank" rel="noopener">${WEBAPP_URL.replace('https://', '')}</a></p>`
      : '<p class="set-note">로그인하면 새벽 준비 때마다 클라우드에 저장되고, 어느 기기에서든 이어서 할 수 있습니다.</p>');
  return '<p class="set-note">연결하는 중…</p>';
}
// 다시 그리기: 처음 화면이나 설정이 떠 있으면 클라우드 상태가 바뀔 때 새로 그려요
export function refreshCloudUI() {
  showConflict();
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
        <small class="set-h">플레이 기록</small>
        <div class="row"><span>익명으로 보내기</span>${seg('stats', [[1, '켬'], [0, '끔']])}</div>
        <p class="set-note">게임을 고치는 데 쓰는 익명 통계입니다. 이름·이메일은 보내지 않습니다</p>
      </div>
      <div class="set-card">
        <small class="set-h">홈 화면에 추가</small>
        ${installRow()}
      </div>
      <div class="set-card">
        <small class="set-h">계정 · 클라우드 저장</small>
        ${accountRows()}
      </div>
      ${G.phase !== 'title' ? `<button class="btn" data-act="toTitle">처음 화면으로${G.run ? ' <small>(오늘 영업은 저장되지 않습니다)</small>' : ''}</button>` : ''}
      <button class="btn" data-act="credits">크레딧</button>
      <p class="set-ver" data-act="ver">소상공인 키우기 · 프로토타입 v${GAME_VERSION}</p>
      ${deviceLinks()}
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
      ${G.run && !G.run.closing ? `<button class="btn${G.run.soldOutHint ? ' primary' : ''}" data-act="closeEarly">오늘 영업 일찍 마감하기</button><p class="pause-note">새 손님은 받지 않고, 안에 있는 손님만 마저 받습니다</p>` : ''}
      ${devOn && G.run && !G.run.closing ? `<div class="dev-inc"><small>개발자 · 돌발 이벤트 바로</small>${Object.keys(INCIDENTS).map(id => `<button class="btn small" data-act="devInc" data-i="${id}">${INCIDENTS[id].name}</button>`).join('')}<button class="btn small" data-act="devCash">+100만 원</button><button class="btn small" data-act="devMarket">시세 소식 (다음 날)</button></div>` : ''}
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
    else if (a === 'open') { mmOpen = null; pickOpen = null; runCmd('openShop'); }
    else if (a === 'questPay') runCmd('questPay', { id: b.dataset.q });
    else if (a === 'buyTool') runCmd('buyTool', { id: b.dataset.tool });
    else if (a === 'menuToggle') runCmd('menuToggle', { menu: m });
    else if (a === 'boardSet') runCmd('boardSet', { slot: b.dataset.slot, menu: m });
    else if (a === 'mmOpen') { mmOpen = m; pickOpen = null; playSfx('page'); renderPrep(); }
    else if (a === 'slotBuy') runCmd('slotBuy');
    else if (a === 'slotPick') { pickOpen = m || ''; mmOpen = null; playSfx('page'); renderPrep(); }
    else if (a === 'slotSet') { pickOpen = null; const off = b.dataset.off; if (off) runCmd('menuSwap', { off, on: m }); else runCmd('menuToggle', { menu: m }); renderPrep(); }
    else if (a === 'slotOff') { pickOpen = null; runCmd('menuToggle', { menu: m }); renderPrep(); }
    else if (a === 'mmClose') { if (e.target === b || b.classList.contains('ts-x')) { mmOpen = null; pickOpen = null; playSfx('tap'); renderPrep(); } } // 창 밖이나 ✕
    else if (a === 'quests') openQuests();
    else if (a === 'hourPick') { const c = b.closest('.hourly'); c.querySelectorAll('.hc.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); c.querySelector('.h-sum').textContent = b.dataset.t; playSfx('tap'); } // 시간대 막대: 그 시간 숫자
    else if (a === 'rcNext') receiptNext();
    else if (a === 'rcPrev') receiptNext(-1);
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
    else if (a === 'setOpt') { setOption(b.dataset.k, +b.dataset.v); playSfx('tap'); if (b.dataset.k === 'stats') statsChanged(); if (b.dataset.k === 'vibe' && +b.dataset.v) vibrate([12, 40, 12]); renderSettings(); } // 진동을 켜면 한 번 울려 봐요
    else if (a === 'cloudLogin') { playSfx('tap'); cloudLogin(); }
    else if (a === 'cloudLogout') { playSfx('tap'); cloudLogout(); }
    else if (a === 'devSave') { backupLocal(); playSfx('coin'); toast(`이 기기에 따로 저장했습니다 · ${summaryLine(localBackupText())}`, 'good'); renderSettings(); }
    else if (a === 'devLoad') {
      playSfx('tap');
      askConfirm(`기기에 저장한 데이터를 불러올까요?<br><small>${summaryLine(localBackup())}<br>지금 진행은 대신 기기 저장 칸에 들어갑니다.</small>`, '불러오기', () => {
        if (!swapLocalBackup()) { toast('기기 데이터를 불러오지 못했습니다', 'warn'); return; }
        if (G.phase === 'title') renderTitle(); else if (loadGame()) { setMusic(null); onStart(); }
        toast('기기 데이터를 불러왔습니다', 'good'); cloudSaved();
      });
    }
    else if (a === 'install') { promptInstall().then(() => renderSettings()); }
    else if (a === 'restart') {
      playSfx('tap');
      askConfirm('정말 처음부터 다시 할까요?<br><small>지금 가게는 예전 세이브로 남아서, 설정 맨 아래 「예전 세이브 불러오기」에서 다시 불러올 수 있습니다.</small>', '다시 시작', () => {
        backupLocal(); clearSave(); setMusic(null); G.run = null; G.phase = 'title'; renderTitle(); playSfx('page');
      });
    }
    else if (a === 'ver') { if (settingsFrom === 'title' && ++verTaps >= 7) { verTaps = 0; playSfx('perfect'); renderDev(); } }
    else if (a === 'devJump') { backupLocal(); clearSave(); runCmd('devJump', { id: b.dataset.j }); playSfx('page'); onStart(); }
    else if (a === 'devInc') { runCmd('pause', { on: false }); runCmd('devIncident', { id: b.dataset.i }); }
    else if (a === 'devCash') { runCmd('devCash'); }
    else if (a === 'devMarket') { runCmd('devMarket'); }
    else if (a === 'toTown') { mmOpen = null; pickOpen = null; playSfx('page'); hideScreen(); showTown(); }
    else if (a === 'resume') { runCmd('pause', { on: false }); }
    else if (a === 'closeEarly') { runCmd('pause', { on: false }); runCmd('closeEarly'); playSfx('page'); }
    else if (a === 'toTitle') { if (G.run) runCmd('pause', { on: false }); G.run = null; G.phase = 'title'; hideTown(); renderTitle(); } // 설정에서만 (v0.43)
  });
}
// 이 기기와 클라우드가 서로 다른 게임이면 고르기 (v0.56 사용자 요청 — 시간만 보고 덮지 않아요). 처음 화면·준비 화면에서만 띄워요
let conflictOn = false;
export function showConflict() {
  const c = CLOUD.conflict;
  if (!c || conflictOn || !$('askModal').hidden) return;
  if (!(G.phase === 'title' || (G.phase === 'prep' && !talking() && !cutActive()))) return;
  const card = (t, who, k) => { const v = saveSummary(t); return `<button type="button" class="btn pick-save" data-ask="${k}"><small>${who}</small><b>${v.day}일차 · ${v.shop || '이름 없는 가게'}</b><span>${(CHAPTERS[v.ch] || CHAPTERS[0]).name} · ${summaryLine(t).split(' · ').slice(2).join(' · ') || '저장 시각 모름'}</span></button>`; };
  $('askModal').innerHTML = `<div class="qm-card ask-card" role="alertdialog"><p>어느 세이브로 할까요?<br><small>이 기기와 클라우드에 서로 다른 게임이 있습니다. 고르지 않은 쪽은 백업으로 남습니다.</small></p>
    ${card(c.local, '이 기기', 'local')}${card(c.cloud.data, '클라우드', 'cloud')}</div>`;
  $('askModal').hidden = false; conflictOn = true;
  playSfx('page');
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
    if (conflictOn) { // 세이브 고르기는 꼭 하나 골라야 닫혀요
      if (!b) return;
      conflictOn = false; $('askModal').hidden = true; $('askModal').innerHTML = '';
      playSfx('tap'); cloudChoose(b.dataset.ask);
      return;
    }
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
