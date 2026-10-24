// 효과음: 파일 없이 짧은 소리를 만들어요. 첫 터치 뒤에만 소리가 나요(브라우저 규칙).
let ac = null, muted = false;
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
}
export function setMuted(m) { muted = m; }
export const isMuted = () => muted;

function tone(freq, dur, type, vol, slide, delay) {
  if (!ac || muted) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(vol || 0.06, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  coin: () => { tone(988, 0.07, 'square', 0.05); tone(1319, 0.14, 'square', 0.05, 0, 0.07); },
  serve: () => tone(660, 0.08, 'triangle', 0.08, 880),
  cookStart: () => tone(220, 0.12, 'sawtooth', 0.03, 330),
  cookDone: () => tone(523, 0.1, 'triangle', 0.07),
  perfect: () => { tone(784, 0.08, 'square', 0.05); tone(1047, 0.08, 'square', 0.05, 0, 0.08); tone(1568, 0.16, 'square', 0.05, 0, 0.16); },
  angry: () => tone(180, 0.18, 'sawtooth', 0.04, 120),
  trash: () => tone(300, 0.12, 'square', 0.04, 150),
  open: () => { tone(523, 0.1, 'triangle', 0.08); tone(659, 0.1, 'triangle', 0.08, 0, 0.1); tone(784, 0.2, 'triangle', 0.08, 0, 0.2); },
  tap: () => tone(1200, 0.03, 'square', 0.025),
  surprise: () => { tone(880, 0.06, 'square', 0.04); tone(1320, 0.12, 'square', 0.04, 0, 0.06); },
  page: () => tone(440, 0.06, 'triangle', 0.05, 520),
};
export function playSfx(name) { const f = SOUNDS[name]; if (f) f(); }
