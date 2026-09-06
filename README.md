# Glamour Atelier

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

`npm run build`는 공개 파일만 담은 새 `.runtime/site-*` 디렉터리를 만들고 참조 파일을 확인합니다. 출력 경로가 배포 대상이며 개발 서버·테스트·모델 가중치는 포함하지 않습니다. `models/`는 카드 상태·룩 복제·브라우저 이미지 저장·아이템 검색·PNG 그리기·키보드 내비게이션·배경 프리셋·제목 서체 규칙 모듈이며 머신러닝 모델이 아닙니다.

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
- 원본 이미지는 자동 크롭하지 않고 프레임 안에 보존하며, 배경 제거는 선택 기능
- 선택한 비율에 맞춘 고화질 PNG 내보내기(세로 2160 × 2700 / 가로 2400 × 1350)

시각 디자인과 편집기 정보 위계는 [DESIGN.md](DESIGN.md)에 기록합니다. Neutral 토큰, Pretendard UI, 인원수별 카드 비율, 텍스트 전용 장비 정보와 전신 이미지의 역할 분리, 그리고 편집기 주변에 노출할 최소 정보가 이 문서를 기준으로 유지됩니다.

아이템 검색은 `/api/items/search` 서버 어댑터를 사용합니다. 한국어 검색은 한국 클라이언트 데이터셋에서, 영문·일문 검색은 XIVAPI에서 가져오며, 브라우저는 검색어·슬롯·언어만 전달합니다. 280ms debounce와 서버 메모리 캐시를 적용해 매 키 입력마다 외부 소스를 직접 호출하지 않습니다. 한국어 데이터셋은 패치별 정적 인덱스로 교체할 수 있도록 분리되어 있습니다.

Cloudflare Pages 배포 전에는 한국어 인덱스를 한 번 생성합니다. 네트워크가 끊겼거나 레코드가 0개인 경우 빌드를 실패시키므로 임의 데이터가 운영 데이터로 들어가지 않습니다. 운영 첫 화면은 빈 LOOK BOOK로 시작하며 이미지·장비·프리셋은 사용자가 추가한 뒤에만 저장됩니다.

```powershell
node scripts/build_item_index.mjs
```

이미지 픽셀만으로 장비 아이템을 확정하는 기능은 포함하지 않습니다. 사용자가 검색 결과를 선택하거나 itemId를 제공하면 슬롯, 다국어 이름, 카드 정보가 자동으로 채워지는 흐름을 기준으로 합니다.

배경 제거 모델(약 973MB)은 처음 사용할 때 내려받고 한 번 로드한 뒤 이후 요청에서 재사용됩니다. 원본은 별도로 유지되므로 같은 버튼으로 언제든 복원할 수 있습니다. 배경 제거 후보 비교는 저장소에 사용자 이미지를 포함하지 않도록 외부 입력 경로를 받는 벤치마크 도구로만 수행합니다.

## Cloudflare 배포 메모

현재 `server.js`는 정적 파일, 아이템 검색 프록시, Python BiRefNet 워커를 한 프로세스로 실행하는 로컬 구성입니다. Cloudflare Pages에서는 `functions/api/items/search.js`가 같은 `/api/items/search` 계약을 담당하고, `assets/data/items-ko.json`을 정적 한국어 인덱스로 사용합니다. `XIVAPI_VERSION` 환경 변수를 설정하면 글로벌 데이터 버전을 고정할 수 있습니다.

Cloudflare Pages 정적 배포만으로는 Python BiRefNet 워커를 실행할 수 없습니다. 배경 제거는 별도 Python/GPU 실행 환경을 `/api/background-removal` 계약 뒤에 연결하거나, 공개 배포에서 해당 기능을 비활성화해야 합니다. 이 분리를 마치기 전에는 Cloudflare 배포를 완료된 것으로 간주하지 않습니다.

공개 배포에서는 `functions/api/background-removal.js`가 별도 GPU 추론 서버로 이미지를 전달합니다. Pages 환경의 `CUTOUT_SERVICE_URL`에는 HTTPS GPU 엔드포인트를, 인증을 사용할 때는 `CUTOUT_SERVICE_TOKEN`을 Secret으로 설정합니다. GPU 서버가 연결되지 않으면 임의 결과를 만들지 않고 사용자에게 재시도를 안내합니다. 자세한 계약은 [Cloudflare 배포 메모](docs/cloudflare-deployment.md)를 확인하세요.

`scripts/background_service.py`는 해당 계약을 검증할 수 있는 최소 GPU 서비스입니다. `onnxruntime-gpu`의 CUDA provider가 활성화되지 않으면 시작을 거부하므로 CPU로 조용히 폴백하지 않습니다. 실제 운영에서는 이 서비스를 GPU 공급자의 관리형 HTTPS 런타임에 배포합니다.

UI 제어는 shadcn/ui의 개방형 컴포넌트 원칙을 참고해 탭, 단일 선택 그룹, 검색 명령, 상태 피드백의 구조와 키보드 접근성을 적용했습니다. 현재 앱은 정적 HTML 프로토타입이므로 React 컴포넌트 패키지를 직접 의존하지 않습니다.
