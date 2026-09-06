# FFXIV 아이템 검색·현지화 API 조사

조사일: 2026-09-04  
범위: Universalis, Garland Tools/Teamcraft, Lodestone 및 현재 저장소의 아이템 검색 구현  
주의: 조사 결과와 현재 애플리케이션 어댑터의 데이터 계약을 함께 기록한다. 배포용 인덱스는 원본 CSV를 빌드할 때 다시 생성한다.

## 결론

1. `Teamcraft 한국어`라는 문구를 검색창과 결과마다 반복해서 보여줄 이유는 없다. 사용자는 자신의 언어로 검색하고, 앱은 내부적으로 여러 이름을 하나의 아이템 ID에 매칭해야 한다. 데이터 출처 표시는 일반 UI가 아니라 도움말·정보 팝오버·개발 로그 정도로 제한하는 편이 낫다.
2. 현재 앱은 실제 API 어댑터를 연결했지만, 외부 소스 장애를 임의 데이터로 감추지 않는다. 검색이 성공한 응답만 캐시하고, 장애 시에는 직전 성공 결과 또는 명확한 연결 실패 상태를 사용한다.
3. 한국어 아이템명은 Teamcraft 이름을 중복 입력하는 방식으로 해결하면 안 된다. 현재 공개 XIVAPI 서비스는 글로벌 클라이언트의 일본어·영어·독일어·프랑스어만 제공하며, 한국 클라이언트 데이터는 별도 버전·패치 흐름을 가진다. 한국어 검색을 제대로 제공하려면 한국 클라이언트에서 추출·정리한 한국어 이름 인덱스를 별도 배포해야 한다.
4. 추천 구조는 `사용자 언어 검색 → canonical itemId 확정 → 필요한 메타데이터 1회 조회 → 카드에는 이름만 표시`다. Teamcraft, Garland Tools, XIVAPI, Universalis를 매 키 입력마다 동시에 호출하는 방식은 사용성·안정성·부하 측면에서 모두 좋지 않다.

## 현재 저장소 확인 결과

### 실제 API 연결 여부

- 과거의 `itemCatalog` 고정 데모 항목은 제거했다. 현재 카드는 빈 장비 슬롯으로 시작하며, 서버가 성공적으로 반환한 canonical itemId·슬롯·현지화 이름만 런타임 캐시에 등록한다.
- 현재 `app.js`는 동일 출처 `/api/items/search`만 호출하고, 서버가 반환한 canonical `itemId`·슬롯·현지화 이름을 카드 모델에 등록한다. 성공한 검색 결과만 짧게 메모리 캐시한다.
- `server.js`는 한국어 입력을 한국 클라이언트 datamining CSV 인덱스에서 검색하고, 영문·일문 입력은 XIVAPI v2로 전달한다. 서버 메모리 캐시와 동일 검색 동시 요청 병합을 적용한다.
- 외부 소스가 실패하면 검색 결과를 로컬 데모 항목으로 위장하지 않는다. 직전 성공 응답이 stale 유효기간 안에 있으면 `stale-cache`로 명시해 보여주고, 그렇지 않으면 연결 실패 상태를 표시한다.
- 서버 응답에는 Cloudflare 등 same-origin edge에서 재사용할 수 있는 `s-maxage`와 `stale-while-revalidate` 헤더가 포함된다. 단, 현재 Node 서버를 Cloudflare에 그대로 배포할 수 있다는 뜻은 아니며 Worker 어댑터가 필요하다.

### 카드의 직업·레벨 표시

검색 결과에 포함될 수 있는 `job` 같은 메타데이터는 카드 표시 모델에 사용하지 않는다. 카드 미리보기와 PNG export에는 제목·캐릭터·아이템명만 남기고, 직업·레벨·데이터 출처·내부 ID는 편집기 보조 데이터로만 취급한다.

## 소스별 역할과 한계

| 소스 | 잘하는 일 | 한국어 이름 | 검색 API 적합성 | 권장 역할 |
| --- | --- | --- | --- | --- |
| XIVAPI v2 | 게임 클라이언트 시트, ID·아이템 필드·검색·아이콘 경로 | 현재 서비스는 글로벌 4개 언어만 제공 | 높음(글로벌 언어) | 글로벌 이름/메타데이터의 기준 소스 |
| Teamcraft | 게임 파일을 추출해 JSON·검색 인덱스를 생성하는 애플리케이션 데이터 파이프라인 | 공식 extractor 문서 예시는 en/fr/de/ja 4개 언어 | 중간; 공개된 단일 한국어 REST 검색 엔드포인트로 보기는 어려움 | 패치별 데이터 생성 방식 참고 또는 자체 snapshot 소스 |
| Garland Tools | 패치별 DB, 아이템 상세·제작·획득처·아이콘 등 풍부한 조회 | 공식 저장소에서 한국어 공개 API 계약을 확인하지 못함 | 낮음~중간; 공식 안정 API 계약이 명확하지 않음 | canonical ID가 확정된 뒤 상세 정보 보강 |
| Universalis | 장터 현재 매물·판매 이력·시세 | 이름·ID 매핑 소스가 아님 | 아이템 이름 검색용으로 부적합 | 시세 기능을 만들 때만 별도 사용 |
| Lodestone Eorzea Database | 공식 사람이 사용하는 아이템 검색·상세 페이지 | 지역 사이트의 표시 언어는 별도 확인 필요 | 공개 개발자용 아이템 JSON API로 사용하지 않음 | 상세 페이지 링크 또는 수동 확인용 |

