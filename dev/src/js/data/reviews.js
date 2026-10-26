// 하루가 끝나면 그날 일어난 일에서 리뷰 3개를 골라요. 별(stars)과 한 줄 평 후보.
// {menu}는 메뉴 이름으로, {menu:이/가}는 받침에 맞는 조사까지 붙여 바뀌어요. salience가 클수록 먼저 골라요.
export const REVIEW_TEMPLATES = {
  perfect: { stars: 5, salience: 3, lines: ['{menu} 진짜 맛있어요. 또 올게요!', '{menu:이/가} 딱 제가 좋아하는 맛이에요', '여기 {menu} 맛집이네요'] },
  cheap: { stars: 5, salience: 2, lines: ['이 가격에 이 맛이면 완전 이득', '가격이 착해서 자주 올 것 같아요'] },
  wait: { stars: 2, salience: 4, lines: ['음식이 너무 늦게 나와서 그냥 나왔어요', '주문하고 한참 기다렸어요…'] },
  price: { stars: 2, salience: 3, lines: ['메뉴판 보고 비싸서 그냥 나왔어요', '분식치고 가격이 좀 세요'] },
  soldout: { stars: 2, salience: 3, lines: ['{menu:이/가} 다 떨어졌대요. 아쉽', '먹으러 왔는데 {menu} 품절…'] },
  full: { stars: 3, salience: 2, lines: ['자리가 없어서 다음에 오기로 했어요', '줄이 길어서 그냥 지나갔어요'] },
  payWait: { stars: 3, salience: 2, lines: ['계산하려고 한참 서 있었어요', '맛은 괜찮은데 계산이 느려요'] },
  blogger: { stars: 5, salience: 9, lines: ['(블로그) 골목 안 숨은 {menu} 맛집 발견!', '(블로그) {menu} 하나 먹으러 또 갈 집'] },
  blogBad: { stars: 3, salience: 9, lines: ['(블로그) 소문만큼은 아니었던 {menu}…', '(블로그) {menu}, 무난하지만 일부러 갈 정도는 글쎄'] },
  youtuber: { stars: 5, salience: 9, lines: ['(영상) 골목 분식집 {menu} 먹방… 바삭함 실화?', '(영상) 구독자 여러분, 이 집 {menu}은 꼭 드세요'] },
  dirty: { stars: 2, salience: 6, lines: ['맛은 괜찮은데 테이블이 좀 끈적했어요', '가게가 좀 지저분해요. 청소 좀…'] },
  regular: { stars: 5, salience: 2, lines: ['매일 와도 안 질려', '여기 {menu}는 옛날 맛 그대로야'] },
  normal: { stars: 4, salience: 1, lines: ['무난하게 먹고 가요', '동네에 이런 분식집 있어서 좋아요', '{menu} 괜찮았어요'] },
};
