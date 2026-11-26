// A paragraph wrapped across source lines reads as one flowing paragraph, and Enter in it starts a new one.
import assert from "node:assert/strict";

const CM = await import("../../../vendor/codemirror/cm.js");
const { breakParagraph, createFlowField } = await import("../markdown-flow.js");
const { EditorState, StateField, markdown, syntaxTree } = CM;

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

/** @param {string} doc @param {{blocks?: {from: number, to: number}[], frontTo?: number}} [page] */
function flowed(doc, { blocks = [], frontTo = -1 } = {}) {
  const field = StateField.define({ create: () => ({ blocks, captions: [], notesAt: null, frontTo }), update: (v) => v });
  const flow = createFlowField(CM, field);
  const state = EditorState.create({ doc, extensions: [markdown(), field, flow] });
  const joined = [];
  state.field(flow).between(0, doc.length, (from, to) => { joined.push(doc.slice(from, to)); });
  return joined;
}

t("soft breaks inside a paragraph join, hard breaks and paragraph gaps stay", () => {
  assert.deepEqual(flowed("one\ntwo  \nthree\\\nfour\n\nfive"), ["\n"]);
  assert.deepEqual(flowed("a\nb\n\nc\nd"), ["\n", "\n"]);
});

t("a wrapped list item joins its continuation indent, and a quote its markers", () => {
  assert.deepEqual(flowed("1. first line\n   goes on\n2. next"), ["\n   "]);
  assert.deepEqual(flowed("> quoted\n> more"), ["\n> "]);
});

t("drawn blocks and front matter keep their lines", () => {
  const doc = "---\ntitle: x\ndate: y\n---\n\nbody\ntext";
  assert.deepEqual(flowed(doc, { frontTo: doc.indexOf("\n\n") }), ["\n"]);
  assert.deepEqual(flowed("a\nb", { blocks: [{ from: 0, to: 3 }] }), []);
});

/** @param {string} doc @param {number} at */
const enter = (doc, at) => {
  const state = EditorState.create({ doc, selection: { anchor: at }, extensions: markdown() });
  const spec = breakParagraph(syntaxTree, state);
  return spec && state.update(spec).state.doc.toString();
};

t("Enter in a paragraph starts a new paragraph, keeping a quote's markers", () => {
  assert.equal(enter("one two\nthree", 3), "one\n\n two\nthree");
  assert.equal(enter("> one two", 5), "> one\n>\n>  two");
});

t("Enter in a list item or code leaves the editor's own Enter to it", () => {
  assert.equal(enter("- one two", 5), null);
  assert.equal(enter("```\ncode\n```", 6), null);
  assert.equal(enter("", 0), null);
});

console.log(`${passed} passed`);
