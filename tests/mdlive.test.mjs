// Markdown as a page (js/mdlive.js): tables, rules, display math and ```math, ```mermaid, ```chart blocks are drawn
// whole; with the caret inside one its source shows with its drawing kept under it (a rule is always drawn); plain
// fenced code stays text. The file's text is never changed. Node, with the vendored CodeMirror's state (no view, no browser).
//   node tests/mdlive.test.mjs
import assert from "node:assert/strict";

const CM = await import("../js/vendor/codemirror/cm.js");
// js/rich.js reads the page's theme and makes a canvas when it loads: the least of a page for it (set after the editor's
// own code has loaded, which reads `document` only when it's there)
globalThis.document = { documentElement: { dataset: {} }, createElement: () => ({ getContext: () => null }), querySelector: () => null };
globalThis.addEventListener ??= () => {};
const { pageView, toggleMark } = await import("../js/mdlive.js");
const { EditorState, EditorView, markdown, markdownLanguage, ensureSyntaxTree } = CM;

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const DOC = [
  "# Title",                 // 1
  "",                        // 2
  "| a | b |",               // 3
  "|---|---|",               // 4
  "| 1 | 2 |",               // 5
  "",                        // 6
  "```mermaid",              // 7
  "graph TD; A-->B",         // 8
  "```",                     // 9
  "",                        // 10
  "```js",                   // 11
  "const x = 1;",            // 12
  "```",                     // 13
  "",                        // 14
  "$$x^2$$",                 // 15
  "",                        // 16
  "---",                     // 17
  "",                        // 18
  "End.",                    // 19
].join("\n");

function blocks(anchorLine) {
  let state = EditorState.create({ doc: DOC, extensions: [markdown({ base: markdownLanguage }), pageView(CM)] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  state = state.update({ selection: { anchor: state.doc.line(anchorLine).from } }).state;
  const out = [];
  for (const v of state.facet(EditorView.decorations)) {
    if (typeof v === "function") continue;
    v.between(0, state.doc.length, (from, to, d) => { if (d.spec.block) out.push([state.doc.lineAt(from).number, state.doc.lineAt(to).number]); });
  }
  return { out, state };
}

t("with the caret on the last line: the table, the diagram, the formula and the rule are drawn whole; code stays text", () => {
  const { out } = blocks(19);
  assert.deepEqual(out, [[3, 5], [7, 9], [15, 15], [17, 17]]);
});

t("the caret inside a table, a diagram or a formula: its source to type in, its drawing kept right under it", () => {
  assert.deepEqual(blocks(4).out, [[5, 5], [7, 9], [15, 15], [17, 17]], "in the table: drawn under its last line");
  assert.deepEqual(blocks(8).out, [[3, 5], [9, 9], [15, 15], [17, 17]], "in the diagram");
});

t("a rule is drawn even with the caret on it (no mode to fall into)", () => {
  assert.deepEqual(blocks(17).out, [[3, 5], [7, 9], [15, 15], [17, 17]]);
});

t("the text is the file's, byte for byte", () => {
  const { state } = blocks(19);
  assert.equal(state.doc.toString(), DOC);
});

t("⌘B on a word makes it bold; on a bold word takes it away; with nothing selected, the pair and the caret between", () => {
  let st = EditorState.create({ doc: "make this bold", selection: { anchor: 10, head: 14 } });
  st = st.update(toggleMark(CM, st, "**")).state;
  assert.equal(st.doc.toString(), "make this **bold**");
  assert.equal(st.sliceDoc(st.selection.main.from, st.selection.main.to), "bold", "the word stays selected");
  st = st.update(toggleMark(CM, st, "**")).state;
  assert.equal(st.doc.toString(), "make this bold");
  let e = EditorState.create({ doc: "ab", selection: { anchor: 1 } });
  e = e.update(toggleMark(CM, e, "*")).state;
  assert.equal(e.doc.toString(), "a**b");
  assert.equal(e.selection.main.head, 2);
});

console.log(`${passed} passed`);
