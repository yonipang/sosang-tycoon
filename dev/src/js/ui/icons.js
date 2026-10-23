// 화면(HTML)에 쓰는 작은 그림: 아틀라스에서 잘라 그림 주소로 만들어 둬요.
import { SPR, ATLAS_URL } from '../art/atlas.js';

const cache = {};
let img = null;
export function loadIcons() {
  return new Promise(res => {
    img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = ATLAS_URL;
  });
}
// name: 아틀라스 그림 이름. 캐릭터는 'char3' → 정면 서 있는 그림
export function iconURL(name) {
  if (cache[name]) return cache[name];
  const r = SPR[name];
  if (!r || !img) return '';
  const isChar = name.startsWith('char');
  const w = isChar ? 16 : r[2], h = isChar ? 32 : r[3], sx = isChar ? r[0] + 48 : r[0];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, sx, r[1], w, h, 0, 0, w, h);
  return (cache[name] = c.toDataURL());
}
export const icon = (name, cls) => `<img class="px ${cls || ''}" src="${iconURL(name)}" alt="">`;
