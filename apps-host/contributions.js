// @ts-check
import { holds } from "./when.js";
import { SURFACE_PLACES } from "./manifest.js";

/** @typedef {import("./manifest.js").App} App @typedef {import("./manifest.js").Surface} Surface @typedef {import("../core/kernel/types").At} At @typedef {{ destroy(): void }} Mounted @typedef {{ enabled(appId: string, project: string | undefined): boolean, mountView(el: HTMLElement, v: { app: App, surface: Surface, kind: string, at: At, input?: unknown, onGone?: () => void }): Mounted, openPanel(app: App, surface: Surface, at: At): void, runCommand(app: App, command: Surface, at: At, args?: unknown): unknown }} Deps @typedef {import("./contributions-types").Contribution} Contribution */

export const APP_PRIORITY = 10;

/** Whether an app's surface shows here: the app is on in this project and its when clause holds. @param {App} app @param {Surface} s @param {Deps} deps */
const shows = (app, s, deps) => (/** @type {At} */ at) => deps.enabled(app.id, typeof at.project === "string" ? at.project : undefined) && holds(s.when, { ...at, "app.enabled": "true" });

/** One app's manifest as ordinary place entries; XO draws every frame around them. @param {App} app @param {Deps} deps @returns {Contribution[]} */
export function compile(app, deps) {
  /** @type {Contribution[]} */
  const out = [];
  const sid = (/** @type {Surface} */ s) => `${app.id}:${s.id}`;
  const S = app.surfaces;
  /** @param {HTMLElement} el @param {Surface} s @param {string} kind @param {At} at @param {unknown} [input] */
  const mount = (el, s, kind, at, input) => { const m = deps.mountView(el, { app, surface: s, kind, at, input }); return () => m.destroy(); };

  for (const s of S.panel || []) {
    out.push({ place: SURFACE_PLACES.panel, entry: { id: sid(s), title: s.title, icon: s.icon || "plug", app: app.id, when: shows(app, s, deps), mount: (/** @type {HTMLElement} */ el, /** @type {At} */ at = {}) => mount(el, s, "panel", at) } });
  }
  for (const s of S.header || []) {
    const panel = (S.panel || []).find((p) => p.id === s.opens);
    const command = (S.commands || []).find((c) => c.id === s.opens);
    out.push({ place: SURFACE_PLACES.header, entry: {
      id: sid(s), label: s.title, icon: s.icon || "plug", app: app.id, when: shows(app, s, deps),
      onPress: (/** @type {At} */ at = {}) => (panel ? deps.openPanel(app, panel, at) : command ? deps.runCommand(app, command, at) : undefined),
    } });
  }
  for (const c of S.commands || []) {
    out.push({ place: SURFACE_PLACES.commands, entry: {
      id: sid(c), label: c.title, slash: c.slash, description: c.description, app: app.id, when: shows(app, c, deps),
      run: (/** @type {At} */ at = {}, /** @type {unknown} */ args) => deps.runCommand(app, c, at, args),
    } });
  }
  for (const s of S.canvas || []) {
    const docType = app.documents.find((d) => d.type === s.for);
    if (!docType) continue;
    const visible = shows(app, s, deps);
    out.push({ place: SURFACE_PLACES.canvas, entry: {
      id: sid(s), label: docType.label, app: app.id, priority: APP_PRIORITY, when: visible,
      accepts: (/** @type {{ path?: string }} */ file, /** @type {At} */ at = {}) => !!file && typeof file.path === "string" && docType.re.test(file.path) && visible(at),
      mount: (/** @type {HTMLElement} */ el, /** @type {At} */ at = {}, /** @type {{ path: string }} */ file) => mount(el, s, "canvas", at, { path: file && file.path }),
    } });
  }
  for (const s of S.evidence || []) {
    out.push({ place: SURFACE_PLACES.evidence, entry: {
      id: sid(s), app: app.id, when: shows(app, s, deps),
      mount: (/** @type {HTMLElement} */ el, /** @type {At} */ at = {}, /** @type {unknown} */ evidence) => mount(el, s, "evidence", at, evidence),
    } });
  }
  return out;
}

/** The places a host module may contribute to, from the surface map. */
export const HOST_PLACES = Object.freeze([...new Set(Object.values(SURFACE_PLACES))]);
