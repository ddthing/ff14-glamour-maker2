# 투영세트메이커2 진행 현황

기준일: 2026-09-07

## 현재 단계

공통 편집 규칙 후속 분리: models/card-png.js가 확정된 편집 데이터·장비 문구·디코딩된 사진으로 PNG를 만들고, models/editor-navigation.js·background-presets.js·title-typography.js가 키보드·배경·서체 규칙을 공유한다. app.js는 DOM 조작·서체 준비·제목 측정·편집 변경 감지·다운로드 UI를 담당한다. 5개 구성에서 변경 전후 실제 PNG 픽셀 해시 일치를 확인했다. CSS 전면 통합과 실제 기기 검수는 남아 있다.

최신 정리: IndexedDB 이미지 저장을 models/image-assets.js로, 검색 요청 취소·응답 순서·캐시를 models/item-search.js로, PNG 그리기와 공통 키보드 규칙을 각각 models/card-png.js·models/editor-navigation.js로, 배경 선택 검증·프리셋 중복 제거·이름 정리를 models/background-presets.js로, 제목 서체 목록·굵기 정규화·선택지 생성을 models/title-typography.js로 분리했다. 사라진 이미지 편집 팝업 미리보기 CSS 및 반복 도크 규칙을 제거했다. 전체 삭제 시 검색어도 비운다. 이것은 전체 CSS/앱 분리의 일부이며, 추가 UI 제어 분리는 남아 있다.

이번 재개 검수에서는 이미지 편집 도크의 레거시 대화상자·중간 도크·최종 도크 덮어쓰기를 하나의 반응형 규칙으로 통합했다. 모바일에서 위치 제목과 `중앙` 버튼이 같은 행에 남고, 방향키·취소·적용 버튼의 조작 영역이 유지되는지 `check-image-editor-dock.cjs`에서 실제 875px·320px Edge 레이아웃으로 확인한다. 브라우저 BiRefNet 모듈은 공개 Pages 경로에 연결했고, API 장애 시 브라우저 폴백 적용 흐름을 자동 검증했다. 외부 CDN 가중치 다운로드가 차단된 환경에서는 실제 모델 추론·품질을 아직 판정하지 않았다.

최근 재개 작업: LOOK BOOK 관리에서 이름 변경·독립 사진 복제·개별 삭제·삭제 취소를 구현했다. 모바일 초기화 메뉴 가림도 수정했다. 앞서 이미지 다중 가져오기/전체 삭제 경쟁 상태, PNG 서체 준비 순서, 슬라이더 중복 CSS, 모바일 편집 헤더 겹침을 수정했다. 다음 미완료 범위는 CSS 전면 통합·추가 기능 모듈 분리·실제 기기 검수다. 아래 역사적 단계표의 완료 표시는 현재 전체 리팩터링 완료를 뜻하지 않는다.

2026-09-06 엄격 검수에서 카드 독립성·이미지 undo 결함이 발견되어 이전의 포괄적인 완료 판정을 철회했다. 승인안의 구현 범위와 남은 작업은 [리디자인 구현 기록](redesign-implementation-2026-09-06.md)을 우선한다. 아래 단계별 표는 이전 작업 이력이며 현재 전체 배포 승인을 의미하지 않는다.

카드 편집기 핵심과 아이템 검색은 동작 검증을 마쳤고, 지금은 **5단계 배포 준비의 로컬 QA 게이트**까지 진행됐다. 아직 GitHub 원격 저장소, Cloudflare Pages 프로젝트, 운영 GPU 엔드포인트는 연결하지 않았다.

