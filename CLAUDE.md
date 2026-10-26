# 소상공인 키우기 — Claude 작업 안내

골목 분식집에서 시작하는 세로 화면 픽셀 가게 경영 웹게임 (HTML/Canvas, 프레임워크·외부 라이브러리 없음). GitHub Pages + 홈 화면 앱(PWA).
기획서는 claude.ai의 「소상공인 키우기 — 게임 기획서 v0.1」 문서예요. **지금은 프로토타입 단계(프롤로그 + 1장)** — 사용자 플레이 검증을 마쳤고, 다른 사람 플레이테스트 뒤 본게임(프롤로그~2장을 출시 품질로)으로 넘어가요.

## 어디를 고치나
- **게임 원본은 `dev/src/`** (`shell.html` + `style.css` + `font.css` + `js/`). 여기만 고쳐요. 파일 지도는 `dev/src/README.md`.
- `python3 dev/build.py` → `dev/index.html` (저장소에 안 올라감). `python3 dev/build_web.py` → 맨 위 `index.html`·`sw.js`·`manifest.webmanifest` (배포 파일, 손으로 안 고쳐요).
- 그림은 `python3 dev/art_pack.py` → `dev/src/js/art/atlas.js` (손으로 안 고쳐요).

## 꼭 지킬 규칙
- **모든 JS 파일은 모듈 모양**: `import { a } from './x.js'`, `export function …`. `export const`는 한 줄에 하나씩. `build.py`가 묶으면서 이름 겹침·없는 import를 확인해요.
- **수치는 `js/data/`**, 동작은 `js/sim/`, 그리기는 `js/render/`, 화면(HTML)은 `js/ui/`.
- **무작위**: 게임 결과에 영향 → `rand()`(하루마다 씨앗 `G.baseSeed + G.day*7919`), 보이기만 → `fxRand()`. `Math.random`은 `engine/random.js`에서만.
- **규칙 코드(`data/`·`sim/`·`save/state`·`save/migrations`)는 화면을 만지지 않아요**: 알림·소리·떠오르는 글자는 `emit('toast'|'float'|'sfx'|…)`, 받는 곳은 `ui/feedback.js`. 화면 → 규칙은 `runCmd('이름', {...})`, 규칙 쪽은 `defineCmd`. (`build.py`가 확인)
- **세이브**: 키 `sosang-tycoon-save-v1`, `SAVE_V = 1`은 바꾸지 않아요. 새 칸은 `save/state.js`의 `SAVE_ORDER`에 기본값과 함께 추가만, 옛 세이브 보정은 `save/migrations.js`. 저장은 준비 단계(prep — 1장부터는 마을의 밤·새벽 포함)에서만 해요(영업 중에 끄면 그날 준비부터).
- **클라우드 저장**(`save/cloud.js`): 소상공인 전용 Firebase 프로젝트 `sosang-tycoon`(v0.17부터, 등불나무와 따로), Firestore 모음 `sosang/{uid}`(규칙: 자기 uid만 읽고 쓰기). 구글 로그인 버튼 하나. 같은 계정이면 어느 기기에서든 더 최근 세이브(`meta.at`)를 저절로 써요(로그인할 때·앱으로 돌아올 때 확인, 바꿔 넣기는 처음 화면·준비 화면에서만, 진 쪽은 백업). 이 기기에 저장할 때마다 3초 모아서 올려요. 웹앱 주소(https)에서만 켜지고 Claude 미리보기에서는 로그인 대신 웹앱 안내.
- **하루 흐름**: 프롤로그는 준비 화면 → 영업 (1~2일차는 오 사장님이 가게 안에 서서 하나씩 시키고 퀘스트를 줘요 — 차례 `data/tutorial.js`, 규칙 `sim/tutorial.js`, 시키는 동안은 시계·손님 기다림이 멈춰요. 3일차는 전화로만). 1장부터는 영업 → 영수증 → **마을 밤**(골목을 걸어 다님, 행동 칸 4: 청소·이웃 이야기·전단지 → 집에서 자기) → **마을 새벽**(칸 3: 정 사장 식자재에서 원재료 장보기·오픈 준비) → 가게 장부(준비 화면, 「오늘의 메뉴」 칸)에서 가게 열기. 마을 수치는 `data/town.js`, 규칙 `sim/town.js`, 화면 `ui/town.js`(위에서 본 골목 지도, 상하좌우로 걸어 다님 · 그리기 `render/town.js`). 재료는 원재료 낱개·재료마다 유통기한(`data/menu.js` INGREDIENTS·recipe, 창고 계산은 `sim/pantry.js`), 원가는 늘 `sim/market.js` `costOf`.
- **게임 안 글**: 사실은 합니다체, 해요체는 「~해 보세요」 같은 제안에만. 손님 말·리뷰는 손님 말투 그대로. (코드 주석은 해요체)
- **「게임이 먼저」**: 나이스비즈맵은 게임 도구로 녹여요. 광고처럼 보이는 문구·강제 이동을 넣지 않아요.

