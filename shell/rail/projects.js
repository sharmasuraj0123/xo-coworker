// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { read, write, reportStorageFailure } from "../../core/platform/storage.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { reconcile } from "../../core/ui/redraw.js";

const KEY = "xo-sidebar-project-pins";

/** @typedef {import("../../core/kernel/types").Lifetime} Lifetime */

/** @param {Lifetime} scope @param {() => {id:string,name:string}[]} projects @param {() => void} change */
export function projectPicker(scope, projects, change) {
  const opener = requireHtml("[data-project-list]", "button"), panel = requireHtml("#rail-project-picker");
  const input = requireHtml("input", "input", panel), list = requireHtml("nav", "nav", panel);
  const pins = new Set(read(KEY, raw => {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  }, [], "local", reportStorageFailure));

  let open = false;
  scope.listen(panel, "beforetoggle", (event) => { open = "newState" in event && event.newState === "open"; });
  function paint(opening = false) {
    const all = projects();
    opener.hidden = !all.length;
    const label = `See all · ${all.length}`;
    if (opener.textContent !== label) opener.textContent = label;
    if (!opening && !open) return;
    const q = input.value.trim().toLowerCase();
    const matches = all.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)));
    reconcile(list, matches.map(({ id, name }) => ({
      key: id, html: `<div class="project-option"><button type="button" class="nrow" data-go="p:${esc(id)}">${esc(name)}</button>`
        + `<button type="button" class="side-ib" data-pin-project="${esc(id)}" aria-pressed="${pins.has(id)}"`
        + ` aria-label="Pin ${esc(name)} to sidebar">${ICON.pin}</button></div>`,
    })));
  }
  scope.listen(opener, "click", () => { input.value = ""; paint(true); });
  scope.listen(input, "input", () => paint(true));
  scope.listen(panel, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    const id = target.closest("[data-pin-project]")?.getAttribute("data-pin-project");
    if (id) {
      if (pins.has(id)) pins.delete(id); else pins.add(id);
      write(KEY, JSON.stringify([...pins]), "local", reportStorageFailure);
      change();
    } else if (target.closest("[data-go],[data-new-project]")) {
      panel.hidePopover();
      if (target.closest("[data-new-project]")) requireHtml("#side-add", "button").click();
    }
  });
  return { paint, pinned: (/** @type {string} */ id) => pins.has(id) };
}
