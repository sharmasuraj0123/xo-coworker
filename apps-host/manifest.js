// @ts-check
import { satisfies } from "../core/kernel/semver.js";
import { parseRoute } from "./routes.js";
import { parseWhen } from "./when.js";

/** @typedef {import("./routes.js").Route} Route @typedef {import("./when.js").When} When @typedef {{ cap: string, why: string, paths?: string[], names?: string[], askWhen?: string }} Permission @typedef {{ id: string, title: string, icon?: string, view?: string, when?: When, for?: string, slash?: string, description?: string, opens?: string, run?: { tool?: string, prompt?: string }, size?: string, maxHeight?: number }} Surface @typedef {{ name: string, label: string, type: string, options?: string[], default?: unknown, scope: "person" | "project" }} Field @typedef {{ type: string, label: string, pattern: string, re: RegExp }} DocType @typedef {{ risk: string, visibility: string[], readOnly: boolean }} Tool @typedef {{ id: string, name: string, version: string, summary: string, engines: string, permissions: { required: Permission[], optional: Permission[] }, routes: Route[], documents: DocType[], surfaces: Record<string, Surface[]>, settings: Field[], tools: Record<string, Tool>, limits: { callTimeoutMs: number, maxResultBytes: number } }} App */

export const APPS_CONTRACT = "0.1.0";

export const SURFACE_PLACES = Object.freeze({
  panel: "panel.page",
  header: "header.action",
  commands: "command",
  canvas: "files.viewer.kind",
  inline: "conversation.block",
  evidence: "decision.evidence",
  settings: "settings.section",
});

export const CAPS = Object.freeze({
  "files.read": "Read files in {paths}",
  "files.write": "Change files in {paths}",
  "threads.read": "See this project's threads: titles, state and checklists, not messages",
  "conversation.read": "Read the conversation it's open in",
  "artifacts.publish": "Add its files to Artifacts and show them in threads",
  "asks.open": "Ask you to decide something. Asks wait their turn like any other.",
  "context.update": "Tell the agent what you're pointing at",
  "composer.draft": "Suggest a message. Only you send it.",
  "inbox.post": "Post notes to Inbox (never Needs you)",
  "network": "Reach the internet, through XO's egress proxy",
  "secrets": "Use your {names}. Its views never see it.",
  "clipboard.write": "Copy to your clipboard",
});

const APP_ID = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
const SURFACE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const SLASH = /^\/[a-z][a-z0-9-]{0,23}$/;
const FIELD_TYPES = ["checkbox", "select", "text", "number", "directory"];
const RISKS = ["routine", "notable", "destructive"];
const VIS = ["model", "app"];
const BAD_GLOB = /(^\/|^~|\\|(^|\/)\.\.(\/|$)|(^|\/)\.git(\/|$)|(^|\/)\.xo(\/|$)|(^|\/)\.env)/;
const DOC_PATTERN = /^(\*\*\/)?(?:[a-z0-9_-]+\/)*\*\.[a-z0-9-]+\.[a-z0-9]+$/;

const str = (/** @type {unknown} */ v, max = 200) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const list = (/** @type {unknown} */ v) => (Array.isArray(v) ? v : []);

/** A glob from a document pattern; ** spans folders, * stays inside one. @param {string} pattern */
export function globRe(pattern) {
  const src = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0001").replace(/\*/g, "[^/]*").replace(/\u0001/g, "(?:.*/)?");
  return new RegExp(`^${src}$`);
}

