// 배경음악: 장면마다 원하는 곡을 정하면(setMusic) 부드럽게 바꿔 틀어요. 곡은 js/audio/music.js (dev/audio_pack.py가 만들어요)
// 지금 곡: oh = 오 사장님 테마 (오 사장님이 나오는 연출·대화·미션 전화)
// 휴대폰 브라우저는 사람이 화면을 누른 뒤에만 소리를 낼 수 있어서, 첫 터치 때 한 번 「깨워」 둬요.
import { MUSIC } from '../audio/music.js';

const MAX_VOL = 0.38, FADE_SEC = 0.8;
let el = null, cur = null, want = null, vol = 0, primed = false, off = false;
try { off = localStorage.getItem('sosang-music') === 'off'; } catch (e) { /* 저장소를 못 쓰는 환경 */ }

function audio() {
  if (!el) { el = new Audio(); el.loop = true; el.preload = 'auto'; el.volume = 0; }
  return el;
}
// 첫 터치 때 소리 내기를 허락받아 둬요
function prime() {
  if (primed) return;
  primed = true;
  const a = audio();
  if (!a.src) a.src = MUSIC.oh;
  a.muted = true;
  const p = a.play();
  const done = () => { a.muted = false; if (!want || off) a.pause(); };
  if (p && p.then) p.then(done, () => { primed = false; a.muted = false; }); else done();
}
export function initMusic() {
  addEventListener('pointerdown', prime, true);
  addEventListener('keydown', prime, true);
}

// name: 곡 이름 (없으면 null = 조용히)
export function setMusic(name) { want = name && MUSIC[name] ? name : null; }
export const musicOff = () => off;
// 시험용: 지금 틀고 있는 곡
export const musicState = () => ({ cur, want, vol: +vol.toFixed(2), paused: el ? el.paused : true, time: el ? +el.currentTime.toFixed(1) : 0 });
export function toggleMusic() {
  off = !off;
  try { localStorage.setItem('sosang-music', off ? 'off' : 'on'); } catch (e) { /* 그대로 */ }
  return off;
}

// 매 프레임 (main.js): 소리를 줄였다 키우며 곡을 바꿔요
export function updateMusic(dt) {
  const a = el;
  const target = off ? null : want;
  if (!a && !target) return;
  const step = dt * MAX_VOL / FADE_SEC;
  if (cur !== target) {
    if (cur && vol > 0.001) { vol = Math.max(0, vol - step); a.volume = vol; return; } // 먼저 줄이고
    if (a && cur) a.pause();
    cur = target;
    if (!cur) return;
    const b = audio();
    if (b.src !== MUSIC[cur]) { b.src = MUSIC[cur]; b.currentTime = 0; }
    vol = 0; b.volume = 0;
    const p = b.play(); if (p && p.catch) p.catch(() => {});
    return;
  }
  if (cur && vol < MAX_VOL) { vol = Math.min(MAX_VOL, vol + step); a.volume = vol; } // 다음에 키워요
}
