/* Independent public-page copy and behavior. The editor and these pages share
   the same language preference, but page copy is kept separate so legal/help
   content can evolve without making the editor's state model heavier. */
const PublicPages = (() => {
  const languagePreferenceStorageKey = "tuyeong-set-maker2-language-v1";
  const supportLinks = Object.freeze({
    buymeacoffee: "https://buymeacoffee.com/coner",
    kofi: "https://ko-fi.com/reconeur",
  });

  const copy = {
    ko: {
      "common.skip": "본문으로 건너뛰기",
      "common.brand": "투영세트메이커",
      "common.tagline": "02 · 룩북",
      "common.homeAria": "투영세트메이커 02 · 룩북 홈",
      "common.navAria": "서비스 안내",
      "common.editor": "편집기",
      "common.cardMaker": "01 · 카드 메이커",
      "common.guide": "가이드",
      "common.contact": "문의",
      "common.support": "후원",
      "common.terms": "이용약관",
      "common.privacy": "개인정보처리방침",
      "common.language": "언어",
      "common.languageAria": "페이지 언어",
      "common.updated": "최종 수정일: 2026년 9월 8일",
      "common.footerUpdated": "서비스가 바뀌면 이 안내도 함께 고칩니다.",
      "common.footerDisclaimer": "투영세트메이커는 스퀘어 에닉스와 관계없는 비공식 팬 도구입니다. FINAL FANTASY XIV 및 관련 자산의 권리는 각 권리자에게 있습니다.",
      "common.backToEditor": "편집기로 돌아가기",
      "common.external": "새 탭에서 열기",

      "terms.metaTitle": "이용약관 | 투영세트메이커 02 · 룩북",
      "terms.metaDescription": "투영세트메이커의 서비스 범위, 이용자 콘텐츠, 외부 서비스, 이용 제한과 문의 방법을 정리했습니다.",
      "terms.kicker": "서비스 기준",
      "terms.title": "이용약관",
      "terms.lead": "투영세트메이커를 사용할 때 지켜야 할 기준을 정리했습니다.",
      "terms.content": `
        <section class="public-section">
          <h2>1. 서비스 범위</h2>
          <p>투영세트메이커는 FINAL FANTASY XIV 캐릭터 이미지, 장비 정보, 문구를 조합해 개인용 코디 카드를 만들고 PNG로 저장하는 웹 도구입니다. 별도 계정 없이 브라우저에서 사용할 수 있습니다.</p>
          <p>기능, 지원 브라우저, 외부 데이터 연결은 품질 개선과 운영 상황에 따라 바뀔 수 있습니다. 서비스를 사용했다고 해서 결과물을 영구히 보관하거나 특정 기능을 계속 제공한다고 보장하지 않습니다.</p>
        </section>
        <section class="public-section">
          <h2>2. 이용자 콘텐츠와 권리</h2>
          <ul>
            <li>업로드할 사진·이미지·문구를 사용할 권리와 필요한 동의는 이용자가 직접 확보해야 합니다.</li>
            <li>타인의 개인정보, 비공개 자료, 저작권·상표권을 침해할 수 있는 자료를 허가 없이 올리지 마세요.</li>
            <li>완성된 PNG의 사용 책임은 이용자에게 있습니다. 관련 게임·캐릭터·장비의 권리는 각 권리자에게 있습니다.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>3. 비공식 팬 도구 고지</h2>
          <p>이 사이트는 스퀘어 에닉스가 운영하거나 승인한 서비스가 아닙니다. FINAL FANTASY XIV, 게임 이미지, 아이템명과 관련 자산은 각 권리자의 지식재산입니다. 권리자의 정책이나 요청에 따라 콘텐츠 표시 방식이 변경될 수 있습니다.</p>
        </section>
        <section class="public-section">
          <h2>4. 금지되는 이용</h2>
          <p>법령 위반, 타인의 권리 침해, 서비스에 과도한 부하를 주는 자동화 요청, 보안 우회·공격, 운영자 사칭은 허용되지 않습니다. 문제가 확인되면 해당 요청이나 접근을 제한할 수 있습니다.</p>
        </section>
        <section class="public-section">
          <h2>5. 외부 서비스와 변경</h2>
          <p>아이템 검색, 이미지 처리, 글꼴, 호스팅, 후원 결제에는 외부 제공자가 관여할 수 있습니다. 외부 서비스의 이용 조건과 개인정보 처리 방식은 각 제공자의 안내를 따릅니다.</p>
          <p>약관이나 서비스가 크게 바뀌면 이 페이지의 수정일과 내용을 함께 고칩니다. 변경 후에도 서비스를 계속 사용하면 변경된 기준에 동의한 것으로 볼 수 있습니다.</p>
        </section>
        <section class="public-notice">
          <h2>문의</h2>
          <p>약관, 권리 침해 신고, 콘텐츠 삭제 요청은 <a class="public-inline-link" href="../contact/">문의 페이지</a>에서 보내 주세요.</p>
        </section>`,

      "privacy.metaTitle": "개인정보처리방침 | 투영세트메이커 02 · 룩북",
      "privacy.metaDescription": "투영세트메이커가 브라우저 저장 데이터, 이미지 처리 요청, 외부 서비스와 문의 정보를 어떻게 다루는지 정리했습니다.",
      "privacy.kicker": "데이터 안내",
      "privacy.title": "개인정보처리방침",
      "privacy.lead": "브라우저에 남는 정보와 외부 서비스로 전송될 수 있는 경우를 구분해 적었습니다.",
      "privacy.content": `
        <section class="public-notice">
          <h2>먼저 확인하세요</h2>
          <ul>
            <li>계정 가입 없이 사용할 수 있습니다.</li>
            <li>룩·사진·편집 설정은 기본적으로 지금 사용하는 브라우저의 로컬 저장소와 IndexedDB에 보관됩니다.</li>
            <li>배경 제거를 요청하면 이미지가 사이트의 배경 제거 API로 전송됩니다. 서버 제공자가 따로 설정된 경우에는 처리에 필요한 범위에서 그 제공자에게도 전달될 수 있습니다.</li>
            <li>아이템을 검색하거나 아이콘을 표시할 때 외부 데이터·CDN을 요청할 수 있습니다.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>1. 처리하는 정보</h2>
          <ul>
            <li><strong>브라우저 설정:</strong> 언어 선택, 현재 룩과 편집 설정, 자동 저장 상태.</li>
            <li><strong>이용자가 선택한 파일:</strong> 카드에 추가한 이미지와 배경 제거 결과. 이미지 파일은 카드 편집과 내보내기에 필요한 범위에서 처리됩니다.</li>
            <li><strong>입력 내용:</strong> 카드 제목, 설명, 장비 선택과 배치 값.</li>
            <li><strong>문의 내용:</strong> 이메일이나 카카오톡으로 이용자가 직접 보내는 연락처와 메시지.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>2. 브라우저 저장과 삭제</h2>
          <p>룩을 계정 서버에 저장하지 않고, 다음 방문에도 이어서 쓸 수 있도록 현재 브라우저에 저장합니다. 사이트 데이터를 지우거나 다른 브라우저를 사용하면, 또는 편집기에서 전체 로컬 데이터를 삭제하면 저장된 룩과 이미지가 사라질 수 있습니다.</p>
          <p>브라우저에서 지워도 외부 제공자의 네트워크·보안 로그까지 바로 삭제된다고 보장할 수는 없습니다. 외부 제공자 로그의 보관과 삭제는 해당 제공자의 정책을 따릅니다.</p>
        </section>
        <section class="public-section">
          <h2>3. 외부 제공자</h2>
          <p>사이트 호스팅과 서버 기능, 아이템 데이터와 아이콘, 선택적 글꼴 CDN, 배경 제거 처리에는 운영에 필요한 외부 제공자가 사용될 수 있습니다. 이때 요청 IP, 브라우저 정보, 요청 시각 같은 일반적인 서버 로그가 처리될 수 있습니다. 보관 기간과 처리 장소는 각 제공자의 최신 정책에서 확인해 주세요.</p>
          <p>현재 배포 코드에는 광고·분석 쿠키를 사용하는 기능이 없습니다. 광고나 분석 도구를 추가하면 사용 목적과 선택 방법을 이 방침에 반영하겠습니다.</p>
        </section>
        <section class="public-section">
          <h2>4. 문의와 권리 요청</h2>
          <p>개인정보 관련 질문, 삭제 요청, 권리 침해 신고는 <a class="public-inline-link" href="../contact/">문의 페이지</a>의 이메일로 보내 주세요. 요청을 확인하는 데 필요한 정보가 더 있으면 추가로 요청할 수 있습니다.</p>
        </section>
        <section class="public-notice">
          <h2>방침 변경</h2>
          <p>서비스 구조나 법적 요구가 바뀌면 이 페이지를 고치고 최종 수정일을 표시합니다.</p>
        </section>`,

      "guide.metaTitle": "사용 가이드 | 투영세트메이커 02 · 룩북",
      "guide.metaDescription": "사진과 장비, 제목과 배경을 편집한 뒤 인원수별 코디 카드를 PNG로 저장하는 방법입니다.",
      "guide.kicker": "빠른 시작",
      "guide.title": "사용 가이드",
      "guide.lead": "사진과 장비, 문구를 정리한 뒤 미리보기 그대로 PNG로 저장하면 됩니다.",
      "guide.content": `
        <section class="public-section">
          <h2>1. 인원수와 사진 정하기</h2>
          <ol>
            <li>편집기에서 1~5인 구성을 고르세요. 인원수에 맞춰 카드 배치와 정보 영역이 바뀝니다.</li>
            <li>이미지 영역의 추가 버튼을 눌러 PNG, JPG, WebP 사진을 한 장 또는 여러 장 불러오세요.</li>
            <li>사진을 넣은 뒤 카드 미리보기에서 프레임, 전체 보기·채우기, 위치와 크기를 조정하세요. 배경을 제거한 뒤에도 원본으로 돌아갈 수 있습니다.</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>2. 장비 정보 추가하기</h2>
          <ol>
            <li>장비 탭에서 이름이나 ID를 검색합니다. 실제 아이템 이미지가 있으면 검색 결과에 함께 표시됩니다.</li>
            <li>아이템을 추가한 뒤 목록에서 바꾸거나 지울 수 있습니다. 3인 이상 카드의 장비 정보 표시 여부는 스타일 탭에서 정하세요.</li>
            <li>장비 정보는 카드 설정에 따라 표시됩니다. 편집 패널에 있는 모든 문구가 카드에 인쇄되는 것은 아닙니다.</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>3. 카드 꾸미기</h2>
          <ul>
            <li>제목과 설명을 입력한 뒤 왼쪽·가운데·오른쪽 정렬 중 하나를 고르세요.</li>
            <li>색상은 배경 명도에 맞춰 자동으로 고르거나 직접 지정할 수 있습니다. 이미지 실루엣 위 글자도 대비에 맞춰 조절됩니다.</li>
            <li>서체와 굵기, 테두리와 그림자, 배경·패턴·질감을 원하는 대로 조합하세요. 작은 화면에서는 컨트롤을 펼쳐 필요한 설정만 확인하면 됩니다.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>4. 미리보기와 저장 확인</h2>
          <p>내보내기 버튼을 누르면 현재 카드의 배치와 이미지 위치, 제목 스타일을 반영한 PNG가 만들어집니다. 화면의 미리보기와 같은 카드 모델로 저장하므로, 바꾼 뒤에는 미리보기를 확인하고 내보내세요.</p>
          <p>다운로드가 막히면 브라우저의 다운로드 권한, 이미지 형식, 저장 공간을 확인한 뒤 다시 시도해 주세요. 페이지는 그 다음에 새로고침하세요.</p>
        </section>
        <section class="public-grid">
          <div class="public-section">
            <h2>배경 제거가 처음일 때</h2>
            <p>브라우저 모델을 준비하는 데 시간이 걸릴 수 있습니다. 원본은 그대로 두고 결과만 바꾸며, 처리가 끝나기 전에는 실루엣 선택이 제한될 수 있습니다.</p>
          </div>
          <div class="public-section">
            <h2>언어 변경</h2>
            <p>상단에서 언어를 바꾸면 장비 이름뿐 아니라 페이지 안내, 편집기 UI와 접근성 라벨도 함께 바뀝니다. 처음 방문할 때는 브라우저 언어와 지역을 참고해 기본 언어를 정하고, 이후 선택은 이 브라우저에 저장합니다.</p>
          </div>
        </section>
        <section class="public-notice">
          <h2>도움이 더 필요하면</h2>
          <p>문제가 다시 나타나면 브라우저와 기기, 문제가 난 단계와 가능하면 화면 캡처를 함께 <a class="public-inline-link" href="../contact/">문의해 주세요</a>.</p>
        </section>`,

      "contact.metaTitle": "문의 | 투영세트메이커 02 · 룩북",
      "contact.metaDescription": "이용 문의, 오류 제보, 개인정보·권리 요청을 이메일이나 카카오톡으로 보내는 방법입니다.",
      "contact.kicker": "연락처",
      "contact.title": "문의",
      "contact.lead": "오류 제보, 이용 방법, 개인정보·권리 요청은 아래 채널로 보내 주세요.",
      "contact.content": `
        <section class="public-grid contact-grid">
          <article class="contact-card">
            <p class="contact-card-label">이메일</p>
            <h2>운영자에게 메일 보내기</h2>
            <p>답변이 필요한 문의나 개인정보 관련 요청은 이메일로 보내 주세요.</p>
            <a class="contact-card-link" href="mailto:co.conermo@gmail.com">co.conermo@gmail.com</a>
          </article>
          <article class="contact-card">
            <p class="contact-card-label">카카오톡</p>
            <h2>오픈채팅으로 문의하기</h2>
            <p>짧은 질문이나 사용 중 막힌 부분을 빠르게 남겨 주세요.</p>
            <a class="contact-card-link" href="https://open.kakao.com/o/s9xXwGjg" target="_blank" rel="noopener">카카오톡 오픈채팅 <span aria-hidden="true">↗</span></a>
          </article>
        </section>
        <section class="public-section">
          <h2>문의할 때 함께 적어 주세요</h2>
          <ul>
            <li>사용한 페이지 주소와 브라우저·기기 종류</li>
            <li>문제가 발생한 단계와 재현 방법</li>
            <li>가능하면 오류가 보이는 화면 캡처</li>
          </ul>
          <p>사진 원본, 계정 비밀번호, 민감한 개인정보는 꼭 필요한 경우가 아니면 보내지 마세요.</p>
        </section>
        <section class="public-notice">
          <h2>삭제·권리 요청</h2>
          <p>브라우저에 저장된 룩은 편집기의 전체 로컬 데이터 삭제 기능으로 지울 수 있습니다. 외부 처리나 문의 기록에 관한 요청은 원하는 조치와 확인 가능한 내용을 이메일에 적어 주세요.</p>
        </section>`,

      "support.metaTitle": "후원 | 투영세트메이커 02 · 룩북",
      "support.metaDescription": "투영세트메이커를 계속 운영할 수 있도록 Buy Me a Coffee나 Ko-fi로 일회성 후원하는 방법입니다.",
      "support.kicker": "선택적 응원",
      "support.title": "후원",
      "support.lead": "투영세트메이커 운영과 개선을 응원한다면 커피 한 잔을 보태 주세요.",
      "supportChooser.kicker": "후원 서비스 선택",
      "supportChooser.title": "원하는 후원 서비스를 골라 주세요",
      "supportChooser.description": "두 서비스 모두 외부 결제 페이지에서 한 번만 진행됩니다.",
      "supportChooser.close": "후원 서비스 선택 닫기",
      "supportChooser.buymeacoffeeMeta": "일회성 후원 · Buy Me a Coffee",
      "supportChooser.buymeacoffeeAction": "Buy Me a Coffee로 후원",
      "supportChooser.kofiMeta": "일회성 후원 · Ko-fi",
      "supportChooser.kofiAction": "Ko-fi로 후원",
      "supportChooser.note": "결제 수단과 통화는 선택한 서비스의 결제 화면에서 확인해 주세요.",
      "support.content": `
        <section class="public-notice">
          <h2>후원 안내</h2>
          <p>후원은 선택 사항이고 편집기 기능을 사용하기 위한 결제가 아닙니다. 후원 여부로 기능, 공개 범위, 문의 처리 순서가 달라지지 않습니다. 후원은 모두 일회성이며 세금공제나 기부금영수증 발급은 보장하지 않습니다.</p>
        </section>
        <section class="support-callout">
          <h2>후원 서비스 선택</h2>
          <p>두 서비스 중 편한 쪽을 고르세요. 고른 결제 페이지가 새 탭으로 열립니다.</p>
          <button class="support-action" id="supportChooserButton" type="button">후원하기</button>
          <p class="support-status">두 서비스 모두 일회성 후원입니다. 후원 여부로 기능이 달라지지는 않습니다.</p>
        </section>
        <section class="public-section">
          <h2>결제와 개인정보</h2>
          <p>후원 결제는 외부 결제 제공자가 처리하며, 이 사이트는 카드 정보를 직접 받지 않습니다. 결제 완료·환불·영수증·결제 정보 처리에 관한 내용은 해당 제공자의 안내를 먼저 확인해 주세요.</p>
          <p>후원 링크가 열리지 않거나 결제에 도움이 필요하면 <a class="public-inline-link" href="../contact/">문의 페이지</a>의 이메일로 알려 주세요.</p>
        </section>`,
    },
    en: {
      "common.skip": "Skip to content",
      "common.brand": "Glamour Set Maker",
      "common.tagline": "02 · LOOKBOOK",
      "common.homeAria": "Glamour Set Maker 02 · Lookbook home",
      "common.navAria": "Service information",
      "common.editor": "Editor",
      "common.cardMaker": "01 · CARD MAKER",
      "common.guide": "Guide",
      "common.contact": "Contact",
      "common.support": "Support",
      "common.terms": "Terms",
      "common.privacy": "Privacy",
      "common.language": "Language",
      "common.languageAria": "Page language",
      "common.updated": "Last updated: September 8, 2026",
      "common.footerUpdated": "This information is updated when the service changes.",
      "common.footerDisclaimer": "Glamour Set Maker is an unofficial fan tool and is not affiliated with Square Enix. Rights to FINAL FANTASY XIV and related assets belong to their respective owners.",
      "common.backToEditor": "Back to editor",
      "common.external": "Opens in a new tab",

      "terms.metaTitle": "Terms of Use | Glamour Set Maker 02 · LOOKBOOK",
      "terms.metaDescription": "Learn about the scope of Glamour Set Maker, user content, external services, acceptable use, and how to contact the operator.",
      "terms.kicker": "Service standards",
      "terms.title": "Terms of Use",
      "terms.lead": "These plain-language terms explain the standards that apply when you use Glamour Set Maker.",
      "terms.content": `
        <section class="public-section">
          <h2>1. What the service does</h2>
          <p>Glamour Set Maker is a web tool for combining FINAL FANTASY XIV character images, item details, and copy into personal look cards that can be saved as PNG files. It can be used in a browser without an account.</p>
          <p>Features, supported browsers, and external data connections may change as the service is improved or maintained. Using the service does not guarantee permanent storage of a result or continued availability of a particular feature.</p>
        </section>
        <section class="public-section">
          <h2>2. Your content and rights</h2>
          <ul>
            <li>You must have the rights and permissions needed to use every photo, image, and piece of copy you upload.</li>
            <li>Do not upload another person’s private information or material that may infringe copyright or trademark rights without permission.</li>
            <li>You are responsible for how you use an exported PNG. Rights to the related game, characters, and item names remain with their respective owners.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>3. Unofficial fan-tool notice</h2>
          <p>This site is not operated, endorsed, or approved by Square Enix. FINAL FANTASY XIV, game imagery, item names, and related assets are intellectual property of their respective owners. The way related content is displayed may change in response to a rights-holder policy or request.</p>
        </section>
        <section class="public-section">
          <h2>4. Prohibited use</h2>
          <p>You may not use the service unlawfully, infringe another person’s rights, overload it with automated requests, bypass or attack its security, or impersonate the operator. Access or requests may be limited when a problem is identified.</p>
        </section>
        <section class="public-section">
          <h2>5. External services and changes</h2>
          <p>External providers may be used for item search, image processing, fonts, hosting, and support payments. Their own terms and privacy notices apply to your use of those services.</p>
          <p>When these terms or the service materially change, this page and its update date will be revised. Continuing to use the service after a change means you accept the revised standards.</p>
        </section>
        <section class="public-notice">
          <h2>Questions</h2>
          <p>For terms questions, rights reports, or content deletion requests, use the <a class="public-inline-link" href="../contact/">contact page</a>.</p>
        </section>`,

      "privacy.metaTitle": "Privacy Policy | Glamour Set Maker 02 · LOOKBOOK",
      "privacy.metaDescription": "Learn how Glamour Set Maker handles browser storage, image processing requests, external services, and information sent through contact channels.",
      "privacy.kicker": "Data guide",
      "privacy.title": "Privacy Policy",
      "privacy.lead": "This page explains what stays in your browser and when information may be sent to an external service.",
      "privacy.content": `
        <section class="public-notice">
          <h2>At a glance</h2>
          <ul>
            <li>No account is required.</li>
            <li>Looks, photos, and editing settings are stored by default in the local storage and IndexedDB of the browser you use.</li>
            <li>When you request background removal, the image is sent to the site’s background-removal API. If a server provider is configured, it may be forwarded there only as needed for processing.</li>
            <li>Item search and icon display may create requests to external data services and CDNs.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>1. Information we process</h2>
          <ul>
            <li><strong>Browser settings:</strong> language choice, the current look and editing settings, and auto-save state.</li>
            <li><strong>Files you choose:</strong> images added to a card and background-removal results. Images are processed only as needed for editing and export.</li>
            <li><strong>Your input:</strong> card titles, descriptions, item choices, and placement values.</li>
            <li><strong>Contact messages:</strong> the address and message you choose to send by email or KakaoTalk.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>2. Browser storage and deletion</h2>
          <p>The service uses local browser storage to help you return to your looks; it does not require an account-based look library. Clearing site data, switching browsers, or using the editor’s delete-all-local-data action can remove saved looks and images.</p>
          <p>Deleting browser data cannot be promised to immediately remove external provider network or security logs. Retention and deletion of those logs follow the relevant provider’s policy.</p>
        </section>
        <section class="public-section">
          <h2>3. External providers</h2>
          <p>Operational providers may be used for site hosting and server functions, item data and icons, an optional font CDN, and background-removal processing. Ordinary server logs such as request IP, browser information, and request time may be processed. Check each provider’s current policy for its actual retention period and processing location.</p>
          <p>The current deployed code does not include an advertising or analytics-cookie feature. If advertising or analytics is added later, its purpose and available choices will be described here.</p>
        </section>
        <section class="public-section">
          <h2>4. Questions and requests</h2>
          <p>For privacy questions, deletion requests, or rights reports, use the email listed on the <a class="public-inline-link" href="../contact/">contact page</a>. We may ask for information needed to verify and act on a request.</p>
        </section>
        <section class="public-notice">
          <h2>Changes to this policy</h2>
          <p>This page and its update date will be revised when the service structure or legal requirements change.</p>
        </section>`,

      "guide.metaTitle": "User Guide | Glamour Set Maker 02 · LOOKBOOK",
      "guide.metaDescription": "Learn how to add photos and item details, style a card, and export matching PNGs for one to five characters in Glamour Set Maker.",
      "guide.kicker": "Quick start",
      "guide.title": "User Guide",
      "guide.lead": "Add photos, organize item details and copy, then export a PNG from the same card state you see in the preview.",
      "guide.content": `
        <section class="public-section">
          <h2>1. Choose people and photos</h2>
          <ol>
            <li>Choose a one- to five-person layout in the editor. The card arrangement and information area adapt to the count.</li>
            <li>Use the image area’s add button to import one or more PNG, JPG, or WebP photos.</li>
            <li>After adding a photo, adjust its frame, contain or cover mode, position, and scale in the card preview. Background removal can be reversed to the original.</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>2. Add item details</h2>
          <ol>
            <li>Search by item name or ID in the Items tab. Search results show the actual item image when available.</li>
            <li>After adding an item, change or remove it from the list. For three or more people, you can also control whether item details appear on the card.</li>
            <li>Item details appear according to the card settings; text from every editing panel is not printed on the card automatically.</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>3. Style the card</h2>
          <ul>
            <li>Enter a title and description, then choose left, center, or right alignment relative to the card.</li>
            <li>Text color can be chosen automatically for readable contrast or set manually. Text over a character silhouette also adapts with contrast in mind.</li>
            <li>Combine typeface, weight, outline, shadow, background, pattern, and texture. On small screens, expand only the controls you need.</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>4. Check the preview and save</h2>
          <p>Export uses the current card model for placement, image position, and title styling. The preview and PNG share that model, so after a change, confirm that the latest preview is visible and export again.</p>
          <p>If the download is blocked, check browser download permissions, image format, and available storage. Try again before refreshing the page.</p>
        </section>
        <section class="public-grid">
          <div class="public-section">
            <h2>First background removal</h2>
            <p>The browser model may take time to prepare. The original is kept while only the result changes, and silhouette selection may remain limited until processing finishes.</p>
          </div>
          <div class="public-section">
            <h2>Changing language</h2>
            <p>The language selector changes page guidance, editor UI, accessibility labels, and item names—not only equipment labels. On first visit, the default follows browser language and region; your later choice is remembered in this browser.</p>
          </div>
        </section>
        <section class="public-notice">
          <h2>Need help?</h2>
          <p>If a problem can be reproduced, include your browser and device, the step where it happened, and a screenshot when possible on the <a class="public-inline-link" href="../contact/">contact page</a>.</p>
        </section>`,

      "contact.metaTitle": "Contact | Glamour Set Maker 02 · LOOKBOOK",
      "contact.metaDescription": "Contact Glamour Set Maker by email or KakaoTalk for questions, bug reports, privacy requests, and rights reports.",
      "contact.kicker": "Get in touch",
      "contact.title": "Contact",
      "contact.lead": "Send questions, bug reports, privacy requests, or rights reports through one of the channels below.",
      "contact.content": `
        <section class="public-grid contact-grid">
          <article class="contact-card">
            <p class="contact-card-label">Email</p>
            <h2>Email the operator</h2>
            <p>Best for a reply, privacy request, or rights-related report.</p>
            <a class="contact-card-link" href="mailto:co.conermo@gmail.com">co.conermo@gmail.com</a>
          </article>
          <article class="contact-card">
            <p class="contact-card-label">KakaoTalk</p>
            <h2>Open KakaoTalk chat</h2>
            <p>Useful for a short question or a quick report about a blocked step.</p>
            <a class="contact-card-link" href="https://open.kakao.com/o/s9xXwGjg" target="_blank" rel="noopener">Open KakaoTalk chat <span aria-hidden="true">↗</span></a>
          </article>
        </section>
        <section class="public-section">
          <h2>Include these details</h2>
          <ul>
            <li>The page URL and your browser and device</li>
            <li>The step where the problem happened and how to reproduce it</li>
            <li>A screenshot of the error when possible</li>
          </ul>
          <p>Do not send original photos, passwords, or sensitive personal information unless it is necessary to resolve the issue.</p>
        </section>
        <section class="public-notice">
          <h2>Deletion and rights requests</h2>
          <p>You can remove looks saved in this browser with the editor’s delete-all-local-data action. For external processing or a contact record, email the requested action and enough detail to identify it.</p>
        </section>`,

      "support.metaTitle": "Support | Glamour Set Maker 02 · LOOKBOOK",
      "support.metaDescription": "Learn how to leave a one-time coffee-sized tip through Buy Me a Coffee or Ko-fi to help keep Glamour Set Maker maintained.",
      "support.kicker": "Optional support",
      "support.title": "Support",
      "support.lead": "A coffee-sized tip can help keep Glamour Set Maker available and maintained.",
      "supportChooser.kicker": "Choose a support service",
      "supportChooser.title": "Choose where you would like to support",
      "supportChooser.description": "Both options open an external checkout for a one-time tip.",
      "supportChooser.close": "Close support service chooser",
      "supportChooser.buymeacoffeeMeta": "One-time support · Buy Me a Coffee",
      "supportChooser.buymeacoffeeAction": "Support on Buy Me a Coffee",
      "supportChooser.kofiMeta": "One-time support · Ko-fi",
      "supportChooser.kofiAction": "Support on Ko-fi",
      "supportChooser.note": "Available payment methods and currencies are shown on the selected service’s checkout.",
      "support.content": `
        <section class="public-notice">
          <h2>How support works</h2>
          <p>Support is optional and is not a payment required to use the editor. It does not change features, access, or response order. Support is presented as a one-time tip; tax deductions or charitable receipts are not promised.</p>
        </section>
        <section class="support-callout">
          <h2>Choose a support service</h2>
          <p>Choose whichever is more convenient: Buy Me a Coffee or Ko-fi. The selected payment page opens in a new tab.</p>
          <button class="support-action" id="supportChooserButton" type="button">Support</button>
          <p class="support-status">Both options are one-time support; support does not change access or features.</p>
        </section>
        <section class="public-section">
          <h2>Payments and privacy</h2>
          <p>External payment providers process support payments. This site does not directly receive card numbers. Check the provider’s guidance first for payment completion, refunds, receipts, and payment-data handling.</p>
          <p>If a support link does not work or you need payment-related help, use the email on the <a class="public-inline-link" href="../contact/">contact page</a>.</p>
        </section>`,
    },
    ja: {
      "common.skip": "本文へスキップ",
      "common.brand": "ミラプリセットメーカー",
      "common.tagline": "02 · ルックブック",
      "common.homeAria": "ミラプリセットメーカー 02 · ルックブック ホーム",
      "common.navAria": "サービス案内",
      "common.editor": "エディター",
      "common.cardMaker": "01 · カードメーカー",
      "common.guide": "ガイド",
      "common.contact": "お問い合わせ",
      "common.support": "サポート",
      "common.terms": "利用規約",
      "common.privacy": "プライバシー",
      "common.language": "言語",
      "common.languageAria": "ページの言語",
      "common.updated": "最終更新日: 2026年9月8日",
      "common.footerUpdated": "サービスの変更に合わせてこの案内も更新します。",
      "common.footerDisclaimer": "ミラプリセットメーカーはスクウェア・エニックスとは関係のない非公式ファンツールです。FINAL FANTASY XIVおよび関連アセットの権利は各権利者に帰属します。",
      "common.backToEditor": "エディターに戻る",
      "common.external": "新しいタブで開きます",

      "terms.metaTitle": "利用規約 | ミラプリセットメーカー 02 · ルックブック",
      "terms.metaDescription": "ミラプリセットメーカーのサービス範囲、ユーザーコンテンツ、外部サービス、禁止事項、お問い合わせ方法を案内します。",
      "terms.kicker": "サービス基準",
      "terms.title": "利用規約",
      "terms.lead": "ミラプリセットメーカーを利用する際の基準を、読みやすい文章でまとめています。",
      "terms.content": `
        <section class="public-section">
          <h2>1. サービスの範囲</h2>
          <p>ミラプリセットメーカーは、FINAL FANTASY XIVのキャラクター画像、アイテム情報、テキストを組み合わせ、個人用のコーデカードを作成してPNGで保存できるウェブツールです。アカウントなしでブラウザから利用できます。</p>
          <p>機能、対応ブラウザ、外部データ接続は改善や運用状況により変更される場合があります。利用によって成果物の永久保存や特定機能の継続提供が保証されるものではありません。</p>
        </section>
        <section class="public-section">
          <h2>2. ユーザーコンテンツと権利</h2>
          <ul>
            <li>アップロードする写真、画像、テキストを利用する権利と必要な同意はユーザーが確保してください。</li>
            <li>第三者の個人情報、または著作権・商標権を侵害するおそれのある素材を許可なくアップロードしないでください。</li>
            <li>書き出したPNGの利用責任はユーザーにあります。ゲーム、キャラクター、アイテム名に関する権利は各権利者に帰属します。</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>3. 非公式ファンツールに関する表示</h2>
          <p>このサイトはスクウェア・エニックスが運営、承認、認可するサービスではありません。FINAL FANTASY XIV、ゲーム画像、アイテム名、関連アセットの知的財産権は各権利者に帰属します。権利者の方針や要請に応じて表示方法を変更することがあります。</p>
        </section>
        <section class="public-section">
          <h2>4. 禁止される利用</h2>
          <p>法令違反、第三者の権利侵害、過度な自動リクエストによる負荷、セキュリティの回避・攻撃、運営者へのなりすましは禁止します。問題が確認された場合、リクエストやアクセスを制限することがあります。</p>
        </section>
        <section class="public-section">
          <h2>5. 外部サービスと変更</h2>
          <p>アイテム検索、画像処理、フォント、ホスティング、サポート決済には外部提供者が使われる場合があります。それらの利用には各提供者の利用規約とプライバシー通知が適用されます。</p>
          <p>規約やサービスに大きな変更がある場合、このページと更新日を改訂します。変更後も利用を続けた場合、改訂後の基準に同意したものとみなされます。</p>
        </section>
        <section class="public-notice">
          <h2>お問い合わせ</h2>
          <p>規約に関する質問、権利侵害の報告、コンテンツ削除の依頼は<a class="public-inline-link" href="../contact/">お問い合わせページ</a>からお送りください。</p>
        </section>`,

      "privacy.metaTitle": "プライバシーポリシー | ミラプリセットメーカー 02 · ルックブック",
      "privacy.metaDescription": "ミラプリセットメーカーがブラウザ保存、画像処理リクエスト、外部サービス、お問い合わせ情報をどのように扱うか説明します。",
      "privacy.kicker": "データ案内",
      "privacy.title": "プライバシーポリシー",
      "privacy.lead": "ブラウザに残る情報と、外部サービスへ送信される可能性がある情報を説明します。",
      "privacy.content": `
        <section class="public-notice">
          <h2>まずご確認ください</h2>
          <ul>
            <li>アカウント登録は必要ありません。</li>
            <li>ルック、写真、編集設定は基本的に利用中のブラウザのローカルストレージとIndexedDBに保存されます。</li>
            <li>背景削除を依頼すると画像がサイトの背景削除APIへ送信されます。サーバー提供者が設定された環境では、処理に必要な範囲でその提供者へ転送される場合があります。</li>
            <li>アイテム検索とアイコン表示では、外部データサービスやCDNへのリクエストが発生する場合があります。</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>1. 処理する情報</h2>
          <ul>
            <li><strong>ブラウザ設定:</strong> 言語の選択、現在のルックと編集設定、自動保存の状態。</li>
            <li><strong>選択したファイル:</strong> カードに追加した画像と背景削除の結果。画像は編集と書き出しに必要な範囲で処理されます。</li>
            <li><strong>入力内容:</strong> カードのタイトル、説明、アイテム選択、配置値。</li>
            <li><strong>お問い合わせ内容:</strong> メールやKakaoTalkでユーザーが送信する連絡先とメッセージ。</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>2. ブラウザ保存と削除</h2>
          <p>アカウント型のルックライブラリではなく、次回の編集を助けるためにブラウザのローカル保存を使用します。サイトデータの削除、別ブラウザの利用、またはエディターのローカルデータ全削除によって保存済みのルックや画像が消える場合があります。</p>
          <p>ブラウザから削除しても、外部提供者のネットワークログやセキュリティログまで直ちに削除されるとは限りません。これらの保存・削除は各提供者のポリシーに従います。</p>
        </section>
        <section class="public-section">
          <h2>3. 外部提供者</h2>
          <p>サイトのホスティングとサーバー機能、アイテムデータとアイコン、任意のフォントCDN、背景削除処理には運用に必要な外部提供者が使われる場合があります。リクエストIP、ブラウザ情報、リクエスト時刻など一般的なサーバーログが処理されることがあります。保存期間や処理場所は各提供者の最新ポリシーをご確認ください。</p>
          <p>現在のデプロイコードには広告・分析Cookieを使う機能は含まれていません。将来追加する場合は、目的と選択方法をこのポリシーに反映します。</p>
        </section>
        <section class="public-section">
          <h2>4. お問い合わせと請求</h2>
          <p>プライバシーに関する質問、削除依頼、権利に関する報告は<a class="public-inline-link" href="../contact/">お問い合わせページ</a>のメールアドレスへお送りください。対応に必要な情報の追加をお願いする場合があります。</p>
        </section>
        <section class="public-notice">
          <h2>ポリシーの変更</h2>
          <p>サービス構成や法的要件が変わった場合、このページと更新日を改訂します。</p>
        </section>`,

      "guide.metaTitle": "使い方ガイド | ミラプリセットメーカー 02 · ルックブック",
      "guide.metaDescription": "ミラプリセットメーカーで写真、アイテム、タイトル、背景を編集し、1～5人のコーデカードをPNGで保存する方法を案内します。",
      "guide.kicker": "クイックスタート",
      "guide.title": "使い方ガイド",
      "guide.lead": "写真を追加し、アイテムとテキストを整えて、プレビューと同じ状態のPNGを書き出します。",
      "guide.content": `
        <section class="public-section">
          <h2>1. 人数と写真を選ぶ</h2>
          <ol>
            <li>エディターで1～5人のレイアウトを選びます。人数に合わせてカードの配置と情報エリアが変わります。</li>
            <li>画像エリアの追加ボタンからPNG、JPG、WebPの写真を1枚または複数枚読み込みます。</li>
            <li>写真を追加したら、カードプレビューでフレーム、全体表示・塗りつぶし、位置、サイズを調整します。背景削除を使っても元画像へ戻せます。</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>2. アイテム情報を追加する</h2>
          <ol>
            <li>アイテムタブで名前またはIDを検索します。可能な場合、検索結果には実際のアイテム画像が表示されます。</li>
            <li>追加したアイテムはリストから変更または削除できます。3人以上のカードではアイテム情報を表示するかもスタイルタブで設定できます。</li>
            <li>アイテム情報はカード設定に応じて表示されます。すべての編集パネルの説明文が自動でカードに印刷されるわけではありません。</li>
          </ol>
        </section>
        <section class="public-section">
          <h2>3. カードを整える</h2>
          <ul>
            <li>タイトルと説明を入力し、カードを基準に左・中央・右の配置を選びます。</li>
            <li>色は読みやすいコントラストになるよう自動選択するか、手動で指定できます。シルエット上の文字もコントラストを考慮して調整されます。</li>
            <li>書体、太さ、縁取り、影、背景、パターン、テクスチャを組み合わせます。小さい画面では必要な設定だけを開けます。</li>
          </ul>
        </section>
        <section class="public-section">
          <h2>4. プレビューと保存を確認する</h2>
          <p>書き出しでは現在のカードモデルを使い、配置、画像位置、タイトルのスタイルをPNGに反映します。プレビューとPNGは同じモデルを使うため、変更後に最新プレビューを確認してからもう一度書き出してください。</p>
          <p>ダウンロードできない場合は、ブラウザのダウンロード権限、画像形式、保存容量を確認し、ページを再読み込みする前に再試行してください。</p>
        </section>
        <section class="public-grid">
          <div class="public-section">
            <h2>背景削除が初めての場合</h2>
            <p>ブラウザモデルの準備に時間がかかることがあります。元画像を保持したまま結果だけを変更し、処理が終わるまでシルエットの選択が制限される場合があります。</p>
          </div>
          <div class="public-section">
            <h2>言語を変更する</h2>
            <p>言語選択は装備名だけでなく、ページ案内、エディターUI、アクセシビリティラベルにも適用されます。初回はブラウザの言語と地域を参考に初期言語を決め、その後の選択はこのブラウザに保存します。</p>
          </div>
        </section>
        <section class="public-notice">
          <h2>さらにサポートが必要な場合</h2>
          <p>問題を再現できる場合は、ブラウザと端末、発生した手順、可能ならスクリーンショットを添えて<a class="public-inline-link" href="../contact/">お問い合わせください</a>。</p>
        </section>`,

      "contact.metaTitle": "お問い合わせ | ミラプリセットメーカー 02 · ルックブック",
      "contact.metaDescription": "ミラプリセットメーカーへの質問、バグ報告、プライバシーや権利に関する依頼をメールとKakaoTalkで送る方法を案内します。",
      "contact.kicker": "連絡先",
      "contact.title": "お問い合わせ",
      "contact.lead": "不具合、使い方、プライバシーや権利に関する依頼を以下の窓口へお送りください。",
      "contact.content": `
        <section class="public-grid contact-grid">
          <article class="contact-card">
            <p class="contact-card-label">メール</p>
            <h2>運営者へメールする</h2>
            <p>返信が必要な質問、プライバシーの依頼、権利に関する報告に適しています。</p>
            <a class="contact-card-link" href="mailto:co.conermo@gmail.com">co.conermo@gmail.com</a>
          </article>
          <article class="contact-card">
            <p class="contact-card-label">KakaoTalk</p>
            <h2>オープンチャットで相談する</h2>
            <p>短い質問や、途中で進めなくなった場合の簡単な報告に利用できます。</p>
            <a class="contact-card-link" href="https://open.kakao.com/o/s9xXwGjg" target="_blank" rel="noopener">KakaoTalkオープンチャット <span aria-hidden="true">↗</span></a>
          </article>
        </section>
        <section class="public-section">
          <h2>一緒にお知らせください</h2>
          <ul>
            <li>ページのURL、ブラウザ、端末の種類</li>
            <li>問題が起きた手順と再現方法</li>
            <li>可能であればエラー画面のスクリーンショット</li>
          </ul>
          <p>元画像、パスワード、機微な個人情報は、問題解決に必要な場合以外は送らないでください。</p>
        </section>
        <section class="public-notice">
          <h2>削除・権利に関する依頼</h2>
          <p>このブラウザに保存されたルックは、エディターのローカルデータ全削除で消去できます。外部処理やお問い合わせ記録については、希望する対応と確認に必要な情報をメールでお知らせください。</p>
        </section>`,

      "support.metaTitle": "サポート | ミラプリセットメーカー 02 · ルックブック",
      "support.metaDescription": "ミラプリセットメーカーの運営と改善を支えるため、Buy Me a CoffeeまたはKo-fiで一度だけコーヒー代程度を送る方法を案内します。",
      "support.kicker": "任意の応援",
      "support.title": "サポート",
      "support.lead": "コーヒー一杯分の応援が、ミラプリセットメーカーの継続運営と改善に役立ちます。",
      "supportChooser.kicker": "サポートサービスを選択",
      "supportChooser.title": "応援するサービスを選んでください",
      "supportChooser.description": "どちらも外部決済ページで一回限りのチップを送れます。",
      "supportChooser.close": "サポートサービスの選択を閉じる",
      "supportChooser.buymeacoffeeMeta": "一回限りの応援 · Buy Me a Coffee",
      "supportChooser.buymeacoffeeAction": "Buy Me a Coffeeで応援する",
      "supportChooser.kofiMeta": "一回限りの応援 · Ko-fi",
      "supportChooser.kofiAction": "Ko-fiで応援する",
      "supportChooser.note": "利用できる決済方法と通貨は、選択したサービスの決済画面で確認できます。",
      "support.content": `
        <section class="public-notice">
          <h2>サポートについて</h2>
          <p>サポートは任意であり、エディター利用のための支払いではありません。サポートの有無によって機能、アクセス、返信の順番は変わりません。一度きりのチップとして案内しており、税控除や寄付金領収書の発行を保証するものではありません。</p>
        </section>
        <section class="support-callout">
          <h2>サポートサービスを選択</h2>
          <p>Buy Me a CoffeeとKo-fiから使いやすいサービスを選んでください。選択した決済ページが新しいタブで開きます。</p>
          <button class="support-action" id="supportChooserButton" type="button">サポートする</button>
          <p class="support-status">どちらも一回限りの応援で、機能やアクセスは変わりません。</p>
        </section>
        <section class="public-section">
          <h2>決済とプライバシー</h2>
          <p>サポートの決済は外部決済事業者が処理します。このサイトがカード番号を直接受け取ることはありません。決済完了、返金、領収書、決済データの扱いについては各提供者の案内を確認してください。</p>
          <p>リンクが動作しない場合や決済について相談したい場合は、<a class="public-inline-link" href="../contact/">お問い合わせページ</a>のメールをご利用ください。</p>
        </section>`,
    },
  };

  function resolveRoot(root) {
    return root || (typeof document !== "undefined" ? document : null);
  }

  function getStorage() {
    try { return globalThis.localStorage; } catch { return null; }
  }

  function getInitialLanguage() {
    const saved = (() => {
      try { return getStorage()?.getItem(languagePreferenceStorageKey) || ""; } catch { return ""; }
    })();
    if (globalThis.I18n?.supportedLanguages?.includes(saved)) return saved;
    return globalThis.I18n?.detectLanguage ? globalThis.I18n.detectLanguage() : "ko";
  }

  function translate(key, language) {
    const dictionary = copy[language] || copy.ko;
    return dictionary[key] ?? copy.ko[key] ?? key;
  }

  function apply(root, language = getInitialLanguage()) {
    const pageRoot = resolveRoot(root);
    const selected = globalThis.I18n?.normaliseLanguage
      ? globalThis.I18n.normaliseLanguage(language)
      : (copy[language] ? language : "ko");
    if (!pageRoot?.querySelectorAll) return selected;

    pageRoot.documentElement?.setAttribute("lang", selected);
    pageRoot.querySelectorAll("[data-page-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.pageI18n, selected);
    });
    pageRoot.querySelectorAll("[data-page-i18n-html]").forEach((element) => {
      element.innerHTML = translate(element.dataset.pageI18nHtml, selected);
    });
    [
      ["aria-label", "data-page-i18n-aria-label"],
      ["title", "data-page-i18n-title"],
      ["content", "data-page-i18n-content"],
      ["placeholder", "data-page-i18n-placeholder"],
      ["alt", "data-page-i18n-alt"],
    ].forEach(([attribute, marker]) => {
      pageRoot.querySelectorAll(`[${marker}]`).forEach((element) => {
        element.setAttribute(attribute, translate(element.getAttribute(marker), selected));
      });
    });

    const currentPage = pageRoot.documentElement?.dataset.publicPage || "";
    pageRoot.querySelectorAll("[data-page-nav]").forEach((element) => {
      if (element.dataset.pageNav === currentPage) element.setAttribute("aria-current", "page");
      else element.removeAttribute("aria-current");
    });
    const languageSelect = pageRoot.querySelector("#pageLanguageSelect");
    if (languageSelect) languageSelect.value = selected;
    applySupportLinks(pageRoot);
    bindSupportChooser(pageRoot);
    return selected;
  }

  function applySupportLinks(root) {
    root.querySelectorAll("[data-support-key]").forEach((element) => {
      const url = supportLinks[element.dataset.supportKey] || "";
      element.classList.toggle("is-pending", !url);
      if (url) {
        element.setAttribute("href", url);
        element.removeAttribute("aria-disabled");
        element.removeAttribute("tabindex");
        if (/^https?:\/\//i.test(url)) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener");
        }
      } else {
        element.removeAttribute("href");
        element.setAttribute("aria-disabled", "true");
        element.setAttribute("tabindex", "-1");
      }
    });
  }

  function bindSupportChooser(root) {
    const trigger = root.querySelector("#supportChooserButton");
    const dialog = root.querySelector("#supportChooser");
    if (!trigger || !dialog) return;

    if (trigger.dataset.initialized !== "true") {
      trigger.dataset.initialized = "true";
      trigger.addEventListener("click", () => {
        if (dialog.open) return;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      });
    }

    if (dialog.dataset.initialized === "true") return;
    dialog.dataset.initialized = "true";
    const closeDialog = () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
    root.querySelector("#supportChooserClose")?.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", () => root.querySelector("#supportChooserButton")?.focus());
    dialog.querySelectorAll("[data-support-key]").forEach((option) => {
      option.addEventListener("click", () => {
        window.setTimeout(closeDialog, 0);
      });
    });
  }

  function persistLanguage(language) {
    try { getStorage()?.setItem(languagePreferenceStorageKey, language); } catch { /* private browsing can reject storage */ }
  }

  function init(root) {
    const pageRoot = resolveRoot(root);
    if (!pageRoot?.querySelector) return "";
    const languageSelect = pageRoot.querySelector("#pageLanguageSelect");
    const initialLanguage = apply(pageRoot, getInitialLanguage());
    if (languageSelect && languageSelect.dataset.initialized !== "true") {
      languageSelect.dataset.initialized = "true";
      languageSelect.addEventListener("change", (event) => {
        const selected = apply(pageRoot, event.currentTarget.value);
        persistLanguage(selected);
      });
    }
    return initialLanguage;
  }

  return {
    copy,
    supportLinks,
    languagePreferenceStorageKey,
    getInitialLanguage,
    apply,
    applySupportLinks,
    bindSupportChooser,
    init,
  };
})();

if (typeof globalThis !== "undefined") globalThis.PublicPages = PublicPages;
if (typeof module !== "undefined") module.exports = PublicPages;

if (typeof document !== "undefined") {
  const start = () => PublicPages.init(document);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
