// 우리 골목 상권 (게임 속 데이터 — 실데이터 아님, 우리가 만든 값). 3장쯤 「상권 지도」(나이스비즈맵 도구)로 보여 줘요.
// 유동인구(data/customers.js FOOT_PER_HOUR)·시간대별 손님 구성(typeMix)도 이 상권의 값이에요.
// 영업 마감 뒤 유동인구 보고(시간대별 손님 그래프 · 영수증 「지나간 사람」)는 나이스비즈맵 도구가 생기면 켜요
import { baseOf } from './menu.js';
export const FOOT_REPORT = false;
//  kind 상권 유형 · competition 경쟁 강도(같은 업종 가게 수) · demand 이 상권에서 메뉴마다 찾는 정도(0~1)
export const DISTRICT_KINDS = {
  residential: { name: '주거', demand: { tteok: 1.0, kimbap: 0.8, twigim: 0.7 } },
  academy: { name: '주거 · 학원가', demand: { tteok: 1.0, twigim: 0.9, kimbap: 0.7 } },
  office: { name: '오피스', demand: { kimbap: 1.0, tteok: 0.7, twigim: 0.5 } },
  commercial: { name: '상업', demand: { tteok: 0.9, twigim: 0.9, kimbap: 0.8 } },
};
// 경쟁 강도: 같은 업종이 많을수록 들어오는 손님이 줄어요 (3장 길 건너 프랜차이즈가 생기면 「높음」)
export const COMPETITION = {
  low: { name: '낮음', mul: 1.1 },
  normal: { name: '보통', mul: 1.0 },
  high: { name: '높음', mul: 0.85 },
};
export const DISTRICT = { name: '오가네 골목', kind: 'academy', competition: 'normal' };
// 메뉴 궁합: 파는 메뉴가 상권이 찾는 메뉴와 맞을수록 손님이 늘어요 (0.85 ~ 1.0배)
export function menuFit(openMenus) {
  const d = DISTRICT_KINDS[DISTRICT.kind].demand;
  const all = Object.values(d).reduce((a, b) => a + b, 0);
  const fit = [...new Set(openMenus.map(baseOf))].reduce((s, m) => s + (d[m] || 0), 0) / all; // 새 메뉴는 기본 메뉴로 세요
  return 0.85 + 0.15 * Math.min(1, fit);
}
export const districtVisitMul = openMenus => COMPETITION[DISTRICT.competition].mul * menuFit(openMenus);
