# Lucian UI 적용

기존 순수 HTML/CSS/JavaScript 편집기에 Lucian #197, #267, #219를 적용한다. 기존 언어 저장·아이템 언어·화면 테마 저장·PNG 출력 경로를 재사용한다. 원본은 Lucian 공식 CLI의 한국어 `get 197 267 219`로 확인했으며, 새 컴포넌트 파일 첫 줄에 각 MIT 라이선스 주석을 유지한다.

## 적용 위치와 동작

- [#197 화면 안내 스포트라이트](https://lucianlabs.dev/uxui-prompt/#197): 헤더 `사용법`에서 시작한다. 선택한 캐릭터의 사진 추가/변경, 인원수, 장비 검색, 배경, PNG 저장의 다섯 실제 대상을 안내한다. 단계별로 필요한 패널을 열고, 종료하면 시작 패널과 초점으로 복귀한다. 원본의 520ms 구멍 이동, 말풍선과 맥박 테두리를 사용한다.
- [#267 언어를 바꾸면 갈아 끼워지는 문구](https://lucianlabs.dev/uxui-prompt/#267): 기존 `#languageSelect`를 유지하면서 지구본·언어 목록·선택 체크를 추가한다. 실제 change 이벤트가 페이지와 아이템 언어를 바꾼다. 안정된 UI 문구에만 45ms 순차 지연, 260ms 퇴장·380ms 입장 모션을 적용하며 사용자 제목·장비 이름·진행 상태는 애니메이션이 덮어쓰지 않는다.
- [#219 누른 자리에서 원으로 번지는 다크 모드](https://lucianlabs.dev/uxui-prompt/#219): 기존 테마 버튼 중심에서 700ms 원형 전환을 실행한다. 원본의 easing과 아이콘을 사용하고 View Transition의 화면 스냅샷으로 구현한다. 실제 앱 DOM을 두 벌 만들지 않으며 카드와 PNG 색은 화면 테마와 독립적이다. 모션 줄이기와 API 미지원 환경에서는 즉시 전환한다.

샘플 대시보드·문서·마케팅 문구는 가져오지 않는다. 데모의 340px 고정 컨테이너 대신 실제 편집기 뷰포트와 헤더에 배치한다. 색은 `styles/lucian-base.css`의 `--ux-*`를 기존 Neutral 토큰에 연결하고, 도형·전환 시간·곡선은 선택한 요소의 원본을 따른다.

안내 중에는 대상 인스펙터의 장식적 진입 애니메이션을 임시로 멈춰, 대상을 측정한 뒤 8px 이동하는 현상을 방지한다. 투어가 닫히면 원래 패널 모션으로 돌아간다. 말풍선의 바깥쪽 꼬리는 보이게 유지하고 짧은 뷰포트에서 필요한 스크롤만 설명 본문 안으로 제한한다.

## 파일

| 역할 | 파일 |
| --- | --- |
| 안내 투어 | `models/lucian-tour.js`, `styles/lucian-tour.css` |
| 언어 메뉴·문구 전환 | `models/lucian-language.js`, `styles/lucian-language.css` |
| 원형 테마 전환 | `models/editor-theme.js`, `styles/lucian-theme-transition.css` |
| 공통 매핑·헤더 연결 | `styles/lucian-base.css`, `index.html` |
| 공개 경로·문법 검사 | `server.js`, `package.json` |
| 기능 검사 | `scripts/check-lucian-{tour,language,theme-transition}.cjs` 및 기존 헤더·언어·초점 검사 |

장비 레이어·추가 슬롯은 별도 [설계 제안](card-information-expansion-proposal.md)에 정리했다. 이 UI 변경에서 기존 카드 저장 형식과 5개 장비 슬롯은 유지한다.

## 검증

검사 범위는 라이트/다크, 375px 모바일 너비, 키보드·초점, 순차 언어 문구·진행 상태 보호, 투어 위치·모션 줄이기 변경, 원형 전환·빠른 연속 조작, 카드/PNG 불변성이다. 기존 저장·장비·내보내기 검사를 포함한 102개 회귀 항목을 같은 CI 워크플로에서 실행한다. 최신 통과 결과는 PR의 Verify 체크와 함께 제공한 검증 보고서를 기준으로 확인한다.

실제 모바일 기기와 Safari/Firefox의 원형 전환은 별도로 확인해야 한다. API를 지원하지 않는 브라우저에서는 즉시 테마가 바뀌는 경로를 검증한다.
