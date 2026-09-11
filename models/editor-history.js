/* Pure undo/redo transitions for the editor. The caller owns the snapshot
   objects and arrays; this module owns stack semantics and the history cap. */
const EditorHistory = (() => {
  const defaultLimit = 25;

  function normaliseLimit(value) {
    const limit = Number(value);
    return Number.isInteger(limit) && limit > 0 ? limit : defaultLimit;
  }

  function stackOrEmpty(value) {
    return Array.isArray(value) ? value : [];
  }

  function trimToLimit(stack, limit) {
    while (stack.length > limit) stack.shift();
  }

  function record({ history, redo: future, snapshot, limit = defaultLimit } = {}) {
    const past = stackOrEmpty(history);
    const next = stackOrEmpty(future);
    if (snapshot === undefined) return;
    past.push(snapshot);
    trimToLimit(past, normaliseLimit(limit));
    next.length = 0;
  }

  function undo({ history, redo: future, current, limit = defaultLimit } = {}) {
    const past = stackOrEmpty(history);
    const next = stackOrEmpty(future);
    if (!past.length) return null;
    const previous = past.pop();
    if (current !== undefined) {
      next.push(current);
      trimToLimit(next, normaliseLimit(limit));
    }
    return previous;
  }

  function redo({ history, redo: future, current, limit = defaultLimit } = {}) {
    const past = stackOrEmpty(history);
    const next = stackOrEmpty(future);
    if (!next.length) return null;
    const nextSnapshot = next.pop();
    if (current !== undefined) {
      past.push(current);
      trimToLimit(past, normaliseLimit(limit));
    }
    return nextSnapshot;
  }

  return Object.freeze({ defaultLimit, record, undo, redo });
})();

if (typeof module !== "undefined") module.exports = EditorHistory;
