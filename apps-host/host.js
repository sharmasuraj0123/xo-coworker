// @ts-check
import { checkManifest } from "./manifest.js";
import { compile, HOST_PLACES } from "./contributions.js";
import { createAppFrame } from "./frame.js";
import { createAppsSettings } from "./settings.js";
import { createCards } from "./card.js";
import { missingRoute } from "../core/platform/http.js";

/** @typedef {import("./manifest.js").App} App @typedef {import("./manifest.js").Surface} Surface @typedef {import("./client.js").AppsClient} AppsClient @typedef {import("./settings-view.js").Row} Row @typedef {import("../core/kernel/types").ModuleDef} ModuleDef @typedef {import("../core/kernel/types").ModuleContext} ModuleContext @typedef {import("../core/kernel/types").At} At @typedef {import("../core/kernel/types").Undo} Undo @typedef {{ client: AppsClient, doc: Document, win: Window, redraw(el: HTMLElement, html: string): unknown, projects(): Array<{ id: string, name: string }>, draft(text: string, at: At): void, openPanel(key: string, at: At): void, confirm(text: string): Promise<boolean>, context(appId: string, at: At, params: unknown): void }} HostDeps */

const ALIVE_MS = 60000;

export const MANIFEST = Object.freeze({
  id: "xo.apps-host",
  version: "0.1.0",
  kernel: "^1",
  description: "Installed apps: their sandboxed views in XO's places, the bridge to their tools and local routes, and Settings › Apps.",
  contributes: [...HOST_PLACES],
  styles: ["apps-host/apps-host.css"],
});

/** @param {any} res */
const htmlOf = (res) => {
  const c = Array.isArray(res?.contents) ? res.contents.find((/** @type {any} */ x) => typeof x?.text === "string") : null;
  if (!c) throw new Error("the app sent no view");
  return /** @type {string} */ (c.text);
};
/** @param {At} at */
const whereOf = (at) => {
  if (typeof at.project !== "string" || !at.project) throw new Error("open it inside a project");
  return { project: at.project, ...(typeof at.thread === "string" && at.thread ? { thread: at.thread } : {}) };
};

