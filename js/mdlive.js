// Markdown as a page you type in (design-research/2026-11-vision/canvas-editing/PLAN.md F2, the page view): the same
// CodeMirror editor as Source, drawn as a document. Headings, emphasis, links, quotes and lists read formatted,
// and their marks (#, **, [](…), >) show only on the lines your caret is on, the way Obsidian's Live Preview and
// Typora do. Tables, rules, display math and ```math, ```mermaid and ```chart blocks are drawn whole by the chat's
// own renderer (js/markdown.js; js/rich.js draws the math and diagrams, cached by their source) until the caret goes
// into them, when they show their source to edit. Inline $math$ is drawn the same way. The file stays its
// Markdown, byte for byte: nothing here changes the text.
//
// pageView(CM) → the extension (js/doceditor.js puts it in a compartment, so Source is the same editor without it).

import { renderMarkdown, renderInline } from "./markdown.js";
import { drawMath, drawDiagram } from "./rich.js";

// A widget's math and diagrams are drawn by the chat's own renderer (js/rich.js: one cache, one Mermaid queue), a
// moment after the widget appears (the caret just left the block: the next key may bring it back), then the widget's
// HTML is written again from the cache, exactly as the chat writes it.
const DRAW_MS = 250;
function drawIn(node, write) {
  const math = [...node.querySelectorAll(".md-math:not(.is-done):not(.is-failed)")];
  const dgs = [...node.querySelectorAll(".md-diagram:not(.is-done):not(.is-failed)")];
  if (!math.length && !dgs.length) return;
  setTimeout(() => {
    if (!node.isConnected) return;
    const jobs = [
      ...math.map((m) => drawMath(m.dataset.tex || "", m.classList.contains("is-block")).catch(() => null)),
      ...dgs.map((g) => drawDiagram(g.querySelector(".md-dg-src code")?.textContent || "").catch(() => null)),
    ];
    Promise.all(jobs).then(() => { if (node.isConnected) write(); });
  }, DRAW_MS);
}

const RICH_FENCE = /^(math|katex|latex|mermaid|chart)$/i;
const INLINE_MATH = /(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\\\n])*?[^\s\\$])\$(?![\w$])/g;
const HIDE_MARKS = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "QuoteMark", "LinkMark", "URL", "LinkTitle"]);

