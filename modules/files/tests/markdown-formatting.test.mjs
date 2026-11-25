// A Markdown page draws a research document's parts: properties, captions, figures, callouts, tasks, code wells and footnotes.
import assert from "node:assert/strict";

const CM = await import("../../../vendor/codemirror/cm.js");
globalThis.document = { documentElement: { dataset: {} }, createElement: () => ({ getContext: () => null }), querySelector: () => null };
globalThis.addEventListener ??= () => {};
const { pageView } = await import("../markdown-page.js");
const { frontMatterOf, fieldText } = await import("../markdown-front-matter.js");
const { resolveImage } = await import("../markdown-figures.js");
const { notesOf } = await import("../markdown-notes.js");
const { createBlockField } = await import("../markdown-blocks.js");
const { createInline } = await import("../markdown-inline.js");
const { EditorState, EditorView, StateField, WidgetType, markdown, markdownLanguage, ensureSyntaxTree } = CM;

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const DOC = [
  "---", "title: A study", "date: 2026-11-25", "status: draft", "---", "",
  "# A study", "",
  "| a | b |", "|---|--:|", "| 1 | 2 |", "",
  "*Where each one opens.*", "",
  "![A screen](shots/one.png)", "",
  "*Figure 7. Written by hand.*", "",
  "Plain *emphasis* that is no caption.", "",
].join("\n");

/** @param {string} doc @param {number} anchor */
function pageState(doc, anchor) {
  let state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), pageView(CM)] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state.update({ selection: { anchor } }).state;
}

/** @param {EditorState} state */
function decorations(state) {
  const out = [];
  for (const v of state.facet(EditorView.decorations)) {
    if (typeof v === "function") continue;
    v.between(0, state.doc.length, (from, to, d) => { out.push({ from, to, line: state.doc.lineAt(from).number, spec: d.spec }); });
  }
  return out;
}

t("front matter reads as flat fields, and only when the file opens with it and its first line is a field", () => {
  assert.deepEqual(frontMatterOf(DOC)?.fields, [["title", "A study"], ["date", "2026-11-25"], ["status", "draft"]]);
  assert.equal(DOC.slice(0, frontMatterOf(DOC)?.to), "---\ntitle: A study\ndate: 2026-11-25\nstatus: draft\n---");
  assert.equal(frontMatterOf("---\n\nA paragraph between rules.\n\n---\n"), null, "two rules around prose");
  assert.equal(frontMatterOf("# Title\n---\na: b\n---"), null, "not at the start");
  assert.deepEqual(frontMatterOf("---\ntags: [one, \"two\"]\n---")?.fields, [["tags", "one, two"]]);
  assert.equal(fieldText("2026-11-25"), "25 Nov 2026");
  assert.equal(fieldText("draft"), "draft");
});

t("the properties draw as one block, also with the caret at the very start; inside them, their source shows", () => {
  const at = (anchor) => decorations(pageState(DOC, anchor)).filter((d) => d.spec.block && d.line === 1);
  assert.equal(at(0).length, 1, "the caret where a file opens");
  assert.equal(at(0)[0].to, DOC.indexOf("\n", DOC.indexOf("status")) + 4);
  assert.equal(at(DOC.indexOf("date")).length, 0, "the caret on a field");
});

t("an italic line after a table or a figure is its caption, numbered unless the author numbered it", () => {
  const captions = decorations(pageState(DOC, DOC.length)).filter((d) => d.spec.class === "cm-md-caption");
  assert.deepEqual(captions.map((d) => [d.line, d.spec.attributes["data-label"] ?? null]), [[13, "Table 1."], [17, null]]);
});

t("a paragraph of pictures alone is a figure; a picture's path resolves inside the project from the file's folder", () => {
  const figures = decorations(pageState(DOC, DOC.length)).filter((d) => d.spec.block && d.line === 15);
  assert.equal(figures.length, 1);
  assert.equal(resolveImage("docs/notes/study.md", "shots/one.png"), "docs/notes/shots/one.png");
  assert.equal(resolveImage("docs/notes/study.md", "../img/two%20words.png"), "docs/img/two words.png");
  assert.equal(resolveImage("docs/study.md", "/assets/x.png"), "assets/x.png");
  assert.equal(resolveImage("study.md", "../outside.png"), null, "leaves the project");
  assert.equal(resolveImage("study.md", "https://example.com/x.png"), null, "a web address is not a project path");
});

t("footnotes number in the order the text cites them, with each one's definition and first citation", () => {
  const text = "One[^b] two[^a] again[^b].\n\n[^a]: First.\n[^b]: Second.\n[^c]: Unused.";
  const notes = notesOf(text);
  assert.deepEqual([...notes.numbers], [["b", 1], ["a", 2], ["c", 3]]);
  assert.equal(notes.defs.get("a"), text.indexOf("[^a]:"));
  assert.equal(notes.refs.get("b"), text.indexOf("[^b]"));
});

