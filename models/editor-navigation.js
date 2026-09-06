/* Shared keyboard and transient-state rules for the editor shell.
   It knows no DOM: callers decide which element receives focus or closes. */
const EditorNavigation = (() => {
  const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
  function create({ panels = [], defaultPanel = "" } = {}) {
    const panelIds = new Set(panels);
    function panel(id) { return panelIds.has(id) ? id : defaultPanel; }
    function nextIndex(current, key, count) {
      if (!Number.isInteger(count) || count < 1 || !movementKeys.has(key)) return -1;
      if (key === "Home") return 0;
      if (key === "End") return count - 1;
      const direction = ["ArrowRight", "ArrowDown"].includes(key) ? 1 : -1;
      return (Math.max(0, Math.min(count - 1, Number(current) || 0)) + direction + count) % count;
    }
    function escapeAction({ dialogOpen = false, resetOpen = false, mobileSearchOpen = false } = {}) {
      if (dialogOpen) return "ignore";
      if (resetOpen) return "close-reset";
      if (mobileSearchOpen) return "close-search";
      return "none";
    }
    return { panel, nextIndex, escapeAction };
  }
  return { create, movementKeys: [...movementKeys] };
})();
if (typeof module !== "undefined") module.exports = EditorNavigation;