export function pageView(CM) {
  const { ViewPlugin, Decoration, WidgetType, StateField, EditorView, syntaxTree, RangeSetBuilder } = CM;

  /** A block drawn by the chat's renderer: a table, a rule, a formula, a diagram, a chart. */
  class BlockWidget extends WidgetType {
    constructor(src, from) { super(); this.src = src; this.from = from; }
    eq(o) { return o.src === this.src; }
    toDOM(view) {
      const d = document.createElement("div");
      d.className = "cm-md-block prose vw-md";
      d.innerHTML = renderMarkdown(this.src);
      drawIn(d, () => { d.innerHTML = renderMarkdown(this.src); });
      d.addEventListener("mousedown", (e) => {
        if (e.target.closest("a, button")) return;
        e.preventDefault();
        const at = Math.min(view.state.doc.length, this.from);
        view.dispatch({ selection: { anchor: at } });
        view.focus();
      });
      return d;
    }
    ignoreEvent() { return false; }
    get estimatedHeight() { return 48; }
  }
  /** An inline formula, drawn; a click puts the caret in it (its source shows). */
  class MathWidget extends WidgetType {
    constructor(src, from) { super(); this.src = src; this.from = from; }
    eq(o) { return o.src === this.src; }
    toDOM(view) {
      const s = document.createElement("span");
      s.className = "cm-md-imath";
      s.innerHTML = renderInline(this.src);
      drawIn(s, () => { s.innerHTML = renderInline(this.src); });
      s.addEventListener("mousedown", (e) => { e.preventDefault(); view.dispatch({ selection: { anchor: this.from + 1 } }); view.focus(); });
      return s;
    }
    ignoreEvent() { return false; }
  }
  class Bullet extends WidgetType {
    eq() { return true; }
    toDOM() { const s = document.createElement("span"); s.className = "cm-md-bullet"; s.textContent = "•"; return s; }
  }
  const bullet = new Bullet();

  /** Lines a selection touches (their marks show). */
  const activeLines = (state) => {
    const set = new Set();
    for (const r of state.selection.ranges) {
      const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
      for (let n = a; n <= b; n++) set.add(n);
    }
    return set;
  };
  const touches = (state, from, to) => state.selection.ranges.some((r) => r.to >= from && r.from <= to);

  // ── blocks: worked out once per change of the text, shown or opened as the caret moves ──
  function blocksOf(state) {
    const out = [];
    const tree = syntaxTree(state);
    tree.iterate({
      enter(n) {
        const name = n.name;
        if (name === "Table" || name === "HorizontalRule") { out.push({ from: n.from, to: n.to }); return false; }
        if (name === "FencedCode") {
          const info = n.node.getChild("CodeInfo");
          const lang = info ? state.sliceDoc(info.from, info.to).trim() : "";
          if (RICH_FENCE.test(lang)) out.push({ from: n.from, to: n.to });
          return false;
        }
        if (name === "Paragraph") {
          const t = state.sliceDoc(n.from, n.to).trim();
          if (/^\$\$[\s\S]+\$\$$/.test(t) || /^\\\[[\s\S]+\\\]$/.test(t)) out.push({ from: n.from, to: n.to });
          return false;
        }
        return name === "Document" || name === "Blockquote" || name === "BulletList" || name === "OrderedList" || name === "ListItem";
      },
    });
    // whole lines only (a block decoration replaces lines)
    return out.map((b) => ({ from: state.doc.lineAt(b.from).from, to: state.doc.lineAt(b.to).to }));
  }
  const blockField = StateField.define({
    create: (state) => ({ list: blocksOf(state), deco: null }),
    update(v, tr) {
      const list = tr.docChanged ? blocksOf(tr.state) : v.list;
      if (!tr.docChanged && !tr.selection && v.deco) return v;
      return { list, deco: null };
    },
    provide: (f) => EditorView.decorations.compute([f, "selection"], (state) => {
      const v = state.field(f);
      const b = new RangeSetBuilder();
      for (const x of v.list) {
        if (x.to > state.doc.length || touches(state, x.from, x.to)) continue;
        b.add(x.from, x.to, Decoration.replace({ widget: new BlockWidget(state.sliceDoc(x.from, x.to), x.from), block: true }));
      }
      return b.finish();
    }),
  });

  // ── inline: the visible lines only, again as the view scrolls or the caret moves ──
  const H = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-md-h cm-md-h${n}` }));
  const quoteLine = Decoration.line({ class: "cm-md-quote" });
  const fenceLine = Decoration.line({ class: "cm-md-fence" });
  const hide = Decoration.replace({});
  const codeMark = Decoration.mark({ class: "cm-md-code" });
  const linkMark = Decoration.mark({ class: "cm-md-link" });

  function inline(view) {
    const { state } = view;
    const active = activeLines(state);
    const tree = syntaxTree(state);
    const ranges = [];
    const lineDeco = new Map(); // line start → deco
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter(n) {
          const name = n.name;
          const lineNo = state.doc.lineAt(n.from).number;
          const on = active.has(lineNo);
          const h = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
          if (h) { lineDeco.set(state.doc.lineAt(n.from).from, H[+h[1] - 1]); }
          else if (name === "Blockquote") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, quoteLine); p = l.to + 1; } }
          else if (name === "FencedCode") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, fenceLine); p = l.to + 1; } return false; }
          else if (name === "InlineCode") ranges.push(codeMark.range(n.from, n.to));
          else if (name === "Link") {
            const marks = n.node.getChildren("LinkMark");
            if (marks.length >= 2) ranges.push(linkMark.range(marks[0].to, marks[1].from));
          } else if (name === "ListMark" && !on) {
            const t = state.sliceDoc(n.from, n.to);
            if (t === "-" || t === "*" || t === "+") ranges.push(Decoration.replace({ widget: bullet }).range(n.from, n.to));
          } else if (HIDE_MARKS.has(name) && !on) {
            // a heading's # takes its space with it
            let end = n.to;
            if (name === "HeaderMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (name === "QuoteMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (end > n.from) ranges.push(hide.range(n.from, end));
          }
        },
      });
      // inline math, on lines the caret isn't on, outside code
      for (let p = from; p <= to;) {
        const l = state.doc.lineAt(p);
        if (!active.has(l.number) && l.text.includes("$")) {
          INLINE_MATH.lastIndex = 0;
          let m;
          while ((m = INLINE_MATH.exec(l.text))) {
            const a = l.from + m.index, b = a + m[0].length;
            const node = tree.resolveInner(a + 1, 1);
            if (/Code/.test(node.name) || /Code/.test(node.parent?.name || "")) continue;
            ranges.push(Decoration.replace({ widget: new MathWidget(m[0], a) }).range(a, b));
          }
        }
        p = l.to + 1;
      }
    }
    for (const [at, d] of lineDeco) ranges.push(d.range(at));
    return Decoration.set(ranges, true);
  }

  const inlinePlugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = safe(view); }
    update(u) { if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = safe(u.view); }
  }, { decorations: (v) => v.decorations });
  // overlapping ranges (a hidden mark inside a replaced math) can't be set together: drop the inner ones
  function safe(view) {
    try { return inline(view); } catch { return Decoration.none; }
  }

  return [
    blockField, inlinePlugin,
    EditorView.editorAttributes.of({ class: "cm-xo-page" }),
  ];
}
