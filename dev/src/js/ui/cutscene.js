// 연출 진행: data/cutscenes.js의 차례(steps)를 하나씩 돌려요. 대화 줄은 #talk 창에, 그림은 render/cut.js가 #cutCv에.
// 화면만의 일이라 게임 규칙(G)은 바꾸지 않아요. 끝나면 done()을 불러요 (이야기 장면이 이어서 진행해요).
import { $ } from '../engine/util.js';
import { CUTS } from '../data/cutscenes.js';
import { CAST } from '../data/story.js';
import { initCut, fitCut, drawCut } from '../render/cut.js';
import { lineHTML, typeIn, stopTyping } from './story.js';
import { playSfx } from './sfx.js';
import { setMusic } from './music.js';

const WALK_PX = 34; // 걷는 빠르기 (연출 픽셀/초)
let C = null;

export const cutActive = () => !!C;
export const cutWaiting = () => !!(C && C.wait);

export function initCutscene() {
  initCut($('cutCv'));
  $('cutSkip').addEventListener('click', e => { e.stopPropagation(); skipCut(); });
  addEventListener('resize', layoutCut);
}
// 아래 대화 창 자리를 남기고 크게
function layoutCut() { if (C) fitCut($('app').clientWidth, $('app').clientHeight - 190); }

export function playCut(id, done) {
  const def = CUTS[id];
  C = {
    def, i: -1, t: 0, step: null, wait: false, time: 0, done,
    cam: { ...def.cam }, actors: JSON.parse(JSON.stringify(def.actors)), props: def.props.map(p => ({ ...p })),
    door: false, fade: 1, emotes: {}, night: !!def.night,
  };
  $('cut').hidden = false;
  if (def.music) setMusic(def.music);
  layoutCut();
  next();
}

function caption(text, cls) {
  const el = $('cutCap');
  el.className = cls || '';
  el.innerHTML = text || '';
  el.hidden = !text;
}

function next() {
  C.i++; C.t = 0;
  const s = C.def.steps[C.i];
  C.step = s;
  if (!s) { end(); return; }
  const A = id => C.actors[id];
  if (s.caption !== undefined) caption(s.caption, 'cap');
  if (s.title !== undefined) caption(s.title ? `<small>${s.title[0]}</small><b>${s.title[1]}</b>` : '', 'cap title');
  if (s.door !== undefined) { C.door = s.door; playSfx('tap'); }
  if (s.night !== undefined) C.night = s.night;
  if (s.cam) C.cam = { x: s.cam[0], y: s.cam[1] };
  if (s.unprop) C.props = C.props.filter(p => p.spr !== s.unprop);
  if (s.show) A(s.show).hidden = false;
  if (s.hide) { A(s.hide).hidden = true; delete C.emotes[s.hide]; }
  if (s.stand) { const a = A(s.stand); a.pose = 'idle'; if (a.stool) { C.props.push({ spr: 'stool', x: a.x - 6, y: a.y - 1 }); a.stool = false; } a.y += 2; }
  if (s.carry) A(s.carry[0]).carry = s.carry[1];
  if (s.drop) { const a = A(s.drop); C.props.push({ spr: a.carry, x: a.x - 5, y: a.y + 1 }); a.carry = null; playSfx('trash'); }
  if (s.face) A(s.face[0]).dir = s.face[1];
  if (s.emote) { C.emotes[s.emote[0]] = { kind: s.emote[1], t: 0 }; if (s.emote[1] === '!') playSfx('surprise'); }
  if (s.pan) C.from = { ...C.cam };
  if (s.fade !== undefined) C.fadeFrom = C.fade;
  if (s.walk) { const a = A(s.walk[0]); a.to = [s.walk[1], s.walk[2]]; }
  if (s.say) {
    C.wait = true;
    const box = $('talk');
    box.className = 'talk in-cut' + (s.say[0] ? (CAST[s.say[0]].think ? ' think' : '') : ' narr');
    box.innerHTML = lineHTML(s.say[0], s.say[1]);
    box.hidden = false;
    typeIn(box);
    return;
  }
  if (!s.sec && !s.walk) next(); // 바로 끝나는 차례
}

// 대화 창을 누르면 (ui/story.js가 불러요)
export function cutTap() {
  if (!cutWaiting()) return;
  C.wait = false;
  stopTyping();
  $('talk').hidden = true; $('talk').innerHTML = '';
  playSfx('tap');
  next();
}

const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// 매 프레임 (main.js)
export function updateCut(dt) {
  if (!C) return;
  C.time += dt;
  for (const id in C.emotes) { const e = C.emotes[id]; e.t += dt; if (e.t > 1.6) delete C.emotes[id]; }
  const s = C.step;
  if (s && !C.wait) {
    C.t += dt;
    const k = s.sec ? Math.min(1, C.t / s.sec) : 1;
    if (s.pan) { const e = ease(k); C.cam.x = C.from.x + (s.pan[0] - C.from.x) * e; C.cam.y = C.from.y + (s.pan[1] - C.from.y) * e; }
    if (s.fade !== undefined) C.fade = C.fadeFrom + (s.fade - C.fadeFrom) * k;
    let walking = false;
    const a = s.walk && C.actors[s.walk[0]];
    if (a && a.to) {
      const [tx, ty] = a.to, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), st = WALK_PX * dt;
      if (d <= st) { a.x = tx; a.y = ty; a.moving = false; a.to = null; }
      else { a.x += dx / d * st; a.y += dy / d * st; a.moving = true; a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 3 : 1); walking = true; }
    }
    if (!walking && k >= 1) next(); // 걷기와 카메라가 같이 있으면 둘 다 끝나야
  }
  if (C) drawCut(C);
}

function end() {
  const done = C.done;
  C = null;
  caption('');
  $('cut').hidden = true;
  setMusic(null);
  done();
}
export function skipCut() {
  if (!C) return;
  stopTyping();
  $('talk').hidden = true; $('talk').innerHTML = '';
  end();
}
