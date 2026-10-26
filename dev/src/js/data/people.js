// 손님 수첩 (ui/book.js): 가게에 오는 사람마다 이름과 한 줄 소개. 그림 번호 = data/customers.js PEOPLE (13번 박 할머니는 단골)
// 처음 가게에 들어오면 수첩에 열려요. 맛있게 먹고 여섯 번 다시 온 손님은 「단골 후보」 (다시 와서 실망하면 한 번 빠져요) — 2장 단골과 이어져요
export const PEOPLE_INFO = {
  1: { name: '김 대리', bio: '근처 사무실 회사원입니다. 점심시간이 짧아 늘 서둘러 먹습니다.', fav: 'kimbap' },
  2: { name: '민준', bio: '학원 가기 전에 들르는 중학생입니다.', fav: 'tteok' },
  3: { name: '서연', bio: '비니를 즐겨 쓰는 고등학생입니다. 친구와 나눠 먹습니다.', fav: 'twigim' },
  4: { name: '박 과장', bio: '야근이 잦아 저녁을 분식으로 때웁니다.', fav: 'tteok' },
  5: { name: '지호', bio: '동아리방 간식을 사 가는 대학생입니다.', fav: 'twigim' },
  6: { name: '도윤', bio: '자전거로 학원을 다니는 고등학생입니다.', fav: 'tteok' },
  7: { name: '최 사장님', bio: '옆 세탁소 사장님입니다. 말수가 적습니다.', fav: 'kimbap' },
  8: { name: '이 기사님', bio: '골목을 도는 택배 기사님입니다. 김밥을 들고 가며 먹습니다.', fav: 'kimbap' },
  9: { name: '미소 사장님', bio: '옆집 미소 꽃집 사장님입니다.', fav: 'tteok' },
  10: { name: '정 주임', bio: '길 건너 은행에 다닙니다.', fav: 'kimbap' },
  11: { name: '태민', bio: '야구부 중학생입니다. 늘 배가 고픕니다.', fav: 'tteok' },
  12: { name: '준호 쌤', bio: '헬스장 트레이너입니다. 「오늘만 먹는다」고 매번 말합니다.', fav: 'twigim' },
  13: { name: '박 할머니', bio: '오 사장님 시절부터 오던 단골입니다. 김밥을 좋아합니다.', fav: 'kimbap' },
  14: { name: '한 약사님', bio: '골목 약국 약사님입니다.', fav: 'kimbap' },
  15: { name: '유나', bio: '미대 입시를 준비하는 고등학생입니다.', fav: 'tteok' },
  16: { name: '카메라 든 손님', bio: '먹기 전에 사진부터 찍습니다. 블로그를 한다는 소문이 있습니다.', fav: 'twigim' },
  17: { name: '소율', bio: '분홍 모자를 쓴 초등학생입니다. 용돈을 모아 옵니다.', fav: 'tteok' },
  19: { name: '강 할아버지', bio: '경로당에 다니는 어르신입니다. 천천히 드십니다.', fav: 'kimbap' },
};
export const BOOK_ORDER = [1, 4, 8, 10, 12, 14, 16, 2, 3, 5, 6, 11, 15, 17, 9, 7, 13, 19];
// fav: 좋아하는 메뉴 — 오늘의 메뉴에 있으면 주로 그걸 시켜요 (sim/customers.js decide)
export const FAV_CHANCE = 0.7;
export const REGULAR_BACK = 6; // 맛있게 먹고 여섯 번 다시 오면 단골 후보 (v0.45: 3 → 6, 다시 와서 실망하면 한 번 빠져요)
