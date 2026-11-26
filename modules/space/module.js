// @ts-check
import { scheduleApi } from "../../core/platform/schedule-response.js";
import { readConnections, readSharing } from "../../core/platform/space-surfaces-response.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";
import { secrets, diagnostics } from "./settings.js";
import { explore } from "./explore.js";

/** @param {string} name @param {string} detail */
const row = (name, detail) => `<li><b>${esc(name)}</b><p>${esc(detail)}</p></li>`;

/** @param {AbortSignal} signal */
async function scheduled(signal) {
  const { jobs } = await scheduleApi.schedules(signal);
  return jobs.map(job => row(job.name, [job.running ? "Running" : job.enabled ? "Enabled" : "Paused",
    job.description, job.next_run && "Next run " + job.next_run].filter(Boolean).join(" · ")));
}

/** @param {AbortSignal} signal */
async function shared(signal) {
  const { repos } = await readSharing(signal);
  return Object.entries(repos).filter(([, repo]) => repo.shared).map(([name, repo]) => row(name, repo.project || "Shared with this Space"));
}

/** @param {AbortSignal} signal */
async function connectors(signal) {
  const { connections } = await readConnections(signal);
  return connections.map(c => row(c.display_name || c.toolkit,
    c.connected_here ? "Connected here" : c.configured ? "Configured" : "Available"));
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const spacePages = {
  manifest: { id: "xo.space-pages", version: "1.0.0", kernel: "^1.1.0",
    contributes: ["page:scheduled", "page:shared", "page:connectors", "page:explore",
      "settings.section:secrets", "settings.section:diagnostics"] },
  activate(ctx) {
    explore(ctx);
    ctx.contribute("settings.section", { id: "secrets", label: "Secrets", icon: "lock", render: secrets });
    ctx.contribute("settings.section", { id: "diagnostics", label: "Server & diagnostics", icon: "server", render: diagnostics });
    for (const [id, read] of Object.entries({ scheduled, shared, connectors })) {
      const title = id[0].toUpperCase() + id.slice(1);
      let last = -Infinity, pending = false;
      /** @param {HTMLElement} host */
      async function load(host) {
        if (pending) return;
        pending = true;
        let html;
        try {
          const rows = await read(ctx.signal);
          /** @type {Record<string,string>} */
          const empty = { scheduled: "No scheduled jobs.", shared: "No shared repositories.", connectors: "No connectors listed." };
          html = rows.length ? `<ul>${rows.join("")}</ul>` : `<p>${empty[id]}</p>`;
        } catch (error) {
          if (ctx.signal.aborted) return;
          html = `<p role="status">${esc(requestFailureMessage(error, title + " unavailable"))}</p>`;
        } finally { pending = false; last = Date.now(); }
        if (!ctx.signal.aborted) redraw(host, `<h1>${title}</h1>${html}<button type="button" class="btn" data-refresh>Refresh</button>`);
      }
      ctx.contribute("page", { id, mount(host) {
        ctx.listen(host, "click", ({ target }) => { if (target instanceof Element && target.closest("[data-refresh]")) void load(host); });
      }, render(host) {
        if (!host.firstChild) redraw(host, `<h1>${title}</h1><p role="status">Loading…</p>`);
        if (Date.now() - last > 30000) void load(host);
      } });
    }
  },
};
