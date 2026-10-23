# 소상공인 키우기

골목 분식집에서 시작하는 세로 화면 픽셀 가게 경영 게임. 낮에는 직접 요리하고 서빙하고 계산하고, 새벽에는 가격과 재료를 준비하고, 밤에는 영수증으로 하루를 돌아봐요.

**지금: 프로토타입 1단계 「분식집의 하루」** — 메뉴 3개(떡볶이·김밥·튀김), 손님 3유형, 조리 미니게임, 마감 영수증·리뷰·별점, 7일마다 임대료·대출 상환.

## 만들기
```
python3 dev/build.py        # dev/src → dev/index.html (브라우저로 바로 열 수 있어요)
python3 dev/qa/smoke.py     # 봇이 7일 영업 → 오류·화면 사진 확인 (Playwright)
python3 dev/build_web.py    # 배포 파일 index.html · sw.js · manifest.webmanifest
```

## 크레딧
- 그림: [LimeZu](https://limezu.itch.io/) — Modern Interiors, Modern Exteriors (원본 에셋은 이 저장소에 없어요)
- 글꼴: Neo둥근모 Pro — SIL Open Font License 1.1
