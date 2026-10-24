// Lucian UX/UI Prompt #267 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#267
(() => {
  "use strict";

  const languages = [
    { code: "KO", lang: "ko", name: "한국어", flag: "🇰🇷" },
    { code: "EN", lang: "en", name: "English", flag: "🇺🇸" },
    { code: "JA", lang: "ja", name: "日本語", flag: "🇯🇵" },
  ];
  const labelsByLanguage = {
    ko: { picker: "언어 선택", current: (name) => `현재 언어: ${name}`, list: "언어 선택" },
    en: { picker: "Choose language", current: (name) => `Current language: ${name}`, list: "Choose language" },
    ja: { picker: "言語を選択", current: (name) => `現在の言語: ${name}`, list: "言語を選択" },
  };
  const transitionSelectors = [
    ".wordmark-copy strong",
    ".wordmark-copy small",
    "#imageSection > .panel-section-head h2",
    "#copyEditorSection > .panel-section-head h2",
    "#cardStyleSection > .panel-section-head h2",
  ];

  function mount() {
    const select = document.getElementById("languageSelect");
    const nativeLabel = select?.closest("label.language-select-control");
    if (!select || !nativeLabel || nativeLabel.closest(".u267-picker")) return;

    const picker = document.createElement("div");
    picker.className = "ux u267 u267-picker";
    picker.setAttribute("data-lucian-language-picker", "");

    const nav = document.createElement("div");
    nav.className = "u267-nv";

    const anchor = document.createElement("div");
    anchor.className = "u267-anchor";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "languagePickerToggle";
    toggle.className = "u267-gb";
    toggle.setAttribute("aria-haspopup", "listbox");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "languagePickerMenu");
    toggle.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 7h11M7 1.5c1.8 1.6 1.8 9.4 0 11M7 1.5c-1.8 1.6-1.8 9.4 0 11" fill="none" stroke="currentColor" stroke-width="1.3"/></svg><span class="u267-cd" aria-hidden="true"></span>';

    const menu = document.createElement("div");
    menu.className = "u267-dd";
    menu.id = "languagePickerMenu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-orientation", "vertical");
    menu.setAttribute("aria-hidden", "true");

    const options = languages.map((language) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "u267-op";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.tabIndex = -1;
      option.lang = language.lang;
      option.dataset.language = language.lang;
      option.innerHTML = '<em aria-hidden="true"></em><span></span><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      option.querySelector("em").textContent = language.flag;
      option.querySelector("span").textContent = language.name;
      menu.appendChild(option);
      return option;
    });

    nav.appendChild(anchor);
    anchor.append(toggle, menu);
    nativeLabel.parentNode.insertBefore(picker, nativeLabel);
    picker.append(nav, nativeLabel);
    nativeLabel.classList.add("u267-native");
    nativeLabel.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    let currentLanguage = select.value;
    let transitionGeneration = 0;
    let open = false;
    let timers = [];
    const pendingTransitions = new Map();
    let lastCopyTexts = new Map();

    function localeLabels() {
      const current = String(document.documentElement.lang || "ko").toLowerCase().split("-")[0];
      return labelsByLanguage[current] || labelsByLanguage.ko;
    }

    function updatePicker() {
      const selected = languages.find((language) => language.lang === select.value) || languages[0];
      const text = localeLabels();
      currentLanguage = selected.lang;
      toggle.querySelector(".u267-cd").textContent = selected.code;
      toggle.setAttribute("aria-label", `${text.picker}. ${text.current(selected.name)}.`);
      menu.setAttribute("aria-label", text.list);
      options.forEach((option) => {
        const isSelected = option.dataset.language === selected.lang;
        option.classList.toggle("is-on", isSelected);
        option.setAttribute("aria-selected", String(isSelected));
        option.tabIndex = open && isSelected ? 0 : -1;
      });
    }

    function readCopyTexts() {
      return new Map(transitionSelectors
        .map((selector) => document.querySelector(selector))
        .filter((element) => element?.hasAttribute("data-i18n") && element.isConnected)
        .map((element) => [element, element.textContent]));
    }

    function onOutsidePointer(event) {
      if (!picker.contains(event.target)) setOpen(false);
    }

    function setOpen(next, focusSelected = false, returnFocus = false) {
      open = Boolean(next);
      picker.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      updatePicker();
      if (open) {
        document.addEventListener("pointerdown", onOutsidePointer, true);
        if (focusSelected) options.find((option) => option.dataset.language === select.value)?.focus();
      } else {
        document.removeEventListener("pointerdown", onOutsidePointer, true);
        if (returnFocus) toggle.focus({ preventScroll: true });
      }
    }

    function restorePendingCopy() {
      pendingTransitions.forEach((text, element) => {
        if (element.isConnected) element.textContent = text;
      });
      pendingTransitions.clear();
    }

    function cancelTextTransitions() {
      transitionGeneration += 1;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [];
      restorePendingCopy();
      return transitionGeneration;
    }

    function transitionCopy(changes, generation) {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      changes.forEach((change, index) => {
        pendingTransitions.set(change.element, change.nextText);
        const start = window.setTimeout(() => {
          if (generation !== transitionGeneration || !change.element.isConnected) return;
          const outgoing = document.createElement("span");
          outgoing.className = "u267-sw is-go";
          const outgoingText = document.createElement("span");
          outgoingText.textContent = change.oldText;
          outgoing.appendChild(outgoingText);
          change.element.replaceChildren(outgoing);

          const finish = window.setTimeout(() => {
            if (generation !== transitionGeneration || !change.element.isConnected) return;
            const incoming = document.createElement("span");
            incoming.className = "u267-sw";
            const incomingText = document.createElement("span");
            incomingText.textContent = change.nextText;
            incoming.appendChild(incomingText);
            change.element.replaceChildren(incoming);
            void incoming.offsetWidth;
            incoming.classList.add("is-in");

            const cleanup = window.setTimeout(() => {
              if (generation !== transitionGeneration) return;
              incoming.classList.remove("is-in");
              pendingTransitions.delete(change.element);
            }, 380);
            timers.push(cleanup);
          }, 260);
          timers.push(finish);
        }, index * 45);
        timers.push(start);
      });
    }

    function captureLanguageChange() {
      const generation = cancelTextTransitions();
      const nextLanguage = select.value;
      if (nextLanguage === currentLanguage) {
        return;
      }
      const before = [...lastCopyTexts.entries()]
        .filter(([element]) => element.isConnected)
        .map(([element, oldText]) => ({ element, oldText }));

      Promise.resolve().then(() => {
        if (generation !== transitionGeneration || select.value !== nextLanguage) return;
        const changes = before
          .map(({ element, oldText }) => ({ element, oldText, nextText: element.textContent }))
          .filter(({ element, oldText, nextText }) => element.isConnected && oldText !== nextText);
        lastCopyTexts = readCopyTexts();
        currentLanguage = nextLanguage;
        updatePicker();
        transitionCopy(changes, generation);
      });
    }

    const languageObserver = new MutationObserver(() => {
      const documentLanguage = String(document.documentElement.lang || "").toLowerCase().split("-")[0];
      const nextLanguage = languages.some((language) => language.lang === documentLanguage) ? documentLanguage : select.value;
      if (!languages.some((language) => language.lang === nextLanguage) || nextLanguage === currentLanguage) {
        updatePicker();
        return;
      }
      const generation = cancelTextTransitions();
      const before = [...lastCopyTexts.entries()]
        .filter(([element]) => element.isConnected)
        .map(([element, oldText]) => ({ element, oldText }));
      select.value = nextLanguage;
      currentLanguage = nextLanguage;
      closeIfOpen();
      updatePicker();
      const changes = before
        .map(({ element, oldText }) => ({ element, oldText, nextText: element.textContent }))
        .filter(({ element, oldText, nextText }) => element.isConnected && oldText !== nextText);
      lastCopyTexts = readCopyTexts();
      transitionCopy(changes, generation);
    });
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    function chooseLanguage(language) {
      if (!languages.some((entry) => entry.lang === language)) return;
      setOpen(false);
      if (select.value !== language) {
        select.value = language;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener("click", () => setOpen(!open, !open));
    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".u267-op[lang]");
      if (option && menu.contains(option)) chooseLanguage(option.lang);
    });

    picker.addEventListener("keydown", (event) => {
      const option = event.target.closest(".u267-op[lang]");
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false, false, true);
        return;
      }
      if (event.target === toggle && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setOpen(true, true);
        return;
      }
      if (!option || !open) return;
      if (event.key === "Tab") {
        Promise.resolve().then(() => setOpen(false));
        return;
      }
      const index = options.indexOf(option);
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
      else if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = options.length - 1;
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseLanguage(option.lang);
        return;
      } else return;
      event.preventDefault();
      options[nextIndex].focus();
    });

    select.addEventListener("change", captureLanguageChange, true);
    select.addEventListener("change", () => {
      closeIfOpen();
      currentLanguage = select.value;
      updatePicker();
    });

    function closeIfOpen() {
      if (open) setOpen(false);
    }

    currentLanguage = select.value;
    lastCopyTexts = readCopyTexts();
    updatePicker();

    window.addEventListener("pagehide", () => languageObserver.disconnect(), { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
