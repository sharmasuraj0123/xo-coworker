// @ts-check
import { readSpaceMap } from "../../core/platform/explore-response.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";

/** @param {import("../../core/kernel/types").ModuleContext} ctx */
export function explore(ctx) {
  let lens = "Graph";
  /** @type {import("../../core/platform/explore-types").SpaceMap | undefined} */
  let map;
  let error = "", loading = false;
  /** @param {HTMLElement} host */
  function paint(host) {
    const buttons = ["Graph", "Tree", "Timeline"].map(name =>
      `<button class="btn" data-lens="${name}" aria-pressed="${name === lens}">${name}</button>`).join("");
    let content = `<p role="status">${esc(error || "Loading…")}</p>`;
    if (map) {
      const { groups, leaves, ties, milestones } = map;
      const labels = new Map([...groups, ...leaves].map(n => [n.id, n.label]));
      const items = lens === "Timeline" ? milestones.map(m => `<li><time>${esc(m.d)}</time> ${esc(m.t)}</li>`)
        : lens === "Tree" ? groups.map(g => `<li><details><summary>${esc(g.label)}</summary><ul>`
          + leaves.filter(n => n.group === g.id).map(n => `<li>${esc(n.label)}</li>`).join("") + "</ul></details></li>")
        : ties.map(e => `<li>${esc(labels.get(e.s) || e.s)} → ${esc(labels.get(e.t) || e.t)} · ${esc(e.label)}</li>`);
      content = items.length ? `<ul>${items.join("")}</ul>` : "<p>No entries.</p>";
    }
    redraw(host, `<h1>Explore</h1><div role="group" aria-label="View">${buttons}</div>${content}`);
  }
  ctx.contribute("page", { id: "explore", mount(host) {
    ctx.listen(host, "click", ({target}) => {
      const next = target instanceof Element && target.closest("[data-lens]")?.getAttribute("data-lens");
      if (next) { lens = next; paint(host); }
    });
  }, render(host) {
    paint(host);
    if (map || loading || error) return;
    loading = true;
    void readSpaceMap(ctx.signal).then(data => { map = data; }).catch(cause => {
      if (!ctx.signal.aborted) error = requestFailureMessage(cause, "Space map unavailable");
    }).finally(() => { loading = false; if (!ctx.signal.aborted) paint(host); });
  } });
}