/** The app in a plugin.json, checked; problems are in plain words and an app with any is never contributed. @param {any} plugin @returns {{ app: App | null, problems: string[] }} */
export function checkManifest(plugin) {
  /** @type {string[]} */
  const problems = [];
  const x = plugin && typeof plugin === "object" && plugin.extensions && plugin.extensions["space.xo"];
  if (!x || typeof x !== "object") return { app: null, problems: ["plugin.json has no extensions[\"space.xo\"] block"] };
  const id = String(x.id || "");
  if (!APP_ID.test(id) || id.length < 3 || id.length > 100) problems.push(`id must be reverse-DNS like "dev.me.word" (got "${id}")`);
  else if (/^xo\./.test(id)) problems.push(`"xo." ids belong to XO's own modules (got "${id}")`);
  const version = String(plugin.version || "");
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) problems.push(`version must be semver like "0.1.0" (got "${version}")`);
  const engines = x.engines && x.engines.xo;
  if (!str(engines, 60)) problems.push("engines.xo must name the XO apps contract range, like \">=0.1 <1\"");
  else if (!satisfies(APPS_CONTRACT, engines)) problems.push(`it needs XO apps contract ${engines}; this XO has ${APPS_CONTRACT}`);
  const name = x.displayName;
  if (!str(name, 40)) problems.push("displayName must be a short name (40 characters at most)");

  /** @param {any} p @param {string} where @returns {Permission | null} */
  const permission = (p, where) => {
    if (!p || !Object.hasOwn(CAPS, p.cap)) { problems.push(`${where}: "${p && p.cap}" isn't a permission XO knows`); return null; }
    if (!str(p.why, 300)) { problems.push(`${where} ${p.cap}: say why in plain words (why)`); return null; }
    if (p.cap.startsWith("files.")) {
      const paths = list(p.paths);
      if (!paths.length || !paths.every((g) => str(g, 200) && !BAD_GLOB.test(g))) { problems.push(`${where} ${p.cap}: paths must be project-relative globs, never .git, .xo, .env, absolute or ..`); return null; }
    }
    if (p.cap === "secrets" && !(list(p.names).length && list(p.names).every((n) => typeof n === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(n)))) { problems.push(`${where} secrets: names must look like "API_KEY"`); return null; }
    return { cap: p.cap, why: p.why, paths: p.paths, names: p.names, askWhen: typeof p.askWhen === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(p.askWhen) ? p.askWhen : undefined };
  };
  const perms = x.permissions || {};
  const permissions = {
    required: /** @type {Permission[]} */ (list(perms.required).map((p, i) => permission(p, `permissions.required[${i}]`)).filter(Boolean)),
    optional: /** @type {Permission[]} */ (list(perms.optional).map((p, i) => permission(p, `permissions.optional[${i}]`)).filter(Boolean)),
  };

  /** @type {Route[]} */
  const routes = [];
  for (const r of list(x.routes)) { const p = parseRoute(r); if (typeof p === "string") problems.push(`routes: ${p}`); else routes.push(p); }

  /** @type {DocType[]} */
  const documents = [];
  for (const d of list(x.documents)) {
    if (!d || !SURFACE_ID.test(d.type || "") || !str(d.label, 40)) { problems.push(`documents: each needs a type like "word" and a label`); continue; }
    if (typeof d.pattern !== "string" || !DOC_PATTERN.test(d.pattern)) { problems.push(`documents ${d.type}: pattern must name its own file type, like "**/*.word.json"`); continue; }
    documents.push({ type: d.type, label: d.label, pattern: d.pattern, re: globRe(d.pattern) });
  }

  /** @type {Record<string, Surface[]>} */
  const surfaces = {};
  /** @type {Field[]} */
  let settings = [];
  const raw = x.surfaces && typeof x.surfaces === "object" ? x.surfaces : {};
  for (const kind of Object.keys(raw)) {
    if (!Object.hasOwn(SURFACE_PLACES, kind)) { problems.push(`surfaces.${kind} isn't a place apps can use (${Object.keys(SURFACE_PLACES).join(", ")})`); continue; }
    if (kind === "settings") { settings = fields(list(raw.settings), problems); continue; }
    const seen = new Set();
    surfaces[kind] = [];
    for (const s of list(raw[kind])) {
      const sid = s && s.id;
      const where = `surfaces.${kind} "${sid}"`;
      if (!SURFACE_ID.test(sid || "") || seen.has(sid)) { problems.push(`surfaces.${kind}: each needs its own short id like "editor"`); continue; }
      seen.add(sid);
      /** @type {Surface} */
      const out = { id: sid, title: s.title };
      if (kind !== "inline" && kind !== "evidence" && !str(s.title, 60)) { problems.push(`${where}: needs a short title`); continue; }
      if (s.when !== undefined) { const w = parseWhen(s.when); if (typeof w === "string") { problems.push(`${where}: ${w}`); continue; } out.when = w; }
      if (kind !== "commands" && kind !== "header") {
        if (typeof s.view !== "string" || !s.view.startsWith(`ui://${id}/`)) { problems.push(`${where}: view must be one of its own, "ui://${id}/…"`); continue; }
        out.view = s.view;
      }
      if (kind === "canvas") {
        if (!documents.some((d) => d.type === s.for)) { problems.push(`${where}: "for" must name one of its documents`); continue; }
        out.for = s.for;
      }
      if (kind === "commands") {
        if (s.slash !== undefined && !(typeof s.slash === "string" && SLASH.test(s.slash))) { problems.push(`${where}: slash must look like "/word"`); continue; }
        const run = s.run || {};
        if (!(typeof run.tool === "string" && run.tool) === !(typeof run.prompt === "string" && run.prompt)) { problems.push(`${where}: run must name one tool or one prompt`); continue; }
        Object.assign(out, { slash: s.slash, description: typeof s.description === "string" ? s.description.slice(0, 200) : undefined, run: { tool: run.tool, prompt: run.prompt } });
      }
      if (kind === "header") {
        if (!str(s.opens, 40)) { problems.push(`${where}: opens must name one of its panel surfaces or commands`); continue; }
        out.opens = s.opens;
      }
      if (typeof s.icon === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(s.icon)) out.icon = s.icon;
      if (kind === "inline") out.maxHeight = Math.min(360, Math.max(60, Number(s.maxHeight) || 360));
      surfaces[kind].push(out);
    }
  }
  for (const h of surfaces.header || []) {
    const ok = (surfaces.panel || []).some((p) => p.id === h.opens) || (surfaces.commands || []).some((c) => c.id === h.opens);
    if (!ok) problems.push(`surfaces.header "${h.id}": opens "${h.opens}" isn't one of its panel surfaces or commands`);
  }

  /** @type {Record<string, Tool>} */
  const tools = {};
  for (const [tname, t] of Object.entries(x.tools && typeof x.tools === "object" ? x.tools : {})) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(tname)) { problems.push(`tools: "${tname}" must be a snake_case name`); continue; }
    const vis = t && t.visibility !== undefined ? list(t.visibility) : VIS;
    if (!vis.every((v) => VIS.includes(v))) { problems.push(`tools.${tname}: visibility is "model" and/or "app"`); continue; }
    const risk = (t && t.risk) || "routine";
    if (!RISKS.includes(risk)) { problems.push(`tools.${tname}: risk is routine, notable or destructive`); continue; }
    tools[tname] = { risk, visibility: vis, readOnly: !!(t && t.readOnly) };
  }
  for (const c of surfaces.commands || []) if (c.run?.tool && !tools[c.run.tool]?.visibility.includes("app")) problems.push(`surfaces.commands "${c.id}": its tool "${c.run.tool}" must be declared with "app" visibility`);

  const lim = x.limits || {};
  const limits = {
    callTimeoutMs: Math.min(300000, Math.max(1000, Number(lim.callTimeoutMs) || 30000)),
    maxResultBytes: Math.min(1 << 20, Math.max(1024, Number(lim.maxResultBytes) || 1 << 20)),
  };
  if (problems.length) return { app: null, problems };
  return { app: { id, name, version, summary: typeof x.summary === "string" ? x.summary.slice(0, 200) : "", engines, permissions, routes, documents, surfaces, settings, tools, limits }, problems };
}

/** @param {any[]} raw @param {string[]} problems @returns {Field[]} */
function fields(raw, problems) {
  /** @type {Field[]} */
  const out = [];
  const seen = new Set();
  for (const f of raw) {
    const n = f && f.name;
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(n || "") || seen.has(n)) { problems.push("surfaces.settings: each field needs its own name"); continue; }
    seen.add(n);
    if (!str(f.label, 60) || !FIELD_TYPES.includes(f.type)) { problems.push(`surfaces.settings "${n}": needs a label and a type (${FIELD_TYPES.join(", ")})`); continue; }
    if (f.type === "select" && !(list(f.options).length && list(f.options).every((o) => str(o, 60)))) { problems.push(`surfaces.settings "${n}": a select lists its options`); continue; }
    out.push({ name: n, label: f.label, type: f.type, options: f.options, default: f.default, scope: f.scope === "project" ? "project" : "person" });
  }
  return out;
}

/** A permission in the words the person reads. @param {Permission} p */
export function permissionWords(p) {
  const join = (/** @type {string[] | undefined} */ a) => (a || []).join(", ");
  return CAPS[/** @type {keyof typeof CAPS} */ (p.cap)].replace("{paths}", join(p.paths)).replace("{names}", join(p.names));
}
