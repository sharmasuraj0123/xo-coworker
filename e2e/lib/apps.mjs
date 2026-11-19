// @ts-check

/** @import { Row, Ask, Answer, Frame } from "./types.d.ts" */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ok = (/** @type {unknown} */ body, status = 200) => ({ status, body });
const err = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, body: { detail: { code, message } } });

/** @typedef {{ packages?: Record<string, string>, answers?: Record<string, string> }} AppsSeed @typedef {{ plugin: Row, views: Record<string, string>, source: Row, sha: string }} Pkg @typedef {{ approval_id: string, action: string, title: string, project: string | null, state: string, apply: () => Row | null, result: Row | null }} Approval */

/** The fake Space's app host in xo-space's shapes: an install or enable waits for the owner's answer, which only a case gives. @param {AppsSeed} [seed] */
export function createApps(seed = {}) {
  /** @type {Record<string, Pkg>} */
  const packages = {};
  for (const [where, dir] of Object.entries(seed.packages || {})) {
    const plugin = JSON.parse(readFileSync(join(ROOT, dir, "plugin.json"), "utf8"));
    /** @type {Record<string, string>} */
    const views = {};
    for (const s of plugin.extensions["space.xo"].surfaces || []) if (s.view) views[s.view] = readFileSync(join(ROOT, dir, "views", `${s.view.split("/").pop()}.html`), "utf8");
    const source = where.startsWith("https://") ? { kind: "git", url: where, host: new URL(where).host, ref: null, commit: "0".repeat(40), path: null } : { kind: "folder", url: null, host: null, ref: null, commit: null, path: where };
    packages[where] = { plugin, views, source, sha: createHash("sha256").update(JSON.stringify(plugin)).digest("hex") };
  }
  const installed = /** @type {Map<string, Row>} */ (new Map()), staged = /** @type {Map<string, Pkg>} */ (new Map());
  const views = /** @type {Map<string, Record<string, string>>} */ (new Map()), approvals = /** @type {Map<string, Approval>} */ (new Map());
  const A = {
    packages, answers: seed.answers || {}, installed, staged, views, approvals, n: 0,
    /** @type {Frame[]} */
    later: [],
    /** The owner's answer in Needs you. @param {string} id @param {"allow" | "decline"} verdict */
    answer(id, verdict) {
      const a = approvals.get(id);
      if (!a || a.state !== "pending") throw new Error(`e2e: no pending approval ${id}`);
      for (const row of installed.values()) row.pending = row.pending.filter((/** @type {Row} */ w) => w.approval_id !== id);
      if (verdict === "decline") { a.state = "declined"; return; }
      a.result = a.apply();
      a.state = "applied";
    },
    pendingIds: () => [...approvals.values()].filter((a) => a.state === "pending").map((a) => a.approval_id),
  };
  return A;
}
/** @typedef {ReturnType<typeof createApps>} Apps */

/** @param {Pkg} pkg @param {string} id */
const sheet = (pkg, id) => {
  const x = pkg.plugin.extensions["space.xo"];
  const tools = Object.entries(x.tools || {}).map(([name, t]) => ({ name, title: name, description: "", risk: t.risk || "routine", read_only: !!t.readOnly }));
  return {
    staging_id: id, expires_at: "2026-11-19T13:00:00Z", id: x.id, name: x.displayName, version: pkg.plugin.version, summary: x.summary || "", publisher: "unverified",
    source: pkg.source, development: pkg.source.kind === "folder", sha256: pkg.sha, size: 4096, files: 6,
    permissions: { required: x.permissions?.required || [], optional: (x.permissions?.optional || []).map((/** @type {Row} */ p) => ({ ...p, ask_when: p.askWhen ?? null })) },
    routes: x.routes || [], capabilities: (x.routes || []).length ? [{ capability: "files.write", routes: x.routes }] : [], uses_internet: true, secrets: [],
    tools, surfaces: x.surfaces || [], warnings: [], replaces: null,
  };
};

