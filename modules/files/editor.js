// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { reportFailure } from "../../core/platform/util.js";
import { projectImages } from "./markdown-image-source.js";

/** @import { EditorMountOptions } from "./editor-types.d.ts" */

/** @import { CodeMirror, CodeMirrorMerge, EditorState, LanguageSupport } from "./cm-types.d.ts" */

const CM_URL = new URL("../../vendor/codemirror/cm.js", import.meta.url).href;
const MERGE_URL = new URL("../../vendor/codemirror/merge.js", import.meta.url).href;
/** @type {Promise<CodeMirror> | null} */
let cmP = null;
/** @type {Promise<CodeMirrorMerge> | null} */
let mergeP = null;
export const loadCM = () => (cmP ||= /** @type {Promise<CodeMirror>} */ (import(CM_URL)).catch((error) => {
  cmP = null;
  throw error;
}));
export const loadMerge = () => (mergeP ||= /** @type {Promise<CodeMirrorMerge>} */ (import(MERGE_URL)));

export function prefetch() { return loadCM().then(() => true, () => false); }

const TINT_MS = 2400;

/** @param {HTMLElement} host @param {EditorMountOptions} options */
export async function mount(host, { docs, doc, name = "", page = false, onLines = null, onAsk = null, onSave = null, onKey = null }) {
  const [CM, { createEditorConfiguration, loadPageExtension }] = await Promise.all([loadCM(), import("./editor-extensions.js")]);
  const { EditorState, EditorView, lineNumbers, highlightActiveLineGutter, foldGutter, LanguageDescription, languages } = CM;
  const configuration = createEditorConfiguration(CM, { onLines, onAsk });
  const { external, lang, ro, pageC, gutters, mergeC, tint, prepareExtensions, askTip, askAbout } = configuration;
  const isMd = /\.(md|markdown|mdx)$/i.test(name) || doc.kind === "markdown";
  const scope = createScope();
  const { signal } = scope;
  const images = isMd && doc.project && doc.rel && !doc.project.startsWith("att:") ? projectImages(doc.project, doc.rel, scope) : null;
  const pageExt = isMd ? await loadPageExtension(CM, { images, askAbout }) : [];

  const extensions = prepareExtensions({
    name, page, isMd, pageExt, onSave, onKey,
    onUpdate(u) {
      if (u.docChanged && !u.transactions.some((tr) => tr.annotation(external))) {
        if (!viewing) docs.edited(doc);
      }
      if (merging && u.docChanged) countChunks();
    },
  });

  const readOnlyNow = () => doc.state === "readonly";
  // the state kept from the last time this document was open (its undo, its caret), rebuilt with this mount's extensions
  let state = doc.cmState && doc.cmState.doc.toString() === docs.textOf(doc)
    ? doc.cmState.update({ effects: CM.StateEffect.reconfigure.of(extensions(readOnlyNow())) }).state
    : EditorState.create({ doc: docs.textOf(doc), extensions: extensions(readOnlyNow()) });
  const view = new EditorView({ state, parent: host });
  doc.cmState = null;
  /** @type {EditorState | null} */
  let live = null;
  /** @type {string | null} */
  let viewing = null;
  let merging = false, showing = false;

  // the code's own language, once it's loaded (a file opens at once, coloured a moment later)
  if (!isMd) {
    const d = LanguageDescription.matchFilename(languages, name);
    if (d) d.load().then((/** @type {LanguageSupport} */ support) => {
      if (!signal.aborted) view.dispatch({ effects: lang.reconfigure(support) });
    }).catch((error) => { if (!signal.aborted) reportFailure(error); });
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
      if (lines) scope.timeout(() => { if (!live) view.dispatch({ effects: tint.clear.of(null) }); }, TINT_MS);
    },
  });

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
    /** Focus the text, at a line when given. @param {{line?: number | null}} options */
    focus({ line = null } = {}) {
      view.focus();
      if (line && Number.isFinite(line)) { const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)); view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: "center" }) }); }
    },
    reveal(/** @type {number} */ line) { const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)); view.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: "start", yMargin: 96 }) }); },
    /** Select inclusive 1-based lines. @param {number} a @param {number} b */
    select(a, b) {
      const d = view.state.doc, A = d.line(Math.min(Math.max(1, a), d.lines)), B = d.line(Math.min(Math.max(a, b), d.lines));
      view.dispatch({ selection: { anchor: A.from, head: B.to }, effects: EditorView.scrollIntoView(A.from, { y: "center" }) });
    },
    clearSelection() { const h = view.state.selection.main.head; view.dispatch({ selection: { anchor: h } }); },
    /** Switch Markdown between page and source. @param {boolean} on */
    setPage(on) {
      if (!isMd) return;
      view.dispatch({ effects: [pageC.reconfigure(on ? pageExt : askTip), gutters.reconfigure(on ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter()])] });
      view.contentDOM.setAttribute("spellcheck", on ? "true" : "false");
    },
    get isMarkdown() { return isMd; },
    /** Show a read-only version or restore the live file. @param {string | null} text */
    showVersion(text) {
      if (text == null) { if (live) { view.setState(live); live = null; viewing = null; } return; }
      if (!live) live = view.state;
      viewing = text;
      view.setState(EditorState.create({ doc: text, extensions: extensions(true) }));
    },
    /** Highlight changes since the original version. @param {string | null} original */
    async showChanges(original) {
      if (original == null) { if (showing) { showing = false; view.dispatch({ effects: mergeC.reconfigure([]) }); } return; }
      const M = await loadMerge();
      if (signal.aborted || merging) return;
      showing = true;
      view.dispatch({ effects: mergeC.reconfigure(M.unifiedMergeView({ original, mergeControls: false, highlightChanges: true, gutter: true, syntaxHighlightDeletions: true })) });
    },
    /** A clash (the document's merge): each place you both changed is a chunk, Keep yours or Take theirs. */
    async showMerge() {
      const merge = doc.merge;
      if (!merge) return;
      const M = await loadMerge();
      if (signal.aborted || doc.merge !== merge) return;
      merging = true; showing = false;
      const control = (/** @type {"accept" | "reject"} */ type, /** @type {(event: MouseEvent) => void} */ action) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = `xd-btn cm-xo-chunk${type === "accept" ? " is-pri" : ""}`;
        b.textContent = type === "accept" ? "Keep yours" : "Take theirs";
        b.addEventListener("mousedown", action);
        return b;
      };
      view.dispatch({ effects: mergeC.reconfigure(M.unifiedMergeView({ original: merge.other, mergeControls: control, highlightChanges: true, gutter: true })) });
      const first = M.getChunks(view.state);
      if (first && first.chunks.length) view.dispatch({ selection: { anchor: first.chunks[0].fromB }, effects: EditorView.scrollIntoView(first.chunks[0].fromB, { y: "center" }) });
      countChunks();
    },
    /** The read-only switch follows the document (Space said it can't be saved here). */
    refresh() { if (!live) view.dispatch({ effects: ro.reconfigure([EditorState.readOnly.of(readOnlyNow()), EditorView.editable.of(!readOnlyNow())]) }); },
    destroy() {
      if (signal.aborted) return;
      scope.dispose();
      if (live) { view.setState(live); live = null; }
      if (!merging && !showing) doc.cmState = view.state; // undo and where you were, for when it opens again
      docs.attach(doc, { source: null, apply: null });
      view.destroy();
    },
  };
  return handle;
}
