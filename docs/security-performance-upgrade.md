# 검수 및 개선 기록

## 적용 사항
- 정적 파일 URL의 점 경로, 역슬래시, NUL을 차단. 원시 HTTP 요청으로 package.json 접근 우회 회귀 검사.
- 공개 페이지 매핑의 상속된 속성 접근 차단. /constructor, /toString, /__proto__ 요청은 404.
- 로컬 정적 파일을 비동기 stat 및 스트리밍으로 제공. ETag 재검증(304), HEAD, Content-Length 적용.
- 로컬 서버와 Pages 응답에 base-uri, object-src, frame-ancestors, form-action CSP 적용.
- 배경 제거 POST의 교차 출처 요청 차단. 서버 간 배경 제거 요청은 리디렉션을 따라가지 않음.
- 편집기 스크립트에 defer를 적용해 실행 순서를 유지하며 HTML 파싱 차단 완화.
- 기존 문구 8곳의 번역투·중복 표현 축소. 새로운 홍보 문구 없음.
- 업로드 안내 줄바꿈, select/summary 키보드 포커스, 편집 패널 스크롤 보완.
- 390px 화면에서 브랜드와 기록 버튼이 겹치던 헤더 수정. 좁은 화면은 두 줄로 배치.

## 측정
로컬 Edge, 1280×900, 자동화 시나리오 1회. 실제 사용자 Core Web Vitals나 개선율을 의미하지 않음.
- DOMContentLoaded: 158ms.
- 스타일 입력 40회: 10.5ms, renderStyles 1회.
- 250개 룩의 제목 입력 40회: 13.1ms.
- 초기 로딩에서 117ms long task 1회 관측. 초기화 추가 분할은 후속 개선 대상.
- 모바일 런타임 오류 0건, 문서 가로 넘침 없음.

## 범위와 한계
기존 미커밋 작업을 보존해 추가 수정했다. 운영 배포와 실서비스 부하 검사는 수행하지 않았다.
CSP는 문서·임베딩 보호 범위이며 script-src를 제한하는 완전한 XSS 방어 정책은 아니다.
출처 검사는 브라우저의 교차 사이트 호출을 줄이며 인증이나 분산 요청 제한을 대체하지 않는다.
실제 GPU 서비스 및 최초 모델 다운로드는 이번 검수에서 실서비스로 검증하지 않았다.
지정된 memory/protocols 파일과 design-md 스킬은 프로젝트에서 발견되지 않았다.
humanize-korean의 quick-rules.md도 설치 경로에 없어 스킬의 정식 점수 산정은 하지 않고 보수적으로 문구를 수정했다.

참고: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
