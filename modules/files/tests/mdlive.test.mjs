// Markdown page widgets keep the editable source and rendered document in sync.
import assert from "node:assert/strict";

const CM = await import("../../../vendor/codemirror/cm.js");
globalThis.document = { documentElement: { dataset: {} }, createElement: () => ({ getContext: () => null }), querySelector: () => null };
globalThis.addEventListener ??= () => {};
const { pageView } = await import("../markdown-page.js");
const { EditorState, EditorView, markdown, markdownLanguage, ensureSyntaxTree } = CM;

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const DOC = [
  "# Title",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "```mermaid",
  "graph TD; A-->B",
  "```",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "$$x^2$$",
  "",
  "---",
  "",
  "End.",
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

t("a table is always drawn (you type in its cells); a diagram or formula with the caret in it: its source, its drawing under it", () => {
  assert.deepEqual(blocks(4).out, [[3, 5], [7, 9], [15, 15], [17, 17]], "the caret in the table: still drawn");
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
  const extensions = pageView(CM);
  const press = (state, key) => {
    const binding = state.facet(CM.keymap).flat().find((item) => item.key === key);
    const view = { state, dispatch(tr) { this.state = tr.state; } };
    assert.equal(binding?.run?.(view), true, `${key} handles the editor shortcut`);
    return view.state;
  };
  let st = EditorState.create({ doc: "make this bold", selection: { anchor: 10, head: 14 }, extensions });
  st = press(st, "Mod-b");
  assert.equal(st.doc.toString(), "make this **bold**");
  assert.equal(st.sliceDoc(st.selection.main.from, st.selection.main.to), "bold", "the word stays selected");
  st = press(st, "Mod-b");
  assert.equal(st.doc.toString(), "make this bold");
  let e = EditorState.create({ doc: "ab", selection: { anchor: 1 }, extensions });
  e = press(e, "Mod-i");
  assert.equal(e.doc.toString(), "a**b");
  assert.equal(e.selection.main.head, 2);
});

t("a long file read a part at a time: every table is drawn once the parser has read that far", () => {
  const table = "| a | b |\n|---|---|\n| 1 | 2 |\n";
  const filler = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} with some words to make it long enough.\n`).join("\n");
  const doc = Array.from({ length: 8 }, (_, i) => `## Part ${i}\n\n${filler}\n${table}`).join("\n");
  let st = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), pageView(CM)] });
  const count = (s) => { let n = 0; for (const v of s.facet(EditorView.decorations)) if (typeof v !== "function") v.between(0, s.doc.length, (a, b, d) => { if (d.spec.block) n++; }); return n; };
  const before = count(st);
  assert.ok(before < 8, `only part of it parsed at first (${before} drawn)`);
  // the parser reading on: a transaction with no change of text, whose tree has grown
  CM.ensureSyntaxTree(st, st.doc.length, 5000);
  st = st.update({}).state;
  assert.equal(count(st), 8, "all eight tables drawn");
});

const { dom, same } = await import("../../../tests/lib/dom.mjs");
const tableFrame = await dom("<main></main>");
const { createTableWidget } = await import("../markdown-table.js");
const { createMarkdownWidgets } = await import("../markdown-widgets.js");
const TableWidget = createTableWidget(CM.WidgetType);

t("table cells preserve alignment and write an escaped pipe to the source row", () => {
  const source = "| ID | Means |\n|:--|--:|\n| `a|b` | one \\| two |\n| x | |";
  const view = {
    state: EditorState.create({ doc: source }),
    dispatch(spec) { this.state = this.state.update(spec).state; },
  };
  const widget = new TableWidget(source, 0);
  const wrap = widget.toDOM(view);
  try {
    assert.equal(wrap.querySelectorAll("thead th").length, 2);
    assert.equal(wrap.querySelectorAll("tbody tr").length, 2, "the delimiter row is skipped");
    const [first, second] = wrap.querySelectorAll('tbody [data-r="1"]');
    assert.equal(first.style.textAlign || "", "");
    assert.equal(second.style.textAlign, "right");
    assert.equal(first.dataset.raw, "`a|b`");
    assert.equal(second.dataset.raw, "one | two");
    second.textContent = "three | four";
    second.dispatchEvent(new tableFrame.window.Event("input", { bubbles: true }));
    assert.equal(view.state.doc.toString(), source.replace("`a|b` | one \\| two", "`a\\|b` | three \\| four"));
  } finally {
    widget.destroy(wrap);
  }
});

t("a reused table edits its current source position and focuses a newly inserted row", () => {
  const table = "| a | b |\n|---|---|\n| c | d |";
  const leading = "A paragraph.\n\n";
  const view = {
    state: EditorState.create({ doc: table }),
    dispatch(spec) { this.state = this.state.update(spec).state; },
  };
  const first = new TableWidget(table, 0);
  const wrap = first.toDOM(view);
  tableFrame.document.querySelector("main").append(wrap);
  const cell = wrap.querySelector('[data-r="1"][data-c="1"]');
  cell.focus();
  view.state = EditorState.create({ doc: leading + table });
  const shifted = new TableWidget(table, leading.length);
  assert.equal(shifted.eq(first), false, "CodeMirror asks a relocated table to update its DOM binding");
  assert.equal(shifted.updateDOM(wrap), true);
  same(wrap.querySelector('[data-r="1"][data-c="1"]'), cell);
  cell.textContent = "revised";
  cell.dispatchEvent(new tableFrame.window.Event("input", { bubbles: true }));
  const revised = table.replace("| c | d |", "| c | revised |");
  assert.equal(view.state.doc.toString(), leading + revised);

  const current = new TableWidget(revised, leading.length);
  current.updateDOM(wrap);
  const enter = new tableFrame.window.Event("keydown", { bubbles: true, cancelable: true });
  enter.key = "Enter";
  cell.dispatchEvent(enter);
  const extended = revised + "\n|  |  |";
  assert.equal(view.state.doc.toString(), leading + extended);
  const extendedTable = new TableWidget(extended, leading.length);
  extendedTable.updateDOM(wrap);
  const addedCell = wrap.querySelector('[data-r="2"][data-c="0"]');
  same(tableFrame.document.activeElement, addedCell);
  extendedTable.destroy(wrap);
  addedCell.textContent = "Retired table";
  addedCell.dispatchEvent(new tableFrame.window.Event("input", { bubbles: true }));
  assert.equal(view.state.doc.toString(), leading + extended, "retiring the table releases its input handler");
});

t("a destroyed Markdown widget can no longer move the editor caret", () => {
  const { MathWidget } = createMarkdownWidgets(CM.WidgetType);
  const widget = new MathWidget("$x$", 3);
  const moves = [];
  const view = { dispatch: (spec) => moves.push(spec.selection.anchor), focus() {} };
  const element = widget.toDOM(view);
  tableFrame.document.querySelector("main").append(element);
  const press = () => element.dispatchEvent(new tableFrame.window.Event("mousedown", { cancelable: true }));
  press();
  widget.destroy(element);
  press();
  assert.deepEqual(moves, [4]);
});

console.log(`${passed} passed`);
