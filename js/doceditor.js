// The one editor for every text file in Files (design-research/2026-11-vision/canvas-editing/PLAN.md F2): CodeMirror 6,
// vendored (js/vendor/codemirror, loaded the first time a file opens). A file opens ready to type in: no Edit, no
// Save; what you type goes to its document (js/docs.js), which saves it. One editor state per document, kept while
// the document is open, so undo reaches back past saves and a tab you come back to is as you left it.
//
// Code reads as code (line numbers, folding, VS Code's keys: ⌘D, ⌥↑↓, ⌘/, ⌘F, ⌃G). Markdown reads as a page
// (js/mdlive.js: formatted, its marks shown only where the caret is, math, diagrams and charts drawn by the chat's
// own renderer); Source is the same editor with the page off. Someone else's change comes in as one edit (your
// caret stays) and the lines it touched glow for a moment. A clash is chunks to keep or take back (CodeMirror's
// merge view), an older version is shown read only, and Show changes marks what the last version changed.
//
// mount(host, {docs, doc, name, page, onLines, onAsk, onSave, onKey}) → handle (below).

const CM_URL = new URL("./vendor/codemirror/cm.js", import.meta.url).href;
const MERGE_URL = new URL("./vendor/codemirror/merge.js", import.meta.url).href;
let cmP = null, mergeP = null;
export const loadCM = () => (cmP ||= import(CM_URL));
export const loadMerge = () => (mergeP ||= import(MERGE_URL));
/** Fetch the editor ahead of need (Files opened, a file about to be): never in the way of typing elsewhere. */
export function prefetch() { loadCM().catch(() => { cmP = null; }); }

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
const TINT_MS = 2400;

/** The colours: XO's code tokens (css/app.css --code-*), so the editor reads like every other code block. */
function highlight(CM) {
  const { HighlightStyle, tags: t } = CM;
  return HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--code-com)", fontStyle: "italic" },
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.modifier, t.self], color: "var(--code-kw)" },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--code-str)" },
    { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name)], color: "var(--code-num)" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--code-fn)" },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.name)], color: "var(--code-bi)" },
    { tag: [t.propertyName, t.attributeName, t.labelName], color: "var(--code-prop)" },
    { tag: [t.tagName, t.heading], color: "var(--code-tag)" },
    { tag: [t.punctuation, t.separator, t.bracket, t.operator, t.derefOperator], color: "var(--code-pun)" },
    { tag: [t.local(t.variableName), t.definition(t.variableName), t.special(t.variableName)], color: "var(--code-var)" },
    { tag: t.inserted, color: "var(--code-add)" },
    { tag: t.deleted, color: "var(--code-del)" },
    { tag: t.strong, fontWeight: "var(--fw-strong)" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: [t.link, t.url], color: "var(--code-fn)" },
    { tag: t.monospace, fontFamily: "var(--mono)" },
    { tag: t.invalid, color: "var(--err-ink)" },
  ]);
}

