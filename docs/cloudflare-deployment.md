# Cloudflare 배포 메모

## 현재 구조

투영세트메이커2는 정적 HTML, CSS, JavaScript와 `assets/` 파일만으로 화면을 구성합니다. 따라서 Cloudflare Pages에 정적 파일로 배포할 수 있습니다. 현재의 `server.js`와 `.venv-bg` Python 환경은 로컬 개발용이며 배포 파일에 포함하지 않습니다.

아이템 검색은 Pages Function으로 분리했습니다.

- `functions/api/items/search.js`: `/api/items/search` same-origin 검색 어댑터
- `functions/api/background-removal.js`: `/api/background-removal` GPU 추론 프록시
- `functions/_shared/item-search.mjs`: 한국어 인덱스/XIVAPI 정규화와 검색 점수화
- `assets/data/items-ko.json`: 배포 전에 `node scripts/build_item_index.mjs`로 생성하는 한국어 snapshot

Pages Function은 `env.ASSETS.fetch()`로 정적 인덱스를 읽고, 영문·일문만 XIVAPI에 서버 측 요청합니다. 브라우저에 외부 API 주소나 비밀값을 노출하지 않으며, 빈 인덱스나 외부 오류를 임의 샘플로 대체하지 않습니다.

배경 제거는 `CUTOUT_SERVICE_URL`로 지정한 별도 GPU 서버에 원본 이미지를 전달하고, `CUTOUT_SERVICE_TOKEN`이 있으면 Bearer 인증을 붙입니다. GPU 서버는 원본 이미지 바이트를 받아 `image/png` 또는 다른 `image/*` 결과를 반환해야 합니다. Pages Function은 16MB를 넘는 업로드를 거부하고, 결과를 저장하지 않으며, 서버 주소가 비어 있으면 임의 결과 대신 503 상태를 반환합니다.

## 배포 전 확인

배포 폴더에는 아래 항목만 넣습니다.

```text
index.html
styles.css
styles/
models/
app.js
assets/
functions/
```

배포 준비 순서는 다음과 같습니다.

```powershell
node scripts/build_item_index.mjs
npx wrangler pages dev .
```

프록시 계약의 로컬 단위 테스트는 외부 GPU 서버를 호출하지 않습니다.

```powershell
node scripts/test-cloudflare-functions.mjs
```

`wrangler pages dev`는 정적 자산과 Pages Functions를 함께 로컬에서 실행하는 공식 개발 경로입니다. 실제 배포에서는 Git integration 또는 Direct Upload 중 하나를 선택하고, 두 방식을 나중에 서로 전환할 수 없다는 점을 먼저 확인합니다.

빌드 도구가 없는 프로토타입이므로 Build command는 비워두고, 위 파일이 들어 있는 폴더를 출력 디렉터리로 사용합니다. Cloudflare Pages는 정적 HTML 사이트를 지원합니다.

## 배경 제거 실행 경로

로컬 Node 서버의 `POST /api/background-removal`은 Python BiRefNet 프로세스를 호출합니다. Cloudflare Pages에서는 Python 프로세스를 실행할 수 없으므로 `app.js`가 같은 API를 먼저 시도한 뒤, GPU 서버가 설정되지 않았거나 사용할 수 없으면 브라우저 추론으로 자동 전환합니다.

브라우저 경로는 `models/background-removal.js`에 포함되어 있습니다.

1. WebGPU가 있으면 `jiabins0303/birefnet-lite-1024-webgpu`를 사용합니다. 1024px 입력 모델을 우선하므로 인물 가장자리와 헤어 디테일을 보존하는 기본 경로입니다.
2. 1024px 모델을 로드하거나 실행할 수 없으면 `studioludens/birefnet-lite-512`를 WebGPU로 시도합니다.
3. WebGPU가 없는 브라우저에서는 같은 512px 모델을 WASM으로 실행합니다.
4. 모델 가중치는 첫 사용 때 브라우저 캐시에 저장되고, 실제 모델 추론은 브라우저에서 수행됩니다. GPU 서버를 설정하지 않은 현재 Function은 이미지를 저장하지 않고 즉시 브라우저 fallback 응답을 냅니다. 첫 실행은 모델 가중치 다운로드로 100MB 이상 걸릴 수 있으며, 자동 QA는 모델 다운로드 자체를 수행하지 않습니다.

따라서 무료 Pages 배포에는 GPU 서버가 필요하지 않습니다. 별도 GPU 서버를 연결하면 API 결과를 먼저 사용해 대기 시간을 줄일 수 있지만, 서버가 없거나 장애가 나도 브라우저 fallback이 기능을 유지합니다.

## 선택적 GPU 서버 계약

GPU 서버를 연결하는 경우 Pages Function 환경 변수에 `CUTOUT_SERVICE_URL`을 저장하고, 인증을 쓰면 `CUTOUT_SERVICE_TOKEN`을 Secret으로 저장합니다. GPU 서버 장애·대기·시간 초과는 브라우저 fallback으로 이어집니다.

### GPU 서버 계약

```text
POST {CUTOUT_SERVICE_URL}
Content-Type: image/png | image/jpeg | image/webp
Accept: image/png
Authorization: Bearer {CUTOUT_SERVICE_TOKEN}  # 선택

응답: 200 image/png (RGBA)
오류: 4xx/5xx JSON 또는 텍스트
```

서비스는 `https` 주소를 사용해야 합니다. 로컬 `wrangler pages dev` 테스트에서만 `localhost`, `127.0.0.1`, `::1`의 `http` 주소를 허용합니다.

저장소에는 계약을 확인할 수 있는 최소 GPU 서비스 예시인 `scripts/background_service.py`도 포함합니다. 이 서비스는 `onnxruntime-gpu`의 `CUDAExecutionProvider`가 실제로 활성화되지 않으면 시작하지 않으며, CPU로 조용히 전환하지 않습니다. GPU 환경에서 다음처럼 실행할 수 있습니다.

```powershell
python -m venv .venv-background-gpu
.\.venv-background-gpu\Scripts\python.exe -m pip install -r requirements-background-gpu.txt
$env:CUTOUT_SERVICE_TOKEN = "긴-랜덤-토큰"
.\.venv-background-gpu\Scripts\python.exe scripts/background_service.py
```

운영에서는 GPU 공급자의 TLS·방화벽·헬스체크를 설정하고 `/health`가 `CUDAExecutionProvider`를 보고하는지 확인합니다. ONNX Runtime 공식 문서의 CUDA/cuDNN 호환성 조건이 맞지 않으면 서비스가 시작하지 않도록 한 이유는, GPU가 없는 상태에서 CPU로 몰래 실행되어 속도와 비용이 예측 불가능해지는 것을 막기 위해서입니다.

정적 카드 편집, IndexedDB 이미지 보관, PNG 내보내기는 브라우저에서 계속 동작합니다. 배경 제거 엔드포인트는 나중에 교체할 수 있도록 현재 호출 경로를 유지합니다.

## Pages 선택지

- GitHub 저장소를 연결하는 Git integration: 브랜치 push마다 Preview와 Production 배포를 만들 수 있습니다.
- 로컬 산출물을 올리는 Direct Upload: Wrangler 또는 대시보드 업로드를 사용합니다.

Pages 프로젝트를 처음 만들 때 두 방식을 신중하게 고릅니다. Cloudflare 문서상 Git integration으로 만든 Pages 프로젝트와 Direct Upload 프로젝트는 나중에 서로 전환할 수 없습니다.

참고 문서:

- [Cloudflare Pages 정적 HTML 배포](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
