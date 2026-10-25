# 소스 파일 지도

`shell.html`의 `@include` 순서 = 묶는 순서예요.

| 폴더 | 파일 | 하는 일 |
|---|---|---|
| engine | `util.js` `random.js` | 공통 도구 · 난수(rand/fxRand) |
| sim | `events.js` | 사건(emit/onEvent) · 명령(defineCmd/runCmd) |
| art | `atlas.js` | 그림 한 장 + 자리표 (art_pack.py가 만들어요) |
| data | `menu.js` `customers.js` `economy.js` `layout.js` `reviews.js` `credits.js` `market.js` `story.js` `cutscenes.js` `tools.js` `incidents.js` `district.js` | 메뉴·손님·돈과 시간·가게 배치·리뷰 문구·크레딧·재료 시세 소식·이야기(인물·퀘스트·대화 장면)·연출 대본·장사 도구·돌발 이벤트·상권 |
| save | `migrations.js` `state.js` `storage.js` `cloud.js` | 옛 세이브 보정 · 게임 상태 G · 브라우저 저장 · 클라우드 저장(구글 로그인, Firebase) |
| sim | `market.js` `story.js` `path.js` `customers.js` `day.js` `player.js` `loop.js` | 이야기 규칙(퀘스트 세기·메뉴 열기) · 길찾기 · 손님 · 하루 흐름/정산 · 사장 행동/조리 · 틱 |
| render | `view.js` `cut.js` | 가게 그리기 · 연출(밤 골목) 그리기 |
| ui | `sfx.js` `icons.js` `hud.js` `story.js` `incident.js` `cutscene.js` `screens.js` `feedback.js` `input.js` | 소리 · 작은 그림 · 위아래 막대 · 대화/골목 신문/퀘스트 표시 · 돌발 이벤트 대화·목표·결과 카드 · 연출 진행 · 준비/영수증 화면 · 사건 받기 · 입력 |
| | `main.js` | 시작·매 프레임 · 시험 손잡이 `window.__T` |

## 이야기 더하기
- 인물·퀘스트·대화 장면은 `data/story.js`에만 써요. 퀘스트 `kind`가 새로 필요하면 `sim/story.js` `storyNote`에 세는 법을 더하고, 그 일이 일어나는 규칙 코드에서 `storyNote('이름', {...})`를 불러요.
- 메뉴는 날짜가 아니라 이야기로 열려요 (`menuOpen`, 퀘스트 `give.menuNext`·`menuNow`).
- 연출은 `data/cutscenes.js`에 대본(steps)으로 쓰고, 이야기 장면에 `cut: '이름'`을 붙이면 그 장면 앞에 나와요.

## 원가율 · 재료 시세
- 메뉴 1인분 원가는 `sim/market.js` `costOf(m)` (그날 시세 반영). `MENUS[m].cost`를 직접 쓰지 말고 이걸 써요.
- 시세 소식은 `data/market.js`에 더하면 골목 신문 장면(`mk_이름`)이 저절로 생겨요.
