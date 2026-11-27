// @ts-check

/** @import { Check, Preflight } from "../../core/platform/launchpad-check-types.d.ts" */

/** @import { Frame } from "../../core/platform/launchpad-stream-types.d.ts" */

/** @import { DeployFrame, LaunchpadCheck } from "./lifetime-types.d.ts" */

/** @typedef {NonNullable<NonNullable<Preflight["launchpad"]["sizes"]>["tiers"]>[number]} Tier */

/** @typedef {{ type: "error"; step: string; code: string; message: string; action?: string }} Failed */

/** @typedef {Frame | Failed & { ts?: string; fix?: undefined; data?: undefined }} Sent */

/** @typedef {Sent | { type: "ended"; ts?: string; run_id?: string } | { type: "lost"; ts?: string; message?: string }} RowInput */

/** A wire value that may be null, as the panel holds it: absent. @template T @param {T} v @returns {NonNullable<T> | undefined} */
const nn = (v) => v ?? undefined;

// Launchpad's view-model: Space's check and preflight as one model per project, and Space's eleven deploy steps as the card's four rows.

/** What the panel offers for Space's `action` (flow.json `actions`), as [label, what the panel does]; an unknown action offers Try again. @type {Record<string, [string, string]>} */
const NEXT = {
  connect_github: ["Connect GitHub", "reconnect"], reconnect_github: ["Reconnect GitHub", "reconnect"],
  ask_agent: ["Ask an agent", "ask-fix"], retry: ["Try again", "retry"], deploy: ["Deploy", "retry"],
  watch: ["Follow it again", "rewatch"], edit_settings: ["Change the settings", "settings"],
  create_repo: ["Create the private repo", "create-repo"], rename_repo: ["Pick another name", "settings"],
  link: ["Link it", "link-same"], recreate_or_unlink: ["Create it again", "recreate"], unlink: ["Unlink", "unlink"], pick_app: ["Pick an app", "pick"],
  open_build_log: ["Open the build log", "log"],
  allow_apps: ["Push anyway", "allow-apps"], // other_apps: a push that would also deploy apps outside this account
  confirm_repo: ["Deploy to this repository", "use-repo"], // with the decision's data: "Deploy to <owner/repo>"
};
/** What the person does outside the panel (sign in, reinstall, pull, …): Space's message and fix are the answer, with no lit button. */
const OUTSIDE = new Set(["manual", "none", "sign_in_xo", "reinstall_space", "pull_changes"]);
/** @param {string} action @param {{ repo?: unknown } | null} [data] @returns {[string, string] | null} */
export function nextStep(action, data) {
  if (OUTSIDE.has(action)) return null;
  const n = NEXT[action] || NEXT.retry;
  // the repository to confirm is named on the button (Space's `data.repo`), so the press says where the code goes
  return action === "confirm_repo" && typeof data?.repo === "string" && data.repo ? [`Deploy to ${data.repo}`, n[1]] : n;
}

/** Everything the deploy form draws from the model and the panel's own state (`extra`), but not what's typed: the form is redrawn exactly when this changes. @param {LaunchpadCheck} c @param {Record<string, unknown>} [extra] */
export function formKey(c, extra = {}) {
  return JSON.stringify([c.state, c.repo, c.github, c.portFrom, c.portSure, c.env, c.blockers, c.warnings, c.app && [c.app.id, c.app.size, c.app.storage], c.sizes, c.size, c.storage, extra]);
}

/** Space's eleven steps onto the card's four rows: everything before the build is the repository's row. @type {Record<string, string>} */
const NODE = { check: "repo", credentials: "repo", repo: "repo", app: "repo", prepare: "repo", push: "repo", create: "repo", env: "repo", build: "build", release: "release", url: "live" };
const ROWS = ["repo", "build", "release", "live"];
/** A Launchpad app's status as [tone, words]: what's wrong is read first ("unhealthy" holds "healthy"), then stopped, then moving, then serving. @param {unknown} st @returns {[string, string]} */
export const appState = (st) => /fail|crash|error|unhealthy|degraded/i.test(String(st)) ? ["stop", "Didn't go live"] : /stop|paus|sleep|suspend/i.test(String(st)) ? ["", "Stopped"] : /progress|deploy|roll|start|build|pending|creat/i.test(String(st)) ? ["work", "Rolling out"] : /^(run|ready|live|healthy|serving|up|active)/i.test(String(st)) ? ["go", "Live"] : ["", String(st || "Unknown").replace(/^./, (x) => x.toUpperCase())];
/** An app's page in XO's Launchpad: by the app's UUID, never its slug (which 404s); "" while its id isn't known. */
const XO_ORIGIN = "https://dev.xo.builders";
/** @param {string | null | undefined} id */
export const launchpadUrl = (id) => (id ? `${XO_ORIGIN}/launchpad/${encodeURIComponent(id)}` : "");