## 그림·글꼴 라이선스
- 그림: LimeZu **Modern Interiors · Modern Exteriors** (구매, 크레딧 표기 필수, 원본 재배포 금지). 크레딧은 **엔딩 크레딧**(`js/data/credits.js`)에 — 엔딩이 생기기 전까지는 처음 화면 「크레딧」 버튼으로 같은 화면을 보여 줘요. 이 둘은 지우지 않아요. 원본 zip·PNG는 **절대 커밋하지 않아요** — `art_pack.py`가 쓰는 그림만 잘라 만든 `atlas.js`만 올려요. 원본 zip 경로는 `python3 dev/art_pack.py <Interiors zip> <Exteriors zip>` 인자나 환경 변수로 줘요(파일 맨 위 설명).
- 직접 그린 그림(떡볶이·김밥·튀김·계산대·얼굴 아이콘 …)은 `art_pack.py` 안에 있어요.
- 글꼴: Neo둥근모 Pro (SIL OFL 1.1, `dev/art_src/fonts/neodgm-pro-OFL.txt`). 
- 음악: `python3 dev/audio_pack.py <원본>` → `dev/src/js/audio/music.js` (손으로 안 고쳐요, 원본 wav는 커밋하지 않아요). 지금 곡은 lolurio 「Everyday Life」(CC BY 4.0) = 오 사장님 테마 — 크레딧(`js/data/credits.js`)에서 지우지 않아요. 재생은 `ui/music.js`의 `setMusic('이름')`.

## 확인과 보고
- 고친 뒤: `python3 dev/build.py && python3 dev/qa/smoke.py` (봇이 연출·대화를 넘기며 9일차까지 돌리고 이야기·도구·새벽·돌발·주간 정산·다시 열기까지 확인, 약 3분, 사진은 `dev/qa/out/`). 저장·클라우드를 고쳤으면 `python3 dev/qa/cloud.py`(가짜 클라우드로 로그인·저절로 이어하기·영업 중 기다리기·백업 확인, 약 1분)도. 그다음 `python3 dev/build_web.py`.
- 올리기: main에 바로 커밋·푸시하고 플레이 링크(아티팩트)도 바로 갱신. 올릴 때마다 버전 하나 — `js/data/version.js`와 프로젝트 문서 「plans/00-소상공인키우기-버전기록.md」를 같이 올려요.
- 개발자 모드(숨김): 처음 화면 → 설정 → 맨 아래 버전 글자를 7번 누르면 열려요. 원하는 날로 바로 가기 (`js/sim/dev.js` DEV_JUMPS — 새 장·새 기능을 만들면 가 볼 곳을 더해요).
- 사용자에게는 한국어로 짧게: 무엇이 바뀌었는지, 확인한 것, 남은 것.

## 나중에 (프로토타입 확인 뒤)
- 비교 테스트·기능별 테스트 묶음, 자동 배포 워크플로, 게임 현황 문서(`dev/design/`), 기획 결정 기록.
