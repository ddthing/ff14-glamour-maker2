# 투영세트메이커2

FFXIV 캐릭터 스크린샷을 룩북 카드로 편집하는 로컬 웹앱 프로토타입입니다.

## 실행

배경 제거는 프로젝트의 `.venv-bg` Python 환경과 BiRefNet 모델을 사용합니다. 처음 한 번만 환경을 준비합니다.

```powershell
py -3.12 -m venv .venv-bg
.\.venv-bg\Scripts\python.exe -m pip install -r requirements-background.txt
```

그 다음 Node 로컬 서버를 실행하세요.

```bash
node server.js
```

그 다음 <http://localhost:4173>을 엽니다.

검사 환경은 Node 20 이상과 설치된 Microsoft Edge를 사용합니다. `npm ci`로 잠금 파일의 개발 의존성을 설치한 뒤, 서버가 실행된 상태에서 `npm test`를 실행합니다. 결과는 `artifacts/check-results.json`에 기록됩니다. 기존 환경의 Playwright를 사용할 때는 `PLAYWRIGHT_MODULE`을 지정할 수 있습니다.

`npm run build`는 공개 파일만 담은 새 `.runtime/site-*` 디렉터리를 만들고 참조 파일을 확인합니다. Git 연동 Cloudflare Pages 배포에는 `npm run build:pages`를 사용하며, 고정된 `dist/` 디렉터리를 출력합니다. 두 배포 경로 모두 개발 서버·테스트·모델 가중치는 포함하지 않습니다. `models/`에는 카드 상태·룩 복제·브라우저 이미지 저장·아이템 검색·PNG 그리기·키보드 내비게이션·배경 프리셋·제목 서체 규칙과 브라우저 배경제거 어댑터가 들어가며, 실제 가중치는 첫 사용 때 외부 모델 저장소에서 내려받습니다.

## 포함된 상호작용

- 이미지 업로드 및 캔버스 드래그 앤 드롭
- 1~5인 캐릭터 슬롯 선택과 인원수별 자동 카드 재배치
- 1인 텍스트 장비 레일 / 2인 균형형 레일 / 3~5인 중앙 라인업
- 새 LOOK BOOK와 빈 카드에서 사용자 이미지를 직접 추가
- 원본 사진 스트립과 배경 제거 라인업을 캐릭터별로 혼합
- BiRefNet 기반 로컬 배경 제거(이 저장소의 Node 서버 실행 시 원본 해상도 RGBA 유지)
- 제목 글리프 외곽선(0–6px)·이미지 외곽선·그림자·배경 스타일 조절
- LOOK BOOK 추가·전환·이름 변경·복제·개별 삭제/삭제 취소·전체 저장(localStorage 설정 + IndexedDB 이미지 보관함). 관리 버튼에서 이름을 바꾸면 카드 제목에도 반영됩니다. 복제본은 독립된 이미지 저장 항목을 가지며, 삭제 취소는 새로고침 전까지만 가능합니다.
- 의상 슬롯 선택과 실제 검색 결과 연결
- 캐릭터별 5슬롯 의상 정보 연결과 자동 카드 반영
- 장비 부위는 이미지 크롭 없이 텍스트 정보로 표시하며, 한국어·일본어에서는 영어명을 보조 표기
- KR / EN / JP 아이템명 전환
- 페이지 전체 UI·상태 메시지·접근성 라벨·문서 메타데이터의 한국어·영어·일본어 전환. 첫 방문에는 브라우저 언어와 접속 지역/시간대를 참고하고, 사용자가 고른 언어는 이 브라우저에 저장합니다.
- 원본 이미지는 자동 크롭하지 않고 프레임 안에 보존하며, 배경 제거는 선택 기능
- 선택한 비율에 맞춘 고화질 PNG 내보내기(세로 2160 × 2700 / 가로 2400 × 1350)

시각 디자인과 편집기 정보 위계는 [DESIGN.md](DESIGN.md)에 기록합니다. Neutral 토큰, Pretendard UI, 인원수별 카드 비율, 텍스트 전용 장비 정보와 전신 이미지의 역할 분리, 그리고 편집기 주변에 노출할 최소 정보가 이 문서를 기준으로 유지됩니다.

아이템 검색은 `/api/items/search` 서버 어댑터를 사용합니다. 한국어 검색은 한국 클라이언트 데이터셋에서, 영문·일문 검색은 XIVAPI에서 가져오며, 브라우저는 검색어·슬롯·언어만 전달합니다. 280ms debounce와 서버 메모리 캐시를 적용해 매 키 입력마다 외부 소스를 직접 호출하지 않습니다. 한국어 원본 snapshot은 패치별로 교체할 수 있고, Pages 빌드에서는 장비 부위별 정적 인덱스로 나뉘어 현재 슬롯에 필요한 데이터만 처음 불러옵니다.