### XIVAPI v2

XIVAPI v2는 `/api/search`로 시트 검색을 제공하고, `sheets=Item`, `fields=Name,...`, `query=...` 형태로 아이템을 검색할 수 있다. 부분 문자열 연산자(`~`), 관련도 정렬, 페이지 커서, URI 인코딩 규칙도 문서화되어 있다.

다만 XIVAPI의 현지화 문서는 현재 서비스가 글로벌 게임 클라이언트에 포함된 일본어·영어·독일어·프랑스어만 제공한다고 명시한다. 한국어·중국어 클라이언트는 별도 클라이언트이고 패치 버전도 다를 수 있으므로, `language=ko`를 호출하면 한국어 데이터가 나온다고 가정하면 안 된다.

XIVAPI는 `version`과 `schema`를 고정할 수 있다. 실서비스에서는 `latest`를 무조건 사용하기보다 앱이 지원하는 패치 기준을 저장해 응답 구조와 카드 표시가 갑자기 바뀌지 않게 하는 편이 안전하다.

권장 사용 예:

```text
GET https://v2.xivapi.com/api/search
  ?sheets=Item
  &fields=Name,Icon,LevelItem,EquipSlotCategory
  &query=Name~"Rainbow"
  &language=en
```

실제 요청에서는 전체 URL을 반드시 URI 인코딩한다. 한국어 이름은 XIVAPI 글로벌 응답에서 해결할 수 없으므로 한국어 인덱스를 먼저 조회하고, 매칭된 ID의 글로벌 메타데이터를 XIVAPI에서 보강하는 혼합 구조가 필요하다.

### Teamcraft

Teamcraft 공식 저장소는 앱 자체를 협업 제작 도구로 설명하며 MIT 라이선스를 사용한다. 공식 `apps/data-extraction` README는 게임 파일에서 Teamcraft에 필요한 JSON 및 검색 인덱스를 생성한다고 설명하고, 검색 및 DB 페이지도 추출 과정에서 생성한다고 명시한다.

같은 문서의 extractor 예시는 문자열 필드가 게임 클라이언트에 존재하는 4개 언어(`en`, `fr`, `de`, `ja`)로 생성되는 구조를 보여준다. 즉, “Teamcraft 한국어”를 붙인다고 현재 Teamcraft의 공개 데이터가 한국어 검색 API가 되는 것은 아니다.

Teamcraft를 사용할 때의 적절한 의미는 다음과 같다.

- Teamcraft 웹 UI를 매 키 입력마다 호출하지 않는다.
- Teamcraft의 데이터 추출·인덱싱 방식을 참고하거나, 필요한 패치의 데이터를 빌드 단계에서 snapshot으로 만든다.
- 한국어가 필요하면 한국 클라이언트에서 추출한 별도 `ko` 데이터셋을 canonical itemId와 함께 유지한다.
- UI에는 `Teamcraft 한국어`를 일반 결과 메타로 반복 표시하지 않는다. 실제로 어느 데이터셋을 사용했는지 확인해야 하는 화면에서만 “데이터 기준 패치”와 함께 표시한다.

### Garland Tools

공식 Garland Tools 저장소는 FFXIV 데이터를 테이블로 관리하고, 패치 때 전체 데이터를 다시 생성·배포하는 구조를 설명한다. 아이템 아이콘은 Lodestone에서 보강하고, 제작·획득처 등은 여러 보조 데이터에서 결합한다. 이 구조는 아이템 상세 정보를 보강하는 데 유용하지만, 공개 저장소에서 브라우저가 의존할 안정적인 검색 API 계약·한국어 endpoint·공식 rate limit 문서를 확인하지 못했다.

커뮤니티의 `garlandtools-api` Node 프로젝트는 스스로 “Unofficial Node wrapper”라고 명시하고 `search(query)`, `item(id)`, 언어 설정, 자체 캐시를 제공한다. 따라서 이를 사용하더라도 공식 보장 API로 취급하지 말고, ID가 이미 확정된 아이템의 상세 보강에 제한하는 편이 안전하다. 검색의 기준 소스로 Garland Tools를 두면 endpoint 형식이나 데이터 배포 방식 변경에 앱이 직접 영향을 받는다.