/** Inline decorations over the whole document, as the page draws them. @param {string} doc @param {number} anchor */
function inline(doc, anchor) {
  class Stub extends WidgetType {
    constructor(...args) { super(); this.args = args; }
    eq() { return false; }
    toDOM() { return null; }
  }
  const named = (name) => class extends Stub { get name() { return name; } };
  const blocks = createBlockField(CM, { Table: named("table"), Block: named("block"), Image: named("image"), Front: named("front"), notesHead: new Stub() });
  const notes = StateField.define({ create: (s) => notesOf(s.doc.toString()), update: (v) => v });
  const widgets = {
    bullet: new (named("bullet"))(), MathWidget: named("math"), CalloutLabel: named("callout"), TaskBox: named("task"),
    NoteRef: named("ref"), NoteNumber: named("number"), CodeLabel: named("code"),
  };
  let state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), blocks, notes] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  state = state.update({ selection: { anchor } }).state;
  const { decorations: set } = createInline(CM, { widgets, blocks, notes })({ state, visibleRanges: [{ from: 0, to: state.doc.length }] });
  const out = [];
  set.between(0, state.doc.length, (from, to, d) => {
    out.push({ from, to, line: state.doc.lineAt(from).number, cls: d.spec.class, attrs: d.spec.attributes, widget: d.spec.widget });
  });
  return { out, state };
}

t("a callout is a tinted box: its marker becomes a label, its lines know the head and the end", () => {
  const doc = "Before.\n\n> [!WARNING]\n> Mind the gap.\n> Twice.\n\n> A plain quote.";
  const { out } = inline(doc, 0);
  const lines = out.filter((d) => d.cls && d.cls.startsWith("cm-md-callout"));
  assert.deepEqual(lines.map((d) => [d.line, d.cls]), [
    [3, "cm-md-callout is-warning is-head"], [4, "cm-md-callout is-warning"], [5, "cm-md-callout is-warning is-end"],
  ]);
  const label = out.find((d) => d.widget?.name === "callout");
  assert.deepEqual([doc.slice(label.from, label.to), label.widget.args], ["[!WARNING]", ["warning", false]]);
  assert.equal(out.find((d) => d.line === 7 && d.cls)?.cls, "cm-md-quote", "a plain quote stays a quote");
  assert.ok(!out.some((d) => d.cls === "cm-md-link" && d.line === 3), "the marker is not drawn as a link");
});

t("a task's bullet and marker become one checkbox that knows where its marker is; a done task reads as done", () => {
  const doc = "- [x] Shipped\n- [ ] Next";
  const { out } = inline(doc, doc.length);
  const boxes = out.filter((d) => d.widget?.name === "task").map((d) => d.widget.args);
  assert.deepEqual(boxes, [[true, 2], [false, 16]]);
  assert.ok(!out.some((d) => d.widget?.name === "bullet"), "no bullet beside a checkbox");
  const done = out.find((d) => d.cls === "cm-md-done");
  assert.equal(doc.slice(done.from, done.to), "Shipped");
});

t("a code block's fences fold into a label and a closing edge, and come back when the caret is on them", () => {
  const doc = "Text\n\n```sh\necho hi\n```\n\nAfter";
  const away = inline(doc, 0).out;
  assert.deepEqual(away.filter((d) => d.cls?.startsWith("cm-md-fence")).map((d) => [d.line, d.cls]), [
    [3, "cm-md-fence is-open"], [4, "cm-md-fence"], [5, "cm-md-fence is-close"],
  ]);
  assert.deepEqual(away.find((d) => d.widget?.name === "code")?.widget.args, ["sh"]);
  assert.ok(away.some((d) => d.line === 5 && d.from < d.to && !d.cls && !d.widget), "the closing fence hidden");
  const on = inline(doc, doc.indexOf("```sh") + 2).out;
  assert.ok(!on.some((d) => d.widget?.name === "code"), "the opening fence shows its source");
});

t("a citation becomes its number linking to its note; the note line is numbered and links back", () => {
  const doc = "Claim[^src].\n\n[^src]: The source.";
  const { out } = inline(doc, 0);
  assert.deepEqual(out.find((d) => d.widget?.name === "ref")?.widget.args, [1, doc.indexOf("[^src]:")]);
  assert.deepEqual(out.find((d) => d.widget?.name === "number")?.widget.args, [1, doc.indexOf("[^src]")]);
  assert.equal(out.find((d) => d.line === 3 && d.cls)?.cls, "cm-md-fn");
  const editing = inline(doc, doc.indexOf("[^src]") + 2).out;
  assert.ok(!editing.some((d) => d.widget?.name === "ref"), "the caret inside a citation shows its source");
});

t("list items hang their wrapped lines by depth, numbers keep their own column, and blank lines are half a line", () => {
  const doc = "- One\n  - Two\n\n1. Three";
  const { out } = inline(doc, doc.length);
  const lines = out.filter((d) => d.cls?.startsWith("cm-md-li") || d.cls === "cm-md-gap");
  assert.deepEqual(lines.map((d) => [d.line, d.cls, d.attrs?.style ?? null]), [
    [1, "cm-md-li is-ul", null], [2, "cm-md-li is-ul", "--md-depth:1"], [3, "cm-md-gap", null], [4, "cm-md-li is-ol", null],
  ]);
  assert.ok(out.some((d) => d.line === 2 && d.from === doc.indexOf("  -") && d.to === d.from + 2 && !d.cls && !d.widget), "the indent hidden");
  const number = out.find((d) => d.cls === "cm-md-olnum");
  assert.equal(doc.slice(number.from, number.to), "1. ");
  assert.deepEqual(out.filter((d) => d.widget?.name === "bullet").map((d) => doc.slice(d.from, d.to)), ["- ", "- "]);
});

console.log(`${passed} passed`);
