// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { appState } from "./model.js";
import { NODES, ago, since, sizeText } from "./words.js";

/** @param {{proj: (project: string) => ReturnType<typeof import("./model.js").model> & Record<string, any>, nameOf: (project: string) => string}} L */
export function createSystem({ proj, nameOf }) {
  /** @param {string} p @param {string} mode */
  function track(p, mode) {
    const s = proj(p), c = s.check, r = s.run, branch = esc(c.repo?.branch || "main");
    /** @type {Record<string, string[]>} */
    const LAB = { done: ["Pushed", "Built", "Released", "Live"], doing: ["Pushing", "Building", "Releasing", "Going live"], failed: ["Didn't push", "Didn't build", "Didn't release", "Didn't answer"], paused: ["Paused", "Paused", "Paused", "Paused"], todo: ["Push", "Build", "Release", "Live"] };
    let st = ["todo", "todo", "todo", "todo"], meta;
    if (mode === "preview") {
      const gh = !c.github ? "" : !c.github.connected ? "GitHub isn't connected" : !c.github.workflow ? "Needs GitHub's workflow permission" : "";
      meta = [`${branch} to GitHub`, gh ? `<span class="lq-need">${gh}</span>` : "On GitHub Actions", "On Launchpad", "At its own address"];
    } else if (mode === "live") {
      const a = r?.live || c.app || {}, [tone] = c.app?.status && !r?.live ? appState(c.app.status) : ["go"];
      const commit = r?.live?.commit || c.app?.commit || "", at = a.at || c.app?.at, release = r?.release || a.release || c.app?.release;
      const ready = c.app?.ready, of = c.app?.of;
      st = ["done", "done", "done", { go: "done", work: "doing", stop: "failed" }[tone] || "todo"];
      meta = [commit ? `<code>${esc(commit)}</code>` : branch, at ? ago(at) : "On GitHub Actions", release ? `#${release}` : "", of ? `${ready ?? of} of ${of} ready` : ""];
    } else {
      /** @param {string} t */
      const said = (t) => t && r.error && (t === r.error.text || t === r.error.message);
      st = NODES.map((n) => { const x = r.steps[n]?.state; return x === "doing" ? (r.lost ? "paused" : "doing") : x === "done" || x === "failed" || x === "paused" ? x : "todo"; });
      meta = NODES.map((n, i) => {
        const x = r.steps[n] || {}, text = x.text && !said(x.text) ? esc(x.text) : "";
        const logs = n === "build" && x.url ? ` · <a class="lp-ln" href="${esc(x.url)}" target="_blank" rel="noopener">Logs</a>` : "";
        if (st[i] === "doing") return `${since(x.at || r.startedAt)}${logs}`;
        if (n === "release" && x.of) return `${x.ready} of ${x.of} ready`;
        if (n === "release" && r.release) return `#${r.release}`;
        return text ? `${text}${logs}` : st[i] === "todo" ? "" : logs.slice(3);
      });
    }
    const at = st.reduce((m, x, i) => (x === "todo" ? m : i), 0);
    const tone = st.includes("failed") ? " t-stop" : st.includes("doing") ? " t-work" : st.includes("paused") ? "" : st[0] === "done" ? " t-go" : "";
    /** @type {Record<string, string>} */
    const cls = { done: " is-done", doing: " is-now", failed: " is-bad", paused: " is-paused", todo: "" };
    return `<ol class="lq-track${tone}" data-at="${at}" aria-label="${esc(`${nameOf(p)}'s deploy: push, build, release, live`)}">` +
      NODES.map((n, i) => `<li class="lq-st${cls[st[i]]}"><i aria-hidden="true"></i><b>${LAB[st[i]][i]}</b>${meta[i] ? `<span>${meta[i]}</span>` : ""}</li>`).join("") + `</ol>`;
  }

  /** @param {string} p */
  function details(p) {
    const s = proj(p), c = s.check, f = s.form || {}, ca = c.app, r = s.run;
    /** @param {string} k @param {string} v */
    const row = (k, v, end = "") => `<div class="lq-row"><span class="lq-k">${k}</span><span class="lq-v">${v}</span>${end}</div>`;
    /** @param {string} label @param {string} what */
    const change = (label, what) => (ca && !ca.gone ? `<button type="button" class="lq-go lp-a" data-lp="edit" aria-label="${esc(`${label} ${what}`)}">${label}${ICON.right}</button>` : "");
    const admin = c.repo && (c.repo.admin || !c.github?.connected);
    const rows = [];
    if (c.repo) rows.push(row("Source", admin ? `${esc(c.repo.full)}<small>${esc(c.repo.branch || "main")} · builds on every push</small>` : `<span title="You're not an admin on ${esc(c.repo.full)}, so Launchpad can't add its build there">A private copy in your GitHub</span> <span class="lp-new">new</span>`));
    if (ca && (ca.size || ca.sizeLabel)) rows.push(row("Machine", `${esc(sizeText(c, ca.size, ca.sizeLabel))}${ca.storage ? `<small>${esc(String(ca.storage.gb))} GB disk at <code>${esc(ca.storage.path)}</code></small>` : ""}`, change("Change", "the machine")));
    const port = r?.error?.port || f.port || "";
    if (port) rows.push(row("Port", `<code>${esc(String(port))}</code>`));
    if (c.env?.length) rows.push(row("Environment", `${c.env.filter((/** @type {{set: boolean}} */ x) => x.set).length} of ${c.env.length} set`, change("Edit", "the environment")));
    return rows.length ? `<p class="lq-h">Details</p><div class="lq-group">${rows.join("")}</div>` : "";
  }

  return { track, details };
}