Cloudflare Pages 배포 전에는 한국어 인덱스를 한 번 생성합니다. 네트워크가 끊겼거나 레코드가 0개인 경우 빌드를 실패시키므로 임의 데이터가 운영 데이터로 들어가지 않습니다. 운영 첫 화면은 빈 LOOK BOOK로 시작하며 이미지·장비·프리셋은 사용자가 추가한 뒤에만 저장됩니다.

```powershell
node scripts/build_item_index.mjs
npm run build:pages
```

이미지 픽셀만으로 장비 아이템을 확정하는 기능은 포함하지 않습니다. 사용자가 검색 결과를 선택하거나 itemId를 제공하면 슬롯, 다국어 이름, 카드 정보가 자동으로 채워지는 흐름을 기준으로 합니다.

로컬 서버의 배경 제거 모델(약 973MB)은 처음 사용할 때 내려받고 한 번 로드한 뒤 이후 요청에서 재사용됩니다. 원본은 별도로 유지되므로 같은 버튼으로 언제든 복원할 수 있습니다. 배경 제거 후보 비교는 저장소에 사용자 이미지를 포함하지 않도록 외부 입력 경로를 받는 벤치마크 도구로만 수행합니다.

## Cloudflare 배포 메모

현재 `server.js`는 정적 파일, 아이템 검색 프록시, Python BiRefNet 워커를 한 프로세스로 실행하는 로컬 구성입니다. Cloudflare Pages에서는 `functions/api/items/search.js`가 같은 `/api/items/search` 계약을 담당하고, `build-site.cjs`가 `assets/data/items-ko.json` 원본 snapshot을 `assets/data/items-ko-{slot}.json` 부위별 정적 인덱스로 분할해 배포합니다. 검색 요청은 활성 슬롯 인덱스만 읽고, 전체 snapshot은 Pages 산출물에 포함하지 않습니다. `XIVAPI_VERSION` 환경 변수를 설정하면 글로벌 데이터 버전을 고정할 수 있습니다.

Cloudflare Pages 정적 배포에서는 Python BiRefNet 워커를 실행할 수 없으므로, 공개 사이트는 브라우저 추론을 기본 경로로 사용합니다. `models/background-removal.js`가 Transformers.js와 `jiabins0303/birefnet-lite-1024-webgpu`를 불러와 WebGPU에서 가장 높은 품질의 1024px BiRefNet을 실행합니다. WebGPU를 사용할 수 없거나 모델 로드가 실패하면 512px WebGPU, 마지막으로 512px WASM으로 자동 전환합니다.

`functions/api/background-removal.js`는 선택적인 빠른 경로입니다. Pages 환경의 `CUTOUT_SERVICE_URL`에 HTTPS GPU 엔드포인트와 `CUTOUT_SERVICE_TOKEN` Secret을 설정하면 서버 결과를 먼저 사용하고, 설정하지 않거나 연결할 수 없으면 브라우저 모델로 계속 처리합니다. 따라서 무료 Pages 배포에는 GPU 서버가 필요하지 않습니다. 자세한 계약은 [Cloudflare 배포 메모](docs/cloudflare-deployment.md)를 확인하세요.

브라우저 경로는 Hugging Face CDN에서 모델 가중치를 첫 사용 때 내려받으므로 기기와 선택된 폴백에 따라 100MB 이상을 준비할 수 있습니다. 이미지 바이트는 GPU 서버를 설정하지 않은 경우 브라우저 밖으로 전송하지 않습니다. 자동 검사는 모듈 공개 경로와 서버 장애 시 폴백 연결을 확인하며, 실제 모델 추론 품질·지연 시간은 사용하는 브라우저와 FF14 이미지 골든셋에서 별도로 확인해야 합니다.

`scripts/background_service.py`는 해당 계약을 검증할 수 있는 최소 GPU 서비스입니다. `onnxruntime-gpu`의 CUDA provider가 활성화되지 않으면 시작을 거부하므로 CPU로 조용히 폴백하지 않습니다. 실제 운영에서는 이 서비스를 GPU 공급자의 관리형 HTTPS 런타임에 배포합니다.

UI 제어는 shadcn/ui의 개방형 컴포넌트 원칙을 참고해 탭, 단일 선택 그룹, 검색 명령, 상태 피드백의 구조와 키보드 접근성을 적용했습니다. 현재 앱은 정적 HTML 프로토타입이므로 React 컴포넌트 패키지를 직접 의존하지 않습니다.