/** Lines changed by someone else glow for a moment (the lines are 1-based, inclusive). */
function tints(CM) {
  const { StateEffect, StateField, Decoration, EditorView } = CM;
  const add = StateEffect.define();
  const clear = StateEffect.define();
  const mark = Decoration.line({ class: "cm-xo-tint" });
  const field = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
      deco = deco.map(tr.changes);
      for (const e of tr.effects) {
        if (e.is(clear)) deco = Decoration.none;
        if (e.is(add)) {
          const doc = tr.state.doc, out = [];
          for (const { from, to } of e.value) for (let n = Math.max(1, from); n <= Math.min(doc.lines, to); n++) out.push(mark.range(doc.line(n).from));
          deco = deco.update({ add: out, sort: true });
        }
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return { field, add, clear };
}

/** "Ask about lines a–b ⌘L" under a selection of whole lines' worth (the file's own thread, or its coordinator). */
function askTip(CM, { onLines, onAsk }) {
  const { StateField, showTooltip } = CM;
  const linesOf = (state) => {
    const s = state.selection.main;
    if (s.empty) return null;
    const a = state.doc.lineAt(s.from).number, bLine = state.doc.lineAt(s.to);
    const b = s.to === bLine.from && bLine.number > a ? bLine.number - 1 : bLine.number;
    return { a, b, pos: s.head };
  };
  const field = StateField.define({
    create: (state) => linesOf(state),
    update(v, tr) { if (!tr.selection && !tr.docChanged) return v; return linesOf(tr.state); },
    provide: (f) => showTooltip.compute([f], (state) => {
      const l = state.field(f);
      if (!l || !onAsk) return null;
      return {
        pos: l.pos, above: false, arrow: false,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-xo-asktip";
          const b = document.createElement("button");
          b.type = "button"; b.className = "xd-ask";
          b.innerHTML = `<span>Ask about ${l.a === l.b ? `line ${l.a}` : `lines ${l.a}–${l.b}`}</span><kbd>${MAC ? "⌘" : "Ctrl "}L</kbd>`;
          b.addEventListener("mousedown", (e) => e.preventDefault()); // the selection stays
          b.addEventListener("click", () => onAsk({ a: l.a, b: l.b }));
          dom.appendChild(b);
          return { dom };
        },
      };
    }),
  });
  let last = null;
  const listen = CM.EditorView.updateListener.of((u) => {
    if (!u.selectionSet && !u.docChanged) return;
    const l = u.state.field(field);
    const k = l ? `${l.a}-${l.b}` : "";
    if (k !== last) { last = k; onLines && onLines(l ? { a: l.a, b: l.b } : null); }
  });
  return { field, ext: [field, listen], linesOf };
}

/**
 * Mount an editor for a document. host: the element it fills. Returns {view, focus, reveal, select, setPage,
 * showVersion, showChanges, refresh, destroy}. Resolves once it's there (the editor's code loads the first time).
 */
