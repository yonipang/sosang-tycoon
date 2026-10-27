// 돌발 이벤트: 영업 중에 하루 1~2번, 손님이 뜸하거나 루즈해지는 시간에 떠요. 시간 안에 해내면 보상.
// 시각은 게임 분 (0 = 09:00, 60 = 10:00 …). from~to 사이 무작위로 시작해요.
//  minDay: 이 날부터 · weight: 고르는 무게 · limit: 시작부터 끝까지(게임 분)
//  kind: group(여럿이 차례로 · ptype 손님 유형, 없으면 아무나) · takeout(포장 · menu 정하면 그 메뉴) · mission(완벽 조리 · menu 정하면 그 메뉴만)
//        guest(깜짝 손님 한 명 · 완벽하게 내주기) · inspect(점검: 시간 동안 놓친 손님이 없으면 성공)
//  needMenu: 이 메뉴가 열려 있어야 골라요 · 어제 일어난 이벤트는 오늘 다시 고르지 않아요
// 새 돌발 이벤트는 여기에 더하고, 처음 보는 kind면 sim/incidents.js에 진행 규칙을 더해요.
//  눈에 띄게 (데이브 더 다이버처럼): 시작하면 가게가 멈추고 대화(intro) → 목표 카드(goal · 보상 prize) → 「시작!」
//   진행 중에는 위 막대에 빨간 띠(진행도 · 남은 시간), 끝나면 결과 카드(winSay/loseSay 한마디 + 보상)
//  intro: [누가, 말] (data/story.js CAST · null이면 설명) · {menu} {qty}는 그때 정해진 것으로 바뀌어요
export const INCIDENTS = {
  group: {
    kind: 'group', name: '학원 끝난 아이들', short: '단체', from: 390, to: 450, minDay: 2, weight: 3,
    ptype: 'student', size: 8, waves: 4, gap: 10, limit: 130, pass: 6, perHead: 1000, allBonus: 4000,
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
  rain: {
    kind: 'group', name: '소나기', short: '소나기', from: 180, to: 420, minDay: 3, weight: 3,
    ptype: null, size: 6, waves: 3, gap: 6, limit: 90, pass: 4, perHead: 800, allBonus: 3000,
    text: '갑자기 소나기가 쏟아집니다!',
    intro: [
      [null, '하늘이 순식간에 어두워지더니 굵은 빗방울이 떨어집니다.'],
      ['rainy', '어휴, 비 피할 데가… 사장님, 잠깐 들어가도 되죠? 뭐라도 먹을게요!'],
      ['meThink', '우산 없는 사람들이 몰려온다. 비 그칠 때까지가 기회다!'],
    ],
    goal: '비 피하러 들어온 손님 6명 계산까지 받기', prize: '한 명마다 팁 800원 · 모두 받으면 +3,000원',
    winSay: ['rainy', '덕분에 비도 피하고 배도 채웠네요. 또 올게요!'], loseSay: ['rainy', '자리가 없네… 그냥 뛰어가야겠다.'],
    win: '비가 그치고, 손님들이 「여기 괜찮네」 하며 돌아갔습니다', lose: '비를 피하러 온 손님들을 다 받지 못했습니다',
  },
  workers: {
    kind: 'group', name: '공사장 점심', short: '점심', from: 150, to: 200, minDay: 4, weight: 2,
    ptype: 'worker', size: 6, waves: 3, gap: 8, limit: 100, pass: 5, perHead: 1500, allBonus: 5000,
    text: '골목 공사장 아저씨들이 점심을 먹으러 옵니다!',
    intro: [
      [null, '골목 끝 공사장에서 안전모를 쓴 사람들이 우르르 걸어옵니다.'],
      ['foreman', '사장님, 여기 빨리 되죠? 우리 한 시까지 다시 올라가야 돼서.'],
      ['foreman', '맛있으면 내일부터 매일 올게. 여섯 명이야!'],
    ],
    goal: '공사장 아저씨 6명 계산까지 받기 (점심시간 안에)', prize: '한 명마다 팁 1,500원 · 모두 받으면 +5,000원',
    winSay: ['foreman', '빠르고 맛있네! 내일도 이 시간에 온다.'], loseSay: ['foreman', '시간 없어, 그냥 편의점 가자.'],
    win: '공사장 아저씨들이 배불리 먹고 현장으로 돌아갔습니다', lose: '점심시간 안에 다 받지 못했습니다',
  },
  parkOrder: {
    kind: 'takeout', name: '박 할머니의 부탁', short: '부탁', from: 240, to: 360, minDay: 5, weight: 2, needMenu: 'kimbap',
    menu: 'kimbap', qty: 5, limit: 120, tip: 6000, who: 'park',
    text: '박 할머니가 김밥 5줄을 부탁했습니다',
    intro: [
      ['park', '사장, 바빠? 오늘 손주 생일이라 애들이 집에 모인대.'],
      ['park', '김밥 다섯 줄만 싸 줘. 이따 장 보고 오는 길에 들를게.'],
      ['me', '네, 할머니! 맛있게 말아 둘게요.'],
    ],
    goal: '{menu} {qty}줄 만들어서 계산대에 올려 두기', prize: '김밥 값 + 할머니 용돈 6,000원',
    winSay: ['park', '아이고, 예쁘게도 말았네. 손주들이 좋아하겠다.'], loseSay: ['park', '아직이야? 늦겠다… 마트 김밥 사 가야겠네.'],
    win: '박 할머니가 김밥을 받아 들고 웃으며 갔습니다', lose: '박 할머니가 기다리다 그냥 가셨습니다',
  },
  inspect: {
    kind: 'inspect', name: '구청 위생 점검', short: '점검', from: 200, to: 400, minDay: 5, weight: 2, limit: 90, reviews: 3,
    text: '구청에서 위생 점검을 나왔습니다',
    intro: [
      [null, '서류철을 든 사람이 가게 문을 열고 들어옵니다.'],
      ['inspector', '구청 위생과에서 나왔습니다. 영업하시는 거 잠깐 지켜보겠습니다.'],
      ['meThink', '하필 지금…! 손님을 그냥 돌려보내는 일만은 없어야 한다.'],
    ],
    goal: '점검하는 동안 손님을 놓치지 않기 (오래 기다림·자리 없음·품절로 돌아가면 실패)', prize: '위생 우수 스티커 · 별점 +0.15',
    winSay: ['inspector', '깔끔하게 잘 하시네요. 우수 업소 스티커 붙여 드릴게요.'], loseSay: ['inspector', '손님이 그냥 나가시네요. 기록해 두겠습니다.'],
    win: '위생 우수 스티커를 받았습니다', lose: '점검 기록에 「손님 응대 미흡」이 남았습니다',
  },
  youtuber: {
    kind: 'guest', name: '먹방 유튜버', short: '유튜버', from: 300, to: 480, minDay: 6, weight: 1, menu: 'twigim', limit: 120, review: 'youtuber',
    text: '먹방 유튜버가 왔습니다!',
    intro: [
      [null, '삼각대를 든 손님이 카메라를 켜며 들어옵니다.'],
      ['youtuber', '여러분 안녕하세요~ 오늘은 골목 분식집에 와 봤습니다! 사장님, {menu} 제일 맛있게 부탁드려요!'],
      ['meThink', '구독자가 많다던 그 사람이다. 실수하면 동네방네 소문난다…'],
    ],
    goal: '유튜버에게 {menu}을/를 「완벽」하게 내주기', prize: '영상 소문 (별 다섯 개 리뷰)',
    winSay: ['youtuber', '와… 이거 진짜 바삭한데요? 여러분 여기 꼭 오세요!'], loseSay: ['youtuber', '음… 평범하네요. 다음 집 가 볼게요~'],
    win: '유튜버가 「인생 맛집」이라며 영상을 찍어 갔습니다', lose: '유튜버가 별 말 없이 다음 가게로 갔습니다',
  },
  ohKimbap: {
    kind: 'mission', name: '오 사장님 김밥 시험', short: '시험', from: 300, to: 330, minDay: 5, weight: 1, needMenu: 'kimbap',
    menu: 'kimbap', need: 2, until: 480, reward: 15000, who: 'oh',
    text: '다섯 시까지 김밥 완벽 두 번!',
    intro: [
      ['ohPhone', '박 할머니가 그러더라. 요즘 김밥 맛이 예전 같다고.'],
      ['ohPhone', '진짜인지 보자. 다섯 시까지 김밥 「완벽」 두 줄. 해내면 김 값 보태 주마.'],
      ['me', '할머니가 그러셨어요? …해 볼게요!'],
    ],
    goal: '다섯 시까지 김밥 「완벽」 2번', prize: '김 값 15,000원',
    winSay: ['ohPhone', '…그래, 그 맛이다. 할머니 말이 맞네.'], loseSay: ['ohPhone', '김밥은 손이 빨라야 돼. 연습 더 해라.'],
    win: '오 사장님이 김 값을 보태 줬습니다', lose: '김밥 시험은 다음 기회에',
  },
};
// 하루에 몇 개까지 (그날 중 무작위로 고름)
export const INCIDENTS_PER_DAY = day => (day <= 1 ? 0 : 1); // 하루에 하나만
// 매일은 아니고 자주 (v0.42 사용자 요청): 2일차는 처음 보여 주려고 꼭, 그 뒤로는 확률 · 어제 없었으면 더 높게
export const INCIDENT_FIRST_DAY = 2;
export const INCIDENT_CHANCE = 0.55;
export const INCIDENT_CHANCE_AFTER_NONE = 0.85;
