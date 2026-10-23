// 옛 세이브 보정은 모두 여기에 둬요. 세이브 구조를 바꾸면 기본값을 채우는 줄을 아래에 더해요.
export function migrate(o) {
  if (!o || typeof o !== 'object') throw new Error('세이브 형식이 아니에요');
  if (!o.stats) o.stats = { served: 0, sales: 0 };
  if (!Array.isArray(o.history)) o.history = [];
  if (!o.inv) o.inv = { tteok: [], kimbap: [], twigim: [] }; // 재료 이월(유통기한) 이전 세이브
  return o;
}
