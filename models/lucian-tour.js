// Lucian UX/UI Prompt #197 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#197
(() => {
  "use strict";

  const copy = {
    ko: {
      trigger: "사용법",
      dialog: "편집기 사용법 안내",
      close: "닫기",
      previous: "이전",
      next: "다음",
      finish: "완료",
      steps: [
        { title: "사진 추가", description: "선택한 캐릭터 칸을 눌러 사진을 추가하거나 바꿔요." },
        { title: "인원 구성", description: "꾸미기 탭에서 1~5인 구성을 정하면 카드 배치도 함께 바뀝니다." },
        { title: "장비 찾기", description: "장비 탭의 검색창에서 아이템 이름을 찾아 슬롯에 연결해요." },
        { title: "카드 분위기", description: "꾸미기 탭에서 배경색, 패턴, 질감을 골라 카드 분위기를 정해요." },
        { title: "PNG 저장", description: "사진을 추가한 뒤 여기서 선택한 비율의 고화질 PNG를 저장해요." },
      ],
    },
    en: {
      trigger: "How to use",
      dialog: "Editor usage guide",
      close: "Close",
      previous: "Previous",
      next: "Next",
      finish: "Done",
      steps: [
        { title: "Add a photo", description: "Select a character tile to add a photo or replace its current one." },
        { title: "Choose the cast", description: "Set one to five characters in Style; the card layout updates with your choice." },
        { title: "Find gear", description: "Open Items and search by name to link a piece to its slot." },
        { title: "Set the mood", description: "Choose a background color, pattern, and texture in Style." },
        { title: "Save a PNG", description: "After adding a photo, save a high-resolution PNG in the selected ratio." },
      ],
    },
    ja: {
      trigger: "使い方",
      dialog: "エディターの使い方ガイド",
      close: "閉じる",
      previous: "前へ",
      next: "次へ",
      finish: "完了",
      steps: [
        { title: "写真を追加", description: "キャラクターの枠を選ぶと、写真を追加または変更できます。" },
        { title: "人数を選択", description: "スタイルで1〜5人を選ぶと、カードの配置も切り替わります。" },
        { title: "装備を検索", description: "装備タブを開き、名前で検索してスロットに登録します。" },
        { title: "カードを整える", description: "スタイルで背景色、パターン、質感を選びます。" },
        { title: "PNGを保存", description: "写真を追加したら、選択した比率で高画質PNGを保存できます。" },
      ],
    },
  };

  const stepCount = 5;
  const padding = 6;
  let trigger = null;
  let overlay = null;
  let spotlight = null;
  let ring = null;
  let tip = null;
  let stepCountLabel = null;
  let stepTitle = null;
  let stepDescription = null;
  let dots = null;
  let previousButton = null;
  let nextButton = null;
  let closeButton = null;
  let currentIndex = -1;
  let currentTarget = null;
  let initialPanel = "stylePanel";
  let returnFocus = null;
  let hole = null;
  let animationDestination = null;
  let animationFrame = 0;
  let layoutFrame = 0;
  let resizeObserver = null;
  let ignoreInitialResizeObservation = false;
  let suppressScheduledLayout = false;
  let languageObserver = null;
  let motionQuery = null;
  let reducedMotion = false;
  let isOpen = false;

  const currentLanguage = () => {
    const value = String(document.documentElement.lang || "ko").toLowerCase().split("-")[0];
    return copy[value] ? value : "ko";
  };

  const messages = () => copy[currentLanguage()];

  function panelId() {
    return document.querySelector('#itemsTab[aria-selected="true"]') ? "itemsPanel" : "stylePanel";
  }

  function selectPanel(id) {
    const targetTab = document.querySelector(id === "itemsPanel" ? "#itemsTab" : "#styleTab");
    if (targetTab && targetTab.getAttribute("aria-selected") !== "true") targetTab.click();
  }

  function panelForStep(index) {
    if (index === 1 || index === 3) return "stylePanel";
    if (index === 2) return "itemsPanel";
    return null;
  }

  function getTarget(index) {
    if (index === 0) {
      const selected = document.querySelector("#portraitWrap .character-figure.is-selected");
      if (selected?.classList.contains("is-empty")) return selected.querySelector(".character-empty-mark") || selected;
      if (selected) {
        const selectedIndex = Number(selected.dataset.characterIndex ?? 0);
        return document.querySelector(`[data-character-image-action="change"][data-character-image-action-index="${selectedIndex}"]`) || selected;
      }
      const emptyTile = document.querySelector("#portraitWrap .character-figure.is-empty");
      return emptyTile?.querySelector(".character-empty-mark") || emptyTile;
    }
    if (index === 1) return document.querySelector("#castCountControl") || document.querySelector("#styleTab");
    if (index === 2) return document.querySelector("#itemSearch") || document.querySelector("#itemsTab");
    if (index === 3) {
      const palette = document.querySelector("#backdropGrid");
      const viewport = getViewport();
      const rect = palette?.getBoundingClientRect();
      if (isVisible(palette) && rect.width <= viewport.width - 24 && rect.height <= viewport.height - 24) return palette;
      return document.querySelector('#backdropGrid [data-background].is-selected') || document.querySelector("#styleTab");
    }
    return document.querySelector("#exportButton");
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || element.closest("[hidden]")) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function getViewport() {
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
    };
  }

  function targetRect(element) {
    const rect = element.getBoundingClientRect();
    const viewport = getViewport();
    const left = Math.max(0, Math.min(viewport.width, rect.left - padding));
    const top = Math.max(0, Math.min(viewport.height, rect.top - padding));
    const right = Math.max(left, Math.min(viewport.width, rect.right + padding));
    const bottom = Math.max(top, Math.min(viewport.height, rect.bottom + padding));
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function setCurrentTarget(element) {
    if (element === currentTarget) return;
    resizeObserver?.disconnect();
    currentTarget = element;
    if (currentTarget && resizeObserver) {
      ignoreInitialResizeObservation = true;
      resizeObserver.observe(currentTarget);
    }
  }

  function pathFor(holeRect) {
    const viewport = getViewport();
    const x = holeRect.x;
    const y = holeRect.y;
    const width = holeRect.w;
    const height = holeRect.h;
    const radius = Math.min(14, width / 2, height / 2);
    return `M0 0H${viewport.width}V${viewport.height}H0Z M${x + radius} ${y}H${x + width - radius}Q${x + width} ${y} ${x + width} ${y + radius}V${y + height - radius}Q${x + width} ${y + height} ${x + width - radius} ${y + height}H${x + radius}Q${x} ${y + height} ${x} ${y + height - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z`;
  }

  function paint(holeRect) {
    const viewport = getViewport();
    spotlight.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
    spotlight.setAttribute("width", String(viewport.width));
    spotlight.setAttribute("height", String(viewport.height));
    spotlight.querySelector("path").setAttribute("d", pathFor(holeRect));
    ring.style.transform = `translate(${holeRect.x.toFixed(1)}px, ${holeRect.y.toFixed(1)}px)`;
    ring.style.width = `${holeRect.w.toFixed(1)}px`;
    ring.style.height = `${holeRect.h.toFixed(1)}px`;
    ring.style.borderRadius = `${Math.min(14, holeRect.w / 2, holeRect.h / 2)}px`;
    hole = holeRect;
    overlay.dataset.targetId = currentTarget?.id || currentTarget?.className || "";
    overlay.dataset.targetRect = `${holeRect.x.toFixed(1)},${holeRect.y.toFixed(1)},${holeRect.w.toFixed(1)},${holeRect.h.toFixed(1)}`;
  }

  function sameRect(a, b) {
    return Boolean(a && b)
      && Math.abs(a.x - b.x) <= 0.5
      && Math.abs(a.y - b.y) <= 0.5
      && Math.abs(a.w - b.w) <= 0.5
      && Math.abs(a.h - b.h) <= 0.5;
  }

  // #197 keeps its 520 ms overshoot and 1.4 tension curve as the spotlight moves.
  function moveHole(to) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationDestination = to;
    if (reducedMotion) {
      paint(to);
      animationFrame = 0;
      animationDestination = null;
      return;
    }
    const from = hole || { x: to.x + to.w / 2, y: to.y + to.h / 2, w: 0, h: 0 };
    const startedAt = performance.now();
    const animate = (now) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 520));
      const tension = 1.4;
      const eased = 1 + (tension + 1) * Math.pow(progress - 1, 3) + tension * Math.pow(progress - 1, 2);
      paint({
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        w: Math.max(0, from.w + (to.w - from.w) * eased),
        h: Math.max(0, from.h + (to.h - from.h) * eased),
      });
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
      else {
        animationFrame = 0;
        animationDestination = null;
      }
    };
    animate(startedAt);
  }

  function layoutTip(rect) {
    const viewport = getViewport();
    const margin = 12;
    const edge = 12;
    const tipWidth = Math.max(1, Math.min(224, viewport.width - edge * 2));
    tip.style.width = `${tipWidth}px`;
    tip.classList.remove("dn", "up", "rt", "lt");
    const tipHeight = tip.offsetHeight;
    let side;
    let left;
    let top;
    if (rect.y + rect.h + margin + tipHeight <= viewport.height - edge) side = "dn";
    else if (rect.y - margin - tipHeight >= edge) side = "up";
    else if (rect.x + rect.w + margin + tipWidth <= viewport.width - edge) side = "rt";
    else if (rect.x - margin - tipWidth >= edge) side = "lt";
    else side = "up";

    tip.classList.add(side);
    if (side === "rt" || side === "lt") {
      left = side === "rt" ? rect.x + rect.w + margin : rect.x - margin - tipWidth;
      top = Math.max(edge, Math.min(viewport.height - tipHeight - edge, rect.y + rect.h / 2 - tipHeight / 2));
      const pointerY = Math.max(16, Math.min(tipHeight - 16, rect.y + rect.h / 2 - top));
      tip.style.setProperty("--ay", `${pointerY}px`);
    } else {
      left = Math.max(edge, Math.min(viewport.width - tipWidth - edge, rect.x + rect.w / 2 - tipWidth / 2));
      top = side === "dn" ? rect.y + rect.h + margin : rect.y - margin - tipHeight;
      const pointerX = Math.max(18, Math.min(tipWidth - 18, rect.x + rect.w / 2 - left));
      tip.style.setProperty("--ax", `${pointerX}px`);
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(edge, Math.min(viewport.height - tipHeight - edge, top))}px`;
  }

  function scheduleLayout({ animate = false } = {}) {
    if (!isOpen || layoutFrame || suppressScheduledLayout) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      refreshTarget({ animate });
    });
  }

  function refreshTarget({ animate = false } = {}) {
    const nextTarget = getTarget(currentIndex);
    if (!isVisible(nextTarget)) return;
    setCurrentTarget(nextTarget);
    const rect = targetRect(currentTarget);
    layoutTip(rect);
    if (animate) {
      if (animationFrame && sameRect(animationDestination, rect)) return;
      moveHole(rect);
    }
    else {
      if (animationFrame && !reducedMotion && sameRect(animationDestination, rect)) return;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      animationDestination = null;
      paint(rect);
    }
  }

  function scrollTargetIntoView(target) {
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    const viewport = getViewport();
    const fullyVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewport.height && rect.right <= viewport.width;
    if (!fullyVisible) {
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      return true;
    }
    return false;
  }

  function updateCopy() {
    const locale = messages();
    trigger.querySelector(".editor-tour-trigger-label")?.replaceChildren(document.createTextNode(locale.trigger));
    trigger.setAttribute("aria-label", locale.trigger);
    trigger.title = locale.trigger;
    tip.setAttribute("aria-label", locale.dialog);
    closeButton.textContent = locale.close;
    previousButton.textContent = locale.previous;
    nextButton.textContent = currentIndex === stepCount - 1 ? locale.finish : locale.next;
    if (currentIndex < 0) return;
    const step = locale.steps[currentIndex];
    stepCountLabel.textContent = `${currentIndex + 1} / ${stepCount}`;
    stepTitle.textContent = step.title;
    stepDescription.textContent = step.description;
    previousButton.hidden = currentIndex === 0;
    Array.prototype.forEach.call(dots.children, (dot, index) => {
      dot.classList.toggle("on", index === currentIndex);
      if (index === currentIndex) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  }

  function setStep(index) {
    currentIndex = Math.max(0, Math.min(stepCount - 1, Number(index) || 0));
    const panel = panelForStep(currentIndex);
    let needsPostScrollLayout = false;
    suppressScheduledLayout = true;
    try {
      if (panel) selectPanel(panel);
      updateCopy();
      let nextTarget = getTarget(currentIndex);
      if (!isVisible(nextTarget)) {
        const fallback = document.querySelector(currentIndex === 2 ? "#itemsTab" : "#styleTab");
        nextTarget = isVisible(fallback) ? fallback : null;
      }
      if (!nextTarget) return;
      needsPostScrollLayout = scrollTargetIntoView(nextTarget);
      setCurrentTarget(nextTarget);
      refreshTarget({ animate: true });
    } finally {
      suppressScheduledLayout = false;
    }
    if (needsPostScrollLayout) scheduleLayout({ animate: true });
    nextButton.focus({ preventScroll: true });
  }

  function next() {
    if (!isOpen) return;
    if (currentIndex < stepCount - 1) setStep(currentIndex + 1);
    else close();
  }

  function previous() {
    if (isOpen && currentIndex > 0) setStep(currentIndex - 1);
  }

  function begin() {
    if (isOpen) return;
    isOpen = true;
    document.body.classList.add("u197-tour-active");
    returnFocus = trigger;
    initialPanel = panelId();
    currentIndex = 0;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("is-tour");
    trigger.setAttribute("aria-expanded", "true");
    attachListeners();
    setStep(0);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove("u197-tour-active");
    overlay.classList.remove("is-tour");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    detachListeners();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    animationFrame = 0;
    layoutFrame = 0;
    animationDestination = null;
    resizeObserver?.disconnect();
    currentIndex = -1;
    currentTarget = null;
    hole = null;
    if (initialPanel) selectPanel(initialPanel);
    (returnFocus?.isConnected ? returnFocus : trigger).focus({ preventScroll: true });
    returnFocus = null;
  }

  function focusableNodes() {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const targetRoot = currentTarget?.matches(selector) ? currentTarget : currentTarget?.closest("button") || currentTarget;
    const targetNodes = targetRoot
      ? targetRoot.matches(selector) ? [targetRoot] : [...targetRoot.querySelectorAll(selector)]
      : [];
    const nodes = [closeButton, ...targetNodes, previousButton, nextButton].filter((element, index, all) => {
      if (!element || all.indexOf(element) !== index || !isVisible(element)) return false;
      if (element.matches(selector)) return true;
      return false;
    });
    return nodes;
  }

  function isEditable(element) {
    return element instanceof HTMLElement && (element.isContentEditable || element.matches("input, textarea, select"));
  }

  function onKeydown(event) {
    if (!isOpen) return;
    if (document.querySelector("dialog[open], .u267-picker.is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      const focusables = focusableNodes();
      if (!focusables.length) return;
      const index = focusables.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? index <= 0 ? focusables.length - 1 : index - 1
        : index < 0 || index === focusables.length - 1 ? 0 : index + 1;
      event.preventDefault();
      focusables[nextIndex].focus({ preventScroll: true });
      return;
    }
    if (isEditable(event.target)) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
      return;
    }
  }

  function onPageClick(event) {
    if (!isOpen || overlay.contains(event.target)) return;
    scheduleLayout();
  }

  function onScroll() {
    scheduleLayout();
  }

  function onResize() {
    const target = getTarget(currentIndex);
    if (isVisible(target)) scrollTargetIntoView(target);
    scheduleLayout();
  }

  function onMotionChange(event) {
    reducedMotion = event.matches;
    if (!isOpen) return;
    if (reducedMotion) {
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      layoutFrame = 0;
      refreshTarget();
      return;
    }
    scheduleLayout({ animate: true });
  }

  function attachListeners() {
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("click", onPageClick, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("scroll", onScroll, { passive: true });
  }

  function detachListeners() {
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("click", onPageClick, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("scroll", onScroll);
  }

  function init() {
    trigger = document.getElementById("editorTourButton");
    if (!trigger) return;
    trigger.classList.add("ux", "u197-start");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "editorTourOverlay");
    trigger.setAttribute("aria-expanded", "false");

    overlay = document.createElement("div");
    overlay.id = "editorTourOverlay";
    overlay.className = "ux u197";
    overlay.dataset.themeSurface = "";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <svg class="u197-ov" aria-hidden="true" preserveAspectRatio="none"><path fill-rule="evenodd"></path></svg>
      <i class="u197-ring" aria-hidden="true"></i>
      <section class="u197-tip dn" role="dialog" aria-labelledby="editorTourTitle" aria-describedby="editorTourDescription" tabindex="-1">
        <button class="u197-x" type="button" data-tour-close></button>
        <div class="u197-copy" aria-live="polite">
          <small class="u197-count"></small>
          <h2 id="editorTourTitle"></h2>
          <p id="editorTourDescription"></p>
        </div>
        <div class="u197-tf">
          <span class="u197-dots" aria-hidden="true"></span>
          <button class="u197-pv" type="button" data-tour-previous></button>
          <button class="u197-nx" type="button" data-tour-next></button>
        </div>
      </section>`;
    document.body.append(overlay);
    spotlight = overlay.querySelector(".u197-ov");
    ring = overlay.querySelector(".u197-ring");
    tip = overlay.querySelector(".u197-tip");
    stepCountLabel = overlay.querySelector(".u197-count");
    stepTitle = overlay.querySelector("#editorTourTitle");
    stepDescription = overlay.querySelector("#editorTourDescription");
    dots = overlay.querySelector(".u197-dots");
    previousButton = overlay.querySelector("[data-tour-previous]");
    nextButton = overlay.querySelector("[data-tour-next]");
    closeButton = overlay.querySelector("[data-tour-close]");
    for (let index = 0; index < stepCount; index += 1) dots.append(document.createElement("i"));

    resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      if (ignoreInitialResizeObservation) {
        ignoreInitialResizeObservation = false;
        return;
      }
      scheduleLayout();
    }) : null;
    trigger.addEventListener("click", begin);
    nextButton.addEventListener("click", next);
    previousButton.addEventListener("click", previous);
    closeButton.addEventListener("click", close);
    spotlight.addEventListener("click", (event) => {
      if (event.target === spotlight.querySelector("path")) {
        event.preventDefault();
        nextButton.focus({ preventScroll: true });
      }
    });
    motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    reducedMotion = Boolean(motionQuery?.matches);
    if (motionQuery?.addEventListener) motionQuery.addEventListener("change", onMotionChange);
    else motionQuery?.addListener?.(onMotionChange);
    languageObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.attributeName === "lang")) return;
      updateCopy();
      if (isOpen) scheduleLayout();
    });
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    updateCopy();
  }

  function getState() {
    return {
      open: isOpen,
      stepIndex: currentIndex,
      targetId: overlay?.dataset.targetId || "",
      targetIndex: currentTarget?.dataset.characterImageActionIndex || currentTarget?.dataset.characterIndex || "",
      targetRect: overlay?.dataset.targetRect || "",
      reducedMotion,
      animating: animationFrame !== 0,
      activePanel: panelId(),
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  window.LucianTour = Object.freeze({ open: begin, close, next, previous, getState });
})();
