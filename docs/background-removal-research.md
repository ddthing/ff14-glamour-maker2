# FF14 룩북 배경 제거 파이프라인 조사

> 기준일: 2026-09-04  
> 대상 환경: Windows, RTX 4060 Ti 8GB, Node 기반 정적 웹앱  
> 조사 범위: 공식 저장소·공식 모델 카드·공식 API 문서만 사용

## 결론

가장 적합한 제품 구조는 **로컬 Python GPU 사이드카의 BiRefNet HR-matting을 기본 자동 제거기로 사용하고, SAM 2.1 Small을 클릭/박스 교정기로 붙인 뒤, 원본 해상도에서 알파 마스크를 적용하는 하이브리드 파이프라인**이다.

```text
브라우저 UI
  → localhost 작업 큐(Node 또는 Python HTTP/stdio bridge)
  → BiRefNet_HR-matting FP16, 2048px 마스크 생성
  → SAM 2.1 Small: +/− 클릭·박스로 누락/오검출 교정
  → 가장자리 보정 + 수동 복원/지우기 브러시
  → 원본 2160×3840 RGB에 알파 적용 → PNG/WebP
```

BiRefNet HR은 2048×2048 투명도 매팅용으로 학습됐고 공식 가중치는 444MB/MIT이다. 공식 모델 카드의 두 매팅 검증셋에서 2048 입력 결과도 공개되어 있다. SAM 2.1 Small은 46M 파라미터, Apache-2.0이며 점·박스 기반 상호작용에 적합하다. 이 둘은 역할이 다르다. BiRefNet이 부드러운 초기 알파를 만들고 SAM 2는 FF14 특유의 큰 귀, 모자 장식, 꼬리, 무기처럼 빠진 영역을 사용자가 되살린다. [BiRefNet HR 모델 카드](https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting), [BiRefNet HR 파일 목록](https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting/tree/main), [SAM 2 공식 저장소](https://github.com/facebookresearch/sam2)

중요한 한계: 공개된 공식 벤치마크 중 FF14 같은 게임 렌더 캐릭터 전용 평가는 없다. 따라서 아래 순위의 화질 판단은 모델 목적·입력 해상도·알파 지원·운영 제약에 근거한 **제품 적합성 추론**이며, 출시 전 FF14 자체 골든셋 평가가 필요하다.

## 순위

| 순위 | 후보 | 권장 역할 | 판단 |
|---:|---|---|---|
| 1 | **BiRefNet HR-matting + SAM 2.1 Small** | 기본 자동 제거 + 대화형 교정 | 화질·알파·라이선스·8GB GPU 균형이 가장 좋음 |
| 2 | **InSPyReNet / transparent-background** | 자동 제거 A/B 후보 또는 폴백 | 고해상도 피라미드 처리와 RGBA 지원은 좋지만 구현·체크포인트가 오래되고 동적 리사이즈가 불안정할 수 있음 |
| 3 | **BEN2 Base** | 자동 제거 A/B 후보 | 4K·hair/edge refinement를 명시하지만 공개 Base와 상용 full model이 구분되고 비교 가능한 공식 수치가 부족함 |
| 4 | **PhotoRoom API / remove.bg API** | 선택형 클라우드 폴백 | 즉시 배포와 품질 비교에 유용하지만 비용·외부 전송·API 키용 서버가 필요함 |
| 5 | **@imgly/background-removal** | 저사양/무설치 브라우저 모드 | 통합은 가장 쉽지만 ISNet 1024 계열이고 AGPL이 폐쇄형 서비스에 부담 |
| 6 | **SAM 3/3.1 단독** | 현재는 채택하지 않음 | 텍스트 개념 선택은 강력하나 0.9B, gated weights, CUDA 12.6+, custom SAM License로 과도함; 매팅 전용 모델도 아님 |

## 후보별 평가

### 1. BiRefNet HR-matting

- **경계/해상도:** 공식 HR-matting 가중치는 2048×2048 이미지로 학습됐다. 모델 카드는 TE-AM-2k와 TE-P3M-500-NP에서 2048 FP16 평가를 공개한다. 머리카락/털처럼 연속 알파가 필요한 작업에 가장 직접적으로 맞는다.
- **크기/실행:** safetensors 444MB. PyTorch/Transformers 경로가 공식 제공된다. 8GB GPU에서는 batch 1 FP16과 단일 작업 큐를 권장한다. 공식 저장소의 ONNX 속도는 기본 1024 BiRefNet 기준 A100 약 165ms이므로, 이를 4060 Ti 또는 HR 모델 속도로 오인하면 안 된다.
- **통합:** 정적 브라우저에 직접 넣기보다 로컬 Python 프로세스로 격리한다. 최초 마스크만 2048 장변/정사각 letterbox로 추론하고 원본 크기로 업샘플하여 원본 RGB에 적용한다.
- **개인정보/라이선스:** 완전 로컬. 모델 카드 MIT. `trust_remote_code=True` 대신 공식 저장소 코드를 버전 고정해 vendoring/해시 검증하는 편이 제품 운영에 안전하다.
- **주의:** 사람 매팅 학습셋 비중이 높아 게임 캐릭터의 무기·꼬리·투명 장식은 누락될 수 있다. 이 때문에 SAM/브러시 교정이 필요하다.

출처: [공식 모델 카드](https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting), [공식 파일 목록](https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting/tree/main), [공식 저장소 ONNX 메모](https://github.com/ZhengPeng7/BiRefNet#onnx)

### 2. InSPyReNet / transparent-background

- **경계/해상도:** 원 논문 구현은 LR/HR 이미지 피라미드를 혼합하는 고해상도 salient-object detection 모델이다. 배포 패키지는 RGBA 알파 출력과 foreground estimation을 지원한다.
- **크기/실행:** 공식 Hugging Face 미러의 base/fast/nightly 체크포인트는 각각 368MB이다. 배포 패키지 기본 base 입력은 1024×1024, fast는 384×384다. `static` 리사이즈는 안정적이지만 세부가 적고, `dynamic`은 더 선명하나 불안정할 수 있다고 공식 문서가 명시한다. JIT는 초기화 비용 대신 추론 시간·GPU 메모리를 줄인다. Windows용 CUDA 11.8/12.8 설치 경로와 CPU 설치 경로가 있다.
- **통합:** Python 사이드카로 비교적 간단하다. 단, 릴리스의 자동 체크포인트 다운로드와 사용자 홈 설정에 의존하지 말고 앱 전용 모델 디렉터리와 체크섬을 고정해야 한다.
- **개인정보/라이선스:** 완전 로컬, 코드/모델 카드 MIT.
- **판단:** FF14 골든셋에서 BiRefNet보다 장식 보존율이 높으면 폴백 엔진으로 유지할 가치가 있다. 다만 패키지의 작은 이미지 문제 및 static/dynamic 안정성 공지가 있어 기본 엔진으로 즉시 확정하기는 어렵다.

출처: [InSPyReNet 공식 저장소](https://github.com/plemeri/InSPyReNet), [transparent-background 공식 저장소](https://github.com/plemeri/transparent-background), [공식 체크포인트 목록](https://huggingface.co/plemeri/InSPyReNet/tree/main)

### 3. BEN2 Base

- **경계/해상도:** Confidence Guided Matting refiner로 낮은 신뢰도 픽셀을 재처리한다. 공식 카드는 hair matting, 4K processing, object segmentation, edge refinement 향상을 주장하며 `refine_foreground` 옵션을 제공한다.
- **크기/실행:** 94.6M 파라미터. 공식 파일은 safetensors 381MB, ONNX 223MB, PyTorch pickle 1.13GB다. 소비자 GPU는 batch 3 이하를 권장한다. 8GB에서는 batch 1이 안전하다.
- **라이선스 위험:** 공개 **Base** 모델/저장소는 MIT지만, 제작사는 별도의 “enhanced/full commercial model” API를 판매한다. 문서에서 둘을 혼동해 공개 Base 결과를 상용 full model 품질로 간주하면 안 된다.
- **판단:** 공개 카드에 다른 후보와 직접 비교 가능한 충분한 수치가 없으므로 FF14 샘플 A/B 전에는 1순위로 올리지 않는다. 실험은 안전한 safetensors 또는 ONNX를 우선하고 pickle 가중치는 피한다.

출처: [BEN2 공식 모델 카드](https://huggingface.co/PramaLLC/BEN2), [공식 파일 목록](https://huggingface.co/PramaLLC/BEN2/tree/main), [공식 저장소](https://github.com/PramaLLC/BEN2)

### 4. SAM 2.1과 SAM 3/3.1

SAM은 알파 매팅 엔진이 아니라 **프롬프트 가능한 분할/교정 도구**로 봐야 한다.

- **SAM 2.1 Small:** 46M 파라미터. 공식 예제는 이미지 임베딩 후 점·박스 프롬프트로 마스크를 갱신한다. Apache-2.0. Windows에서는 WSL2 Ubuntu를 강하게 권장하지만 CUDA 확장을 빌드하지 않아도 대부분 기능은 실행된다. 정적 이미지 교정에는 Large(224.4M)보다 Small이 8GB와 반응성에 유리하다. 공식 FPS는 A100 비디오 벤치마크이므로 로컬 UI 지연시간으로 환산하지 않는다.
- **SAM 3/3.1:** 텍스트·점·박스·마스크 및 open-vocabulary concept segmentation을 지원한다. 그러나 공식 모델은 0.9B 파라미터, 체크포인트 접근 승인 필요, Python 3.12+/PyTorch 2.7+/CUDA 12.6+가 전제이며 별도 SAM License다. 8GB 로컬 편집기의 단일 캐릭터 클릭 교정에는 기능·운영비 모두 과하다. SAM 3.1의 7배 속도 향상은 H100에서 128개 객체를 추적한 결과로, 본 앱의 정적 이미지 1개에는 직접적인 근거가 아니다.
- **알파 한계:** 두 모델 모두 경계의 소프트 알파를 전용 매팅 모델처럼 생성하는 것이 목적이 아니다. 교정 결과는 BiRefNet 알파를 완전히 덮기보다 SAM의 이진 포함/제외 영역을 trimap 제약으로 사용해야 한다.

출처: [SAM 2 공식 저장소와 모델 표](https://github.com/facebookresearch/sam2#model-description), [SAM 2 설치 문서](https://github.com/facebookresearch/sam2/blob/main/INSTALL.md), [SAM 3 공식 저장소](https://github.com/facebookresearch/sam3), [SAM 3 모델 카드](https://huggingface.co/facebook/sam3), [SAM 3 라이선스](https://github.com/facebookresearch/sam3/blob/main/LICENSE), [SAM 3.1 릴리스](https://github.com/facebookresearch/sam3/blob/main/RELEASE_SAM3p1.md)

### 5. @imgly/background-removal

- **통합성:** 브라우저 및 Node 패키지를 제공하고 ONNX Runtime Web을 사용한다. 정적 앱에 가장 직접적으로 붙일 수 있으며 브라우저에서 처리하면 이미지가 외부 서버로 나가지 않는다.
- **크기/실행:** ISNet 모델은 공식 번들 기준 FP32 168MB, FP16 84.1MB, quantized 42.3MB. web 설정은 CPU/GPU를 선택하고, cross-origin isolation이 없으면 성능 저하를 경고한다. 즉 현재 단순 정적 서버에는 COOP/COEP 헤더가 사실상 필요하다.
- **품질:** 고해상도 매팅 전용 모델이 아니라 ISNet 계열을 리스케일해 처리하므로 2160×3840 FF14 장식/털의 최종 품질 엔진보다는 빠른 미리보기나 CPU 폴백에 적합하다.
- **라이선스:** AGPL-3.0. 네트워크로 제공되는 수정 버전의 소스 제공 의무를 포함하므로 폐쇄형 제품 계획이면 법률 검토 또는 IMG.LY 상용 라이선스가 필요하다.

출처: [공식 저장소](https://github.com/imgly/background-removal-js), [공식 web 설정](https://github.com/imgly/background-removal-js/blob/main/packages/web/src/schema.ts), [공식 모델 파일](https://github.com/imgly/background-removal-js/tree/main/bundle/models), [AGPL 라이선스](https://github.com/imgly/background-removal-js/blob/main/LICENSE.md)

### 6. 클라우드 API

| 서비스 | 공식 제한/비용 정보 | 개인정보 | 판단 |
|---|---|---|---|
| **PhotoRoom** | Remove Background Basic은 $0.02/call, full 최대 36MP; 첫 10회 production 무료 | sync 이미지는 응답 후 폐기. 다만 self-serve의 학습 기본값 설명은 공식 페이지 간 표현 차이가 있으므로 계정의 opt-out과 계약을 확인해야 함 | 가장 유용한 품질 기준선 및 선택형 폴백 |
| **remove.bg** | 입력 50MP/22MB; 투명 PNG 10MP, WebP/ZIP 50MP; 고해상도 1 credit | API 이미지는 처리 직후 삭제한다고 명시 | 2160×3840(약 8.3MP) PNG를 원해상도로 받을 수 있는 비교 기준선. 2026-12-01 Leonardo.Ai 이전 공지가 있어 장기 결합 위험 |
| **Clipdrop** | 공식 페이지가 고해상도 제거와 usage-based API를 제공 | 로컬 처리 아님; 계약·보존 조건 별도 확인 필요 | 공개 문서의 구체성이 위 두 서비스보다 낮아 우선순위 낮음 |

정적 프런트엔드에서 API 키를 직접 보관하면 안 된다. 클라우드를 선택하면 최소한 localhost/호스팅 서버 프록시에서 키를 보관하고, 사용자가 “클라우드로 전송”을 명시적으로 선택하도록 해야 한다.

출처: [PhotoRoom API 규격](https://docs.photoroom.com/api-reference-openapi), [PhotoRoom 가격](https://www.photoroom.com/api/pricing), [PhotoRoom 보안·보존](https://www.photoroom.com/platform/security), [remove.bg API](https://www.remove.bg/api), [remove.bg 보존 정책](https://www.remove.bg/help/a/are-my-images-safe), [Clipdrop API 문서](https://clipdrop.co/apis/docs/remove-background), [Clipdrop 가격](https://clipdrop.co/en-US/pricing)

## 권장 제품 설계

1. **별도 로컬 서비스:** 기존 정적 Node 앱은 UI로 유지하고, Python 3.11/3.12 가상환경의 localhost 서비스가 모델을 한 번 로드해 직렬 처리한다. 브라우저에 400MB급 모델을 매번 내려받지 않는다.
2. **GPU 정책:** BiRefNet HR FP16, batch 1, 동시 추론 1개. CUDA OOM 시 1536 또는 1024 마스크로 자동 재시도하고 CPU는 마지막 폴백으로만 제공한다.
3. **원본 보존:** RGB 원본과 마스크를 별도 저장한다. 모델 입력용 축소본만 만들고 최종 RGBA는 원본 크기에서 합성한다. 긴 변을 잘라 정사각형으로 만들지 말고 letterbox/tiling 좌표를 기록한다.
4. **교정 UX:** 자동 결과 후 체크무늬/흰색/검은색 배경 전환, 100%·200% 확대, `포함(+)`, `제외(-)`, 복원/지우기 브러시를 제공한다. SAM 2 이미지 임베딩은 사진별로 캐시한다.
5. **알파 합성:** SAM 마스크는 trimap의 확실한 foreground/background 제약으로 사용하고, 미지 영역은 BiRefNet의 연속 알파를 유지한다. 얇은 털·반투명 천을 임의 threshold로 이진화하지 않는다.
6. **안전/배포:** 가중치 버전·SHA256·라이선스 사본을 앱과 함께 고정한다. 모델 다운로드는 최초 실행 시 동의와 용량을 표시한다. 클라우드는 명시적 opt-in 폴백으로만 둔다.

## FF14 골든셋 테스트 계획

앱 적용 전 다음 24~40장을 수동 정답 마스크와 함께 고정한다.

- 밝은 설원/흰 의상, 어두운 실내/검은 의상, 보케·DOF, 강한 림라이트
- 라라펠 귀·꼬리, 털 장식, 반투명 천, 머리카락, 깃털, 무기와 얇은 끈
- 1인 전신과 2인 이상 겹침, 세로 2160×3840 원본

평가는 동일 전처리로 BiRefNet HR, InSPyReNet base/dynamic, BEN2 Base/refine, PhotoRoom, remove.bg를 비교한다.

- **필수 수치:** SAD, MSE, gradient error, connectivity error, boundary IoU
- **제품 수치:** 원본 보존 해상도, 첫 실행/후속 실행 시간, peak VRAM/RAM, 실패·OOM 비율, SAM 클릭 수, 수동 브러시 시간
- **합격 기준:** 장식 누락이 없는 이미지 ≥90%, 중앙값 교정 ≤2 clicks, 8GB에서 OOM 0건, 원본 크기 RGBA 저장, 자동 처리 중앙값 목표 ≤8초/장

## 현재 구현 상태

- 로컬 편집 경로는 `server.js`가 상주 Python 워커를 호출하고, 현재 설치된 `rembg`/ONNX Runtime CPU 환경에서 원본 크기 RGBA 결과를 반환한다.
- 과거 외부 검증 이미지로 생성한 결과는 로컬 `artifacts/background-benchmark/`에만 남으며 배포 자산에서 제외된다. 새 비교는 저장소 밖의 입력 경로를 명시해 실행하고, 결과를 운영 번들에 포함하지 않는다.
- 공개 배포 경로는 `functions/api/background-removal.js` 프록시와 `scripts/background_service.py` GPU 서비스 예시까지 준비했다. GPU 서비스는 `CUDAExecutionProvider`가 활성화되지 않으면 시작하지 않으므로 CPU로 조용히 전환하지 않는다.
- 아직 구현하지 않은 항목은 BiRefNet HR-matting 실서비스 전환, SAM 2.1 클릭/박스 보정, 브러시 교정, 24–40장 골든셋 정량 비교다. 이 항목들은 실제 GPU 엔드포인트를 연결한 뒤의 품질 개선 단계로 남긴다.

현재 머신 확인 결과는 RTX 4060 Ti 8188MiB, Node v24.13.1이며 `python` 명령은 전역 PATH에 없다. 로컬 가상환경 경로는 프로젝트 안에 존재한다. 위 골든셋 테스트는 HR·SAM 도입 전의 다음 품질 게이트다.

## 정확한 1차 출처

1. BiRefNet 공식 저장소: <https://github.com/ZhengPeng7/BiRefNet>
2. BiRefNet HR-matting 공식 모델 카드: <https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting>
3. BiRefNet HR-matting 공식 파일 목록: <https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting/tree/main>
4. InSPyReNet 공식 저장소: <https://github.com/plemeri/InSPyReNet>
5. transparent-background 공식 저장소: <https://github.com/plemeri/transparent-background>
6. InSPyReNet 공식 체크포인트 미러: <https://huggingface.co/plemeri/InSPyReNet/tree/main>
7. BEN2 공식 저장소: <https://github.com/PramaLLC/BEN2>
8. BEN2 공식 모델 카드/파일: <https://huggingface.co/PramaLLC/BEN2>, <https://huggingface.co/PramaLLC/BEN2/tree/main>
9. SAM 2 공식 저장소/설치: <https://github.com/facebookresearch/sam2>, <https://github.com/facebookresearch/sam2/blob/main/INSTALL.md>
10. SAM 3 공식 저장소/모델/라이선스: <https://github.com/facebookresearch/sam3>, <https://huggingface.co/facebook/sam3>, <https://github.com/facebookresearch/sam3/blob/main/LICENSE>
11. SAM 3.1 공식 릴리스: <https://github.com/facebookresearch/sam3/blob/main/RELEASE_SAM3p1.md>
12. IMG.LY background-removal 공식 저장소/라이선스: <https://github.com/imgly/background-removal-js>, <https://github.com/imgly/background-removal-js/blob/main/LICENSE.md>
13. PhotoRoom 공식 API/가격/보안: <https://docs.photoroom.com/api-reference-openapi>, <https://www.photoroom.com/api/pricing>, <https://www.photoroom.com/platform/security>
14. remove.bg 공식 API/보안: <https://www.remove.bg/api>, <https://www.remove.bg/help/a/are-my-images-safe>
15. Clipdrop 공식 API/가격: <https://clipdrop.co/apis/docs/remove-background>, <https://clipdrop.co/en-US/pricing>