/** apps-host as a kernel module: each enabled app's surfaces become entries in the places its manifest names. @param {HostDeps} d @returns {ModuleDef} */
export function createAppsHost(d) {
  return {
    manifest: { ...MANIFEST, contributes: [...MANIFEST.contributes], styles: [...MANIFEST.styles] },
    async activate(ctx) {
      /** @type {Map<string, { row: Row, app: App | null, problems: string[], key: string, undo: Undo[] }>} */
      const apps = new Map();
      /** @type {Set<{ app: string, project: string | undefined, retheme(): void, destroy(): void, halt(text: string): void, gone?: () => void }>} */
      const frames = new Set();
      let disposed = false;
      const enabled = (/** @type {string} */ id, /** @type {string | undefined} */ project) => !!project && apps.get(id)?.row.projects?.[project]?.state === "enabled";
      const granted = (/** @type {string} */ id, /** @type {string} */ project) => {
        const g = apps.get(id)?.row.projects?.[project];
        return Array.isArray(g?.granted) ? g.granted.filter((x) => typeof x === "string") : [];
      };

      /** @param {App} app @param {At} at @param {string} name @param {unknown} args */
      const callTool = async (app, at, name, args) => {
        const w = whereOf(at);
        const risky = app.tools[name]?.risk === "destructive";
        if (risky && !(await d.confirm(`${app.name} wants to run ${name}. This can't be undone.`))) throw new Error("you said no");
        return d.client.call(app.id, w, name, args && typeof args === "object" ? args : {}, { confirm: risky });
      };

      /** @param {HTMLElement} el @param {{ app: App, surface: Surface, kind: string, at: At, input?: unknown, onGone?: () => void }} v */
      const mountView = (el, v) => {
        const { at } = v;
        let { app, surface } = v;
        let where, alive = 0, view = "";
        try { where = whereOf(at); } catch (e) { where = null; }
        /** @type {ReturnType<typeof createAppFrame> | null} */
        let frame = null;
        const closed = () => {
          frames.delete(handle);
          if (alive) { d.win.clearInterval(alive); alive = 0; if (where) d.client.viewClosed(app.id, where, view).catch(() => {}); }
        };
        const handle = {
          app: app.id,
          project: where ? where.project : undefined,
          gone: v.onGone,
          retheme: () => frame && frame.retheme(),
          halt: (/** @type {string} */ text) => { if (frame) frame.halt(text); closed(); },
          destroy: () => { if (frame) frame.destroy(); closed(); },
        };
        frame = createAppFrame(el, {
          doc: d.doc, win: d.win, app, title: surface.title ? `${app.name}: ${surface.title}` : app.name,
          load: async () => {
            if (!where || !enabled(app.id, where.project)) throw new Error("it isn't on in this project");
            const now = apps.get(app.id)?.app;
            const s = now && (now.surfaces[v.kind] || []).find((x) => x.id === surface.id);
            if (!now || !s || !s.view) throw new Error("this view is gone from the app");
            app = now;
            surface = s;
            const w = where;
            if (alive && view !== s.view) closed();
            frames.add(handle);
            view = s.view;
            if (!alive) {
              d.client.viewOpened(app.id, w, view).catch(() => {});
              alive = d.win.setInterval(() => { if (d.doc.visibilityState !== "hidden") d.client.viewAlive(app.id, w, view).catch(() => {}); }, ALIVE_MS);
            }
            return { html: htmlOf(await d.client.resource(app.id, view, w)), app, granted: granted(app.id, w.project) };
          },
          ready: (notify) => { if (v.input !== undefined) notify(v.kind === "inline" ? "ui/notifications/tool-result" : "ui/notifications/tool-input", v.kind === "inline" ? { structuredContent: v.input } : { arguments: v.input }); },
          handlers: {
            callTool: (name, args) => callTool(app, at, name, args),
            readResource: (uri) => d.client.resource(app.id, uri, whereOf(at)),
            draft: (text) => d.draft(text, at),
            context: (params) => d.context(app.id, at, params),
            openLink: (url) => d.confirm(`Open ${url}?`).then((ok) => { if (ok) d.win.open(url, "_blank", "noopener,noreferrer"); return ok; }),
            displayMode: (mode) => (mode === "fullscreen" && v.kind === "panel" ? (d.openPanel(`${app.id}:${surface.id}`, { ...at, full: true }), "fullscreen") : "inline"),
          },
        });
        frames.add(handle);
        return handle;
      };

      /** @param {App} app @param {Surface} c @param {At} at @param {unknown} [args] */
      const runCommand = async (app, c, at, args) => {
        if (c.run?.tool) return callTool(app, at, c.run.tool, args);
        if (c.run?.prompt) {
          const p = await d.client.prompt(app.id, whereOf(at), c.run.prompt);
          if (typeof p?.text === "string" && p.text) d.draft(p.text, at);
        }
        return undefined;
      };
      const deps = { enabled, mountView, openPanel: (/** @type {App} */ app, /** @type {Surface} */ s, /** @type {At} */ at) => d.openPanel(`${app.id}:${s.id}`, at), runCommand };

      const settings = createAppsSettings({ client: d.client, redraw: d.redraw, projects: d.projects, confirm: d.confirm, rows: () => [...apps.values()].map((a) => a.row), refresh: () => refresh() });
      const cards = createCards({ doc: d.doc, mountView, find: (id, project) => (enabled(id, project) ? apps.get(id)?.app || null : null) });
      ctx.contribute("settings.section", { id: "apps", label: "Apps", icon: "plug", order: 900, render: settings.render });
      ctx.contribute("conversation.block", { id: "app", render: cards.render });
      ctx.effect(() => () => { cards.closeAll(); for (const f of [...frames]) f.destroy(); });

      /** @param {{ app: string, gone?: () => void, destroy(): void, halt(text: string): void }} f @param {string} text */
      const close = (f, text) => { if (f.gone) { f.destroy(); f.gone(); } else f.halt(text); };
      /** @param {string} id @param {string} [text] */
      const drop = (id, text) => {
        const name = apps.get(id)?.app?.name || apps.get(id)?.row.name || id;
        for (const f of [...frames]) if (f.app === id) close(f, text || `${name} changed. Reload to open it again.`);
        const a = apps.get(id);
        if (a) for (const u of a.undo.reverse()) u();
        apps.delete(id);
      };
      /** @type {Promise<void>} */
      let queue = Promise.resolve();
      const refresh = () => (queue = queue.catch(() => {}).then(load));
      async function load() {
        let res, none = false;
        try { res = await d.client.list(); } catch (e) {
          if (!missingRoute(e)) throw e;
          res = [];
          none = true;
        }
        if (disposed) return;
        settings.unavailable(none);
        if (disposed) return;
        /** @type {Row[]} */
        const rows = Array.isArray(res) ? res : Array.isArray(res?.apps) ? res.apps : [];
        const seen = new Set();
        for (const row of rows) {
          if (!row || typeof row.id !== "string") continue;
          seen.add(row.id);
          const key = JSON.stringify([row.version, row.state, row.manifest ?? null]);
          const old = apps.get(row.id);
          if (old && old.key === key) {
            const was = old.row.projects || {}, now = row.projects || {};
            old.row = row;
            for (const f of [...frames]) {
              if (f.app !== row.id || !f.project || JSON.stringify(was[f.project] ?? null) === JSON.stringify(now[f.project] ?? null)) continue;
              close(f, now[f.project]?.state === "enabled" ? `${old.app?.name || row.id}'s access here changed. Reload to open it again.` : `${old.app?.name || row.id} is off in this project.`);
            }
            continue;
          }
          drop(row.id);
          const { app, problems } = checkManifest(row.manifest);
          /** @type {Undo[]} */
          const undo = [];
          if (app && app.id === row.id && row.state !== "needs_consent") {
            try { for (const c of compile(app, deps)) undo.push(ctx.contribute(c.place, c.entry)); } catch (e) {
              problems.push(String(/** @type {any} */ (e)?.message || e));
              for (const u of undo.splice(0).reverse()) u();
            }
          } else if (app && app.id !== row.id) problems.push(`its manifest says it is ${app.id}`);
          apps.set(row.id, { row, app: problems.length ? null : app, problems, key, undo });
        }
        for (const id of [...apps.keys()]) if (!seen.has(id)) drop(id, `${apps.get(id)?.app?.name || id} was removed.`);
        ctx.emit("apps:changed", { ids: [...apps.keys()] });
        settings.redraw();
      }
      ctx.effect(() => () => { disposed = true; for (const id of [...apps.keys()]) drop(id); });
      ctx.on("apps:refresh", () => { refresh().catch((e) => settings.loaded(false, `XO couldn't list your apps: ${String(/** @type {any} */ (e)?.message || e)}`)); });

      const html = d.doc.documentElement;
      const MO = /** @type {typeof MutationObserver | undefined} */ (/** @type {any} */ (d.win).MutationObserver);
      if (MO) {
        const mo = new MO(() => { for (const f of frames) f.retheme(); });
        mo.observe(html, { attributes: true, attributeFilter: ["data-theme", "class"] });
        ctx.observe(mo);
      }
      try { await refresh(); settings.loaded(false); } catch (e) { settings.loaded(false, `XO couldn't list your apps: ${String(/** @type {any} */ (e)?.message || e)}`); }
    },
  };
}
