// @ts-check

import { xi } from "../../core/ui/icons/icon.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import { EditorMountOptions } from "./editor-types.d.ts" */

/** @import {CodeMirror, EditorState, Extension, ViewUpdate} from "./cm-types.d.ts" */

/** @import {ImageSource} from "./markdown-figures.js" */

/** @typedef {{from: number, to: number}} LineRange */

/** @typedef {{name: string, page: boolean, isMd: boolean, pageExt: Extension}} PageOptions */

/** @typedef {Pick<EditorMountOptions, "onSave" | "onKey"> & {onUpdate: (update: ViewUpdate) => void}} EditorEvents */

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

/** @param {CodeMirror} CM @param {{images?: ImageSource | null}} [options] @returns {Promise<Extension>} */
export async function loadPageExtension(CM, options) {
  try {
    return (await import("./markdown-page.js")).pageView(CM, options);
  } catch (error) {
    reportFailure(error);
    return [];
  }
}

/** @param {CodeMirror} CM */
function highlight(CM) {
  const { HighlightStyle, tags: t } = CM;
  return HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--code-com)", fontStyle: "italic" },
    {
      tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.modifier, t.self],
      color: "var(--code-kw)",
    },
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

/** Briefly mark changed lines, using inclusive 1-based ranges. @param {CodeMirror} CM */
function tints(CM) {
  const { StateEffect, StateField, Decoration, EditorView } = CM;
  /** @type {import("@codemirror/state").StateEffectType<LineRange[]>} */
  const add = StateEffect.define();

  /** @type {import("@codemirror/state").StateEffectType<null>} */
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
          for (const { from, to } of e.value) {
            for (let n = Math.max(1, from); n <= Math.min(doc.lines, to); n++) out.push(mark.range(doc.line(n).from));
          }
          deco = deco.update({ add: out, sort: true });
        }
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return { field, add, clear };
}

/** @param {CodeMirror} CM @param {Pick<EditorMountOptions, "onLines" | "onAsk">} options */
function askTip(CM, { onLines, onAsk }) {
  const { StateField, showTooltip } = CM;
  const linesOf = (/** @type {EditorState} */ state) => {
    const s = state.selection.main;
    if (s.empty) return null;
    const a = state.doc.lineAt(s.from).number, bLine = state.doc.lineAt(s.to);
    const b = s.to === bLine.from && bLine.number > a ? bLine.number - 1 : bLine.number;
    return { a, b, pos: s.head };
  };
  const field = StateField.define({
    create: linesOf,
    update(lines, tr) {
      if (!tr.selection && !tr.docChanged) return lines;
      return linesOf(tr.state);
    },
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
          const label = l.a === l.b ? `line ${l.a}` : `lines ${l.a}–${l.b}`;
          const modifier = MAC ? xi("key-command", "kb-ic") : "Ctrl ";
          b.innerHTML = `<span>Ask about ${label}</span><kbd>${modifier}L</kbd>`;
          b.addEventListener("mousedown", (e) => e.preventDefault()); // the selection stays
          b.addEventListener("click", () => onAsk({ a: l.a, b: l.b }));
          dom.appendChild(b);
          return { dom };
        },
      };
    }),
  });
  /** @type {string | null} */
  let last = null;
  const listen = CM.EditorView.updateListener.of((/** @type {ViewUpdate} */ u) => {
    if (!u.selectionSet && !u.docChanged) return;
    const l = u.state.field(field);
    const k = l ? `${l.a}-${l.b}` : "";
    if (k !== last) {
      last = k;
      if (onLines) onLines(l ? { a: l.a, b: l.b } : null);
    }
  });
  return { field, ext: [field, listen], linesOf };
}

