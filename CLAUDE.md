# 소상공인 키우기 — Claude 작업 안내

골목 분식집에서 시작하는 세로 화면 픽셀 가게 경영 웹게임 (HTML/Canvas, 프레임워크·외부 라이브러리 없음). GitHub Pages + 홈 화면 앱(PWA).
기획서는 claude.ai의 「소상공인 키우기 — 게임 기획서 v0.1」 문서예요 (https://claude.ai/artifact/C29rkyHhLJQFqymQxR5wcV).
**지금(10-27, v0.59): 프롤로그 + 1장 + 2장 「골목 사람들」까지 들어 있고, 지인 한두 명 플레이테스트와 3장 기획(기획서 3장 탭) 중.** 지금 상태 요약·다음 할 일·최근 결정은 아래 「이어받기」와 프로젝트 문서 「plans/00-소상공인키우기-버전기록.md」 맨 위에 있어요.

## 이어받기 (새 대화는 여기부터)
1. 프로젝트 문서 `plans/00-소상공인키우기-버전기록.md`를 먼저 읽어요 — 「지금 상태」(게임에 뭐가 있나) · 「다음 할 일」(개발 순서) · 버전 표(맨 위가 최신). 다음 버전 번호도 거기에.
2. `git pull` 뒤 이 파일과 `dev/src/README.md`(파일 지도)를 봐요. 고칠 곳이 정해지면 그 파일만 읽어요(파일 맨 위 주석에 하는 일이 적혀 있어요).
3. 사용자는 개발자가 아니에요(나이스비즈맵 디자이너 주연). 한국어로 쉽게 · 짧게. 한 화면에 정보가 많은 걸 싫어해요(화면 원칙: 한 화면 = 결정 하나). 아이폰 스크린샷으로 요청이 많이 와요 — 스크린샷 속 화면을 코드에서 찾아 고쳐요.
4. 새 규칙·밸런스·보상은 추천안 + 이유를 내고 사용자가 고르면 만들어요. 작은 화면 요청은 바로 고쳐서 올려요.

## 작업 요령 (이 프로젝트에서 배운 것)
- **스모크는 늘 백그라운드로** (`run_in_background`) — 약 3분이라, 앞에서 돌리면 사용자가 그 사이 보낸 말을 못 받아요. 사용자가 작업 중에 보낸 요청은 그것부터 반영해요.
- 특정 화면만 볼 때는 Playwright 짧은 스크립트로: `dev/index.html` 열기 → `window.__T.viewReady()` 기다리기 → 설정 → 버전 글자 7번(`[data-act=ver]`) → `[data-j=<DEV_JUMPS id>]`(예: `c2g` 2장 마을 밤) → 대화는 `#talk`를 눌러 넘기기. `window.__T`에 `G`·`runCmd`·`townView()` 등이 있어요(`main.js`). 사진은 작업 공간 임시 폴더에.
- 파이썬으로 파일을 고칠 때 `open(p,'w').write(open(p).read()…)`는 파일을 0바이트로 만들어요 — 읽고 나서 쓰기를 따로.
- `build.py`는 없는 import·이름 겹침만 봐요. **import 안 한 이름을 써도 통과**하니 새로 쓴 함수 이름은 직접 확인해요(스모크가 그 줄을 지나야 잡혀요).
- 버전 기록 문서 고치기: 작업 공간에 사본(`Projects project_read`)을 두고 고친 뒤, 작업 폴더 안 임시 파일로 복사해 `project_write`의 `local_path`로 올리고 임시 파일은 지워요(문서가 길어서 통째로 붙이지 않아요). 표 한 줄 = 버전 · 날짜 · 바뀐 것(사용자 요청이면 「사용자 요청:」) · 커밋 해시.
- 플레이 링크 갱신: `dev/index.html`을 작업 공간 임시 폴더에 `sosang-tycoon.html`로 복사 → Artifact 게시(`url` = https://claude.ai/artifact/UTCFoAz25sbcJaT7BL7Ct9). 새 대화에서 처음 게시할 때는 먼저 `action: read`.
- 그림을 새로 잘라 쓸 때는 LimeZu zip에서 `art_pack.py`로만 (zip은 사용자가 대화에 올려 줘요 — 없으면 요청). 옆 그림이 같이 잘려 들어오는 일이 잦으니 사진으로 꼭 확인.

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
- **클라우드 저장**(`save/cloud.js`): 소상공인 전용 Firebase 프로젝트 `sosang-tycoon`(v0.17부터, 등불나무와 따로), Firestore 모음 `sosang/{uid}`(규칙: 자기 uid만 읽고 쓰기). 구글 로그인 버튼 하나. 같은 계정이면 어느 기기에서든 더 최근 세이브(`meta.at`)를 저절로 써요(로그인할 때·앱으로 돌아올 때 확인, 바꿔 넣기는 처음 화면·준비 화면에서만, 진 쪽은 백업 — 클라우드 백업 prev는 화면에 안 보여요 — v0.57부터 설정 맨 아래 작은 글자 버튼 「기기 저장」·「기기 데이터 불러오기」가 이 기기 저장 칸(`sosang-tycoon-backup`)과 지금 진행의 자리를 바꿔요). **이 기기와 클라우드가 서로 다른 게임(meta.id 다름)이면 시간으로 정하지 않고 「어느 세이브로 할까요?」 창**(고를 때까지 안 올림, v0.56). 「처음부터 다시 하기」·개발자 바로 가기 전 세이브는 이 기기 백업(`sosang-tycoon-backup`)에 남아요. 설정에 마지막으로 올린 때·실패 이유. 이 기기에 저장할 때마다 3초 모아서 올려요. 웹앱 주소(https)에서만 켜지고 Claude 미리보기에서는 로그인 대신 웹앱 안내.
- **동네 탐방**(2장부터, v0.78): 골목 버스 정류장 → 새벽 첫차로 재래시장 · 아침 버스로 아파트 단지(v0.82) · 출근 버스로 오피스 거리(v0.84 — 하루 한 곳, 동네는 `data/explore.js` `EX_AREAS`, 사건마다 `area`). 준비 시간과 따로 하루 한 번(`G.explore.last`), 체력은 탐방 안에서만. 수치·사건 `data/explore.js`, 규칙 `sim/explore.js`(지도는 그날 씨앗 `makeRand`), 화면 `ui/explore.js`(골목 화면을 빌려 써요), 그리기 `render/explore.js`. 개발자 바로 가기 `c2x`. 도와주기는 직접 해요(v0.81): 심부름(`task` — 짐 배달 · 아이 데리고 할머니 찾기, 짐을 들면 체력 2배)과 손기술(`mini` — 타이밍 · 연타 미니게임), 끝은 `runCmd('exFinish')`. 시험 스크립트는 `__T.exRun()`·`__T.exView()`. 동네마다 빈 가게 하나 = **임대 매물**(이사 갈 자리, v0.84): 정보는 `data/move.js` `MOVE_SPOTS`, 지도엔 `map.listing`, 상호작용 「매물 보기」 → `runCmd('exListing')`(본 동네는 `G.explore.seen`). 실제 이사는 나중(기획서 6장).
- **자동 주방(v0.83 시험)**: `data/menu.js` `AUTO_COOK = true`면 조리 미니게임 없이 조리대가 주문을 알아서 만들어 조리대 위에 올려요(`sim/kitchen.js`) — 사장은 들기·내주기·계산. 갓 나온 걸 바로 들면 「완벽」, 오래 두면 식어요(`AUTO_FRESH`). 주문이 없으면 만들지 않아요(v0.88 「미리 만들기」 뺌). 손님 수 `data/customers.js` `CUSTOMER_MUL`(1.6). `false`로 바꾸면 예전 미니게임으로.
- **손님층 수첩(v0.90)**: 계산대 「손님층」 탭. 1장부터 손님층마다 세다가(판 그릇·주문·가격 표정·계산한 손님) 조건을 채우면 칸이 열려요 — 좋아하는 메뉴 · 많이 오는 때 · 값 느낌 · 기다림. 수치 `data/notebook.js`, 규칙 `sim/notebook.js`(`G.notebook`), 화면 `ui/notebook.js`, 열릴 때 알림 `emit('notebook')`.
- **칠판 · 메뉴 변형(v0.91)**: 가게 안 「칠판」(전 「메뉴 연구」 버튼)에서 메뉴 레벨 올리기 + 2장부터 메뉴 변형 찾기 — 기본 레시피 네 칸 중 핀 꽂힌 칸은 못 바꾸고, ⇄ 칸 하나를 다른 재료로 바꿔 「한 그릇 만들어 보기」(`data/menu.js` `VARIANT_FIND`, `runCmd('menuTry')`, 찾은 것 `G.varFound`). 찾은 변형만 개발비 내고 메뉴에 올려요. 새 메뉴(우동·돈까스 …)는 나중에 「메뉴 연구」 버튼 + 냄비 연구(4장 무렵). 칠판 추천(아침·점심·오후)은 「가게 열기」 화면 명패를 메뉴 칸으로 끌거나 눌러서(`ui/screens.js` platesHTML). 장사를 마치면 가게 안에서 밤을 시작해요(1장 첫 밤만 골목). 상호작용 버튼이 가리키는 것엔 흰 테두리(v0.92 — 각 `ActTarget`의 `focus` → `render/town.js` twFocus · `render/view.js` drawShopTo). 조이스틱은 마을 화면 전체(`#town`)에서 받아요(지도 밖 빈 곳도, v0.92).
- **3장 「길 건너 대결」(v0.88~)**: 기획서 3장 탭 순서대로 단계별. 1단계(v0.88) 길 건너 떡볶이 공장 — 수치 `data/rival.js`, 규칙 `sim/rival.js`(`G.story.c3` 3장 시작한 날 · `c3Day()` · 1~2일째 공사 가림막 · 3일째 개업+강 점장 장면 `c3_flyer` · 오픈 세일 사흘 · 손님층·시간마다 공장이 가져가는 몫 `rivalTake` → `sim/customers.js` 입장, 놓친 수 `r.log.rival`). 골목 빈 가게 그림은 `ui/town.js` swap(tw_hoard·tw_factory). 바로 가기 `c3a`·`c3b`. 다음: 상권 지도 → 예보·요일 → 무기 카드 → 시간제 알바(도윤 — 사장과 같이 서빙·계산하는 둘째 손, 10-29 결정) → 대결판·장 끝.
- **하루 흐름**: 프롤로그는 준비 화면 → 영업 (1일차는 가격·재료 주문 고정 + 손님이 더 오래 기다림 + 다 팔면 일찍 닫음 — `sim/day.js` `day1Fixed`, v0.84 · 2일차부터 품절로 손님을 처음 놓치면 품절 길잡이 장면 `tutSoldOut` · 1~2일차는 오 사장님이 가게 안에 서서 하나씩 시키고 퀘스트를 줘요 — 차례 `data/tutorial.js`, 규칙 `sim/tutorial.js`, 시키는 동안은 시계·손님 기다림이 멈춰요. 3일차는 전화로만). 1장부터는 영업 → 영수증 → **마을 준비 시간**(골목을 걸어 다님 · 한 턴 7시간(코드 이름은 칸 · 화면엔 「시간」), 넘기면 피로 · **v0.59부터 밤·새벽을 나누지 않아요** — 모든 곳이 늘 열려 있고 차례 없이: 청소·이웃 이야기·정 사장 식자재 장보기(특가·단골가·친밀도, 1시간)·오픈 준비·홍보(위 막대 휴대폰: 인스타·블로그·**식자재 주문**(정가 · 시간·친밀도 없음) — 계산대엔 판매 장부·손님 수첩만)·벤치 쉬기·자판기·걷는 손님과 이야기·2장 미소 가구·상인회. 4시간을 쓰면 시계·하늘빛만 새벽 5시로(`G.town.part`). 가게 안 「가게 열기」나 집 「자고 가게 열기」로 아무 때나 → 남긴 시간은 쉼(피로 −1)) → 「가게 열기」에서 오늘의 메뉴 칸을 확인하고 영업. 우리 가게 안(문으로 걸어 들어감, 조이스틱)에서 냉장고·칠판·계산대(판매 장부·손님 수첩·손님층)·퇴식대. 사람 앞에 서면 머리 위 「대화하기」 버튼. 전화(오 사장님·포장 손님)는 폰이 울리고 「받기」를 눌러야 대화(ui/phone.js — 시험 스크립트는 `[data-ring]`을 눌러요). 마을 수치는 `data/town.js`, 규칙 `sim/town.js`, 화면 `ui/town.js`(위에서 본 골목 지도, 상하좌우로 걸어 다님 · 그리기 `render/town.js`). 재료는 원재료 낱개·재료마다 유통기한(`data/menu.js` INGREDIENTS·recipe, 창고 계산은 `sim/pantry.js`), 원가는 늘 `sim/market.js` `costOf`.
- **게임 안 글**: 사실은 합니다체, 해요체는 「~해 보세요」 같은 제안에만. 손님 말·리뷰는 손님 말투 그대로. (코드 주석은 해요체)
- **「게임이 먼저」**: 나이스비즈맵은 게임 도구로 녹여요. 광고처럼 보이는 문구·강제 이동을 넣지 않아요.

## 그림·글꼴 라이선스
- 그림: LimeZu **Modern Interiors · Modern Exteriors** (구매, 크레딧 표기 필수, 원본 재배포 금지). 크레딧은 **엔딩 크레딧**(`js/data/credits.js`)에 — 엔딩이 생기기 전까지는 처음 화면 「크레딧」 버튼으로 같은 화면을 보여 줘요. 이 둘은 지우지 않아요. 원본 zip·PNG는 **절대 커밋하지 않아요** — `art_pack.py`가 쓰는 그림만 잘라 만든 `atlas.js`만 올려요. 원본 zip 경로는 `python3 dev/art_pack.py <Interiors zip> <Exteriors zip>` 인자나 환경 변수로 줘요(파일 맨 위 설명).
- 직접 그린 그림(떡볶이·김밥·튀김·계산대·얼굴 아이콘 …)은 `art_pack.py` 안에 있어요. 재래시장 간판(`mk_s_`)은 게임 글꼴(`font.css`의 woff2)로 써요 — `art_pack.py`에 `fontTools` + `brotli`가 필요해요(`pip install --break-system-packages brotli`).
- LimeZu 실내 그림의 그림자는 `art_pack.py`가 「그림자 없는 판(Shadowless)」과 비교해 **검정 12%**로 바꿔요(v0.71 사용자 요청). 바닥은 블록 대신 깨끗한 한 칸을 이어 붙여요(`floor48`). 미소 가구 주방(조리대 `kc_`·주방 바닥 `kf_`·화구 `stove_`·튀김기 `fryer_`)은 `kitchen_sprites()`.
- **사용자가 직접 그린 그림**(v0.95~): `dev/art_src/ings/<재료>.png`(16×16 — 지금 파 `scallion`·떡 `ddeok`·오뎅 `fishcake`)이 있으면 `art_pack.py`가 그 재료 그림(`ing_…`)을 바꿔 써요. Aseprite 묶음은 `python3 dev/ase_pack.py` → `dev/art_src/ings/ingredients.aseprite`(프레임 하나에 재료 하나, 태그 = 재료 이름 · 새 재료는 `NAMES`에 더하기).
- 글꼴: Neo둥근모 Pro (SIL OFL 1.1, `dev/art_src/fonts/neodgm-pro-OFL.txt`). 
- 음악: `python3 dev/audio_pack.py <원본>` → `dev/src/js/audio/music.js` (손으로 안 고쳐요, 원본 wav는 커밋하지 않아요). 지금 곡은 lolurio 「Everyday Life」(CC BY 4.0) = 오 사장님 테마 — 크레딧(`js/data/credits.js`)에서 지우지 않아요. 재생은 `ui/music.js`의 `setMusic('이름')`.

## 확인과 보고
- 고친 뒤: `python3 dev/build.py && python3 dev/qa/smoke.py` (봇이 연출·대화를 넘기며 9일차까지 돌리고 이야기·도구·새벽·돌발·주간 정산·다시 열기까지 확인, 약 3분, 사진은 `dev/qa/out/`). 저장·클라우드를 고쳤으면 `python3 dev/qa/cloud.py`(가짜 클라우드로 로그인·저절로 이어하기·영업 중 기다리기·백업 확인, 약 1분)도. 그다음 `python3 dev/build_web.py`.
- 올리기: main에 바로 커밋·푸시하고 플레이 링크(아티팩트)도 바로 갱신. 올릴 때마다 버전 하나 — `js/data/version.js`와 프로젝트 문서 「plans/00-소상공인키우기-버전기록.md」를 같이 올려요.
- 개발자 모드(숨김): 처음 화면 → 설정 → 맨 아래 버전 글자를 7번 누르면 열려요. 원하는 날로 바로 가기 (`js/sim/dev.js` DEV_JUMPS — 새 장·새 기능을 만들면 가 볼 곳을 더해요).
- 사용자에게는 한국어로 짧게: 무엇이 바뀌었는지, 확인한 것, 남은 것.

## 플레이 기록 (GA4 → BigQuery)
- 게임 쪽: `ui/analytics.js` (측정 ID `G-L04Y1ZQLTN`, github.io 주소에서만 · 설정 「플레이 기록」으로 끔). 규칙 코드는 `emit('track', 이름, {...})`만 해요. 모든 기록에 `day`·`ch`·`cash`(천 원)가 붙어요.
- 기록 이름: `phase` · `leave`(앱을 닫은 지점) · `day_open` · `day_close`(revenue·net·served·missed·rating·reviews) · `weekly` · `quest` · `scene` · `chapter` · `menu_dev` · `menu_up` · `furn_buy` · `slot_buy` · `town_act` · `town_use` · `town_meet` · `explore`(동네 탐방: area(market·apt·office)·got·lost·did·sp·fainted) · `move_look`(임대 매물 살펴봄: area) · `rival_open`(3장 공장 개업) · `note_open`(손님층 수첩 칸이 열림: type·key) · `menu_find`(칠판에서 메뉴 변형을 찾음: menu) · `market_buy` · `rush_buy` · `equip_up` · `tool_up` · `incident`(id·ok). 새 기능을 만들면 여기와 같이 더해요.
- BigQuery: Google Cloud 프로젝트 `sosang-tycoon`, 위치 서울(`asia-northeast3`), 매일 내보내기(하루 늦게 들어옴 · 무료 샌드박스라 60일 지나면 지워짐). 표는 `events_YYYYMMDD`, 값은 `event_params`(key / value.int_value·string_value…).
- 읽기 키(서비스 계정 JSON, BigQuery 데이터 뷰어 + 작업 사용자)는 **저장소에 절대 올리지 않아요** (공개 저장소). claude.ai 프로젝트 문서 `claude/bigquery-key.json`에 있어요 → `Projects project_read`로 꺼내 작업 공간에만 두고 써요. 서비스 계정 `claude-reader@sosang-tycoon.iam.gserviceaccount.com`(BigQuery 데이터 뷰어 + BigQuery 사용자).
- 조회: `python3 dev/qa/bq.py --ls` / `python3 dev/qa/bq.py "SELECT …"` (키는 `/root/.sosang/bq-key.json` 또는 환경 변수 `BQ_KEY`, `pip install --break-system-packages google-auth requests`). `bq` 명령줄 도구는 프록시에서 인증이 안 돼요.
- 작업 공간에서 닿으려면 claude.ai 설정 → 기능(Capabilities)의 허용 도메인에 `oauth2.googleapis.com`·`bigquery.googleapis.com`이 있어야 해요 (없으면 프록시가 403).

## 나중에 (프로토타입 확인 뒤)
- 비교 테스트·기능별 테스트 묶음, 자동 배포 워크플로, 게임 현황 문서(`dev/design/`), 기획 결정 기록.
