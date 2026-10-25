// 입력: 가게 화면 누르기 → 칸 명령 · 스페이스(조리 멈추기) · Esc(쉬기) · 아래 막대 버튼
import { G } from '../save/state.js';
import { $ } from '../engine/util.js';
import { runCmd } from '../sim/events.js';
import { cssToTile } from '../render/view.js';
import { unlockAudio } from './sfx.js';
import { talking } from './story.js';
import { cutActive } from './cutscene.js';
import { openSettingsHere } from './screens.js';

const SPEEDS = [1, 2, 3];

export function initInput() {
  const cv = $('cv');
  cv.addEventListener('pointerdown', e => {
    unlockAudio();
    if (G.phase !== 'day' || !G.run || G.run.paused) return;
    const rc = cv.getBoundingClientRect();
    const t = cssToTile(e.clientX - rc.left, e.clientY - rc.top);
    runCmd(G.run.cook ? 'cookTap' : 'tap', t);
    e.preventDefault();
  });
  // 조리 중에는 화면 어디를 눌러도 멈춰요
  $('cookUI').addEventListener('pointerdown', e => { runCmd('cookTap'); e.preventDefault(); });
  $('bSet').addEventListener('click', () => { unlockAudio(); if (!talking() && !cutActive()) openSettingsHere(); });
  $('bPause').addEventListener('click', () => { if (G.run && !talking()) runCmd('pause', { on: !G.run.paused }); });
  $('bSpeed').addEventListener('click', () => {
    if (!G.run) return;
    runCmd('speed', { x: SPEEDS[(SPEEDS.indexOf(G.run.speed) + 1) % SPEEDS.length] });
  });
  addEventListener('keydown', e => {
    if (G.phase !== 'day' || !G.run || talking()) return;
    if (e.code === 'Space') { if (G.run.cook && !e.repeat) runCmd('cookTap'); e.preventDefault(); }
    else if (e.code === 'Escape') runCmd('pause', { on: !G.run.paused });
  });
  // 다른 창으로 가면 저절로 쉬어요
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.phase === 'day' && G.run && !G.run.paused && !talking()) runCmd('pause', { on: true });
  });
}
