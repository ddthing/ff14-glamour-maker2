# 아이템 데이터 자동 갱신

## 운영 원칙

한국어 아이템 데이터는 검색 요청마다 게임 원본을 직접 호출하지 않고, GitHub Actions가 하루 한 번 원본 snapshot을 확인해 갱신합니다. 검증에 실패하면 기존 정상 snapshot을 유지하며, 성공한 변경만 데이터 전용 PR을 거쳐 main에 반영합니다. Cloudflare Pages Git integration은 main push를 Production 배포로 연결합니다.

자동화 workflow는 .github/workflows/sync-korean-item-data.yml입니다.

## 실행 순서

1. Ra-Workspace/ffxiv-datamining-ko의 Item.csv를 파일 변경 커밋 SHA로 고정해 다운로드합니다.
2. scripts/build_item_index.mjs가 assets/data/items-ko.json과 items-ko.manifest.json을 생성합니다.
3. 중복 ID, 알 수 없는 장비 분류, 빈 이름, 아이콘 누락, 전체·부위별 데이터 급감, 주요 회귀 아이템을 검사합니다.
4. npm run check, item index 검사, sync 검사, Pages build, whitespace 검사를 실행합니다.
5. 변경이 있을 때만 automation/korean-item-data 데이터 전용 PR을 생성하고 자동 병합합니다.
6. Production manifest가 새 원본 SHA를 실제로 제공할 때까지 배포 후 smoke test를 수행합니다.

dist/는 빌드 산출물이므로 커밋하지 않습니다. Pages 빌드가 원본 snapshot을 장비 부위별 정적 인덱스로 분할합니다.

## 수동 실행

GitHub Actions의 Sync Korean item data workflow에서 Run workflow를 누르면 같은 검증을 즉시 실행할 수 있습니다. 로컬에서는 다음 명령을 사용합니다.

    node scripts/build_item_index.mjs
    npm run check
    node scripts/check-item-index.cjs
    node scripts/check-item-data-sync.cjs
    npm run build:pages

## 실패 시 대응

원본 CSV가 비어 있거나 HTML 오류 페이지로 바뀌거나, 아이템 수가 급감하거나, 필수 회귀 아이템이 사라지면 workflow가 PR을 만들지 않습니다. 원본 저장소의 스키마나 경로가 바뀐 경우에는 scripts/item-data-sync.mjs의 source adapter와 fixture 검사를 함께 수정한 뒤 수동 workflow로 확인합니다.
