// 난수: 게임 결과에 영향 → rand() (하루마다 씨앗을 정해 같은 날을 다시 돌릴 수 있어요)
//       보이기만(반짝임·소리) → fxRand()
// Math.random은 이 파일에서만 써요 (build.py가 확인).
let seed = 1;
export function seedRand(s) { seed = (s >>> 0) || 1; }
export function rand() {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const fxRand = () => Math.random();
export const newSeed = () => (Math.random() * 4294967296) >>> 0;
export const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
export const pick = arr => arr[Math.floor(rand() * arr.length)];
// { a: 3, b: 1 } → 'a' 또는 'b' (무게만큼)
export function weighted(obj) {
  let sum = 0;
  for (const k in obj) sum += Math.max(0, obj[k]);
  let r = rand() * sum;
  for (const k in obj) { r -= Math.max(0, obj[k]); if (r < 0) return k; }
  return Object.keys(obj)[0];
}
// 따로 노는 난수 (같은 씨앗이면 같은 순서): 동네 탐방 지도처럼 하루 영업 난수와 섞이면 안 되는 곳 (sim/explore.js)
export function makeRand(s) {
  let st = (s >>> 0) || 1;
  return () => {
    st = (st + 0x6D2B79F5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
