const assert = require("node:assert/strict");
const EditorHistory = require("../models/editor-history.js");

const history = [];
const redo = ["stale"];
const historyReference = history;
const redoReference = redo;

EditorHistory.record({ history, redo, snapshot: "first" });
assert.deepEqual(history, ["first"]);
assert.deepEqual(redo, [], "a new edit must invalidate the redo branch");
assert.strictEqual(history, historyReference, "history transitions must preserve the caller-owned array");
assert.strictEqual(redo, redoReference, "redo transitions must preserve the caller-owned array");

const undone = EditorHistory.undo({ history, redo, current: "second" });
assert.equal(undone, "first");
assert.deepEqual(history, []);
assert.deepEqual(redo, ["second"]);

const redone = EditorHistory.redo({ history, redo, current: "first" });
assert.equal(redone, "second");
assert.deepEqual(history, ["first"]);
assert.deepEqual(redo, []);

for (let index = 0; index < 30; index += 1) {
  EditorHistory.record({ history, redo, snapshot: index });
}
assert.equal(history.length, EditorHistory.defaultLimit, "history must keep the configured bounded depth");
assert.equal(history[0], 5, "the oldest snapshot should be evicted first");
assert.equal(EditorHistory.undo({ history, redo, current: "latest" }), 29);
assert.equal(redo.at(-1), "latest");
assert.equal(EditorHistory.undo({ history: [], redo: [], current: "ignored" }), null);
assert.equal(EditorHistory.redo({ history: [], redo: [], current: "ignored" }), null);

console.log("PASS: editor history owns bounded stack transitions without replacing caller state.");
