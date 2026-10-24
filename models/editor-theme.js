// Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219
/* Runs before stylesheets so the saved/system appearance is known at first
   paint. Theme tokens are scoped by data-theme-surface; the card stays light. */
(() => {
  "use strict";

  const storageKey = "glamour-maker2-editor-theme-v1";
  const transitionClass = "u219-theme-transition";
  const transitionDarkClass = "u219-theme-transition--dark";
  const transitionLightClass = "u219-theme-transition--light";
  const SUN_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/></g></svg>';
  const MOON_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.8A5.6 5.6 0 0 1 6.2 2.5a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor"/></svg>';
  const root = document.documentElement;
  const languageLabels = {
    ko: {
      label: "화면 테마",
      light: "라이트",
      dark: "다크",
      toLight: "밝은 화면으로 전환",
      toDark: "어두운 화면으로 전환",
    },
    en: {
      label: "Editor theme",
      light: "Light",
      dark: "Dark",
      toLight: "Switch to light mode",
      toDark: "Switch to dark mode",
    },
    ja: {
      label: "画面テーマ",
      light: "ライト",
      dark: "ダーク",
      toLight: "ライトモードに切り替え",
      toDark: "ダークモードに切り替え",
    },
  };

  const normaliseTheme = (value) => value === "light" || value === "dark" ? value : null;
  let storage = null;
  let explicitTheme = null;
  let currentTheme = "light";
  let mediaQuery = null;
  let toggleButton = null;
  let toggleLabel = null;
  let toggleMark = null;
  let reducedMotionQuery = null;
  let pendingTheme = null;
  let activeTransition = null;
  let transitionRequest = 0;

  try {
    storage = window.localStorage;
    explicitTheme = normaliseTheme(storage.getItem(storageKey));
  } catch {
    storage = null;
  }

  try {
    mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)") || null;
  } catch {
    mediaQuery = null;
  }

  try {
    reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
  } catch {
    reducedMotionQuery = null;
  }

  function getSystemTheme() {
    return mediaQuery?.matches ? "dark" : "light";
  }

  function getLabels() {
    const language = String(root.lang || "ko").toLowerCase().split("-")[0];
    return languageLabels[language] || languageLabels.ko;
  }

  function updateToggle() {
    if (!toggleButton) return;
    const labels = getLabels();
    const currentLabel = currentTheme === "dark" ? labels.dark : labels.light;
    const actionLabel = currentTheme === "dark" ? labels.toLight : labels.toDark;
    toggleButton.setAttribute("aria-pressed", String(currentTheme === "dark"));
    toggleButton.setAttribute("aria-label", `${labels.label}: ${currentLabel}. ${actionLabel}`);
    toggleButton.title = actionLabel;
    if (toggleLabel) toggleLabel.textContent = currentLabel;
    if (toggleMark) {
      toggleMark.classList.add("u219-theme-icon");
      toggleMark.classList.toggle("is-dark", currentTheme === "dark");
      toggleMark.innerHTML = currentTheme === "dark" ? MOON_ICON : SUN_ICON;
    }
    toggleButton.dataset.currentTheme = currentTheme;
  }

  function applyTheme(theme) {
    currentTheme = normaliseTheme(theme) || getSystemTheme();
    root.dataset.editorTheme = currentTheme;
    updateToggle();
  }

  function clearRevealStyles() {
    root.classList.remove(transitionClass, transitionDarkClass, transitionLightClass);
    root.style.removeProperty("--u219-origin-x");
    root.style.removeProperty("--u219-origin-y");
    root.style.removeProperty("--u219-reveal-radius");
  }

  function cancelActiveTransition() {
    const transition = activeTransition;
    activeTransition = null;
    clearRevealStyles();
    try {
      transition?.skipTransition?.();
    } catch {
      // The direct theme update below remains authoritative if skipping fails.
    }
  }

  function invalidatePendingTransition() {
    transitionRequest += 1;
    pendingTheme = null;
    cancelActiveTransition();
  }

  function finishTransition(transition, requestId) {
    if (activeTransition !== transition) return;
    activeTransition = null;
    if (requestId === transitionRequest) clearRevealStyles();
  }

  function applyThemeWithReveal(theme, trigger = toggleButton) {
    const requestId = ++transitionRequest;
    pendingTheme = theme;
    const applyRequestedTheme = () => {
      if (requestId !== transitionRequest || pendingTheme !== theme) return;
      pendingTheme = null;
      applyTheme(theme);
    };
    const startTransition = document.startViewTransition;
    if (typeof startTransition !== "function" || reducedMotionQuery?.matches) {
      cancelActiveTransition();
      applyRequestedTheme();
      return;
    }

    const viewportWidth = Math.max(1, window.innerWidth || root.clientWidth);
    const viewportHeight = Math.max(1, window.innerHeight || root.clientHeight);
    const rect = trigger?.getBoundingClientRect?.();
    const originX = Math.round(rect ? rect.left + rect.width / 2 : viewportWidth / 2);
    const originY = Math.round(rect ? rect.top + rect.height / 2 : viewportHeight / 2);
    const farthestX = Math.max(originX, viewportWidth - originX);
    const farthestY = Math.max(originY, viewportHeight - originY);
    const radius = Math.ceil(Math.hypot(farthestX, farthestY));
    root.style.setProperty("--u219-origin-x", `${originX}px`);
    root.style.setProperty("--u219-origin-y", `${originY}px`);
    root.style.setProperty("--u219-reveal-radius", `${radius}px`);
    root.classList.remove(transitionDarkClass, transitionLightClass);
    root.classList.add(transitionClass, theme === "dark" ? transitionDarkClass : transitionLightClass);

    let transition;
    try {
      transition = startTransition.call(document, applyRequestedTheme);
    } catch {
      clearRevealStyles();
      applyRequestedTheme();
      return;
    }
    activeTransition = transition;
    Promise.resolve(transition.ready).catch(() => {});
    Promise.resolve(transition.updateCallbackDone).catch(() => {});
    Promise.resolve(transition.finished).then(
      () => finishTransition(transition, requestId),
      () => finishTransition(transition, requestId),
    );
  }

  function chooseTheme(theme) {
    explicitTheme = theme;
    try {
      storage ||= window.localStorage;
      storage.setItem(storageKey, theme);
    } catch {
      // Keep the chosen appearance for this session when storage is denied.
    }
    applyThemeWithReveal(theme);
  }

  function clearPreference() {
    let storageError = null;
    try {
      const activeStorage = storage || window.localStorage;
      activeStorage.removeItem(storageKey);
      storage = activeStorage;
    } catch (error) {
      storageError = error;
    }
    invalidatePendingTransition();
    explicitTheme = null;
    applyTheme(getSystemTheme());
    if (storageError) throw storageError;
  }

  function bindToggle() {
    toggleButton = document.getElementById("editorThemeToggle");
    toggleLabel = document.getElementById("editorThemeCurrent");
    toggleMark = document.getElementById("editorThemeToggleMark");
    if (!toggleButton) return;
    toggleButton.addEventListener("click", () => {
      const activeTheme = pendingTheme || currentTheme;
      chooseTheme(activeTheme === "dark" ? "light" : "dark");
    });
    updateToggle();
  }

  function onSystemThemeChange() {
    if (!explicitTheme) {
      invalidatePendingTransition();
      applyTheme(getSystemTheme());
    }
  }

  function onStorageChange(event) {
    if (event.key !== storageKey && event.key !== null) return;
    invalidatePendingTransition();
    explicitTheme = normaliseTheme(event.newValue);
    applyTheme(explicitTheme || getSystemTheme());
  }

  // The attribute is set synchronously before token and component styles load.
  applyTheme(explicitTheme || getSystemTheme());

  const languageObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "lang")) updateToggle();
  });
  languageObserver.observe(root, { attributes: true, attributeFilter: ["lang"] });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindToggle, { once: true });
  } else {
    bindToggle();
  }

  if (mediaQuery?.addEventListener) mediaQuery.addEventListener("change", onSystemThemeChange);
  else mediaQuery?.addListener?.(onSystemThemeChange);
  window.addEventListener("storage", onStorageChange);
  window.EditorTheme = Object.freeze({ clearPreference });
})();