/** An answer for the app routes, or undefined for any other path. @param {Apps} A @param {Ask} q @param {Frame[]} frames @returns {Answer | undefined} */
export function answerApps(A, q, frames) {
  const { method: m, path: p, query } = q;
  if (!p.startsWith("/api/apps") && !p.startsWith("/api/coworker/apps/")) return undefined;
  const body = /** @type {Record<string, any>} */ (q.body || {});
  frames.push(...A.later.splice(0));
  const changed = (/** @type {Row} */ row, /** @type {string} */ change, /** @type {string | null} */ project = null) => A.later.push({ type: "apps.changed", data: { id: row.id, slug: row.slug, change, version: row.version, project } });
  const approval = (/** @type {string} */ action, /** @type {string} */ title, /** @type {string | null} */ project, /** @type {() => Row | null} */ apply) => {
    const id = `ap_${++A.n}`;
    A.approvals.set(id, { approval_id: id, action, title, project, state: "pending", apply, result: null });
    return ok({ approval_id: id, state: "pending", expires_at: "2026-11-19T13:00:00Z" }, 202);
  };
  /** @type {RegExpExecArray | null} */
  let k;
  if (m === "GET" && p === "/api/apps/contract") return ok({ contract: "0.1", catalogue: 1 });
  if (m === "GET" && p === "/api/apps") return ok({ contract: "0.1", safe_mode: false, apps: [...A.installed.values()] });
  if (m === "POST" && p === "/api/apps/installs") {
    const src = body.source || {};
    const pkg = A.packages[String(src.kind === "folder" ? src.path : src.url || "")];
    if (!pkg) return err(422, "no_manifest", "Nothing to install there: no plugin.json with an extensions[\"space.xo\"] block.");
    const sid = `st_${++A.n}`;
    A.staged.set(sid, pkg);
    return ok(sheet(pkg, sid));
  }
  if ((k = /^\/api\/apps\/installs\/([^/]+)\/confirm$/.exec(p)) && m === "POST") {
    const sid = k[1], pkg = A.staged.get(sid);
    if (!pkg || body.sha256 !== pkg.sha) return err(409, "stale", "The package changed since you saw it. Check it again.");
    const x = pkg.plugin.extensions["space.xo"];
    return approval("install", `Install ${x.displayName} ${pkg.plugin.version}`, null, () => {
      const row = { id: x.id, slug: x.id.split(".").pop(), name: x.displayName, version: pkg.plugin.version, sha256: pkg.sha, development: pkg.source.kind === "folder", source: pkg.source, previous: null, state: "installed", runtime: null, projects: {}, pending: [], manifest: x };
      A.installed.set(row.id, row);
      A.views.set(row.id, pkg.views);
      A.staged.delete(sid);
      changed(row, "installed");
      return { id: row.id, slug: row.slug, version: row.version };
    });
  }
  if ((k = /^\/api\/apps\/approvals\/([^/]+)$/.exec(p)) && m === "GET") {
    const a = A.approvals.get(k[1]);
    if (!a) return err(404, "not_found", "No such approval");
    return ok({ approval_id: a.approval_id, action: a.action, slug: a.result?.slug || "", title: a.title, state: a.state, reason: null, expires_at: "2026-11-19T13:00:00Z", result: a.result });
  }
  if ((k = /^\/api\/apps\/([^/]+)\/grants$/.exec(p))) {
    const row = A.installed.get(k[1]), project = query.get("project") || "";
    if (!row) return err(404, "not_found", "No such app");
    const x = row.manifest;
    if (m === "GET") return ok({ grant: row.projects[project] || null, declared: { required: x.permissions?.required || [], optional: x.permissions?.optional || [], routes: x.routes || [] } });
    if (m === "PUT" && body.state === "disabled") {
      row.projects[project] = { ...(row.projects[project] || {}), pid: `pid_${project}`, state: "disabled" };
      changed(row, "disabled", project);
      return ok({ grant: row.projects[project] });
    }
    if (m === "PUT" && body.state === "enabled") {
      const permissions = body.permissions || (x.permissions?.required || []).map((/** @type {Row} */ r) => ({ cap: r.cap, paths: r.paths || [], names: r.names || [] }));
      const grant = { pid: `pid_${project}`, state: "enabled", permissions, routes: body.routes || x.routes || [], manifest_sha: row.sha256, by: "owner", at: "2026-11-19T12:00:00Z" };
      const res = approval("enable", `Turn ${row.name} on in ${project}`, project, () => {
        row.projects[project] = grant;
        row.pending = row.pending.filter((/** @type {Row} */ w) => w.project !== project);
        changed(row, "enabled", project);
        return { id: row.id, slug: row.slug, version: row.version };
      });
      row.pending.push({ approval_id: /** @type {any} */ (res.body).approval_id, action: "enable", title: `Turn ${row.name} on in ${project}`, project });
      return res;
    }
  }
  if ((k = /^\/api\/apps\/([^/]+)$/.exec(p)) && m === "DELETE") {
    const row = A.installed.get(k[1]);
    if (!row) return err(404, "not_found", "No such app");
    A.installed.delete(k[1]);
    A.views.delete(k[1]);
    changed(row, "removed");
    return ok({ removed: true });
  }
  if ((k = /^\/api\/coworker\/apps\/([^/]+)\/(resources|call|views\/open|views\/close|views\/heartbeat)$/.exec(p))) {
    const row = A.installed.get(k[1]);
    if (!row) return err(404, "not_found", "No such app");
    if (k[2] === "resources" && m === "GET") {
      const uri = query.get("uri") || "";
      const html = A.views.get(row.id)?.[uri];
      return html ? ok({ contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: html }] }) : err(404, "not_found", "No such view");
    }
    if (k[2] === "call" && m === "POST") {
      if (row.projects[body.project]?.state !== "enabled") return err(403, "not_granted", `${row.name} isn't on in this project.`);
      const said = A.answers[String(body.tool)];
      if (said === undefined) return err(404, "not_found", `${row.name} has no tool ${body.tool}`);
      const text = said.replace(/\{(\w+)\}/g, (_m, n) => String((body.arguments || {})[n] || "you"));
      return ok({ content: [{ type: "text", text }], isError: false });
    }
    if (m === "POST") return ok({ ok: true });
  }
  return undefined;
}
