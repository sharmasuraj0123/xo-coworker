// Markdown as a page you type in (the page view): the same
// CodeMirror editor as Source, drawn as a document, and you type straight into the formatted text (the owner, 19 Nov
// 11:42Z: "it shouldn't feel like you're in another mode editing it. have it edit directly even on the formatted
// text"). Headings stay headings and bold stays bold where the caret is: the marks (#, **, `, [](…), >) are never
// shown, and the caret steps over them as one character (atomic ranges), so Backspace at the start of a heading makes
// it a paragraph again. Formatting comes as Notion and Typora do it: ⌘B, ⌘I, ⌘E (code), ⌘⇧X (strike), and "# ",
// "- ", "1. ", "> " typed at a line's start. Lists continue on Enter. Rules are drawn always. Tables, display math and
// ```math, ```mermaid and ```chart blocks are drawn by the chat's own renderer (js/markdown.js, js/rich.js); with the
// caret in one, its source shows with the drawing kept under it, updating as you type. An inline $formula$ shows its
// TeX only while the caret is inside it. The file stays its Markdown, byte for byte.
//
// pageView(CM) → the extension (js/doceditor.js puts it in a compartment, so Source is the same editor without it).

import { renderMarkdown, renderInline, cells } from "./markdown.js";
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

/**
 * ⌘B and the rest: wrap each selection in a mark, or take the mark away when it's already wrapped; an empty selection
 * gets the pair with the caret between. Returns the transaction's spec. Pure (state in, spec out).
 */
export function toggleMark(CM, state, mark) {
  const n = mark.length;
  return {
    ...state.changeByRange((r) => {
      if (state.sliceDoc(r.from - n, r.from) === mark && state.sliceDoc(r.to, r.to + n) === mark) {
        return { changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + n }], range: CM.EditorSelection.range(r.from - n, r.to - n) };
      }
      return { changes: [{ from: r.from, insert: mark }, { from: r.to, insert: mark }], range: CM.EditorSelection.range(r.from + n, r.to + n) };
    }),
    userEvent: "input.format", scrollIntoView: true,
  };
}

/** A table row written back from its cells: "| a | b |", a "|" inside a cell escaped. Pure. */
export function rowLine(list) {
  return `| ${list.map((c) => String(c).replace(/\n/g, " ").replace(/(?<!\\)\|/g, "\\|")).join(" | ")} |`;
}
/** A table's source as rows of cells (the delimiter row left out) and the line each row is on. Pure. */
export function tableRows(src) {
  const lines = src.split("\n");
  const rows = [];
  lines.forEach((l, i) => { if (i !== 1 && l.trim()) rows.push({ line: i, cells: cells(l) }); });
  const align = lines[1] ? cells(lines[1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "")) : [];
  return { rows, align, width: rows.length ? rows[0].cells.length : 0 };
}

