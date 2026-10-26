// 문 철물 · 상인회 창 (마을 · 2장): 가입 전엔 가입 할 일 하나, 가입 뒤엔 설비 5줄 + (♥♥♥♥) 장사 도구 등급 업
//  규칙은 sim/guild.js (runCmd 'equipUp' · 'toolUp' · 가입비는 'questPay'), 수치는 data/guild.js
import { G } from '../save/state.js';
import { won, wonShort } from '../engine/util.js';
import { EQUIP, EQUIP_IDS, TOOL_UP, TOOL_UP_IDS, GUILD_JOIN_FEE, GUILD_DUES } from '../data/guild.js';
import { TOOLS } from '../data/tools.js';
import { QUESTS } from '../data/story.js';
import { guildMember, eqLv, eqPrice, toolUp, toolUpPrice, moonDisc } from '../sim/guild.js';
import { bondLv } from '../sim/bond.js';
import { questActive, questProg } from '../sim/story.js';
import { icon } from './icons.js';
import { heartsHTML } from './furn.js';

const hh = n => '♥'.repeat(n);
function eqRow(id) {
  const E = EQUIP[id], lv = eqLv(id), L = E.lv[lv], max = !L;
  const lock = !max && bondLv('moon') < L.heart, price = max ? 0 : eqPrice(id);
  return `<div class="gd-row${max ? ' max' : ''}">${icon(E.spr, 'gd-ic')}
    <div class="gd-tx"><b>${E.name} <i class="lv">Lv${lv}</i></b><small>${max ? E.lv[2].text : `Lv${lv + 1} · ${L.text}`}</small></div>
    ${max ? '<span class="gd-done">최고</span>' : `<button type="button" class="btn small ${lock ? '' : 'primary'}" data-ts="eqUp" data-id="${id}" ${lock || price > G.cash ? 'disabled' : ''}>${lock ? `${hh(L.heart)} 필요` : wonShort(price)}</button>`}</div>`;
}
function toolRow(id) {
  const T = TOOL_UP[id], own = (G.story.tools || []).includes(id), up = toolUp(id), lock = bondLv('moon') < T.heart, price = toolUpPrice(id);
  if (!own) return '';
  return `<div class="gd-row${up ? ' max' : ''}"><div class="gd-tx"><b>${TOOLS[id].name} → ${T.name}</b><small>${T.text}</small></div>
    ${up ? '<span class="gd-done">바꿈</span>' : `<button type="button" class="btn small ${lock ? '' : 'primary'}" data-ts="toolUp" data-id="${id}" ${lock || price > G.cash ? 'disabled' : ''}>${lock ? `${hh(T.heart)} 필요` : wonShort(price)}</button>`}</div>`;
}

export function guildHTML() {
  const head = `<div class="ts-head"><b>문 철물 · 상인회</b>${heartsHTML('moon')}<button type="button" class="ts-x" data-ts="close" aria-label="닫기">✕</button></div>`;
  if (!guildMember()) {
    let body;
    if (questActive('c2_moon')) { const [n, need] = questProg('c2_moon'); body = `<p class="ts-note">문 회장님 부탁: ${QUESTS.c2_moon.goal} <b>${n}/${need}</b></p><p class="ts-note">부탁을 들어 드리면 상인회에 들어갈 수 있습니다</p>`; }
    else if (questActive('c2_join')) body = `<p class="ts-note">가입하면 설비를 손볼 수 있습니다 · 회비 주 ${wonShort(GUILD_DUES)}</p><button type="button" class="btn primary big" data-ts="join" ${G.cash < GUILD_JOIN_FEE ? 'disabled' : ''}>상인회 가입 · ${won(GUILD_JOIN_FEE)}</button>`;
    else body = '<p class="ts-note">공구와 철물을 팝니다. 안쪽은 골목 상인회 사무실입니다</p>';
    return head + body;
  }
  const disc = moonDisc();
  const tools = TOOL_UP_IDS.map(toolRow).join('');
  return `${head}<p class="gd-sub">설비 손보기 <small>맛은 그대로, 손이 덜 갑니다${disc ? ` · ♥ ${Math.round(disc * 100)}% 할인` : ''}</small></p>
    <div class="gd-list">${EQUIP_IDS.map(eqRow).join('')}</div>
    ${tools ? `<p class="gd-sub">장사 도구 등급 업 <small>${hh(4)}</small></p><div class="gd-list">${tools}</div>` : ''}
    <p class="gd-foot">잔고 ${wonShort(G.cash)} · 상인회 회비 주 ${wonShort(GUILD_DUES)}</p>`;
}
