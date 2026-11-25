// @ts-check

import { renderMarkdown, renderInline } from "../../core/ui/markdown/markdown.js";
import { drawRichElement, ownRichElement } from "../../core/ui/markdown/rich.js";
import { createScope } from "../../core/kernel/scope.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { fieldText } from "./markdown-front-matter.js";

/** @import {CodeMirror, EditorView} from "./cm-types.d.ts" */

const DRAW_MS = 250;
/** @param {ReturnType<typeof createScope>} scope @param {HTMLElement} node */
function drawIn(scope, node) {
  const elements = /** @type {NodeListOf<HTMLElement>} */ (node.querySelectorAll(".md-math, .md-diagram"));
  if (!elements.length) return;
  for (const element of elements) ownRichElement(element, scope.signal, reportFailure);
  scope.timeout(() => {
    for (const element of elements) {
      if (!element.matches(".is-done, .is-failed")) void drawRichElement(element);
    }
  }, DRAW_MS);
}

/** @param {CodeMirror["WidgetType"]} WidgetType */
export function createMarkdownWidgets(WidgetType) {
  /** @type {WeakMap<HTMLElement, ReturnType<typeof createScope>>} */
  const scopes = new WeakMap();

  /** @param {HTMLElement} node */
  function own(node) {
    const scope = createScope();
    scopes.set(node, scope);
    return scope;
  }

  /** @param {HTMLElement} node */
  function dispose(node) {
    scopes.get(node)?.dispose();
    scopes.delete(node);
  }

  class BlockWidget extends WidgetType {
    /** @param {string} src @param {number} from */
    constructor(src, from, preview = false) { super(); this.src = src; this.from = from; this.preview = preview; }
    /** @override @param {BlockWidget} other */
    eq(other) { return other.src === this.src && other.from === this.from && other.preview === this.preview; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const d = document.createElement("div");
      const scope = own(d);
      d.className = `cm-md-block prose vw-md${this.preview ? " is-preview" : ""}`;
      d.innerHTML = renderMarkdown(this.src);
      drawIn(scope, d);
      scope.listen(d, "mousedown", (e) => {
        if (e.target instanceof Element && e.target.closest("a, button")) return;
        e.preventDefault();
        const at = Math.min(view.state.doc.length, this.from);
        view.dispatch({ selection: { anchor: at } });
        view.focus();
      });
      return d;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return false; }
    /** @override */
    get estimatedHeight() { return 48; }
  }
  class MathWidget extends WidgetType {
    /** @param {string} src @param {number} from */
    constructor(src, from) { super(); this.src = src; this.from = from; }
    /** @override @param {MathWidget} other */
    eq(other) { return other.src === this.src && other.from === this.from; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const s = document.createElement("span");
      const scope = own(s);
      s.className = "cm-md-imath";
      s.innerHTML = renderInline(this.src);
      drawIn(scope, s);
      scope.listen(s, "mousedown", (event) => {
        event.preventDefault();
        view.dispatch({ selection: { anchor: this.from + 1 } });
        view.focus();
      });
      return s;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return false; }
  }
  class Bullet extends WidgetType {
    /** @override */
    eq() { return true; }
    /** @override */
    toDOM() { const s = document.createElement("span"); s.className = "cm-md-bullet"; s.textContent = "•"; return s; }
  }
  const bullet = new Bullet();
  class FrontWidget extends WidgetType {
    /** @param {[string, string][]} fields */
    constructor(fields) { super(); this.fields = fields; }
    /** @override @param {FrontWidget} other */
    eq(other) { return JSON.stringify(other.fields) === JSON.stringify(this.fields); }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const d = document.createElement("div");
      const scope = own(d);
      d.className = "cm-md-front";
      d.setAttribute("aria-label", "Properties");
      for (const [key, value] of this.fields) {
        if (key === "title") continue;
        const words = key === "tags" || key === "keywords" ? value.split(/,\s*/) : [fieldText(value)];
        for (const word of words) {
          const chip = document.createElement("span");
          chip.className = `cm-md-prop${key === "status" ? " is-status" : ""}`;
          chip.title = key;
          chip.textContent = key === "status" ? word.charAt(0).toUpperCase() + word.slice(1) : word;
          d.appendChild(chip);
        }
      }
      scope.listen(d, "mousedown", (event) => {
        event.preventDefault();
        view.dispatch({ selection: { anchor: view.state.doc.line(Math.min(2, view.state.doc.lines)).from } });
        view.focus();
      });
      return d;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return false; }
  }
  class NotesHead extends WidgetType {
    /** @override */
    eq() { return true; }
    /** @override */
    toDOM() { const d = document.createElement("div"); d.className = "cm-md-notes"; d.textContent = "Notes"; return d; }
  }
  const notesHead = new NotesHead();
  return { BlockWidget, MathWidget, FrontWidget, bullet, notesHead };
}
