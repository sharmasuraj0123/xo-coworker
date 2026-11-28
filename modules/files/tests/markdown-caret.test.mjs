// The page's caret rests hidden until the reader clicks or types, and rests again when the page loses focus.
import assert from "node:assert/strict";

const CM = await import("../../../vendor/codemirror/cm.js");
const { restingCaret } = await import("../markdown-caret.js");
const { EditorState, EditorView } = CM;

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

const resting = (state) => state.facet(EditorView.editorAttributes).some((attrs) => attrs.class === "cm-md-resting");
const blur = (state) => state.facet(EditorView.focusChangeEffect).map((f) => f(state, false)).filter(Boolean);

t("a page opens with its caret resting, and a programmatic selection leaves it resting", () => {
  const state = EditorState.create({ doc: "Some words here", extensions: restingCaret(CM) });
  assert.equal(resting(state), true);
  assert.equal(resting(state.update({ selection: { anchor: 4 } }).state), true);
});

t("a click, a selection key or typing shows the caret", () => {
  const state = EditorState.create({ doc: "Some words here", extensions: restingCaret(CM) });
  assert.equal(resting(state.update({ selection: { anchor: 4 }, userEvent: "select.pointer" }).state), false);
  assert.equal(resting(state.update({ selection: { anchor: 5 }, userEvent: "select" }).state), false);
  assert.equal(resting(state.update({ changes: { from: 0, insert: "A" }, userEvent: "input.type" }).state), false);
});

t("leaving the page puts the caret back to rest", () => {
  const opened = EditorState.create({ doc: "x", extensions: restingCaret(CM) });
  const placed = opened.update({ selection: { anchor: 1 }, userEvent: "select.pointer" }).state;
  assert.equal(resting(placed.update({ effects: blur(placed) }).state), true);
});

console.log(`${passed} passed`);
