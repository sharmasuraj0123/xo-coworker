// @ts-check
import { scheduleApi } from "../../core/platform/schedule-response.js";
import { configureConnection, readConnections, readSharing } from "../../core/platform/space-surfaces-response.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";
import { secrets, diagnostics } from "./settings.js";
import { explore } from "./explore.js";
import { checkSharing, pollConnection, runJob } from "../../core/platform/space-actions-response.js";
import { readUsage, readSources } from "../../core/platform/space-usage-response.js";
import { scheduleEditor, bindSchedules } from "./schedule-editor.js";

/** @param {string} id @param {string} text */
const action = (id, text) => `<button type="button" class="btn" data-action="${esc(id)}">${esc(text)}</button>`;

/** @param {string} name @param {string} detail */
const row = (name, detail, button = "") => `<li><b>${esc(name)}</b><p>${esc(detail)}</p>${button}</li>`;

/** @param {AbortSignal} signal */
async function scheduled(signal) {
  const { jobs } = await scheduleApi.schedules(signal);
  return jobs.map(job => row(job.name, [job.running ? "Running" : job.enabled ? "Enabled" : "Paused",
    job.description, job.next_run && "Next run " + job.next_run].filter(Boolean).join(" · "),
  (job.running ? "" : action(job.id, "Run now")) + (job.kind === "agent" ? scheduleEditor(job) : "")));
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
    c.connected_here ? "Connected here" : c.configured ? "Configured" : "Available",
    (c.connected_here ? action(c.toolkit, "Poll now") : "")
    + `<button type="button" class="btn" data-action="${esc(c.toolkit)}" data-enable="${!c.enabled}">`
    + (c.enabled ? "Pause collection" : "Enable collection") + "</button>"));
}

/** @param {AbortSignal} signal */
async function runtimes(signal) {
  const [totals, sources] = await Promise.all([readUsage(signal), readSources(signal)]);
  const summary = row("Recorded usage", `${totals.sessions.toLocaleString()} sessions · ${totals.tokens.toLocaleString()} tokens`);
  const agents = Object.entries(totals.sessions_by_agent).map(([agent, n]) =>
    row(agent, `${n.toLocaleString()} sessions · ${(totals.tokens_by_agent[agent] ?? 0).toLocaleString()} tokens`));
  return [summary, ...agents, ...sources.items.map(s => row(s.label, s.enabled ? "Collection enabled" : "Collection paused")),
    '<li><button class="btn" data-set-open="runtimes">Runtime limits</button>'
    + '<button class="btn" data-set-open="accounts">Accounts</button></li>'];
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const spacePages = {
  manifest: { id: "xo.space-pages", version: "1.0.0", kernel: "^1.1.0",
    contributes: ["page:scheduled", "page:shared", "page:connectors", "page:explore", "page:runtimes",
      "settings.section:secrets", "settings.section:diagnostics"] },
  activate(ctx) {
    explore(ctx);
    ctx.contribute("settings.section", { id: "secrets", label: "Secrets", icon: "lock", render: secrets });
    ctx.contribute("settings.section", { id: "diagnostics", label: "Server & diagnostics", icon: "server", render: diagnostics });
    for (const [id, read] of Object.entries({ scheduled, shared, connectors, runtimes })) {
      const title = id === "runtimes" ? "Usage &amp; agents" : id[0].toUpperCase() + id.slice(1);
      let last = -Infinity, pending = false, working = false, notice = "";
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
        if (!ctx.signal.aborted) redraw(host, `<h1>${title}</h1>${html}<button type="button" class="btn" data-refresh>Refresh</button>`
          + (id === "shared" ? action("shared", "Check now") : id === "scheduled" ? scheduleEditor() : "")
          + `<p role="status" data-result>${esc(notice)}</p>`);
      }
      ctx.contribute("page", { id, mount(host) {
        if (id === "scheduled") bindSchedules(ctx, host, () => load(host));
        ctx.listen(host, "click", async ({ target }) => {
          if (!(target instanceof Element) || working || pending) return;
          if (target.closest("[data-refresh]")) { await load(host); return; }
          const key = target.closest("[data-action]")?.getAttribute("data-action");
          if (!key) return;
          working = true;
          const status = host.querySelector("[data-result]");
          if (status) status.textContent = "Requesting…";
          try {
            const enabled = target.closest("[data-enable]")?.getAttribute("data-enable");
            if (id === "connectors" && enabled != null) {
              await configureConnection(key, enabled === "true", ctx.signal);
              notice = enabled === "true" ? "Collection enabled." : "Collection paused.";
            } else notice = await (id === "shared" ? checkSharing(ctx.signal)
              : id === "scheduled" ? runJob(key, ctx.signal) : pollConnection(key, ctx.signal));
          } catch (error) {
            if (ctx.signal.aborted) return;
            notice = requestFailureMessage(error, "Request failed");
          } finally { working = false; }
          if (!ctx.signal.aborted) await load(host);
        });
      }, render(host) {
        if (!host.firstChild) redraw(host, `<h1>${title}</h1><p role="status">Loading…</p>`);
        if (!host.querySelector("details[open]") && Date.now() - last > 30000) void load(host);
      } });
    }
  },
};
