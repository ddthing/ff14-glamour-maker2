/*
 * Coalesce editor changes into ordered draft writes.
 *
 * The editor owns snapshot creation and status copy; this module owns the
 * timing contract: a queued save runs once, an in-flight save is followed by
 * the newest snapshot, and stale completions never report a final status.
 */
const DraftAutosave = (() => {
  function create({
    createSnapshot,
    write,
    onSaving = () => {},
    onSaved = () => {},
    onFailed = () => {},
    debounceMs = 180,
    setTimeoutRef = globalThis.setTimeout,
    clearTimeoutRef = globalThis.clearTimeout,
    queueMicrotaskRef = globalThis.queueMicrotask,
  } = {}) {
    if (typeof createSnapshot !== "function") throw new TypeError("DraftAutosave needs a snapshot factory.");
    if (typeof write !== "function") throw new TypeError("DraftAutosave needs a write function.");
    if (typeof setTimeoutRef !== "function" || typeof clearTimeoutRef !== "function") {
      throw new TypeError("DraftAutosave needs timer functions.");
    }

    const queueMicrotask = typeof queueMicrotaskRef === "function"
      ? queueMicrotaskRef
      : (callback) => Promise.resolve().then(callback);
    let scheduledTimer = null;
    let saveSequence = 0;
    let activeRun = null;

    function clearScheduledSave() {
      if (scheduledTimer === null) return;
      clearTimeoutRef(scheduledTimer);
      scheduledTimer = null;
    }

    function finish(run, sequence, failed) {
      if (run.cancelled) {
        if (activeRun === run) activeRun = null;
        run.resolve();
        return;
      }
      if (run.needsRun) {
        void startRun(run);
        return;
      }
      if (activeRun === run) activeRun = null;
      if (sequence === saveSequence) {
        if (failed) onFailed();
        else onSaved();
      }
      run.resolve();
    }

    function startRun(run) {
      run.needsRun = false;
      run.started = true;
      const sequence = run.latestSequence;
      onSaving();
      let writePromise;
      try {
        writePromise = write(createSnapshot());
      } catch {
        finish(run, sequence, true);
        return;
      }
      return Promise.resolve(writePromise)
        .then(() => finish(run, sequence, false))
        .catch(() => finish(run, sequence, true));
    }

    function save({ immediate = false } = {}) {
      clearScheduledSave();
      if (activeRun?.cancelled) activeRun = null;
      const sequence = ++saveSequence;
      if (activeRun) {
        activeRun.latestSequence = sequence;
        activeRun.needsRun = true;
        if (immediate && !activeRun.started) void startRun(activeRun);
        return activeRun.promise;
      }

      const run = {
        latestSequence: sequence,
        needsRun: false,
        started: false,
        promise: null,
        resolve: null,
      };
      run.promise = new Promise((resolve) => { run.resolve = resolve; });
      activeRun = run;
      if (immediate) {
        void startRun(run);
      } else {
        queueMicrotask(() => {
          if (activeRun === run && !run.started && !run.cancelled) void startRun(run);
        });
      }
      return run.promise;
    }

    function schedule() {
      clearScheduledSave();
      scheduledTimer = setTimeoutRef(() => {
        scheduledTimer = null;
        void save();
      }, debounceMs);
    }

    function flush() {
      if (scheduledTimer === null && !activeRun) return;
      clearScheduledSave();
      return save({ immediate: true });
    }

    function cancel() {
      clearScheduledSave();
      saveSequence += 1;
      if (activeRun) {
        activeRun.cancelled = true;
        activeRun.needsRun = false;
      }
    }

    return Object.freeze({ schedule, flush, save, cancel });
  }

  return Object.freeze({ create });
})();

if (typeof module !== "undefined") module.exports = DraftAutosave;