| 단계 | 상태 | 확인된 범위 | 남은 일 |
| --- | --- | --- | --- |
| 1. 구조·사용 흐름 | 구현·검증 완료 | 꾸미기/장비 작업 모드, 기본 접힘 LOOK BOOK, 빈 카드에서 시작하는 이미지 추가 흐름, 인스펙터 작업 순서 정리, 모바일 라인업 정보 밀도 정리, 문구·서체·제목 외곽선 편집 흐름 통합 | 실제 모바일 기기·스크린리더 수동 점검 |
| 2. 이미지·카드 편집 | 핵심 구현 | 1인 세로 4:5, 2인 양쪽 5슬롯 정보, 3–5인 중앙 제목, 원본/배경 제거 선택, 텍스트 전용 장비 정보 | HR 매팅 전환, SAM/브러시 보정, 다양한 원본 조합 QA |
| 3. 아이템 데이터 | 구현·검증 완료 | 한국어 정적 인덱스, 영문/일문 XIVAPI, 언어별 검색, 캐시·동시 요청 병합, 실패 시 임의 데이터 금지 | 패치 인덱스 갱신 절차 운영화 |
| 4. 시각 품질 | 구현·검증 완료 | 지정 폰트 10종, UI·본문 Pretendard, 이름 기반 굵기 선택, 반응형 제목 맞춤, 패턴 레시피, 카드와 PNG 레이어 순서 통일, 모바일 라인업 정보 계층 | 레퍼런스 기준 패턴 세부 조정, 폰트별 실제 원본 조합 QA |
| 5. 접근성·성능·배포 | 로컬 QA 게이트 완료 | Pages 아이템 Function, GPU 배경제거 프록시, 엄격한 GPU 서비스 예시, 자동 회귀·대비·AX 트리 검사, 빈 운영 데이터 경계와 전체 로컬 삭제, 로컬 Git 초기화 | 실제 GitHub/Cloudflare 연결, VoiceOver/NVDA 수동 점검, GPU 운영 배포·부하 테스트 |

## 이번 단계에서 추가된 것

- `functions/api/background-removal.js`: Cloudflare Pages에서 GPU 서비스로 전달하는 same-origin 프록시
- `scripts/background_service.py`: CUDA가 없으면 실패하고 CPU로 폴백하지 않는 최소 HTTP GPU 서비스
- `requirements-background-gpu.txt`: GPU 실행 환경 의존성
- `scripts/test-cloudflare-functions.mjs`: 외부 GPU 서버 없이 프록시 계약을 검증하는 테스트
- GitHub 업로드에서 제외할 모델·가상환경·QA 산출물 규칙과 로컬 Git 저장소
- 배포 번들에서 고정 데모 룩·스크린샷 자산을 제거하고, 첫 화면을 빈 LOOK BOOK로 고정
- `모든 로컬 데이터 삭제`에서 LOOK BOOK·IndexedDB 이미지·프리셋·레거시 저장 키를 함께 제거
- 전체 삭제가 진행 중인 뒤늦은 아이템명 요청이 초안을 다시 저장하지 않도록 작업공간 세대와 선택 룩을 검증한다. 삭제 경합 회귀 검사는 `scripts/check-reset-async-race.cjs`에서 실제 지연 응답으로 확인한다.
- 모바일 뷰포트가 바뀌는 첫 프레임에도 제목 맞춤을 동기 실행해 이전 데스크톱 크기의 말줄임이 잠깐 나타나지 않게 한다. 고급 스타일 토글의 `aria-controls`도 실제 테두리·그림자 섹션을 가리키도록 정리했다.

## 다음 순서

1. 실제 모바일 브라우저와 VoiceOver/NVDA에서 현재 로컬 QA 결과를 수동 확인한다.
2. 사용자가 GitHub 저장소를 만들면 `main`을 Cloudflare Pages Production 브랜치로 연결한다.
3. Preview 배포에서 아이템 검색과 배경 제거 미설정 상태를 확인한다.
4. 관리형 HTTPS GPU 서비스에 `scripts/background_service.py` 계약을 배포하고 `CUTOUT_SERVICE_URL`, `CUTOUT_SERVICE_TOKEN`을 Preview부터 연결한다.
5. 실제 GPU 결과와 FF14 골든셋을 확인한 뒤 HR/SAM 보정 기능의 범위를 결정한다.