export function pageView(CM) {
  const { ViewPlugin, Decoration, WidgetType, StateField, EditorView, syntaxTree, RangeSetBuilder, EditorSelection, Prec, keymap } = CM;

  /** A block drawn by the chat's renderer: a table, a rule, a formula, a diagram, a chart. */
  class BlockWidget extends WidgetType {
    constructor(src, from, preview = false) { super(); this.src = src; this.from = from; this.preview = preview; }
    eq(o) { return o.src === this.src && o.preview === this.preview; }
    toDOM(view) {
      const d = document.createElement("div");
      d.className = `cm-md-block prose vw-md${this.preview ? " is-preview" : ""}`;
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
  /**
   * A table you type into (the owner, 19 Nov 12:11Z): each cell is editable where it's drawn; a cell's text goes back
   * into its row's line as you type (that line only, rewritten as "| a | b |"). Tab and ⇧Tab move between cells, Enter
   * goes down a row (in the last row it adds one), Esc leaves the table. A cell shows its Markdown while you're in it
   * and its formatting otherwise. The editor keeps this same table as the text changes under it (updateDOM), so the
   * cell you're in keeps its caret.
   */
  class TableWidget extends WidgetType {
    constructor(src, from) { super(); this.src = src; this.from = from; }
    eq(o) { return o.src === this.src; }
    toDOM(view) {
      const wrap = document.createElement("div");
      wrap.className = "cm-md-block cm-md-table prose vw-md";
      wrap.innerHTML = `<div class="md-table"><table><thead></thead><tbody></tbody></table></div>`;
      wrap._w = this;
      this.fill(wrap, null);
      const cellOf = (t) => t.closest && t.closest("[data-r]");
      wrap.addEventListener("focusin", (e) => { const c = cellOf(e.target); if (c && c.textContent !== c.dataset.raw) c.textContent = c.dataset.raw; });
      wrap.addEventListener("focusout", (e) => { const c = cellOf(e.target); if (c) c.innerHTML = renderInline(c.dataset.raw) || "&#8203;"; });
      wrap.addEventListener("input", (e) => {
        const c = cellOf(e.target);
        if (!c) return;
        c.dataset.raw = c.textContent.replace(/\u200b/g, "");
        const w = wrap._w, r = +c.dataset.r;
        const row = [...wrap.querySelectorAll(`[data-r="${r}"]`)].map((x) => x.dataset.raw);
        const { rows } = tableRows(w.src);
        const line = view.state.doc.lineAt(w.from).number + rows[r].line;
        const l = view.state.doc.line(line);
        view.dispatch({ changes: { from: l.from, to: l.to, insert: rowLine(row) }, userEvent: "input.table" });
      });
      wrap.addEventListener("keydown", (e) => {
        const c = cellOf(e.target);
        if (!c || e.isComposing) return;
        const all = [...wrap.querySelectorAll("[data-r]")], i = all.indexOf(c);
        const w = wrap._w, { rows, width } = tableRows(w.src), r = +c.dataset.r, k = +c.dataset.c;
        const go = (x) => { if (!x) return; x.focus(); const s = getSelection(); s.selectAllChildren(x); s.collapseToEnd(); };
        if (e.key === "Tab") { e.preventDefault(); go(all[i + (e.shiftKey ? -1 : 1)]); return; }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const end = view.state.doc.lineAt(w.from).number + rows[rows.length - 1].line; view.focus(); view.dispatch({ selection: { anchor: view.state.doc.line(end).to } }); return; }
        if (e.key === "Enter") {
          e.preventDefault();
          if (r < rows.length - 1) { go(wrap.querySelector(`[data-r="${r + 1}"][data-c="${k}"]`)); return; }
          // the last row: a new one under it, its first cell next
          const last = view.state.doc.line(view.state.doc.lineAt(w.from).number + rows[r].line);
          wrap._focusNext = { r: r + 1, c: 0 };
          view.dispatch({ changes: { from: last.to, insert: "\n" + rowLine(Array(width).fill("")) }, userEvent: "input.table" });
        }
      });
      return wrap;
    }
    /** The text changed under the table (a cell typed in, a row added): its cells are brought up to date in place. */
    updateDOM(dom) {
      if (!dom.classList.contains("cm-md-table")) return false;
      dom._w = this;
      this.fill(dom, document.activeElement);
      if (dom._focusNext) { const n = dom._focusNext; dom._focusNext = null; const x = dom.querySelector(`[data-r="${n.r}"][data-c="${n.c}"]`); if (x) x.focus(); }
      return true;
    }
    fill(wrap, keep) {
      const { rows, align, width } = tableRows(this.src);
      const head = wrap.querySelector("thead"), body = wrap.querySelector("tbody");
      const want = (r) => (r === 0 ? head : body);
      rows.forEach((row, r) => {
        const sec = want(r), idx = r === 0 ? 0 : r - 1;
        let tr = sec.children[idx];
        if (!tr) { tr = document.createElement("tr"); sec.appendChild(tr); }
        for (let k = 0; k < width; k++) {
          let td = tr.children[k];
          if (!td) { td = document.createElement(r === 0 ? "th" : "td"); td.contentEditable = "true"; td.spellcheck = true; td.dataset.r = r; td.dataset.c = k; tr.appendChild(td); }
          const raw = row.cells[k] ?? "";
          if (align[k]) td.style.textAlign = align[k];
          if (td === keep) { td.dataset.raw = raw; continue; } // the cell you're typing in keeps its text and caret
          if (td.dataset.raw !== raw || !td.innerHTML) { td.dataset.raw = raw; td.innerHTML = renderInline(raw) || "&#8203;"; }
        }
        while (tr.children.length > width) tr.lastChild.remove();
      });
      while (body.children.length > Math.max(0, rows.length - 1)) body.lastChild.remove();
    }
    ignoreEvent() { return true; } // its cells are its own: the editor leaves their keys and clicks alone
    get estimatedHeight() { return 120; }
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

  const touches = (state, from, to) => state.selection.ranges.some((r) => r.to >= from && r.from <= to);

  // ── blocks: worked out once per change of the text, shown or opened as the caret moves ──
  function blocksOf(state) {
    const out = [];
    const tree = syntaxTree(state);
    tree.iterate({
      enter(n) {
        const name = n.name;
        if (name === "HorizontalRule") { out.push({ from: n.from, to: n.to, always: true }); return false; }
        if (name === "Table") { out.push({ from: n.from, to: n.to, always: true, table: true }); return false; }
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
    return out.map((b) => ({ from: state.doc.lineAt(b.from).from, to: state.doc.lineAt(b.to).to, always: !!b.always, table: !!b.table }));
  }
  const blockField = StateField.define({
    create: (state) => ({ list: blocksOf(state), deco: null }),
    update(v, tr) {
      // the parser reads a long file a part at a time (the rest after the first frame, in the background): the blocks
      // are found again whenever it has read further, not only when the text changes (the owner, 19 Nov 12:08Z: "these
      // tables don't render in file view", 7 of ICONS.md's 8 lay past the first part)
      const grew = syntaxTree(tr.state) !== syntaxTree(tr.startState);
      const list = tr.docChanged || grew ? blocksOf(tr.state) : v.list;
      if (!tr.docChanged && !grew && !tr.selection && v.deco) return v;
      return { list, deco: null };
    },
    provide: (f) => EditorView.decorations.compute([f, "selection"], (state) => {
      const v = state.field(f);
      const b = new RangeSetBuilder();
      for (const x of v.list) {
        if (x.to > state.doc.length) continue;
        const src = state.sliceDoc(x.from, x.to);
        // a table is always drawn, and you type in its cells; the others draw until the caret is in them
        if (x.table) { b.add(x.from, x.to, Decoration.replace({ widget: new TableWidget(src, x.from), block: true })); continue; }
        if (x.always || !touches(state, x.from, x.to)) { b.add(x.from, x.to, Decoration.replace({ widget: new BlockWidget(src, x.from), block: true })); continue; }
        // the caret is in it: its source to type in, and its drawing kept right under it, following what you type
        b.add(x.to, x.to, Decoration.widget({ widget: new BlockWidget(src, x.from, true), block: true, side: 1 }));
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
    const tree = syntaxTree(state);
    const ranges = [];
    atomic = [];
    const lineDeco = new Map(); // line start → deco
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter(n) {
          const name = n.name;
          const h = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
          if (h) { lineDeco.set(state.doc.lineAt(n.from).from, H[+h[1] - 1]); }
          else if (name === "Blockquote") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, quoteLine); p = l.to + 1; } }
          else if (name === "FencedCode") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, fenceLine); p = l.to + 1; } return false; }
          else if (name === "InlineCode") ranges.push(codeMark.range(n.from, n.to));
          else if (name === "Link") {
            const marks = n.node.getChildren("LinkMark");
            if (marks.length >= 2) ranges.push(linkMark.range(marks[0].to, marks[1].from));
          } else if (name === "ListMark") {
            const t = state.sliceDoc(n.from, n.to);
            if (t === "-" || t === "*" || t === "+") { const r = Decoration.replace({ widget: bullet }).range(n.from, n.to); ranges.push(r); atomic.push(r); }
          } else if (HIDE_MARKS.has(name)) {
            // a heading's # takes its space with it
            let end = n.to;
            if (name === "HeaderMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (name === "QuoteMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (end > n.from) { const r = hide.range(n.from, end); ranges.push(r); atomic.push(r); }
          }
        },
      });
      // inline math, outside code: drawn, but its TeX while the caret is inside the formula itself
      for (let p = from; p <= to;) {
        const l = state.doc.lineAt(p);
        if (l.text.includes("$")) {
          INLINE_MATH.lastIndex = 0;
          let m;
          while ((m = INLINE_MATH.exec(l.text))) {
            const a = l.from + m.index, b = a + m[0].length;
            const node = tree.resolveInner(a + 1, 1);
            if (/Code/.test(node.name) || /Code/.test(node.parent?.name || "")) continue;
            if (state.selection.ranges.some((r) => r.from > a && r.from < b) || state.selection.ranges.some((r) => r.to > a && r.to < b)) continue;
            ranges.push(Decoration.replace({ widget: new MathWidget(m[0], a) }).range(a, b));
          }
        }
        p = l.to + 1;
      }
    }
    for (const [at, d] of lineDeco) ranges.push(d.range(at));
    return Decoration.set(ranges, true);
  }
  // the hidden marks and the bullets: the caret steps over each as one (and Backspace takes it whole)
  let atomic = [];

  const inlinePlugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = safe(view); this.atomic = Decoration.set(atomic, true); }
    update(u) { if (u.docChanged || u.viewportChanged || u.selectionSet || syntaxTree(u.state) !== syntaxTree(u.startState)) { this.decorations = safe(u.view); this.atomic = Decoration.set(atomic, true); } }
  }, { decorations: (v) => v.decorations, provide: (p) => EditorView.atomicRanges.of((view) => view.plugin(p)?.atomic ?? Decoration.none) });
  // overlapping ranges (a hidden mark inside a replaced math) can't be set together: drop the inner ones
  function safe(view) {
    try { return inline(view); } catch { atomic = []; return Decoration.none; }
  }

  const wrap = (mark) => (view) => { view.dispatch(view.state.update(toggleMark(CM, view.state, mark))); return true; };
  const keys = Prec.high(keymap.of([
    { key: "Mod-b", run: wrap("**") },
    { key: "Mod-i", run: wrap("*") },
    { key: "Mod-e", run: wrap("`") },
    { key: "Mod-Shift-x", run: wrap("~~") },
  ]));

  return [
    blockField, inlinePlugin, keys,
    EditorView.editorAttributes.of({ class: "cm-xo-page" }),
  ];
}
