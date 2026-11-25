// @ts-check

import { STYLE_NAMES, ToolStrip } from "./markdown-tools.js";
import { LISTS, styleAt } from "./markdown-format-bar.js";
import { countsOf, insertBlock, insertDate, insertFootnote, setLineStyle } from "./markdown-commands.js";

/** @import {CodeMirror, EditorState, EditorView, TransactionSpec, ViewUpdate} from "./cm-types.d.ts" */

/** @import {BlockKind, LineStyle} from "./markdown-commands.js" */

/** @import {MenuItem} from "./markdown-tools.js" */

/** @type {(MenuItem | "-")[]} */
const MORE = [
  ...LISTS.filter(([id]) => id !== "task").map(([id, label, icon]) => ({ id, label, icon })),
  { id: "quote", label: "Quote", icon: "quote" },
  "-",
  { id: "code", label: "Code block", icon: "code" },
  { id: "divider", label: "Divider" },
  { id: "callout", label: "Callout", icon: "info" },
  { id: "formula", label: "Formula" },
  { id: "footnote", label: "Footnote" },
  { id: "contents", label: "Table of contents" },
  { id: "date", label: "Date", icon: "calendar" },
];

/** @type {Set<string>} */
const BLOCKS = new Set(["table", "image", "diagram", "code", "divider", "callout", "formula", "contents"]);

/** @type {Set<string>} */
const STYLES = new Set(["body", "h1", "h2", "h3", "quote", "ul", "ol", "task"]);

/** @param {string} id @returns {id is BlockKind} */
const isBlock = (id) => BLOCKS.has(id);

/** @param {string} id @returns {id is LineStyle} */
const isStyle = (id) => STYLES.has(id);

/** @param {number} n @param {string} one @param {string} many */
const counted = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** What the More menu says about the document's length. @param {EditorState} state */
function lengthNote(state) {
  const { all, selected } = countsOf(state);
  if (!selected) return `${counted(all.words, "word", "words")} · ${counted(all.characters, "character", "characters")}`;
  return `${selected.words.toLocaleString()} of ${counted(all.words, "word", "words")} · ` +
    `${selected.characters.toLocaleString()} of ${counted(all.characters, "character", "characters")}`;
}

/** The bar along the page's foot. @param {CodeMirror} CM @param {EditorView} view */
function createInsertBar(CM, view) {
  const strip = new ToolStrip(view, "pt-dock", "Insert", run);
  strip.button({ id: "style", label: "Text style", icon: "text-size", menu: true });
  strip.gap();
  strip.button({ id: "table", label: "Table", icon: "table" });
  strip.button({ id: "image", label: "Picture", icon: "image" });
  strip.button({ id: "task", label: "Checklist", icon: "checklist" });
  strip.button({ id: "diagram", label: "Diagram", icon: "graph" });
  strip.gap();
  strip.button({ id: "more", label: "More", icon: "more", menu: true });
  const dom = document.createElement("div");
  dom.className = "pt-dockwrap";
  dom.appendChild(strip.dom);

  /** @param {TransactionSpec} spec */
  function apply(spec) { view.dispatch(spec); view.focus(); }

  /** @param {string} id */
  function insert(id) {
    const { state } = view;
    if (id === "footnote") apply(insertFootnote(state));
    else if (id === "date") apply(insertDate(state, new Date()));
    else if (isBlock(id)) apply(insertBlock(CM, state, id));
    else if (isStyle(id)) apply(setLineStyle(state, id));
  }

  /** @param {string} id @param {HTMLElement} button @param {MouseEvent} event */
  function run(id, button, event) {
    if (id === "style") {
      const now = styleAt(view.state);
      const items = STYLE_NAMES.map(([s, label]) => ({ id: s, label, checked: now === s }));
      strip.toggle(button, { items, pick: insert }, event);
    } else if (id === "more") strip.toggle(button, { items: MORE, note: lengthNote(view.state), pick: insert }, event);
    else insert(id);
  }

  dom.hidden = view.state.readOnly;
  return {
    dom,
    top: false,
    /** @param {ViewUpdate} update */
    update(update) { dom.hidden = update.state.readOnly; },
    destroy() { strip.destroy(); },
  };
}

/** @param {CodeMirror} CM */
export function insertBar(CM) {
  return CM.showPanel.of((view) => createInsertBar(CM, view));
}
