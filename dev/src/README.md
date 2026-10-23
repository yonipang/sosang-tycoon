# 소스 파일 지도

`shell.html`의 `@include` 순서 = 묶는 순서예요.

| 폴더 | 파일 | 하는 일 |
|---|---|---|
| engine | `util.js` `random.js` | 공통 도구 · 난수(rand/fxRand) |
| sim | `events.js` | 사건(emit/onEvent) · 명령(defineCmd/runCmd) |
| art | `atlas.js` | 그림 한 장 + 자리표 (art_pack.py가 만들어요) |
| data | `menu.js` `customers.js` `economy.js` `layout.js` `reviews.js` | 메뉴·손님·돈과 시간·가게 배치·리뷰 문구 |
| save | `migrations.js` `state.js` `storage.js` | 옛 세이브 보정 · 게임 상태 G · 브라우저 저장 |
| sim | `path.js` `customers.js` `day.js` `player.js` `loop.js` | 길찾기 · 손님 · 하루 흐름/정산 · 사장 행동/조리 · 틱 |
| render | `view.js` | 가게 그리기 |
| ui | `sfx.js` `icons.js` `hud.js` `screens.js` `feedback.js` `input.js` | 소리 · 작은 그림 · 위아래 막대 · 준비/영수증 화면 · 사건 받기 · 입력 |
| | `main.js` | 시작·매 프레임 · 시험 손잡이 `window.__T` |
