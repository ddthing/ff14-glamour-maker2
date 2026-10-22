/* Runs before stylesheets so the saved/system appearance is known at first
   paint. Theme tokens are scoped by data-theme-surface; the card stays light. */
(() => {
  "use strict";

  const storageKey = "glamour-maker2-editor-theme-v1";
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
    if (toggleMark) toggleMark.textContent = currentTheme === "dark" ? "☾" : "☀";
    toggleButton.dataset.currentTheme = currentTheme;
  }

  function applyTheme(theme) {
    currentTheme = normaliseTheme(theme) || getSystemTheme();
    root.dataset.editorTheme = currentTheme;
    updateToggle();
  }

  function chooseTheme(theme) {
    explicitTheme = theme;
    try {
      storage ||= window.localStorage;
      storage.setItem(storageKey, theme);
    } catch {
      // Keep the chosen appearance for this session when storage is denied.
    }
    applyTheme(theme);
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
    explicitTheme = null;
    applyTheme(getSystemTheme());
    if (storageError) throw storageError;
  }

  function bindToggle() {
    toggleButton = document.getElementById("editorThemeToggle");
    toggleLabel = document.getElementById("editorThemeCurrent");
    toggleMark = document.getElementById("editorThemeToggleMark");
    if (!toggleButton) return;
    toggleButton.addEventListener("click", () => chooseTheme(currentTheme === "dark" ? "light" : "dark"));
    updateToggle();
  }

  function onSystemThemeChange() {
    if (!explicitTheme) applyTheme(getSystemTheme());
  }

  function onStorageChange(event) {
    if (event.key !== storageKey && event.key !== null) return;
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
