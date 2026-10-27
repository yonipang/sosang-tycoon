# 소스 파일 지도

`shell.html`의 `@include` 순서 = 묶는 순서예요.

| 폴더 | 파일 | 하는 일 |
|---|---|---|
| engine | `util.js` `random.js` | 공통 도구 · 난수(rand/fxRand) |
| sim | `events.js` | 사건(emit/onEvent) · 명령(defineCmd/runCmd) |
| art · audio | `atlas.js` `music.js` | 그림 한 장 + 자리표 (art_pack.py) · 배경음악 (audio_pack.py) — 손으로 안 고쳐요 |
| data | `menu.js` | 메뉴 18종(기본 3 + 2장 변형 15: `base`·`lv`)·레시피·원재료(유통기한)·메뉴 레벨·오늘의 메뉴 칸 |
| | `customers.js` `people.js` | 손님층·시간대 흐름·좋아하는 메뉴 · 손님 수첩 인물(이름·소개·`fav`) |
| | `economy.js` `layout.js` `reviews.js` `version.js` `credits.js` | 돈과 시간·별점 · 가게 배치(등급마다) · 리뷰 문구 · 게임 버전 · 크레딧(지우지 않기) |
| | `market.js` `town.js` | 재료 시세 소식 · 마을(지도·장소·행동 칸·물건·걷는 손님·홍보) |
| | `bond.js` `furniture.js` `guild.js` | 친밀도(미소·정 사장·문 회장) · 미소 가구(테마·분위기·확장공사) · 상인회(설비·도구 등급) |
| | `story.js` `tutorial.js` `cutscenes.js` | 인물·퀘스트·대화 장면(프롤로그~2장) · 오 사장님 가게 길잡이 · 연출 대본 |
| | `tools.js` `incidents.js` `district.js` | 장사 도구 · 돌발 이벤트 · 상권(게임 속 데이터) |
| save | `migrations.js` `state.js` `storage.js` `cloud.js` | 옛 세이브 보정 · 게임 상태 G(`SAVE_ORDER`) · 브라우저 저장 · 클라우드 저장 |
| sim | `rating.js` `story.js` `pantry.js` `upgrade.js` | 별점(리뷰 수가 적으면 3점 쪽으로) · 이야기 규칙 · 재료 창고·오늘의 메뉴 · 메뉴 레벨·메뉴 개발 |
| | `traffic.js` `book.js` `tutorial.js` `tools.js` | 유동인구 × 들어오는 비율(칠판·홍보·블로거) · 손님 수첩 기록 · 가게 길잡이 · 장사 도구 |
| | `market.js` `bond.js` `furniture.js` `guild.js` `town.js` | 원가(`costOf`) · 친밀도 · 미소 가구 · 상인회 · 마을 규칙 |
| | `path.js` `customers.js` `incidents.js` `day.js` `player.js` `loop.js` | 길찾기 · 손님 · 돌발 · 하루 흐름/정산 · 사장 행동/조리 · 틱 |
| | `dev.js` | 개발자 모드 바로 가기(`DEV_JUMPS`) |
| render | `view.js` `cut.js` `town.js` | 가게 그리기 · 연출 그리기 · 마을 지도 그리기 |
| ui | `settings.js` `analytics.js` `sfx.js` `music.js` `icons.js` | 설정 · 플레이 기록(GA4) · 효과음 · 배경음악 · 작은 그림 |
| | `hud.js` `phone.js` `story.js` `incident.js` | 영업 중 위아래 막대 · 전화 받기(울리는 폰 · 「받기」) · 대화/신문/퀘스트 · 돌발 이벤트 화면 |
| | `board.js` `book.js` `furn.js` `sales.js` `guild.js` | 메뉴 연구 칠판 · 손님 수첩 · 미소 가구 창 · 판매 장부 · 문 철물·상인회 창 |
| | `town.js` `cutscene.js` `screens.js` `feedback.js` `input.js` | 마을 화면(걷기·조이스틱·가게 안·대화하기 버튼·휴대폰: 인스타·블로그 홍보·최근 통화·상권 지도 자물쇠) · 연출 진행 · 처음/준비/영수증/고지서 화면 · 사건 받기 · 입력 |
| | `main.js` | 시작·매 프레임 · 시험 손잡이 `window.__T` |

## 이야기 더하기
- 인물·퀘스트·대화 장면은 `data/story.js`에만 써요. 퀘스트 `kind`가 새로 필요하면 `sim/story.js` `storyNote`에 세는 법을 더하고, 그 일이 일어나는 규칙 코드에서 `storyNote('이름', {...})`를 불러요.
- 메뉴는 날짜가 아니라 이야기로 열려요 (`menuOpen`, 퀘스트 `give.menuNext`·`menuNow`).
- 연출은 `data/cutscenes.js`에 대본(steps)으로 쓰고, 이야기 장면에 `cut: '이름'`을 붙이면 그 장면 앞에 나와요. 장이 시작될 때는 연출 끝에 `title: ['N장', '이름']` 카드 (1장 = handover 끝, 2장 = ch2open).
- 전화로 말하는 사람은 `CAST`에 `phone: true` (ohPhone · caller). 그 사람이 말을 꺼내는 줄 앞에서 폰이 울리고 「받기」를 눌러야 이어져요(ui/phone.js). 「전화가 울립니다」 같은 설명 줄은 쓰지 않아요.

## 원가율 · 재료 시세
- 메뉴 1인분 원가는 `sim/market.js` `costOf(m)` (그날 시세 반영). `MENUS[m].cost`를 직접 쓰지 말고 이걸 써요.
- 재료는 원재료 낱개(`data/menu.js` INGREDIENTS)로 사고, 메뉴 한 그릇은 recipe 재료를 하나씩 써요. 창고·영업 중 재료 계산은 `sim/pantry.js`(`invServings`·`stockOf`·`takeMenu`)로만 해요.
- 시세 소식은 `data/market.js`에 더하면 골목 신문 장면(`mk_이름`)이 저절로 생겨요.