/** @param {CodeMirror} CM */
function editorTheme(CM) {
  return CM.EditorView.theme({
    "&": { height: "100%", color: "var(--code-ink)", backgroundColor: "transparent", fontSize: "var(--fs-code)" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "var(--lh-ui)", overflow: "auto" },
    ".cm-content": { caretColor: "var(--ink)", padding: "var(--cell-in) 0" },
    ".cm-gutters": { backgroundColor: "transparent", color: "var(--ink-5)", border: "none" },
    ".cm-activeLine": { backgroundColor: "var(--row-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink-3)" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "var(--ink)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--info) 28%, transparent)",
    },
    ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warn) 22%, transparent)", outline: "none" },
    ".cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--warn) 40%, transparent)" },
    ".cm-selectionMatch": { backgroundColor: "var(--hover-fill)" },
    ".cm-matchingBracket": { backgroundColor: "var(--hover-fill)", outline: "1px solid var(--line-strong)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--fill-1)", border: "none", color: "var(--ink-3)", borderRadius: "var(--r-xs)" },
    ".cm-tooltip": { backgroundColor: "var(--float)", border: "1px solid var(--line)", borderRadius: "var(--r)", color: "var(--ink)" },
    ".cm-panels": { backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" },
    ".cm-xo-tint": {
      backgroundColor: "color-mix(in srgb, var(--info) 14%, transparent)",
      transition: "background-color var(--d-long) var(--ease)",
    },
  });
}

/** @param {boolean} open */
function foldMarker(open) {
  const marker = document.createElement("span");
  marker.className = "cm-xo-fold";
  marker.textContent = open ? "⌄" : "›";
  return marker;
}

/** @param {CodeMirror} CM @param {Pick<EditorMountOptions, "onLines" | "onAsk">} options */
export function createEditorConfiguration(CM, { onLines, onAsk }) {
  const { Compartment, Annotation } = CM;
  const external = Annotation.define();
  const lang = new Compartment(), ro = new Compartment(), pageC = new Compartment();
  const gutters = new Compartment(), mergeC = new Compartment(), wrap = new Compartment();
  const tint = tints(CM);
  const ask = askTip(CM, { onLines, onAsk });

  /** @param {PageOptions & EditorEvents} options */
  function prepareExtensions({ name, page, isMd, pageExt, onSave, onKey, onUpdate }) {
    const {
      EditorState, EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor,
      rectangularSelection, crosshairCursor, highlightSpecialChars, history, historyKeymap, defaultKeymap, indentWithTab,
      searchKeymap, highlightSelectionMatches, search, foldGutter, foldKeymap, bracketMatching, indentOnInput,
      syntaxHighlighting, closeBrackets, closeBracketsKeymap, gotoLine, languages, markdown, markdownLanguage,
    } = CM;
    const theme = editorTheme(CM);
    const keys = keymap.of([
      { key: "Mod-s", preventDefault: true, run: () => { if (onSave) onSave(); return true; } },
      { key: "Ctrl-g", run: gotoLine },
      { key: "Mod-l", run: (v) => {
        const l = ask.linesOf(v.state);
        if (!l || !onAsk) return false;
        onAsk({ a: l.a, b: l.b });
        return true;
      } },
      ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab,
    ]);

    return (/** @type {boolean} */ readOnly) => [
      gutters.of(page && isMd ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter({ markerDOM: foldMarker })]),
      highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
      syntaxHighlighting(highlight(CM)), bracketMatching(), closeBrackets(), rectangularSelection(),
      crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
      search({ top: true }),
      wrap.of(EditorView.lineWrapping),
      lang.of(isMd ? markdown({ base: markdownLanguage, codeLanguages: languages }) : []),
      pageC.of(page && isMd ? pageExt : []),
      ro.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
      mergeC.of([]),
      tint.field, ask.ext, keys, theme,
      EditorView.contentAttributes.of({
        "aria-label": `${name || "File"}${page && isMd ? ", as a page" : ""}`,
        spellcheck: page && isMd ? "true" : "false",
      }),
      EditorView.updateListener.of(onUpdate),
      EditorView.domEventHandlers({ keydown: (/** @type {KeyboardEvent} */ e) => (onKey ? onKey(e) : false) }),
    ];
  }
  return { external, lang, ro, pageC, gutters, mergeC, tint, prepareExtensions };
}
