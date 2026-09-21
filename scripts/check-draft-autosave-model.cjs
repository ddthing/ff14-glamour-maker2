const assert = require("node:assert/strict");
const DraftAutosave = require("../models/draft-autosave.js");

async function testLatestWriteWins() {
  let snapshotNumber = 0;
  const writes = [];
  const pendingWrites = [];
  const status = [];
  const autosave = DraftAutosave.create({
    createSnapshot: () => ({ revision: ++snapshotNumber }),
    write: (snapshot) => {
      writes.push(snapshot.revision);
      return new Promise((resolve) => pendingWrites.push(resolve));
    },
    onSaving: () => status.push("saving"),
    onSaved: () => status.push("saved"),
    onFailed: () => status.push("failed"),
  });

  const first = autosave.save({ immediate: true });
  const second = autosave.save({ immediate: true });
  assert.strictEqual(first, second, "coalesced saves should share one completion promise");
  assert.deepEqual(writes, [1]);

  pendingWrites.shift()();
  while (pendingWrites.length < 1) await Promise.resolve();
  assert.deepEqual(writes, [1, 2], "the newest snapshot should follow an in-flight write");
  pendingWrites.shift()();
  await first;
  assert.deepEqual(status, ["saving", "saving", "saved"]);
}

async function testFlushCancelsDebounce() {
  const timers = new Map();
  let nextTimerId = 0;
  let writes = 0;
  const autosave = DraftAutosave.create({
    createSnapshot: () => ({ revision: ++writes }),
    write: async () => {},
    setTimeoutRef: (callback) => {
      const id = ++nextTimerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeoutRef: (id) => timers.delete(id),
  });

  autosave.schedule();
  autosave.schedule();
  assert.equal(timers.size, 1, "rescheduling should keep one debounce timer");
  await autosave.flush();
  assert.equal(timers.size, 0, "flush should cancel the pending debounce timer");
  assert.equal(writes, 1);
}

async function testFailureStatus() {
  let failed = 0;
  const autosave = DraftAutosave.create({
    createSnapshot: () => ({}),
    write: async () => { throw new Error("write failed"); },
    onFailed: () => { failed += 1; },
  });
  await autosave.save({ immediate: true });
  assert.equal(failed, 1, "the latest failed write should report one failure");
}

async function testCancelInvalidatesPendingRun() {
  let release;
  let saved = 0;
  const autosave = DraftAutosave.create({
    createSnapshot: () => ({}),
    write: () => new Promise((resolve) => { release = resolve; }),
    onSaved: () => { saved += 1; },
  });
  const pending = autosave.save({ immediate: true });
  autosave.cancel();
  release();
  await pending;
  assert.equal(saved, 0, "cancelled writes must not announce a stale saved state");
}

(async () => {
  await testLatestWriteWins();
  await testFlushCancelsDebounce();
  await testFailureStatus();
  await testCancelInvalidatesPendingRun();
  console.log("PASS: draft autosave coalesces writes, flushes deterministically, and reports only the latest result.");
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
