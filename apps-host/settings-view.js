// @ts-check
import { esc } from "../core/platform/util.js";
import { checkManifest, permissionWords } from "./manifest.js";

/** @typedef {import("./manifest.js").Permission} Permission @typedef {import("./manifest.js").App} App @typedef {{ state?: string, granted?: string[], optional?: string[] }} ProjectGrant @typedef {{ id: string, name?: string, version?: string, state?: string, development?: boolean, previous?: string, error?: string, manifest?: unknown, projects?: Record<string, ProjectGrant> }} Row @typedef {{ staging_id: string, sha256: string, id: string, name?: string, version?: string, commit?: string, publisher?: string, development?: boolean, permissions?: { required?: Permission[], optional?: Permission[] }, routes?: Array<{ words?: string, routes?: string[] }>, secrets?: string[], warnings?: string[], size?: number }} Staged @typedef {{ mode: "list" | "install" | "sheet" | "app", rows: Row[], loading: boolean, error: string, busy: string, source: "git" | "path", staged: Staged | null, appId: string, grantFor: string, activity: Array<{ at?: string, what?: string, outcome?: string }> | null, values: Record<string, Record<string, unknown>> }} State @typedef {{ projects: Array<{ id: string, name: string }>, project?: string }} Ctx */

/** @param {string} label @param {string} act @param {Record<string, string>} [data] @param {string} [extra] */
const btn = (label, act, data = {}, extra = "") =>
  `<button type="button" class="btn${act === "remove" ? " btn-danger" : ""}" data-act="${esc(act)}"${Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("")}${extra}>${esc(label)}</button>`;
const note = (/** @type {State} */ s) => (s.error ? `<p class="set-err" role="alert">${esc(s.error)}</p>` : s.busy ? `<p class="set-note" role="status">${esc(s.busy)}</p>` : "");
/** @param {Permission[] | undefined} list @param {string} title @param {{ pick?: boolean }} [o] */
const perms = (list, title, o = {}) => (list && list.length ? `<section class="set-sec"><h3>${esc(title)}</h3>${list.map((p, i) => {
  const key = `${p.cap}#${i}`;
  const words = `<div class="set-l"><b>${esc(permissionWords(p))}</b><span>${esc(p.why)}</span></div>`;
  return `<div class="set-row" data-key="${esc(key)}">${o.pick ? `<label class="xa-pick"><input type="checkbox" data-optional="${esc(key)}"> ${words}</label>` : words}</div>`;
}).join("")}</section>` : "");

/** @param {Row} r */
const rowState = (r) => [r.version ? `v${r.version}` : "", r.development ? "Development" : "", r.state === "failed" ? "Stopped after crashes" : r.state === "needs_consent" ? "Update waits for your OK" : ""].filter(Boolean).join(" · ");
/** @param {string} title @param {string} inner @param {string} [key] */
const sec = (title, inner, key = "") => `<section class="set-sec"${key ? ` data-key="${esc(key)}"` : ""}><h3>${esc(title)}</h3>${inner}</section>`;
/** @param {string} b @param {string} sub @param {string} [tail] @param {string} [key] */
const row = (b, sub, tail = "", key = "") => `<div class="set-row"${key ? ` data-key="${esc(key)}"` : ""}><div class="set-l"><b>${b}</b><span>${sub}</span></div>${tail}</div>`;
/** @param {string} title */
const top = (title) => `<h3 class="xa-title" tabindex="-1" data-autofocus>${esc(title)}</h3>`;

/** @param {State} s */
function list(s) {
  const rows = s.rows.map((r) => row(esc(r.name || r.id), esc(rowState(r) || r.id), btn("Open", "open", { app: r.id }, ` aria-label="Open ${esc(r.name || r.id)}"`), r.id)).join("");
  return `${top("Apps")}<p class="set-lead">Apps add views and tools to the projects you turn them on in. They use XO's local routes, ask before they touch anything, and never see your keys.</p>
${note(s)}${s.loading ? "" : rows || `<p class="set-empty">No apps yet.</p>`}<div class="set-fa">${btn("Install an app", "install")}</div>`;
}

/** @param {State} s */
function install(s) {
  const git = s.source === "git";
  return `${top("Install an app")}<div class="set-form">
<fieldset class="xa-from"><legend>From</legend>
<label class="xa-pick"><input type="radio" name="xa-source" data-source="git"${git ? " checked" : ""}> A repo</label>
<label class="xa-pick"><input type="radio" name="xa-source" data-source="path"${git ? "" : " checked"}> A folder on this machine (development)</label></fieldset>
${git ? `<label class="field"><span>Repo address</span><input type="url" id="xa-git" placeholder="https://github.com/me/xo-word" autocomplete="off" spellcheck="false"></label>
<label class="field"><span>Tag, branch or commit (optional)</span><input type="text" id="xa-ref" autocomplete="off" spellcheck="false"></label>`
    : `<label class="field"><span>Folder</span><input type="text" id="xa-path" placeholder="/home/me/xo-word" autocomplete="off" spellcheck="false"></label>`}
<p class="set-lead">XO fetches it and checks it. Nothing in it runs until you turn it on in a project.</p>
${note(s)}<div class="set-fa">${btn("Cancel", "back")}${btn("Check it", "stage")}</div></div>`;
}

/** @param {State} s */
function sheet(s) {
  const st = /** @type {Staged} */ (s.staged);
  const routes = (st.routes || []).map((g) => row(esc(g.words || ""), (g.routes || []).map((x) => `<code>${esc(x)}</code>`).join(" "))).join("");
  return `${top(`Install ${st.name || st.id}?`)}
