// @ts-check
import { view } from "./settings-view.js";
import { checkManifest } from "./manifest.js";

/** @typedef {import("./settings-view.js").State} State @typedef {import("./settings-view.js").Row} Row @typedef {import("./client.js").AppsClient} AppsClient @typedef {{ client: AppsClient, redraw(el: HTMLElement, html: string): unknown, projects(): Array<{ id: string, name: string }>, confirm(text: string): Promise<boolean>, rows(): Row[], refresh(): Promise<void> }} SettingsDeps */

/** @param {unknown} e */
const words = (e) => String(/** @type {any} */ (e)?.message || e || "Something went wrong.");

/** Settings › Apps: install from a repo or a folder, the consent sheet, per-project grants, update, rollback, remove. @param {SettingsDeps} d */
export function createAppsSettings(d) {
  /** @type {State} */
  const s = { mode: "list", rows: [], loading: true, error: "", busy: "", source: "git", staged: null, appId: "", grantFor: "", activity: null, values: {}, unavailable: false };
  /** @type {Set<HTMLElement>} */
  const shown = new Set();
  /** @type {WeakSet<HTMLElement>} */
  const wired = new WeakSet();
  /** @type {WeakMap<HTMLElement, { project?: string }>} */
  const where = new WeakMap();

  const draw = () => {
    s.rows = d.rows();
    for (const el of [...shown]) {
      if (!el.isConnected) { shown.delete(el); continue; }
      const had = el.contains(el.ownerDocument.activeElement);
      d.redraw(el, view(s, { projects: d.projects(), project: where.get(el)?.project }));
      const a = el.ownerDocument.activeElement;
      if (had && (!a || a === el.ownerDocument.body || !el.contains(a))) /** @type {HTMLElement | null} */ (el.querySelector("[data-autofocus]"))?.focus();
    }
  };
  /** @param {Partial<State>} next */
  const set = (next) => { Object.assign(s, next); draw(); };
  /** @param {string} busy @param {() => Promise<Partial<State> | void>} fn */
  const work = async (busy, fn) => {
    if (s.busy) return;
    const at = `${s.mode}|${s.appId}`;
    set({ busy, error: "" });
    const still = () => `${s.mode}|${s.appId}` === at;
    try { const next = await fn(); set({ busy: "", ...(still() ? next || {} : {}) }); } catch (e) { set({ busy: "", ...(still() ? { error: words(e) } : {}) }); }
  };
  /** @param {HTMLElement} el @param {string} sel */
  const val = (el, sel) => String(/** @type {HTMLInputElement | null} */ (el.querySelector(sel))?.value || "").trim();
  /** @param {HTMLElement} el */
  const loadValues = (el) => {
    const project = where.get(el)?.project, id = s.appId, key = `${id}|${project}`;
    if (!project || !id || Object.hasOwn(s.values, key)) return;
    d.client.settings(id, project).then((v) => { if (!Object.hasOwn(s.values, key)) set({ values: { ...s.values, [key]: v && typeof v === "object" ? (v.values || v) : {} } }); }).catch(() => {});
  };
  const app = () => { const r = s.rows.find((x) => x.id === s.appId); return r ? checkManifest(r.manifest).app : null; };

  /** @type {Record<string, (el: HTMLElement, data: DOMStringMap) => unknown>} */
  const ACTS = {
    install: () => set({ mode: "install", error: "" }),
    back: () => set({ mode: "list", error: "", staged: null, appId: "", grantFor: "", activity: null, values: {} }),
    open: (el, data) => { set({ mode: "app", appId: data.app || "", error: "", grantFor: "", activity: null, values: {} }); loadValues(el); },
    stage: (el) => work("Fetching and checking…", async () => {
      const source = s.source === "git" ? { git: val(el, "#xa-git"), ...(val(el, "#xa-ref") ? { ref: val(el, "#xa-ref") } : {}) } : { path: val(el, "#xa-path") };
      const staged = await d.client.stage(source);
      return { mode: "sheet", staged };
    }),
    confirm: () => work("Installing…", async () => {
      const st = s.staged;
      if (!st) return {};
      await d.client.confirm(st.staging_id, st.sha256);
      await d.refresh();
      return { mode: "app", appId: st.id, staged: null };
    }),
    grant: (_el, data) => set({ grantFor: data.project || "", error: "" }),
    "cancel-grant": () => set({ grantFor: "" }),
    allow: (el, data) => work("Turning it on…", async () => {
      const a = app();
      if (!a || !data.project) return {};
      const picked = new Set([...el.querySelectorAll("input[data-optional]:checked")].map((i) => /** @type {HTMLElement} */ (i).dataset.optional));
      const optional = a.permissions.optional.map((p, i) => i).filter((i) => picked.has(`${a.permissions.optional[i].cap}#${i}`));
      const sha = s.rows.find((r) => r.id === a.id)?.manifest_sha;
      await d.client.setGrant(a.id, data.project, { optional, routes: a.routes.map((r) => `${r.method} ${r.template}`), ...(typeof sha === "string" ? { manifestSha: sha } : {}) });
      await d.refresh();
      return { grantFor: "" };
    }),
    revoke: (_el, data) => work("Turning it off…", async () => {
      if (!data.project) return {};
      await d.client.revoke(s.appId, data.project);
      await d.refresh();
    }),
    update: () => work("Fetching the newest version…", async () => {
      const staged = await d.client.update(s.appId);
      if (staged && staged.staging_id) return { mode: "sheet", staged };
      await d.refresh();
    }),
    rollback: () => work("Going back…", async () => { await d.client.rollback(s.appId); await d.refresh(); }),
    start: () => work("Restarting…", async () => { await d.client.start(s.appId); await d.refresh(); }),
    activity: () => (s.activity ? set({ activity: null }) : work("Reading activity…", async () => {
      const a = await d.client.activity(s.appId);
      return { activity: Array.isArray(a) ? a : Array.isArray(a?.items) ? a.items : [] };
    })),
    remove: () => work("Removing…", async () => {
      const name = s.rows.find((r) => r.id === s.appId)?.name || s.appId;
      if (!(await d.confirm(`Remove ${name}? Everything it added goes away. Your files stay.`))) return {};
      await d.client.remove(s.appId);
      await d.refresh();
      return { mode: "list", appId: "", activity: null };
    }),
    "save-settings": (el) => work("Saving…", async () => {
      const project = where.get(el)?.project;
      if (!project) return {};
      /** @type {Record<string, unknown>} */
      const values = {};
      for (const i of el.querySelectorAll("[data-setting]")) {
        const input = /** @type {HTMLInputElement} */ (i);
        values[input.dataset.setting || ""] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      }
      await d.client.saveSettings(s.appId, project, values);
      return { values: { ...s.values, [`${s.appId}|${project}`]: values } };
    }),
  };

  /** @param {HTMLElement} el */
  const wire = (el) => {
    if (wired.has(el)) return;
    wired.add(el);
    el.addEventListener("click", (e) => {
      const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.("[data-act]"));
      if (!b || !el.contains(b) || /** @type {HTMLButtonElement} */ (b).disabled) return;
      const fn = Object.hasOwn(ACTS, b.dataset.act || "") ? ACTS[b.dataset.act || ""] : null;
      if (fn) void fn(el, b.dataset);
    });
    el.addEventListener("change", (e) => {
      const t = /** @type {HTMLInputElement} */ (e.target);
      if (t.dataset && t.dataset.source && t.checked) set({ source: t.dataset.source === "path" ? "path" : "git" });
    });
  };

  return {
    /** The settings.section entry's render. @param {HTMLElement} el @param {{ project?: string }} [at] */
    render(el, at = {}) {
      where.set(el, { project: typeof at.project === "string" ? at.project : undefined });
      shown.add(el);
      wire(el);
      if (s.mode === "app") loadValues(el);
      draw();
      return () => { shown.delete(el); };
    },
    /** @param {boolean} loading @param {string} [error] */
    loaded(loading, error = "") { set({ loading, error }); },
    /** @param {boolean} on */
    unavailable(on) { if (s.unavailable !== on) set({ unavailable: on, ...(on ? { mode: "list" } : {}) }); },
    redraw: draw,
  };
}