export async function mount(host, { docs, doc, name = "", page = false, onLines = null, onAsk = null, onSave = null, onKey = null }) {
  const CM = await loadCM();
  const { EditorState, EditorView, Compartment, Annotation, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor,
    rectangularSelection, crosshairCursor, highlightSpecialChars, history, historyKeymap, defaultKeymap, indentWithTab, searchKeymap, highlightSelectionMatches,
    search, foldGutter, foldKeymap, bracketMatching, indentOnInput, syntaxHighlighting, closeBrackets, closeBracketsKeymap, gotoLine, LanguageDescription,
    languages, markdown, markdownLanguage } = CM;
  const external = Annotation.define();
  const lang = new Compartment(), ro = new Compartment(), pageC = new Compartment(), gutters = new Compartment(), mergeC = new Compartment(), wrap = new Compartment();
  const tint = tints(CM);
  const ask = askTip(CM, { onLines, onAsk });
  const isMd = /\.(md|markdown|mdx)$/i.test(name) || doc.kind === "markdown";
  let pageExt = [];
  if (isMd) { try { pageExt = (await import("./mdlive.js")).pageView(CM); } catch (e) { console.error(e); } }

  const theme = EditorView.theme({
    "&": { height: "100%", color: "var(--code-ink)", backgroundColor: "transparent", fontSize: "var(--fs-base)" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "var(--lh-ui)", overflow: "auto" },
    ".cm-content": { caretColor: "var(--ink)", padding: "var(--cell-in) 0" },
    ".cm-gutters": { backgroundColor: "transparent", color: "var(--ink-5)", border: "none" },
    ".cm-activeLine": { backgroundColor: "var(--row-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink-3)" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "var(--ink)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--info) 28%, transparent)" },
    ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warn) 22%, transparent)", outline: "none" },
    ".cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--warn) 40%, transparent)" },
    ".cm-selectionMatch": { backgroundColor: "var(--hover-fill)" },
    ".cm-matchingBracket": { backgroundColor: "var(--hover-fill)", outline: "1px solid var(--line-strong)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--fill-1)", border: "none", color: "var(--ink-3)", borderRadius: "var(--r-xs)" },
    ".cm-tooltip": { backgroundColor: "var(--float)", border: "1px solid var(--line)", borderRadius: "var(--r)", color: "var(--ink)" },
    ".cm-panels": { backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" },
    ".cm-xo-tint": { backgroundColor: "color-mix(in srgb, var(--info) 14%, transparent)", transition: "background-color var(--d-long) var(--ease)" },
  });

  const keys = keymap.of([
    { key: "Mod-s", preventDefault: true, run: () => { onSave && onSave(); return true; } },
    { key: "Ctrl-g", run: gotoLine },
    { key: "Mod-l", run: (v) => { const l = ask.linesOf(v.state); if (!l || !onAsk) return false; onAsk({ a: l.a, b: l.b }); return true; } },
    ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab,
  ]);

  const extensions = (readOnly) => [
    gutters.of(page && isMd ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter({ markerDOM: (open) => { const s = document.createElement("span"); s.className = "cm-xo-fold"; s.textContent = open ? "⌄" : "›"; return s; } })]),
    highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
    syntaxHighlighting(highlight(CM)), bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
    search({ top: true }),
    wrap.of(EditorView.lineWrapping),
    lang.of(isMd ? markdown({ base: markdownLanguage, codeLanguages: languages }) : []),
    pageC.of(page && isMd ? pageExt : []),
    ro.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
    mergeC.of([]),
    tint.field, ask.ext, keys, theme,
    EditorView.contentAttributes.of({ "aria-label": `${name || "File"}${page && isMd ? ", as a page" : ""}`, spellcheck: page && isMd ? "true" : "false" }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && !u.transactions.some((tr) => tr.annotation(external))) { if (!viewing) docs.edited(doc); }
      if (merging && u.docChanged) countChunks();
    }),
    EditorView.domEventHandlers({ keydown: (e) => (onKey ? onKey(e) : false) }),
  ];

  const readOnlyNow = () => doc.state === "readonly";
  // the state kept from the last time this document was open (its undo, its caret), given this mount's extensions:
  // history is one field across configurations, so it survives; the rest is this mount's own
  let state = doc.cmState && doc.cmState.doc.toString() === docs.textOf(doc)
    ? doc.cmState.update({ effects: CM.StateEffect.reconfigure.of(extensions(readOnlyNow())) }).state
    : EditorState.create({ doc: docs.textOf(doc), extensions: extensions(readOnlyNow()) });
  const view = new EditorView({ state, parent: host });
  doc.cmState = null;
  let live = null;     // the live state, while an older version is shown
  let viewing = null;  // the version shown, read only
  let merging = false, showing = false;

  // the code's own language, once it's loaded (a file opens at once, coloured a moment later)
  if (!isMd) {
    const d = LanguageDescription.matchFilename(languages, name);
    if (d) d.load().then((support) => { if (!destroyed) view.dispatch({ effects: lang.reconfigure(support) }); }).catch(() => {});
  }

  // the document's hooks: its text (the live one, even while an old version shows), and its changes coming in
  docs.attach(doc, {
    source: () => (live || view.state).doc.toString(),
    length: () => (live || view.state).doc.length,
    apply: (e, info) => {
      const spec = { changes: { from: e.from, to: e.to, insert: e.insert }, annotations: external.of(true) };
      if (live) { live = live.update(spec).state; return; }
      const lines = info && info.lines && info.lines.length ? info.lines : null;
      view.dispatch({ ...spec, effects: lines ? tint.add.of(lines) : [] });
      if (lines) setTimeout(() => { if (!destroyed && !live) view.dispatch({ effects: tint.clear.of(null) }); }, TINT_MS);
    },
  });
  let destroyed = false;

  async function countChunks() {
    const M = await loadMerge();
    const r = M.getChunks(view.state);
    const left = r ? r.chunks.length : 0;
    docs.mergeProgress(doc, left);
    if (!left && merging) {
      merging = false;
      view.dispatch({ effects: mergeC.reconfigure([]) });
      docs.resolve(doc);
    }
  }

  const handle = {
    view,
    /** Focus the text, at a line when given ("first-visible" keeps where it is). */
    focus({ line = null } = {}) {
      view.focus();
      if (line && Number.isFinite(line)) { const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)); view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: "center" }) }); }
    },
    reveal(line) { const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)); view.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: "start", yMargin: 96 }) }); },
    /** Select lines a–b (1-based, inclusive), as a link to them does. */
    select(a, b) {
      const d = view.state.doc, A = d.line(Math.min(Math.max(1, a), d.lines)), B = d.line(Math.min(Math.max(a, b), d.lines));
      view.dispatch({ selection: { anchor: A.from, head: B.to }, effects: EditorView.scrollIntoView(A.from, { y: "center" }) });
    },
    clearSelection() { const h = view.state.selection.main.head; view.dispatch({ selection: { anchor: h } }); },
    /** Markdown as a page (true) or its source (false): the same editor, caret and undo. */
    setPage(on) {
      if (!isMd) return;
      view.dispatch({ effects: [pageC.reconfigure(on ? pageExt : []), gutters.reconfigure(on ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter()])] });
      view.contentDOM.setAttribute("spellcheck", on ? "true" : "false");
    },
    get isMarkdown() { return isMd; },
    /** Show an older version's text, read only (null: back to the file as it is). */
    showVersion(text) {
      if (text == null) { if (live) { view.setState(live); live = null; viewing = null; } return; }
      if (!live) live = view.state;
      viewing = text;
      view.setState(EditorState.create({ doc: text, extensions: extensions(true) }));
    },
    /** Mark what changed since `original` (the version before), in the text itself; null: stop. */
    async showChanges(original) {
      if (original == null) { if (showing) { showing = false; view.dispatch({ effects: mergeC.reconfigure([]) }); } return; }
      const M = await loadMerge();
      if (destroyed || merging) return;
      showing = true;
      view.dispatch({ effects: mergeC.reconfigure(M.unifiedMergeView({ original, mergeControls: false, highlightChanges: true, gutter: true, syntaxHighlightDeletions: true })) });
    },
    /** A clash (the document's merge): each place you both changed is a chunk, Keep yours or Take theirs. */
    async showMerge() {
      if (!doc.merge) return;
      const M = await loadMerge();
      if (destroyed) return;
      merging = true; showing = false;
      const control = (type, action) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = `xd-btn cm-xo-chunk${type === "accept" ? " is-pri" : ""}`;
        b.textContent = type === "accept" ? "Keep yours" : "Take theirs";
        b.addEventListener("mousedown", action);
        return b;
      };
      view.dispatch({ effects: mergeC.reconfigure(M.unifiedMergeView({ original: doc.merge.other, mergeControls: control, highlightChanges: true, gutter: true })) });
      const first = M.getChunks(view.state);
      if (first && first.chunks.length) view.dispatch({ selection: { anchor: first.chunks[0].fromB }, effects: EditorView.scrollIntoView(first.chunks[0].fromB, { y: "center" }) });
      countChunks();
    },
    /** The read-only switch follows the document (Space said it can't be saved here). */
    refresh() { if (!live) view.dispatch({ effects: ro.reconfigure([EditorState.readOnly.of(readOnlyNow()), EditorView.editable.of(!readOnlyNow())]) }); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (live) { view.setState(live); live = null; }
      if (!merging && !showing) doc.cmState = view.state; // undo and where you were, for when it opens again
      docs.attach(doc, { source: null, apply: null });
      view.destroy();
    },
  };
  return handle;
}
