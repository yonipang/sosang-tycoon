// 시작점: 화면을 잇고, 매 프레임 규칙을 돌리고 그려요.
import { G } from './save/state.js';
import { $ } from './engine/util.js';
import { runCmd } from './sim/events.js';
import { stepSim, runFor } from './sim/loop.js';
import { setPhase } from './sim/day.js';
import { targetAt } from './sim/player.js';
import { initView, fitView, drawFrame, drawIdle, viewReady } from './render/view.js';
import { loadIcons } from './ui/icons.js';
import { updateHud, initRush, renderRush, initDawn } from './ui/hud.js';
import { initScreens, renderTitle, refreshCloudUI } from './ui/screens.js';
import { cloudInit, onCloud, cloudFlush, cloudCheck, CLOUD } from './save/cloud.js';
import { toast } from './ui/feedback.js';
import { initFeedback, watchHints, updateSpeech } from './ui/feedback.js';
import { initInput } from './ui/input.js';
import { initStory, updateQuestTrack } from './ui/story.js';
import { initIncidentUI } from './ui/incident.js';
import { initCutscene, updateCut } from './ui/cutscene.js';
import { initMusic, updateMusic, musicState } from './ui/music.js';

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
  updateCut(dt);
  updateMusic(dt);
  if (G.phase === 'day') updateQuestTrack(); // 돌발 이벤트 진행도 (바뀐 것만 다시 그려요)
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
  initStory();
  initIncidentUI();
  initCutscene();
  initMusic();
  initRush();
  initDawn();
  initScreens(() => setPhase('prep'));
  layout();
  addEventListener('resize', layout);
  renderTitle();
  requestAnimationFrame(frame);
  // 클라우드 저장: 상태가 바뀌면 처음 화면·설정을 다시 그리고, 알릴 말은 알림으로
  onCloud((msg, kind) => { refreshCloudUI(); if (msg) toast(msg, kind); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cloudFlush(); else cloudCheck(); }); // 앱을 내리면 기다리던 업로드를 바로, 돌아오면 다른 기기에서 더 했는지 확인
  cloudInit();
  // 시험용 손잡이 (dev/qa 스크립트가 써요)
  window.__T = { G, runCmd, runFor, targetAt, viewReady, musicState, CLOUD };
}
boot();