<p class="set-lead">${esc([st.id, st.version && `v${st.version}`, st.publisher || "Unverified publisher", st.commit && `commit ${String(st.commit).slice(0, 12)}`, st.development && "Development: loads from a folder you can edit"].filter(Boolean).join(" · "))}</p>
${perms(st.permissions?.required, "It will be able to")}${perms(st.permissions?.optional, "It may ask later to")}
${routes ? sec("XO routes it uses", routes) : ""}
${(st.secrets || []).length ? sec("Your keys, by name (its server only)", `<p class="set-lead">${(st.secrets || []).map((x) => `<code>${esc(x)}</code>`).join(" ")}</p>`) : ""}
${(st.warnings || []).map((w) => `<p class="set-note">${esc(w)}</p>`).join("")}
<p class="set-lead">Installing runs nothing. You choose the projects it shows in next.</p>
${note(s)}<div class="set-fa">${btn("Not now", "back")}${btn("Install", "confirm")}</div>`;
}

/** @param {State} s @param {Ctx} c */
function appPage(s, c) {
  const r = s.rows.find((x) => x.id === s.appId);
  if (!r) return `<p class="set-empty">That app is gone.</p><div class="set-fa">${btn("Back to Apps", "back")}</div>`;
  const { app, problems } = checkManifest(r.manifest);
  const grantFor = s.grantFor;
  const projects = c.projects.map((p) => {
    const g = r.projects?.[p.id];
    const on = g?.state === "enabled", waits = g?.state === "needs_consent";
    return row(esc(p.name), on ? "On" : waits ? "Waits for your OK" : "Off", on ? btn("Turn off", "revoke", { project: p.id }) : btn(waits ? "Review" : "Turn on", "grant", { project: p.id }), `p:${p.id}`);
  }).join("");
  const sheetFor = grantFor && app ? `<div class="set-form" data-key="grant:${esc(grantFor)}"><h4 tabindex="-1" data-autofocus>Turn ${esc(app.name)} on in ${esc(c.projects.find((p) => p.id === grantFor)?.name || grantFor)}?</h4>
${perms(app.permissions.required, "It will be able to")}${perms(app.permissions.optional, "Also allow (you can say yes later)", { pick: true })}
${app.routes.length ? `<h4>XO routes it uses</h4><p class="set-lead">${app.routes.map((x) => `<code>${esc(`${x.method} ${x.template}`)}</code>`).join(" ")}</p>` : ""}
<div class="set-fa">${btn("Not now", "cancel-grant")}${btn("Allow", "allow", { project: grantFor })}</div></div>` : "";
  const here = c.project && r.projects?.[c.project]?.state === "enabled" && app && app.settings.length ? settingsForm(app, s.values[`${r.id}|${c.project}`] || {}) : "";
  const activity = s.activity ? sec("Activity", s.activity.length ? s.activity.slice(0, 100).map((a) => row(esc(a.what || ""), esc([a.at, a.outcome].filter(Boolean).join(" · ")))).join("") : `<p class="set-note">Nothing yet.</p>`) : "";
  return `<div class="set-fa xa-back">${btn("Apps", "back", {}, ' aria-label="Back to Apps"')}</div>${top(r.name || r.id)}
<p class="set-lead">${esc([r.id, rowState(r)].filter(Boolean).join(" · "))}</p>
${app && app.summary ? `<p class="set-lead">${esc(app.summary)}</p>` : ""}
${problems.length ? `<div class="set-err" role="alert"><p>XO won't show this version:</p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}
${r.error ? `<p class="set-err">${esc(r.error)}</p>` : ""}
${note(s)}${sec("Projects", projects || `<p class="set-note">No projects yet.</p>`)}${sheetFor}${here}
<div class="set-fa">${btn("Update", "update")}${r.previous ? btn(`Use v${r.previous} again`, "rollback") : ""}${r.state === "failed" ? btn("Restart", "start") : ""}${btn(s.activity ? "Hide activity" : "Activity", "activity")}${btn("Remove", "remove")}</div>${activity}`;
}

/** @param {App} app @param {Record<string, unknown>} values */
function settingsForm(app, values) {
  const field = (/** @type {import("./manifest.js").Field} */ f) => {
    const v = values[f.name] ?? f.default;
    const id = `xa-set-${f.name}`;
    if (f.type === "checkbox") return `<label class="xa-pick"><input type="checkbox" id="${esc(id)}" data-setting="${esc(f.name)}"${v ? " checked" : ""}> ${esc(f.label)}</label>`;
    if (f.type === "select") return `<label class="field"><span>${esc(f.label)}</span><select id="${esc(id)}" data-setting="${esc(f.name)}">${(f.options || []).map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
    return `<label class="field"><span>${esc(f.label)}</span><input type="${f.type === "number" ? "number" : "text"}" id="${esc(id)}" data-setting="${esc(f.name)}" value="${esc(v ?? "")}" spellcheck="false"></label>`;
  };
  return sec("Settings", `<div class="set-form">${app.settings.map(field).join("")}<div class="set-fa">${btn("Save settings", "save-settings")}</div></div>`);
}

/** Settings › Apps as HTML for redraw; every control is keyed by its data- hooks. @param {State} s @param {Ctx} c */
export function view(s, c) {
  const body = s.mode === "install" ? install(s) : s.mode === "sheet" && s.staged ? sheet(s) : s.mode === "app" ? appPage(s, c) : list(s);
  return `<div class="set-live" data-m="apps-host" aria-busy="${s.loading || !!s.busy}">${body}</div>`;
}
