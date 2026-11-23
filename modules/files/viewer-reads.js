// @ts-check

import { api, attachmentUrl, attachmentText, missingRoute } from "../../core/platform/api.js";
import { kindOf } from "../../core/services/media/attachment-rules.js";

/** @import { FileChangeEvent, ViewerData, ViewerDocument, ViewerFile, ViewerReadDependencies } from "./viewer-types.d.ts" */

/** @import { FileError } from "./operation-types.d.ts" */

/** @param {ViewerReadDependencies} deps */
export function createViewerReads({ V, docs, doc, changes, dropImage, render, announce, paintHead }) {
  /** @param {ViewerFile} f @returns {Promise<ViewerData>} */
  async function readAttachment(f) {
    const name = f.name || "";
    const textKind = /\.(md|markdown)$/i.test(name) || f.type === "text/markdown" ? "markdown" : "code";
    if (f.local != null) return { kind: textKind, content: String(f.local), name, size_bytes: f.bytes };
    const k = kindOf(f.type || "");
    const att = /** @type {NonNullable<ViewerFile["att"]>} */ (f.att);
    if (k !== "text") return { kind: k, url: attachmentUrl(att.chat, att.id), name, size_bytes: f.bytes, remote: true };
    return { kind: textKind, content: await attachmentText(att.chat, att.id), name, size_bytes: f.bytes };
  }

  /** @param {Required<Pick<ViewerFile, "project" | "rel">>} f */
  async function readText(f) {
    try { return await api.projectFile(f.project, f.rel, null, { purpose: "edit" }); }
    catch (err) {
      if (/** @type {FileError} */ (err).status !== 413) throw err;
      const d = await api.projectFile(f.project, f.rel);
      return { ...d, editable: false, not_editable_reason: "too_large" };
    }
  }

  async function load() {
    const my = ++V.gen, tab = V.tab;
    dropImage();
    V.loading = true; V.error = null; V.data = null; V.dims = null;
    render();
    try {
      const file = /** @type {NonNullable<typeof V.file>} */ (V.file);
      if (file.att || file.local != null) {
        const d = await readAttachment(file);
        if (my !== V.gen) return;
        const current = /** @type {ViewerFile} */ (V.file);
        if (typeof d.content === "string") d.doc = docs.open(`att:${current.att ? current.att.chat : "paste"}`, current.att ? current.att.id : current.name || "paste", { ...d, version: null, editable: false, not_editable_reason: "attachment" });
        V.data = d;
      } else if (file.image) {
        const blob = await api.projectImage(/** @type {string} */ (file.project), /** @type {string} */ (file.rel));
        if (my !== V.gen) return;
        V.data = { kind: "image", size_bytes: blob.size, url: URL.createObjectURL(blob) };
      } else {
        const d = await readText(/** @type {Required<Pick<ViewerFile, "project" | "rel">>} */ (file));
        if (my !== V.gen) return;
        if (typeof d.content !== "string") V.error = "XO sent this file without its text.";
        else {
          const current = /** @type {ViewerFile} */ (V.file);
          d.doc = docs.open(current.project, current.rel, d);
        }
        V.data = d;
        if (d.doc) loadVersions(d.doc);
      }
      if (tab) { tab.data = V.data; tab.doc = V.data && V.data.doc || null; }
    } catch (cause) {
      if (my !== V.gen) return;
      const err = /** @type {FileError} */ (cause);
      V.error = err.status === 404 ? "This file isn't there any more." : err.status === 403 && err.code === "outside_project" ? "This file is outside the project: a link leads out of it." : err.message || "Couldn't read this file.";
    }
    V.loading = false;
    render();
  }
  let versionsRoute = true;
  /** @param {ViewerDocument} D */
  async function loadVersions(D) {
    if (!versionsRoute || !api.projectVersions) return;
    try {
      const r = await api.projectVersions(D.project, D.rel);
      docs.knownVersions(D, r.versions || []);
    } catch (err) { if (missingRoute(/** @type {Parameters<typeof missingRoute>[0]} */ (err))) versionsRoute = false; }
  }

  /** @param {ViewerDocument} D */
  const sigNow = (D) => { const c = changes ? changes.at(D.project, D.rel) : null; return c && typeof c.file.version === "string" ? c.file.version : null; };
  let pushed = false;
  function notice() {
    if (pushed || !V.open) return;
    for (const t of V.tabs) {
      const D = t.doc;
      if (!D || D.state === "readonly" || D.state === "conflict" || !D.project || D.project.startsWith("att:")) continue;
      const now = sigNow(D);
      if (!now || now === D.version || now === D.checkedSig) continue;
      D.checkedSig = now;
      docs.changed(D.project, D.rel, { version: now, by: { kind: "agent" } });
    }
  }
  /** @param {FileChangeEvent | null | undefined} ev */
  function fileChanged(ev) {
    pushed = true;
    if (!ev || !ev.project_id) return;
    if (ev.type === "file.rescan") {
      for (const D of docs.all()) if (D.project === ev.project_id) docs.changed(D.project, D.rel, {});
      return;
    }
    const D = docs.get(ev.project_id, ev.path) || (ev.old_path ? docs.get(ev.project_id, ev.old_path) : null);
    if (!D) return;
    if (ev.kind === "rename" && ev.old_path && ev.path && D.rel === ev.old_path) {
      docs.renamed(D.project, ev.old_path, ev.path);
      const name = ev.path.split("/").pop();
      for (const t of V.tabs) if (t.doc === D) { t.file = { ...t.file, rel: ev.path, path: ev.path, name, where: ev.path }; if (t === V.tab) V.file = t.file; }
      if (D === doc()) { announce(`${name}: the file moved to ${ev.path}.`); render(); } else paintHead();
      if (ev.version && ev.version === D.version) return;
    }
    if (ev.type === "file.version.attributed") {
      const v = /** @type {ViewerDocument} */ (D).versions.find((x) => x.id === ev.id);
      if (v) { v.by = ev.by; if (D === doc()) paintHead(); }
      return;
    }
    docs.changed(D.project, D.rel, { version: ev.version, by: ev.by, at: ev.at, id: ev.id, kind: ev.kind });
  }

  return { load, notice, fileChanged };
}
