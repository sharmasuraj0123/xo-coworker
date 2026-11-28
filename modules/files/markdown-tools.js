// @ts-check

import { xi } from "../../core/ui/icons/icon.js";
import { createScope } from "../../core/kernel/scope.js";
import { focusOpened, menuKeys } from "../../core/ui/a11y/keynav.js";

/** @import {EditorView} from "./cm-types.d.ts" */

/** @import {LineStyle} from "./markdown-commands.js" */

/** @typedef {{ id: string, label: string, icon?: string, text?: string, keys?: string, menu?: boolean }} Tool */

/** @typedef {{ id: string, label: string, icon?: string, checked?: boolean }} MenuItem */

/** @typedef {{ items: (MenuItem | "-")[], note?: string, pick: (id: string) => void }} MenuSpec */

/** @typedef {(id: string, button: HTMLElement, event: MouseEvent) => void} ToolRun */

/** @type {[LineStyle, string][]} */
export const STYLE_NAMES = [["body", "Body"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"]];

/** A row of tools over a Markdown page: buttons, separators and one open menu at a time; the editor keeps the selection. */
export class ToolStrip {
  /** @param {EditorView} view @param {string} className @param {string} label @param {ToolRun} run */
  constructor(view, className, label, run) {
    this.view = view;
    this.scope = createScope();
    this.dom = document.createElement("div");
    this.dom.className = `pt-strip ${className}`;
    this.dom.setAttribute("role", "toolbar");
    this.dom.setAttribute("aria-label", label);
    /** @type {{ menu: HTMLElement, opener: HTMLElement, spec: MenuSpec, stopKeys: () => void } | null} */
    this.open = null;
    this.scope.listen(this.dom, "mousedown", (event) => {
      if (!(event.target instanceof Element && event.target.closest("input"))) event.preventDefault();
    });
    this.scope.listen(this.dom, "click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const item = target?.closest("[data-item]");
      if (item && this.open) {
        const { spec } = this.open;
        this.close(false);
        spec.pick(item.getAttribute("data-item") || "");
        return;
      }
      const tool = /** @type {HTMLElement | null} */ (target?.closest("[data-tool]") ?? null);
      if (tool && event instanceof MouseEvent) run(tool.getAttribute("data-tool") || "", tool, event);
    });
    this.scope.listen(document, "pointerdown", (event) => {
      if (this.open && !(event.target instanceof Node && this.dom.contains(event.target))) this.close(false);
    });
  }

  /** @param {Tool} tool */
  button({ id, label, icon, text, keys, menu }) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pt-tool${text ? " has-text" : ""}`;
    b.setAttribute("data-tool", id);
    b.setAttribute("aria-label", label);
    b.setAttribute("title", keys ? `${label} (${keys})` : label);
    if (menu) { b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false"); }
    b.innerHTML = (icon ? xi(icon) : "") + (text ? "<span></span>" : "") + (menu ? xi("chevron-down", "pt-chev", "xs") : "");
    if (text) /** @type {HTMLElement} */ (b.querySelector("span")).textContent = text;
    if (!menu) { this.dom.appendChild(b); return b; }
    const holder = document.createElement("span");
    holder.className = "pt-wrap";
    holder.appendChild(b);
    this.dom.appendChild(holder);
    return b;
  }

  gap() {
    const s = document.createElement("span");
    s.className = "pt-gap";
    s.setAttribute("aria-hidden", "true");
    this.dom.appendChild(s);
  }

  /** Opens a menu by its button, which closes it again. @param {HTMLElement} opener @param {MenuSpec} spec @param {MouseEvent} event */
  toggle(opener, spec, event) {
    const again = this.open?.opener === opener;
    this.close(false);
    if (again) return;
    const menu = document.createElement("div");
    menu.className = "vw-menu pt-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", opener.getAttribute("aria-label") || "");
    if (spec.note) {
      const note = document.createElement("p");
      note.className = "pt-note";
      note.textContent = spec.note;
      menu.appendChild(note);
    }
    for (const item of spec.items) menu.appendChild(item === "-" ? rule() : row(item));
    opener.after(menu);
    opener.setAttribute("aria-expanded", "true");
    const stopKeys = menuKeys(this.dom, { close: () => this.close(true) });
    this.open = { menu, opener, spec, stopKeys };
    focusOpened(menu, event);
  }

  /** @param {boolean} refocus whether focus goes back to the menu's button */
  close(refocus) {
    const open = this.open;
    if (!open) return;
    this.open = null;
    open.stopKeys();
    open.opener.setAttribute("aria-expanded", "false");
    const hadFocus = open.menu.contains(document.activeElement);
    open.menu.remove();
    if (refocus) open.opener.focus();
    else if (hadFocus) this.view.focus();
  }

  /** @param {HTMLElement} button @param {boolean} on */
  static pressed(button, on) { button.setAttribute("aria-pressed", String(on)); }

  destroy() { this.close(false); this.scope.dispose(); }
}

/** @param {MenuItem} item */
function row({ id, label, icon, checked }) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("role", checked === undefined ? "menuitem" : "menuitemradio");
  if (checked !== undefined) b.setAttribute("aria-checked", String(checked));
  b.setAttribute("data-item", id);
  b.innerHTML = icon ? xi(icon) : '<i class="pt-noicon" aria-hidden="true"></i>';
  const words = document.createElement("span");
  words.textContent = label;
  b.appendChild(words);
  if (checked) b.insertAdjacentHTML("beforeend", xi("check", "pt-check"));
  return b;
}

function rule() {
  const r = document.createElement("div");
  r.className = "pt-rule";
  r.setAttribute("role", "separator");
  return r;
}