### Universalis

Universalis 공식 문서는 이 서비스를 crowdsourced market board aggregator로 설명한다. 같은 문서에서 아이템 ID와 이름 매핑은 XIVAPI를 사용하라고 안내하며, Universalis 자체를 일반적인 아이템 이름 카탈로그로 사용하도록 설계하지 않았다.

공식 문서에 표시된 현재 제한은 다음과 같다.

- API: 초당 25 요청, 50 요청 burst
- 웹사이트 scraping: 초당 15 요청, 30 요청 burst
- IP당 동시 연결: 최대 8

따라서 아이템 이름 검색에는 Universalis를 연결하지 않는다. 이후 시세 기능이 필요할 때만 이미 확보한 itemId로 현재 가격을 조회하고, 짧은 TTL 캐시·요청 병합·동시성 제한을 둔다. 가격은 변하지만 이름·아이콘·장비 슬롯 같은 게임 데이터는 가격 API와 분리해야 한다.

### Lodestone

공식 Eorzea Database는 키워드·카테고리·고급 필터로 아이템을 검색하고, 현재 패치 버전을 표시하는 사람용 웹 서비스다. 공식 업데이트 기록도 패치 때 Eorzea Database가 갱신된다고 설명한다.

확인한 공식 자료에서는 공개 개발자용 아이템 검색 JSON API 또는 안정적인 API rate limit 계약을 찾지 못했다. 그러므로 Lodestone HTML을 브라우저에서 매 키 입력마다 scraping하는 방식은 추천하지 않는다. 카드에서는 필요할 때 아이템 상세 페이지 링크를 제공하는 정도가 적절하다.

## 한국어 검색을 위한 권장 매칭 전략

사용자는 하나의 검색창에 자신의 언어로 입력한다. 내부적으로만 다국어 alias를 유지한다.

```text
검색어 정규화
  → 선택 언어 정확 일치
  → 선택 언어 prefix/token 일치
  → 한국어 alias·공식 표기 변형
  → en/ja/de/fr alias 일치
  → 숫자 itemId 일치
  → 슬롯 필터
  → 관련도 순으로 결과 표시
```

구체적으로는 다음을 권장한다.

- 유니코드 NFC 정규화, 앞뒤 공백 제거, 연속 공백 통합
- 대소문자 무시, 하이픈·중점·괄호 등 표기 구분자 정리
- 입력 언어를 선택하지 않아도 현재 UI 언어를 최우선으로 사용
- 정확 일치·prefix·token·다국어 alias·ID 순으로 점수화
- 슬롯을 선택하면 검색 인덱스 단계에서 필터링
- 결과 클릭 후에는 문자열이 아니라 `itemId`와 source revision을 저장
- 한국어 이름을 얻지 못한 경우 임의 번역이나 임의 이름을 만들지 않고 “한국어 이름 준비 중” 또는 안전한 원문 fallback을 사용
- 동명이거나 색상·염색·HQ 변형이 있는 항목은 결과에 슬롯·아이템 레벨·고유 ID를 함께 보여 사용자가 확정

핵심은 Teamcraft 이름, Garland 이름, XIVAPI 이름을 UI에 나란히 적는 것이 아니라, 하나의 canonical record로 합치는 것이다.

```json
{
  "itemId": 12345,
  "names": { "ko": "한국어 이름", "en": "English Name", "ja": "日本語名" },
  "slot": "head",
  "iconUrl": "...",
  "patch": "7.x",
  "sourceRevision": "ko-client-7.x"
}
```

## 과부하·캐시·Cloudflare 권장안

실시간 API를 연결해도 과부하가 필연적으로 발생하는 것은 아니다. 과부하는 보통 매 키 입력마다 여러 외부 API를 호출하고, 같은 검색을 캐시하지 않으며, 모든 캐릭터의 장비 상세를 한꺼번에 병렬 조회할 때 발생한다.

권장 흐름:

1. 한국어 중심의 아이템 검색 인덱스를 패치별 정적 JSON으로 빌드한다.
2. 브라우저는 Cloudflare의 동일 출처 `/api/items/search?q=...&slot=...&lang=ko`만 호출한다.
3. 250~350ms debounce, 최소 2글자, 이전 요청 abort를 적용한다.
4. Cloudflare Worker에서 정규화된 query/lang/slot/patch를 캐시 키로 사용한다.
5. 검색 결과는 짧은 edge TTL로 캐시하고, ID 상세 조회는 더 긴 TTL을 사용한다.
6. 외부 소스 호출은 cache miss 때만 서버에서 수행하며, 동일 ID 동시 요청은 하나로 합친다.
7. 429/5xx에는 무한 재시도하지 않고 `Retry-After` 존중, 지수 backoff, stale cache fallback을 사용한다.

