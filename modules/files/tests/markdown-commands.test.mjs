// The page's formatting commands write plain Markdown: marks, line styles, links and inserted blocks.
import assert from "node:assert/strict";

const CM = await import("../../../vendor/codemirror/cm.js");
const {
  lineStyleOf, setLineStyle, toggleMark, marksAt, linkTo, insertBlock, insertFootnote, insertDate, countsOf,
} = await import("../markdown-commands.js");
const { EditorState, EditorSelection, markdown, markdownLanguage, ensureSyntaxTree } = CM;

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

/** A state whose selection is written in the text as « and », or ‸ for a caret. @param {string} marked */
function at(marked) {
  const caret = marked.indexOf("‸");
  const doc = marked.replace(/[«»‸]/g, "");
  const selection = caret >= 0 ? EditorSelection.single(caret) : EditorSelection.single(marked.indexOf("«"), marked.indexOf("»") - 1);
  const state = EditorState.create({ doc, selection, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

/** The text after a command, with its selection marked the same way. @param {EditorState} state @param {object} spec */
function after(state, spec) {
  const next = state.update(spec).state;
  const { from, to } = next.selection.main;
  const text = next.doc.toString();
  return from === to ? text.slice(0, from) + "‸" + text.slice(from) : text.slice(0, from) + "«" + text.slice(from, to) + "»" + text.slice(to);
}

t("a line knows its style from how it starts", () => {
  const styles = ["Words", "# One", "## Two", "#### Four", "> Said", "- Point", "* Point", "3. Step", "- [x] Done", "  - [ ] Nested"];
  assert.deepEqual(styles.map(lineStyleOf), ["body", "h1", "h2", "h3", "quote", "ul", "ul", "ol", "task", "task"]);
});

t("a style replaces the one a line had; asking again returns it to body text", () => {
  const state = at("# Ti‸tle");
  assert.equal(after(state, setLineStyle(state, "h2")), "## Ti‸tle");
  const h2 = at("## Ti‸tle");
  assert.equal(after(h2, setLineStyle(h2, "h2")), "Ti‸tle");
  const task = at("- Bu‸y milk");
  assert.equal(after(task, setLineStyle(task, "task")), "- [ ] Bu‸y milk");
});

t("lists number every selected line in order and skip the blank ones between", () => {
  const state = at("«One\n\nTwo\nThree»");
  assert.equal(after(state, setLineStyle(state, "ol")), "1. «One\n\n2. Two\n3. Three»");
  const nested = at("- One\n  - T‸wo");
  assert.equal(after(nested, setLineStyle(nested, "ol")), "- One\n  1. T‸wo", "an item keeps its depth");
});

t("a mark wraps the selection, and unwraps the mark the selection sits in", () => {
  const state = at("Say «this» now");
  assert.equal(after(state, toggleMark(CM, state, "bold")), "Say **«this»** now");
  const bold = at("Say **«this»** now");
  assert.deepEqual([...marksAt(CM, bold)], ["bold"]);
  assert.equal(after(bold, toggleMark(CM, bold, "bold")), "Say «this» now");
  const caret = at("Say ‸");
  assert.equal(after(caret, toggleMark(CM, caret, "code")), "Say `‸`", "an empty pair to type into");
});

t("a link wraps the selection, or changes the address of the link the selection sits in", () => {
  const state = at("Read «the notes» first");
  assert.equal(after(state, linkTo(CM, state, "https://example.com/a b")), "Read [«the notes»](https://example.com/a%20b) first");
  const link = at("Read [the «notes»](old) first");
  assert.deepEqual([...marksAt(CM, link)], ["link"]);
  assert.equal(after(link, linkTo(CM, link, "new")), "Read [the «notes»](new) first");
});

t("a block goes on its own lines after the caret's line with its placeholder selected, or fills an empty line", () => {
  const state = at("Intro‸\nNext");
  assert.equal(after(state, insertBlock(CM, state, "table")), "Intro\n\n| «Column» | Column |\n| --- | --- |\n|  |  |\n\nNext");
  const empty = at("Intro\n\n‸\n\nNext");
  assert.equal(after(empty, insertBlock(CM, empty, "divider")), "Intro\n\n---‸\n\nNext");
  const code = at("‸");
  assert.equal(after(code, insertBlock(CM, code, "code")), "```\n‸\n```\n");
});

t("contents list the headings as nested links", () => {
  const state = at("# Study\n\n## How it opens\n\n### A detail\n\n‸");
  assert.equal(after(state, insertBlock(CM, state, "contents")).split("\n\n").pop(),
    "- [Study](#study)\n  - [How it opens](#how-it-opens)\n    - [A detail](#a-detail)‸\n");
});

t("a footnote cites the next free number at the caret and starts its note at the end", () => {
  const state = at("Claim‸.\n\nMore[^1].\n\n[^1]: Old.");
  assert.equal(after(state, insertFootnote(state)), "Claim[^2].\n\nMore[^1].\n\n[^1]: Old.\n\n[^2]: ‸");
});

t("the date reads as words, and counts cover the document and the selection", () => {
  assert.equal(after(at("On ‸"), insertDate(at("On ‸"), new Date(2026, 10, 25))), "On 25 Nov 2026‸");
  assert.deepEqual(countsOf(at("«Two words» and three")), { all: { words: 4, characters: 19 }, selected: { words: 2, characters: 9 } });
  assert.equal(countsOf(at("A doc‸")).selected, null);
});

console.log(`${passed} passed`);
