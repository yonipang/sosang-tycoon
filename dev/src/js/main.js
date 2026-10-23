// 시작점: 화면을 잇고, 매 프레임 규칙을 돌리고 그려요.
import { G } from './save/state.js';
import { $ } from './engine/util.js';
import { runCmd } from './sim/events.js';
import { stepSim, runFor } from './sim/loop.js';
import { setPhase } from './sim/day.js';
import { targetAt } from './sim/player.js';
import { initView, fitView, drawFrame, drawIdle, viewReady } from './render/view.js';
import { loadIcons } from './ui/icons.js';
import { updateHud, initRush, renderRush } from './ui/hud.js';
import { initScreens, renderTitle } from './ui/screens.js';
import { initFeedback, watchHints, updateSpeech } from './ui/feedback.js';
import { initInput } from './ui/input.js';

function layout() {
  const st = $('stage');
  fitView(st.clientWidth, st.clientHeight - 8);
}

let lastT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - (lastT || now)) / 1000);
  lastT = now;
  stepSim(dt);
  if (G.phase === 'day' && G.run) { drawFrame(dt); watchHints(); }
  else drawIdle(dt, G.phase === 'receipt' || G.phase === 'weekly');
  updateSpeech(dt);
  document.body.dataset.phase = G.phase;
  if (G.phase !== 'title') updateHud();
  if (G.run && !document.getElementById('rushUI').hidden && Math.floor(lastT / 500) !== Math.floor((lastT - dt * 1000) / 500)) renderRush(); // 도착까지 남은 초
  requestAnimationFrame(frame);
}

async function boot() {
  initView($('cv'));
  await loadIcons();
  initFeedback();
  initInput();
  initRush();
  initScreens(() => setPhase('prep'));
  layout();
  addEventListener('resize', layout);
  renderTitle();
  requestAnimationFrame(frame);
  // 시험용 손잡이 (dev/qa 스크립트가 써요)
  window.__T = { G, runCmd, runFor, targetAt, viewReady };
}
boot();
