// 돌발 이벤트: 영업 중에 하루 1~2번, 손님이 뜸하거나 루즈해지는 시간에 떠요. 시간 안에 해내면 보상.
// 시각은 게임 분 (0 = 09:00, 60 = 10:00 …). from~to 사이 무작위로 시작해요.
//  minDay: 이 날부터 · weight: 고르는 무게 · limit: 시작부터 끝까지(게임 분)
//  kind: group(단체 손님) · takeout(포장 전화) · mission(오 사장님 미션) · guest(깜짝 손님)
// 새 돌발 이벤트는 여기에 더하고, 처음 보는 kind면 sim/incidents.js에 진행 규칙을 더해요.
export const INCIDENTS = {
  group: {
    kind: 'group', name: '단체 손님', short: '단체', from: 390, to: 450, minDay: 2, weight: 3, size: 4, reward: 5000,
    text: '학원 끝난 학생 넷이 몰려옵니다! 모두 받아 보세요', who: null,
    win: '단체 손님이 고맙다며 팁을 남겼습니다', lose: '단체 손님 중 일부가 그냥 나갔습니다',
  },
  takeout: {
    kind: 'takeout', name: '포장 전화', short: '포장', from: 300, to: 420, minDay: 2, weight: 3, qty: 3, limit: 120, tip: 3000,
    text: '{menu} {qty}인분 포장 주문! 만들어서 계산대에 올려 두세요', who: null,
    win: '포장 손님이 「빨리 해 주셔서 고마워요」 하고 가져갔습니다', lose: '포장 손님이 기다리다 주문을 취소했습니다',
  },
  mission: {
    kind: 'mission', name: '오 사장님 미션', short: '미션', from: 150, to: 180, minDay: 4, weight: 2, need: 3, until: 330, reward: 20000,
    text: '점심 장사 시작이다. 두 시 반까지 완벽하게 세 번 만들어 봐라. 해내면 재료값 보태 주마', who: 'oh',
    win: '오 사장님: 「제법이다.」 재료값을 보태 줬습니다', lose: '오 사장님: 「아직 멀었다. 내일 또 해 봐라.」',
  },
  guest: {
    kind: 'guest', name: '맛집 블로거', short: '블로거', from: 300, to: 420, minDay: 4, weight: 1, menu: 'tteok', limit: 150,
    text: '카메라를 든 손님이 들어옵니다. 동네 맛집 블로거 같습니다! 완벽하게 대접해 보세요', who: null,
    win: '블로거가 사진을 잔뜩 찍고 갔습니다. 소문이 날 것 같습니다', lose: '블로거가 「무난하네」 하고 갔습니다',
  },
};
// 하루에 몇 개까지 (그날 중 무작위로 고름)
export const INCIDENTS_PER_DAY = day => (day <= 1 ? 0 : day <= 3 ? 1 : 2);