브라우저 직접 호출은 소스별 CORS 정책에 의존하게 된다. Universalis 문서는 브라우저 클라이언트를 고려한 CORS 헤더를 언급하지만, 모든 소스가 동일한 정책을 보장하는 것은 아니다. 또한 같은 출처 proxy를 두면 응답 캐시·속도 제한·로그·fallback을 한곳에서 관리할 수 있다. Cloudflare 배포에서는 API key가 필요한 소스가 추가되더라도 키를 브라우저에 넣지 않고 Worker secret으로 보관해야 한다.

현재 Universalis 문서상 8개 동시 연결 제한을 고려하면, 서버의 외부 동시성도 보수적으로 4~6개 이하로 제한하는 것이 안전하다. 다만 이름 검색 자체는 Universalis가 아니라 정적 한국어 인덱스에서 처리해야 하므로, 일반적인 검색 사용량이 Universalis 제한을 소모하지 않도록 설계한다.

## 다음 구현 순서 제안

### 1. 데이터 계약 먼저 확정

`itemId`, `names`, `slot`, `iconUrl`, `itemLevel`, `patch`, `sourceRevision`만 카드 기능에 필요한 최소 계약으로 확정한다. Teamcraft/Garland/Universalis/Lodestone의 원문 필드를 그대로 UI 모델로 노출하지 않는다.

### 2. 한국어 데이터셋 확보·검증

한국 클라이언트 추출 데이터 또는 신뢰할 수 있는 패치별 한국어 snapshot을 확보하고, 글로벌 ID와 실제로 조인되는지 샘플 장비 20~30개로 검증한다. 한국어 데이터가 없는 항목은 임의 번역하지 않는다.

### 3. 단일 검색 인덱스 생성

한국어·영어·일본어 alias와 ID를 하나의 인덱스로 만들고, 선택 언어 우선 점수와 장비 슬롯 필터를 적용한다. 검색 UI에서 `Teamcraft 한국어` 반복 표시는 제거한다.

### 4. Cloudflare same-origin API와 캐시 추가

`/api/items/search`와 `/api/items/:id`를 Worker 또는 서버 어댑터로 제공한다. 브라우저는 이 두 endpoint만 사용하고, 외부 API 호출은 서버에서만 한다.

### 5. 카드 정보 최소화

카드 미리보기·PNG export에서 직업/레벨을 제거한다. 제목, 캐릭터, 아이템명처럼 룩을 이해하는 데 필요한 정보만 남기고, 데이터 출처·패치·내부 ID는 편집기 보조 정보로 숨긴다.

### 6. 실제 항목으로 회귀 테스트

한국어 이름 검색, 영어/일본어 alias 검색, ID 검색, 슬롯 제한, 동명이 항목, 존재하지 않는 이름, API 장애, 캐시 stale 상태를 테스트한다. 테스트 통과 전에는 “API 연결 완료”라고 표시하지 않는다.

## 1차 출처

- [XIVAPI Welcome](https://v2.xivapi.com/docs/welcome/)
- [XIVAPI Important Concepts — editions/localisations](https://v2.xivapi.com/docs/guides/concepts/)
- [XIVAPI Searching Sheets](https://v2.xivapi.com/docs/guides/search/)
- [XIVAPI Reading Sheets](https://v2.xivapi.com/docs/guides/sheets/)
- [XIVAPI Ensuring Stability](https://v2.xivapi.com/docs/guides/pinning/)
- [XIVAPI Retrieving Assets](https://v2.xivapi.com/docs/guides/assets/)
- [XIVAPI source repository](https://github.com/xivapi/xivapi.com)
- [XIVAPI datamining repository](https://github.com/xivapi/ffxiv-datamining)
- [FFXIV Korean datamining repository README](https://github.com/Ra-Workspace/ffxiv-datamining-ko)
- [FFXIV Teamcraft repository](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft)
- [Teamcraft XIV Data Extraction README](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/blob/staging/apps/data-extraction/README.md)
- [Garland Tools source repository](https://github.com/ufx/GarlandTools)
- [Garland Tools unofficial Node wrapper](https://github.com/karashiiro/garlandtools-api)
- [Universalis documentation](https://docs.universalis.app/)
- [Universalis API design documentation](https://github.com/Universalis-FFXIV/Universalis/blob/v2/docs/design/api.md)
- [Official Lodestone Eorzea Database](https://na.finalfantasyxiv.com/lodestone/playguide/db/)
- [Official Lodestone update notes](https://na.finalfantasyxiv.com/lodestone/special/update_log/)
