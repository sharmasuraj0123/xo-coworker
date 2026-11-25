// @ts-check

import { STYLE_NAMES, ToolStrip } from "./markdown-tools.js";
import { lineStyleOf, linkTo, marksAt, setLineStyle, toggleMark } from "./markdown-commands.js";

/** @import {CodeMirror, EditorState, EditorView, TransactionSpec, ViewUpdate} from "./cm-types.d.ts" */

/** @import {LineStyle, Mark} from "./markdown-commands.js" */

/** @typedef {((state: EditorState) => void) | null} AskAbout */

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl+";

/** @type {[Mark, string, string, string][]} */
const MARK_TOOLS = [
  ["bold", "Bold", "bold", "B"], ["italic", "Italic", "italic", "I"], ["strike", "Strikethrough", "strikethrough", "Shift+X"],
  ["code", "Code", "code", "E"],
];

/** @type {[LineStyle, string, string][]} */
export const LISTS = [["ul", "Bulleted list", "list"], ["ol", "Numbered list", "list-numbered"], ["task", "Checklist", "checklist"]];

/** The style of the line the selection starts on. @param {EditorState} state */
export const styleAt = (state) => lineStyleOf(state.doc.lineAt(state.selection.main.from).text);

/** The bar over a selection. @param {CodeMirror} CM @param {EditorView} view @param {AskAbout} askAbout */
function createFormatBar(CM, view, askAbout) {
  const strip = new ToolStrip(view, "pt-format", "Format", run);
  const style = strip.button({ id: "style", label: "Text style", text: "Body", menu: true });
  strip.gap();
  const marks = new Map(MARK_TOOLS.map(([id, label, icon, key]) => [id, strip.button({ id, label, icon, keys: MOD + key })]));
  const link = strip.button({ id: "link", label: "Link", icon: "link" });
  strip.gap();
  const list = strip.button({ id: "list", label: "List", icon: "list", menu: true });
  const quote = strip.button({ id: "quote", label: "Quote", icon: "quote" });
  if (askAbout) {
    strip.gap();
    strip.button({ id: "ask", label: "Ask about the selected lines", icon: "chat-ai", text: "Ask", keys: `${MOD}L` });
  }
  const linkForm = document.createElement("input");
  linkForm.className = "pt-link";
  linkForm.type = "url";
  linkForm.placeholder = "Paste a link";
  linkForm.setAttribute("aria-label", "Link address");
  strip.dom.appendChild(linkForm);

  /** @param {TransactionSpec} spec */
  function apply(spec) { view.dispatch(spec); view.focus(); }

  /** @param {string} id @param {HTMLElement} button @param {MouseEvent} event */
  function run(id, button, event) {
    const { state } = view;
    const now = styleAt(state);
    if (id === "style") {
      const items = STYLE_NAMES.map(([s, label]) => ({ id: s, label, checked: now === s }));
      strip.toggle(button, { items, pick: (s) => apply(setLineStyle(view.state, /** @type {LineStyle} */ (s))) }, event);
    } else if (id === "list") {
      const items = LISTS.map(([s, label, icon]) => ({ id: s, label, icon, checked: now === s }));
      strip.toggle(button, { items, pick: (s) => apply(setLineStyle(view.state, /** @type {LineStyle} */ (s))) }, event);
    } else if (id === "quote") apply(setLineStyle(state, "quote"));
    else if (id === "link") openLink();
    else if (id === "ask") askAbout?.(state);
    else if (marks.has(/** @type {Mark} */ (id))) apply(toggleMark(CM, state, /** @type {Mark} */ (id)));
  }

  function openLink() {
    strip.dom.classList.add("is-linking");
    linkForm.value = "";
    linkForm.focus();
  }

  /** @param {boolean} done */
  function closeLink(done) {
    if (!strip.dom.classList.contains("is-linking")) return;
    strip.dom.classList.remove("is-linking");
    const address = linkForm.value.trim();
    if (done && address) apply(linkTo(CM, view.state, address));
    else view.focus();
  }
  strip.scope.listen(linkForm, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter") { event.preventDefault(); closeLink(true); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeLink(false); }
  });
  strip.scope.listen(linkForm, "blur", () => {
    if (strip.dom.classList.contains("is-linking")) strip.dom.classList.remove("is-linking");
  });

  /** @param {EditorState} state */
  function refresh(state) {
    const on = marksAt(CM, state);
    const now = styleAt(state);
    for (const [id, button] of marks) ToolStrip.pressed(button, on.has(id));
    ToolStrip.pressed(link, on.has("link"));
    ToolStrip.pressed(list, now === "ul" || now === "ol" || now === "task");
    ToolStrip.pressed(quote, now === "quote");
    const label = STYLE_NAMES.find(([s]) => s === now)?.[1] ?? "Body";
    /** @type {HTMLElement} */ (style.querySelector("span")).textContent = label;
    strip.dom.classList.toggle("is-readonly", state.readOnly);
  }
  refresh(view.state);

  return {
    dom: strip.dom,
    /** @param {ViewUpdate} update */
    update(update) {
      if (update.selectionSet || update.docChanged || update.transactions.some((t) => t.reconfigured)) refresh(update.state);
    },
    destroy() { strip.destroy(); },
  };
}

/** Shows the format bar over any selection; a read-only page offers only Ask. @param {CodeMirror} CM @param {AskAbout} askAbout */
export function formatBar(CM, askAbout) {
  const { StateField, showTooltip } = CM;
  /** @param {EditorState} state */
  const spot = (state) => {
    const range = state.selection.main;
    return range.empty || (state.readOnly && !askAbout) ? null : range.from;
  };
  return StateField.define({
    create: spot,
    update: (value, tr) => (tr.selection || tr.docChanged || tr.reconfigured ? spot(tr.state) : value),
    provide: (field) => showTooltip.compute([field], (state) => {
      const pos = state.field(field);
      if (pos === null) return null;
      return { pos, above: true, arrow: false, create: (/** @type {EditorView} */ view) => createFormatBar(CM, view, askAbout) };
    }),
  });
}
