# 제목 서체 조사

2026-09-04 기준으로 사용자가 지정한 Noonnu 페이지의 웹폰트 코드와 굵기 정보를 확인했다. 카드 제목 선택지는 이 표의 10개 서체만 사용하며, UI 본문은 기존 Pretendard를 유지한다.

| 카드 제목 표시명 | 원문 페이지 | 확인된 굵기 | 웹폰트 소스 |
| --- | --- | --- | --- |
| 군함이말문트였체 | [눈누 1869](https://noonnu.cc/font_page/1869) | 400 단일 | `GFCGunhamiTalks.woff2` |
| 리디바탕 | [눈누 324](https://noonnu.cc/font_page/324) | 400 단일 | `RIDIBatang.woff` |
| 스텔라체 | [눈누 1907](https://noonnu.cc/font_page/1907) | 400 단일 | `Stellar_Serif_Bold_Condensed.woff2` |
| 에스코어드림 | [눈누 223](https://noonnu.cc/font_page/223) | 100–900, 9단계 | `S-CoreDream-1Thin`–`9Black.woff` |
| 읏맨 궁서체 | [눈누 947](https://noonnu.cc/font_page/947) | 400 단일 | `OKGUNG.woff2` |
| 케리스 케듀체 | [눈누 1756](https://noonnu.cc/font_page/1756) | 400, 700 | `KERISKEDU_R/B.woff2` |
| 학교안심 둥근미소 | [눈누 1479](https://noonnu.cc/font_page/1479) | 400, 700 | `HakgyoansimDunggeunmisoTTF-R/B.woff2` |
| 한글안심 나들이 | [눈누 1482](https://noonnu.cc/font_page/1482) | 400, 700 | `HakgyoansimNadeuriTTF-L/B.woff2` |
| G마켓산스 | [눈누 366](https://noonnu.cc/font_page/366) | 300, 500, 700 | `GmarketSansLight/Medium/Bold.woff` |
| ZEN SERIF | [눈누 1686](https://noonnu.cc/font_page/1686) | 400 단일 | [제작사 다운로드 페이지](https://oddatelier.net/notice-board/oa-font-zen-serif/)의 `ZEN SERIF TTF` |

## 구현 메모

- 목록은 `localeCompare("ko-KR")`로 가나다순 정렬한다. 영문으로 시작하는 G마켓산스와 ZEN SERIF는 한글 목록 뒤에 배치된다.
- 굵기 슬라이더는 실제 제공 파일이 2개 이상인 서체에서만 보인다. 슬라이더 값은 존재하지 않는 중간 굵기를 합성하지 않고, 원문에 확인된 단계만 선택한다.
- ZEN SERIF는 Noonnu 페이지에 웹폰트 코드가 노출되지 않아 제작사 페이지의 정규 TTF를 `@font-face`로 연결했다. 해당 페이지의 라이선스 제한을 지키기 위해 파일 변환이나 수정은 하지 않는다.
- 라이선스는 배포 전에 각 제작사의 원문 조건을 다시 확인한다. 특히 서체 파일 수정·재배포 제한이 있는 서체는 Cloudflare 배포 방식과 함께 검토한다.
