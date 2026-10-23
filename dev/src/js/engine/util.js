// 공통 도구
export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const won = n => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원';
export const wonShort = n => {
  const a = Math.abs(Math.round(n)), s = n < 0 ? '-' : '';
  if (a >= 10000) return s + (a / 10000).toFixed(a % 10000 ? 1 : 0).replace(/\.0$/, '') + '만원';
  return s + a.toLocaleString('ko-KR') + '원';
};
// 영업 시작(09:00)부터 지난 게임 분 → "HH:MM"
export const clockText = min => {
  const t = 9 * 60 + Math.floor(min);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
// 받침에 맞는 조사: josa('떡볶이', '이/가')
export const josa = (word, pair) => {
  const [a, b] = pair.split('/');
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + b;
  return word + ((c - 0xac00) % 28 ? a : b);
};
