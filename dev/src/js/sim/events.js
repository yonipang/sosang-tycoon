// 사건: 규칙 코드는 소리·알림·떠오르는 글자를 바로 부르지 않고 사건만 남겨요.
// 받는 곳은 ui/feedback.js (onEvent). 예) emit('float', x, y, '+4,000원', 'cash') · emit('toast', '손이 꽉 찼어요', 'warn') · emit('sfx', 'coin')
const handlers = {};
export function onEvent(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
export function emit(name, ...args) { for (const fn of handlers[name] || []) fn(...args); }

// 명령: 화면·입력이 규칙에 보내는 것. 받는 곳은 규칙 파일의 defineCmd.
const cmds = {};
export function defineCmd(name, fn) { cmds[name] = fn; }
export function runCmd(name, arg) {
  if (!cmds[name]) throw new Error('없는 명령: ' + name);
  return cmds[name](arg || {});
}
