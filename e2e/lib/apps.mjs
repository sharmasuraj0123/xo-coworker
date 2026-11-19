// @ts-check

/** @import { Row, Ask, Answer, Frame } from "./types.d.ts" */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ok = (/** @type {unknown} */ body, status = 200) => ({ status, body });
const err = (/** @type {number} */ status, /** @type {string} */ code, /** @type {string} */ message) => ({ status, body: { detail: { code, message } } });

/** @typedef {{ packages?: Record<string, string>, answers?: Record<string, string> }} AppsSeed @typedef {{ manifest: Row, views: Record<string, string>, source: string, sha: string }} Pkg */

/** The fake Space's app host, in xo-space's shapes: installs and their approvals, grants, and an app's views and tools. @param {AppsSeed} [seed] */
export function createApps(seed = {}) {
  /** @type {Record<string, Pkg>} */
  const packages = {};
  for (const [source, dir] of Object.entries(seed.packages || {})) {
    const manifest = JSON.parse(readFileSync(join(ROOT, dir, "plugin.json"), "utf8"));
    const x = manifest.extensions["space.xo"];
    /** @type {Record<string, string>} */
    const views = {};
    for (const s of x.surfaces || []) if (s.view) views[s.view] = readFileSync(join(ROOT, dir, "views", `${s.view.split("/").pop()}.html`), "utf8");
    packages[source] = { manifest, views, source, sha: createHash("sha256").update(JSON.stringify(manifest)).digest("hex") };
  }
  const installed = /** @type {Map<string, Row>} */ (new Map()), staged = /** @type {Map<string, Pkg>} */ (new Map());
  const views = /** @type {Map<string, Record<string, string>>} */ (new Map());
  const approvals = /** @type {Map<string, { state: string, apply: () => void, seen: number }>} */ (new Map());
  return { packages, answers: seed.answers || {}, installed, staged, views, approvals, n: 0 };
}
/** @typedef {ReturnType<typeof createApps>} Apps */

/** @param {Pkg} pkg @param {string} id */
const sheet = (pkg, id) => {
  const x = pkg.manifest.extensions["space.xo"];
  return {
    staging_id: id, sha256: pkg.sha, id: x.id, name: x.displayName, version: pkg.manifest.version, publisher: "", development: !pkg.source.startsWith("https://"),
    permissions: { required: x.permissions?.required || [], optional: x.permissions?.optional || [] },
    routes: (x.routes || []).map((/** @type {string} */ r) => ({ words: r.startsWith("PUT /api/xo-projects") ? "Change files in this project, as the app" : "Use XO's local routes", routes: [r] })),
    secrets: [], warnings: [], internet: true,
  };
};

/** An answer for the app routes, or undefined for any other path. @param {Apps} A @param {Ask} q @param {Frame[]} frames @returns {Answer | undefined} */
export function answerApps(A, q, frames) {
  const { method: m, path: p, query } = q;
  if (!p.startsWith("/api/apps") && !p.startsWith("/api/coworker/apps/")) return undefined;
  const body = /** @type {Record<string, any>} */ (q.body || {});
  const changed = (/** @type {Row} */ row, /** @type {string} */ change, /** @type {string | null} */ project = null) => frames.push({ type: "apps.changed", data: { id: row.id, slug: row.slug, change, version: row.version, project } });
  const approval = (/** @type {() => void} */ apply) => { const id = `ap_${++A.n}`; A.approvals.set(id, { state: "pending", apply, seen: 0 }); return ok({ approval_id: id }, 202); };
  /** @type {RegExpExecArray | null} */
  let k;
  if (m === "GET" && p === "/api/apps/contract") return ok({ contract: "0.1", catalogue: 1 });
  if (m === "GET" && p === "/api/apps") return ok({ apps: [...A.installed.values()] });
  if (m === "POST" && p === "/api/apps/installs") {
    const pkg = A.packages[String(body.path || body.git || "")];
    if (!pkg) return err(404, "not_found", "Nothing to install there: no plugin.json with an extensions[\"space.xo\"] block.");
    const sid = `st_${++A.n}`;
    A.staged.set(sid, pkg);
    return ok(sheet(pkg, sid));
  }
  if ((k = /^\/api\/apps\/installs\/([^/]+)\/confirm$/.exec(p)) && m === "POST") {
    const sid = k[1], pkg = A.staged.get(sid);
    if (!pkg || body.sha256 !== pkg.sha) return err(409, "stale", "The package changed since you saw it. Check it again.");
    return approval(() => {
      const x = pkg.manifest.extensions["space.xo"];
      const row = { id: x.id, slug: x.id.split(".").pop(), name: x.displayName, version: pkg.manifest.version, state: "installed", development: !pkg.source.startsWith("https://"), manifest: pkg.manifest, manifest_sha: pkg.sha, projects: {} };
      A.views.set(row.id, pkg.views);
      A.installed.set(row.id, row);
      A.staged.delete(sid);
      changed(row, "installed");
    });
  }
  if ((k = /^\/api\/apps\/approvals\/([^/]+)$/.exec(p)) && m === "GET") {
    const a = A.approvals.get(k[1]);
    if (!a) return err(404, "not_found", "No such approval");
    if (a.state === "pending" && ++a.seen > 1) { a.apply(); a.state = "applied"; }
    return ok({ approval_id: k[1], state: a.state });
  }
  if ((k = /^\/api\/apps\/([^/]+)\/grants$/.exec(p))) {
    const row = A.installed.get(k[1]), project = query.get("project") || "";
    if (!row) return err(404, "not_found", "No such app");
    if (m === "GET") return ok(row.projects[project] || { state: "disabled" });
    if (m === "PUT") return approval(() => { row.projects[project] = { state: "enabled", granted: (row.manifest.extensions["space.xo"].permissions?.required || []).map((/** @type {Row} */ x) => x.cap), manifest_sha: row.manifest_sha }; changed(row, "enabled", project); });
    if (m === "DELETE") { row.projects[project] = { state: "disabled" }; changed(row, "disabled", project); return ok({ state: "disabled" }); }
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
    const row = A.installed.get(k[1]), project = q.query.get("project") || body.project || "";
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
    if (m === "POST") return ok({ ok: true, project });
  }
  return undefined;
}
