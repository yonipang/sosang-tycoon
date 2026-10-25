// 돌발 이벤트: 영업 중에 하루 1~2번, 손님이 뜸하거나 루즈해지는 시간에 떠요. 시간 안에 해내면 보상.
// 시각은 게임 분 (0 = 09:00, 60 = 10:00 …). from~to 사이 무작위로 시작해요.
//  minDay: 이 날부터 · weight: 고르는 무게 · limit: 시작부터 끝까지(게임 분)
//  kind: group(단체 손님) · takeout(포장 전화) · mission(오 사장님 미션) · guest(깜짝 손님)
// 새 돌발 이벤트는 여기에 더하고, 처음 보는 kind면 sim/incidents.js에 진행 규칙을 더해요.
//  눈에 띄게 (데이브 더 다이버처럼): 시작하면 가게가 멈추고 대화(intro) → 목표 카드(goal · 보상 prize) → 「시작!」
//   진행 중에는 위 막대에 빨간 띠(진행도 · 남은 시간), 끝나면 결과 카드(winSay/loseSay 한마디 + 보상)
//  intro: [누가, 말] (data/story.js CAST · null이면 설명) · {menu} {qty}는 그때 정해진 것으로 바뀌어요
export const INCIDENTS = {
  group: {
    kind: 'group', name: '학원 끝난 아이들', short: '단체', from: 390, to: 450, minDay: 2, weight: 3,
    size: 8, waves: 4, gap: 10, limit: 130, pass: 6, perKid: 1000, allBonus: 4000,
    text: '학원 끝난 아이들이 몰려옵니다!',
    intro: [
      [null, '골목 끝에서 왁자지껄한 소리가 들려옵니다.'],
      ['kids', '사장님!! 저희 학원 끝났어요! 여덟 명인데 자리 있어요?'],
      ['kids2', '나 떡볶이! 나는 튀김! …야, 너 돈 있냐?'],
      ['meThink', '한꺼번에 몰려온다. 정신 바짝 차려야겠다!'],
    ],
    goal: '아이들 8명 계산까지 받기 (두세 명씩 차례로 옵니다)', prize: '한 명마다 팁 1,000원 · 8명 모두 받으면 +4,000원',
    winSay: ['kids', '사장님 최고! 내일 학원 끝나고 또 올게요!'], loseSay: ['kids', '아 배고픈데… 그냥 편의점 가자.'],
    win: '아이들이 배부르게 먹고 갔습니다', lose: '아이들을 다 받지 못했습니다. 자리·재료·속도를 챙겨 보세요',
  },
  takeout: {
    kind: 'takeout', name: '포장 전화', short: '포장', from: 300, to: 420, minDay: 2, weight: 3, qty: 3, limit: 100, tip: 3000,
    text: '{menu} {qty}인분 포장 주문!',
    intro: [
      [null, '따르릉— 가게 전화가 울립니다.'],
      ['caller', '여보세요, 거기 분식집이죠? {menu} {qty}인분 포장돼요? 금방 찾으러 갈게요.'],
      ['me', '네! 바로 준비해 두겠습니다.'],
    ],
    goal: '{menu} {qty}인분 만들어서 계산대에 올려 두기', prize: '포장 값 + 팁 3,000원',
    winSay: ['caller', '와, 벌써 다 됐네요? 잘 먹을게요!'], loseSay: ['caller', '아직이에요? …그냥 취소할게요.'],
    win: '포장 손님이 기분 좋게 가져갔습니다', lose: '포장 손님이 기다리다 주문을 취소했습니다',
  },
  mission: {
    kind: 'mission', name: '오 사장님 미션', short: '미션', from: 150, to: 180, minDay: 4, weight: 2, need: 3, until: 330, reward: 20000,
    text: '두 시 반까지 완벽하게 세 번!', who: 'oh',
    intro: [
      ['ohPhone', '어이, 사장. 점심 장사 시작이지?'],
      ['ohPhone', '두 시 반까지 완벽하게 세 번 만들어 봐라. 메뉴는 아무거나. 해내면 재료값 보태 주마.'],
      ['me', '…해 볼게요!'],
    ],
    goal: '두 시 반까지 아무 메뉴나 「완벽」 3번', prize: '재료값 20,000원',
    winSay: ['ohPhone', '제법이다. 재료값은 보내 놨다.'], loseSay: ['ohPhone', '아직 멀었다. 내일 또 해 봐라.'],
    win: '오 사장님이 재료값을 보태 줬습니다', lose: '오 사장님 미션은 다음 기회에',
  },
  guest: {
    kind: 'guest', name: '맛집 블로거', short: '블로거', from: 300, to: 420, minDay: 4, weight: 1, menu: 'tteok', limit: 150,
    text: '맛집 블로거가 왔습니다!',
    intro: [
      [null, '카메라를 목에 건 손님이 가게 안을 두리번거립니다.'],
      ['meThink', '저 사람… 동네 맛집 블로거 아닌가? 옆 동네 가게도 올렸던…'],
      ['blogger', '여기 {menu} 맛있다고 해서 왔어요. 사진 좀 찍어도 되죠?'],
    ],
    goal: '블로거에게 {menu}을/를 「완벽」하게 내주기', prize: '별 다섯 개 리뷰 · 동네 소문',
    winSay: ['blogger', '와, 이건 글 써야겠는데요?'], loseSay: ['blogger', '음… 무난하네요.'],
    win: '블로거가 사진을 잔뜩 찍고 갔습니다. 소문이 날 것 같습니다', lose: '블로거가 「무난하네」 하고 갔습니다',
  },
};
// 하루에 몇 개까지 (그날 중 무작위로 고름)
export const INCIDENTS_PER_DAY = day => (day <= 1 ? 0 : 1); // 하루에 하나만
