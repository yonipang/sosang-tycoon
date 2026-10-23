// 한 틱: 영업 중이면 시계·손님·사장을 차례로 움직여요. 빠르게 감기도 작은 걸음으로 나눠서 같은 결과가 나와요.
import { G } from '../save/state.js';
import { tickDay } from './day.js';
import { updateCustomers } from './customers.js';
import { updatePlayer } from './player.js';

const STEP = 1 / 30;
let acc = 0;

export function stepSim(realDt) {
  if (G.phase !== 'day' || !G.run || G.run.paused) { acc = 0; return; }
  acc += Math.min(realDt, 0.25) * G.run.speed;
  while (acc >= STEP && G.run && G.phase === 'day') {
    acc -= STEP;
    updatePlayer(STEP);
    updateCustomers(STEP);
    tickDay(STEP);
  }
}

// 시험용: 정해진 시간만큼 바로 돌려요 (화면 없이)
export function runFor(sec) {
  let t = 0;
  while (t < sec && G.run && G.phase === 'day') {
    updatePlayer(STEP); updateCustomers(STEP); tickDay(STEP);
    t += STEP;
  }
}
