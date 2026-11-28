// @ts-check

import { xi } from "../../core/ui/icons/icon.js";
import { createScope } from "../../core/kernel/scope.js";

/** @import {CodeMirror, EditorView} from "./cm-types.d.ts" */

const CALLOUTS = /** @type {const} */ ({
  note: { word: "Note", icon: "info" },
  tip: { word: "Tip", icon: "lightbulb" },
  important: { word: "Important", icon: "alert" },
  warning: { word: "Warning", icon: "warning" },
  caution: { word: "Caution", icon: "x-circle" },
});

/** @typedef {keyof typeof CALLOUTS} CalloutKind */

/** @param {CodeMirror} CM */
export function createInlineWidgets({ WidgetType, EditorView }) {
  /** @type {WeakMap<HTMLElement, ReturnType<typeof createScope>>} */
  const scopes = new WeakMap();
  /** @param {HTMLElement} node */
  const own = (node) => { const scope = createScope(); scopes.set(node, scope); return scope; };
  /** @param {HTMLElement} node */
  const dispose = (node) => { scopes.get(node)?.dispose(); scopes.delete(node); };
  /** @param {EditorView} view @param {number} at */
  const goTo = (view, at) => {
    view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: "center" }) });
    view.focus();
  };

  class CalloutLabel extends WidgetType {
    /** @param {CalloutKind} kind @param {boolean} titled */
    constructor(kind, titled) { super(); this.kind = kind; this.titled = titled; }
    /** @override @param {CalloutLabel} other */
    eq(other) { return other.kind === this.kind && other.titled === this.titled; }
    /** @override */
    toDOM() {
      const s = document.createElement("span");
      s.className = "cm-md-callout-label";
      const { word, icon } = CALLOUTS[this.kind];
      s.innerHTML = xi(icon, "", "sm") + (this.titled ? "" : `<span>${word}</span>`);
      return s;
    }
  }

  class TaskBox extends WidgetType {
    /** @param {boolean} done @param {number} at */
    constructor(done, at) { super(); this.done = done; this.at = at; }
    /** @override @param {TaskBox} other */
    eq(other) { return other.done === this.done && other.at === this.at; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const b = document.createElement("span");
      b.className = `cm-md-task${this.done ? " is-done" : ""}`;
      b.setAttribute("role", "checkbox");
      b.setAttribute("aria-checked", String(this.done));
      b.setAttribute("aria-label", this.done ? "Done" : "To do");
      b.innerHTML = this.done ? xi("check", "", "xs") : "";
      own(b).listen(b, "mousedown", (event) => {
        event.preventDefault();
        if (view.state.readOnly) return;
        view.dispatch({ changes: { from: this.at + 1, to: this.at + 2, insert: this.done ? " " : "x" }, userEvent: "input.task" });
      });
      return b;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return true; }
  }

  class NoteRef extends WidgetType {
    /** @param {number} n @param {number | null} target */
    constructor(n, target) { super(); this.n = n; this.target = target; }
    /** @override @param {NoteRef} other */
    eq(other) { return other.n === this.n && other.target === this.target; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const s = document.createElement("sup");
      s.className = "cm-md-fnref";
      s.textContent = String(this.n);
      own(s).listen(s, "mousedown", (event) => {
        if (this.target == null) return;
        event.preventDefault();
        goTo(view, this.target);
      });
      return s;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return false; }
  }

  class NoteNumber extends WidgetType {
    /** @param {number} n @param {number | null} back */
    constructor(n, back) { super(); this.n = n; this.back = back; }
    /** @override @param {NoteNumber} other */
    eq(other) { return other.n === this.n && other.back === this.back; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const s = document.createElement("span");
      s.className = "cm-md-fnnum";
      s.textContent = `${this.n}.`;
      if (this.back != null) {
        s.title = "Back to the text";
        own(s).listen(s, "mousedown", (event) => {
          if (this.back == null) return;
          event.preventDefault();
          goTo(view, this.back);
        });
      }
      return s;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { dispose(node); }
    /** @override */
    ignoreEvent() { return false; }
  }

  class CodeLabel extends WidgetType {
    /** @param {string} language */
    constructor(language) { super(); this.language = language; }
    /** @override @param {CodeLabel} other */
    eq(other) { return other.language === this.language; }
    /** @override */
    toDOM() { const s = document.createElement("span"); s.className = "cm-md-codelang"; s.textContent = this.language; return s; }
  }

  return { CalloutLabel, TaskBox, NoteRef, NoteNumber, CodeLabel };
}
