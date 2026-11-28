// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { renderInline, cells } from "../../core/ui/markdown/markdown.js";

/** @import { CodeMirror, EditorView } from "./cm-types.d.ts" */

/** @typedef {{ row: number, column: number }} CellPosition */

/** @param {readonly unknown[]} list */
function rowLine(list) {
  return `| ${list.map((c) => String(c).replace(/\n/g, " ").replace(/(?<!\\)\|/g, "\\|")).join(" | ")} |`;
}

/** @param {string} src */
function tableRows(src) {
  const lines = src.split("\n");
  const rows = /** @type {{ line: number, cells: string[] }[]} */ ([]);
  lines.forEach((l, i) => { if (i !== 1 && l.trim()) rows.push({ line: i, cells: cells(l) }); });
  const align = lines[1] ? cells(lines[1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "")) : [];
  return { rows, align, width: rows.length ? rows[0].cells.length : 0 };
}

/** @param {CodeMirror["WidgetType"]} WidgetType */
export function createTableWidget(WidgetType) {
  /** @type {WeakMap<HTMLElement, {widget: TableWidget, focusNext: CellPosition | null, dispose(): void}>} */
  const tables = new WeakMap();

  class TableWidget extends WidgetType {
    /** @param {string} source @param {number} from */
    constructor(source, from) {
      super();
      this.source = source;
      this.from = from;
    }

    /** @override @param {TableWidget} other */
    eq(other) { return other.source === this.source && other.from === this.from; }

    /** @override @param {EditorView} view */
    toDOM(view) {
      const wrap = document.createElement("div");
      wrap.className = "cm-md-block cm-md-table prose vw-md";
      wrap.innerHTML = '<div class="md-table"><table><thead></thead><tbody></tbody></table></div>';
      const scope = createScope();
      const state = { widget: this, focusNext: /** @type {CellPosition | null} */ (null), dispose: scope.dispose };
      tables.set(wrap, state);
      this.fill(wrap, null);
      scope.listen(wrap, "focusin", ({ target }) => {
        const cell = cellOf(target);
        if (cell && cell.textContent !== cell.dataset.raw) cell.textContent = cell.dataset.raw ?? "";
      });
      scope.listen(wrap, "focusout", ({ target }) => {
        const cell = cellOf(target);
        if (cell) cell.innerHTML = renderInline(cell.dataset.raw ?? "") || "&#8203;";
      });
      scope.listen(wrap, "input", ({ target }) => {
        const cell = cellOf(target);
        if (!cell) return;
        cell.dataset.raw = (cell.textContent ?? "").replace(/\u200b/g, "");
        const { widget } = state;
        const row = Number(cell.dataset.r);
        const values = Array.from(wrap.querySelectorAll(`[data-r="${row}"]`), (node) => {
          return node instanceof HTMLElement ? node.dataset.raw : "";
        });
        const lines = tableRows(widget.source).rows;
        const line = view.state.doc.lineAt(widget.from).number + lines[row].line;
        const { from, to } = view.state.doc.line(line);
        view.dispatch({ changes: { from, to, insert: rowLine(values) }, userEvent: "input.table" });
      });
      scope.listen(wrap, "keydown", (keyEvent) => {
        const event = /** @type {KeyboardEvent} */ (keyEvent);
        const cell = cellOf(event.target);
        if (!cell || event.isComposing) return;
        const { widget } = state;
        const { rows, width } = tableRows(widget.source);
        const start = view.state.doc.lineAt(widget.from).number;
        const row = Number(cell.dataset.r), column = Number(cell.dataset.c);
        if (event.key === "Tab") {
          event.preventDefault();
          const all = [...wrap.querySelectorAll("[data-r]")];
          focusCell(all[all.indexOf(cell) + (event.shiftKey ? -1 : 1)]);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          const end = start + rows[rows.length - 1].line;
          view.focus();
          view.dispatch({ selection: { anchor: view.state.doc.line(end).to } });
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (row < rows.length - 1) {
            focusCell(atCell(wrap, { row: row + 1, column }));
            return;
          }
          const last = view.state.doc.line(start + rows[row].line);
          state.focusNext = { row: row + 1, column: 0 };
          view.dispatch({ changes: { from: last.to, insert: "\n" + rowLine(Array(width).fill("")) }, userEvent: "input.table" });
        }
      });
      return wrap;
    }

    /** @override @param {HTMLElement} wrap */
    updateDOM(wrap) {
      const state = tables.get(wrap);
      if (!state) return false;
      state.widget = this;
      this.fill(wrap, document.activeElement);
      if (state.focusNext) {
        const cell = atCell(wrap, state.focusNext);
        state.focusNext = null;
        if (cell instanceof HTMLElement) cell.focus();
      }
      return true;
    }

    /** @param {HTMLElement} wrap @param {Element | null} keep */
    fill(wrap, keep) {
      const { rows, align, width } = tableRows(this.source);
      const head = wrap.querySelector("thead"), body = wrap.querySelector("tbody");
      if (!head || !body) return;
      rows.forEach((row, index) => {
        const first = index === 0;
        const section = first ? head : body;
        const slot = first ? 0 : index - 1;
        const existing = /** @type {HTMLTableRowElement | undefined} */ (section.children[slot]);
        const tr = existing ?? section.appendChild(document.createElement("tr"));
        for (let column = 0; column < width; column++) {
          let cell = /** @type {HTMLTableCellElement | undefined} */ (tr.children[column]);
          if (!cell) {
            cell = document.createElement(first ? "th" : "td");
            cell.contentEditable = "true";
            cell.spellcheck = false;
            cell.dataset.r = String(index);
            cell.dataset.c = String(column);
            tr.appendChild(cell);
          }
          const raw = row.cells[column] ?? "";
          if (align[column]) cell.style.textAlign = align[column];
          if (cell !== keep && (cell.dataset.raw !== raw || !cell.innerHTML)) cell.innerHTML = renderInline(raw) || "&#8203;";
          cell.dataset.raw = raw;
        }
        while (tr.children.length > width) tr.lastElementChild?.remove();
      });
      while (body.children.length > Math.max(0, rows.length - 1)) body.lastElementChild?.remove();
    }
    /** @override @param {HTMLElement} wrap */
    destroy(wrap) {
      tables.get(wrap)?.dispose();
      tables.delete(wrap);
    }
    /** @override */
    ignoreEvent() { return true; }
    /** @override */
    get estimatedHeight() { return 120; }
  }
  return TableWidget;
}

/** @param {EventTarget | null} target */
function cellOf(target) {
  const cell = target instanceof Element ? target.closest("[data-r]") : null;
  return cell instanceof HTMLElement ? cell : null;
}

/** @param {HTMLElement} table @param {CellPosition} position */
function atCell(table, { row, column }) {
  return table.querySelector(`[data-r="${row}"][data-c="${column}"]`);
}

/** @param {Element | null | undefined} cell */
function focusCell(cell) {
  if (!(cell instanceof HTMLElement)) return;
  cell.focus();
  const selection = getSelection();
  selection?.selectAllChildren(cell);
  selection?.collapseToEnd();
}