/** @param {string} url */
export const hostOf = (url) => { try { return new URL(url).host; } catch { return url || ""; } };
/** A disk's size in GB, from Launchpad's "2Gi" or launchpad.json's 2. @param {unknown} v */
const gbOf = (v) => { const n = parseFloat(String(v)); return Number.isFinite(n) && n > 0 ? n : null; };
/** A size's words: "Medium · 1 CPU, 4 GB memory" from a tier, or from Launchpad's own label, or its name as it is. @param {Tier | string | null | undefined} t @param {string} [label] */
export const sizeWords = (t, label = "") => {
  if (t && typeof t === "object" && t.label) return `${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB memory`;
  const m = /^xo\.(\w+),\s*(.+)$/.exec(label || "");
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1)} · ${m[2].replace(" and ", ", ")}`;
  return label || (typeof t === "string" ? t : "");
};
/** What the size picker offers: the template's allowed tiers in the catalog's order, and its default; null when Space says nothing of sizes. @param {Preflight["launchpad"]["sizes"]} z */
function sizesOf(z) {
  if (!z || !Array.isArray(z.tiers)) return null;
  const allowed = new Set(z.allowed || z.tiers.map((t) => t.name));
  const tiers = z.tiers.filter((t) => t && allowed.has(t.name)).map((t) => ({ name: t.name, label: t.label || t.name, cpu: t.cpu, memory_gb: t.memory_gb }));
  return tiers.length ? { tiers, def: tiers.some((t) => t.name === z.default) ? z.default : "", source: z.source || "", error: z.error || "", fixed: z.fixed_after_create !== false } : null;
}

/** check (and, once it's in, preflight) as the section's model. @param {Check} c @param {Preflight | null} [pre] */
export function model(c, pre = null) {
  const f = c.fields || {}, cfg = c.config, app = pre?.launchpad?.app;
  const repo = pre?.repo || {};
  return {
    project: c.project, state: c.state, summary: c.summary || "",
    name: f.name?.value || c.project, port: f.port?.value ?? null, portFrom: f.port?.source || "", portSure: f.port?.confident !== false,
    env: (f.env || []).map((x) => ({ name: x.name, sensitive: !!x.sensitive, source: x.source || "", default: x.default || "", set: !!pre?.launchpad?.env_set?.[x.name] })),
    repo: {
      full: repo.full_name || f.repo?.full_name || f.repo?.origin || "",
      branch: f.repo?.branch || c.git?.branch || "main",
      // until preflight answers, an origin is taken as usable; preflight's "new" says otherwise
      admin: pre ? repo.mode !== "new" : !!(f.repo?.origin || f.repo?.full_name),
      create: f.repo?.new_repo_name || c.project, why: repo.reason || "", taken: !!repo.exists,
      // whether the repository is the person's own (Space's `own`): preflight's record wins; false (not true, not absent) is foreign
      own: typeof repo.own === "boolean" ? repo.own : typeof f.repo?.own === "boolean" ? f.repo.own : null,
    },
    github: { connected: pre ? !!pre.github?.connected : !!c.prerequisites?.github_connected, workflow: pre ? pre.github?.workflow_scope !== false : true, login: pre?.github?.login || "", source: pre?.github?.source || c.prerequisites?.github_source || null, fix: pre?.github?.fix || "", error: pre?.github?.error || "" },
    // the address is Launchpad's: preflight's live url (a custom domain once there is one), else launchpad.json's
    app: cfg?.app_id ? { id: cfg.app_id, name: nn(cfg.name), url: app?.url || nn(cfg.url), host: hostOf(app?.url || cfg.url || ""), status: app?.status || "", release: app?.release || null, at: app?.last_deploy_at ? Date.parse(app.last_deploy_at) : null, ready: nn(app?.ready), of: nn(app?.desired), gone: app?.exists === false, commit: (c.git?.deployed_head || "").slice(0, 7),
      // its size and disk, fixed when it was created (the disk can grow): preflight's, else launchpad.json's
      size: app?.size || cfg.size || "", sizeLabel: app?.size_label || "",
      storage: app && "storage" in app ? (app.storage ? { path: app.storage.path || "", gb: gbOf(app.storage.size) } : null) : cfg.storage ? { path: cfg.storage.path || "", gb: gbOf(cfg.storage.size_gb) } : app?.size ? null : undefined } : null,
    // a new app's size and disk: launchpad.json's (null: the template's default, no disk), and what Launchpad offers
    size: f.size?.value || "", storage: f.storage?.value ? { path: f.storage.value.path || "", gb: gbOf(f.storage.value.size_gb) } : null,
    sizes: sizesOf(pre?.launchpad?.sizes),
    nameFree: pre?.launchpad?.name_free !== false, sameName: pre?.launchpad?.same_name || null,
    missing: (c.reasons || []).map((r) => ({ what: typeof r === "string" ? r : r.what || r.message || "", why: typeof r === "string" ? "" : r.why || "", ok: false })),
    reason: c.summary || "", blockers: c.blockers || [], warnings: c.warnings || [],
    behind: c.git?.head && c.git?.deployed_head && c.git.head !== c.git.deployed_head,
    running: c.running?.kind === "deploy" ? c.running.run_id : null,
    pre: !!pre,
  };
}

/** One stream's events as the card's: a row opens when its first step runs and closes when a later row's starts; progress fills in the build's link and the release's n of m. @param {(e: DeployFrame) => void} on @returns {(ev: RowInput) => void} */
export function rows(on) {
  const open = new Set(), shut = new Set(), /** @type {Record<string, string>} */ said = {};
  let pushed = ""; // the repository row ends on what the push did, not on the last setup step's words
  const close = (/** @type {string} */ upto) => { for (const n of ROWS) { if (n === upto) break; if (open.has(n) && !shut.has(n)) { shut.add(n); on({ step: n, state: "done", text: n === "repo" && pushed ? pushed : said[n] }); } } };
  const raw = on;
  on = (e) => raw({ ...e, at: stamp });
  let stamp = 0;
  return (ev) => {
    stamp = Date.parse(ev.ts ?? "") || Date.now();
    if (ev.type === "run") { raw({ type: "run", started: Date.parse(ev.started_at) || stamp, at: stamp }); return; }
    const n = ("step" in ev && ev.step && NODE[ev.step]) || "repo";
    switch (ev.type) {
      case "step":
        if (ev.status === "running" || ev.status === "waiting") { close(n); open.add(n); said[n] = ev.message || ev.title || said[n]; on({ step: n, state: "doing", text: said[n] }); }
        else if (ev.status === "done" || ev.status === "skipped") { if (ev.message) said[n] = ev.message; if (ev.step === "push" && ev.message) pushed = ev.message; if (n !== "repo") { shut.add(n); on({ step: n, state: "done", text: said[n] }); } else if (open.has(n)) on({ step: n, state: "doing", text: said[n] }); }
        return;
      case "progress": {
        const d = ev.data || {};
        if (ev.step === "create" && d.app_id) on({ type: "app", id: d.app_id }); // the new app exists: its id, before it's live
        if (n === "build") on({ step: "build", state: "doing", text: ev.message || said.build, url: nn(d.run_url) });
        else if (n === "release") on({ step: "release", state: "doing", text: ev.message || said.release, ready: nn(d.ready), of: nn(d.desired), release: nn(d.release) });
        return;
      }
      // the app Space made or deployed to comes with its id: Open in Launchpad needs it the moment the app is live
      case "done": close("live"); on({ step: "live", state: "done", text: "Live", host: hostOf(ev.url || ""), url: nn(ev.url), release: nn(ev.release), commit: (ev.commit || "").slice(0, 7), app: ev.app ? { id: ev.app.id || "", name: ev.app.name || "", slug: ev.app.slug || "" } : null }); return;
      case "error": {
        const d = ev.data || {};
        on({ step: n, state: "failed", text: ev.message, error: { code: ev.code, action: ev.action || "", message: ev.message, fix: nn(ev.fix), source: nn(d.source), app: nn(d.app), step: nn(d.failed_step), log: Array.isArray(d.log_tail) ? d.log_tail.slice(-3) : null, url: nn(d.run_url), port: nn(d.port), declared: (d.exposed_ports || [])[0], kind: nn(d.kind), release: nn(d.release), diagnosis: nn(d.diagnosis) } });
        return;
      }
      case "needs": on({ type: "needs", step: n, code: ev.code, action: ev.action || "", message: ev.message, fix: nn(ev.fix), options: ev.options || [], data: ev.data || {} }); return;
      case "replaced": on({ type: "replaced", by: ev.by }); return;
      case "ended": on({ type: "ended", run: ev.run_id || "" }); return;
      case "lost": on({ type: "lost", message: ev.message || "" }); return;
      case "warning": on({ type: "warning", message: ev.message }); return;
    }
  };
}

/** @typedef {ReturnType<typeof model>} Model */
