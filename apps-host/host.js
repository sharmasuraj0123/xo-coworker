// @ts-check
import { checkManifest } from "./manifest.js";
import { compile, HOST_PLACES } from "./contributions.js";
import { createAppFrame } from "./frame.js";
import { createAppsSettings } from "./settings.js";
import { createCards } from "./card.js";

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
      /** @type {Set<{ retheme(): void, destroy(): void }>} */
      const frames = new Set();
      const enabled = (/** @type {string} */ id, /** @type {string | undefined} */ project) => !!project && apps.get(id)?.row.projects?.[project]?.state === "enabled";
      const granted = (/** @type {string} */ id, /** @type {string} */ project) => {
        const g = apps.get(id)?.row.projects?.[project];
        return Array.isArray(g?.granted) ? g.granted.filter((x) => typeof x === "string") : [];
      };

      /** @param {HTMLElement} el @param {{ app: App, surface: Surface, kind: string, at: At, input?: unknown }} v */
      const mountView = (el, v) => {
        const { app, surface, at } = v;
        let where, alive = 0;
        try { where = whereOf(at); } catch (e) { where = null; }
        const view = /** @type {string} */ (surface.view);
        const frame = createAppFrame(el, {
          doc: d.doc, win: d.win, app, title: surface.title ? `${app.name}: ${surface.title}` : app.name,
          granted: where ? granted(app.id, where.project) : [],
          load: async () => {
            if (!where || !enabled(app.id, where.project)) throw new Error("it isn't on in this project");
            const w = where;
            if (!alive) {
              d.client.viewOpened(app.id, w, view).catch(() => {});
              alive = d.win.setInterval(() => { if (d.doc.visibilityState !== "hidden") d.client.viewAlive(app.id, w, view).catch(() => {}); }, ALIVE_MS);
            }
            return htmlOf(await d.client.resource(app.id, view, where));
          },
          ready: (notify) => { if (v.input !== undefined) notify(v.kind === "inline" ? "ui/notifications/tool-result" : "ui/notifications/tool-input", v.kind === "inline" ? { structuredContent: v.input } : { arguments: v.input }); },
          handlers: {
            callTool: async (name, args) => {
              const w = whereOf(at);
              const risky = app.tools[name]?.risk === "destructive";
              if (risky && !(await d.confirm(`${app.name} wants to run ${name}. This can't be undone.`))) throw new Error("you said no");
              return d.client.call(app.id, w, name, args, { confirm: risky });
            },
            readResource: (uri) => d.client.resource(app.id, uri, whereOf(at)),
            draft: (text) => d.draft(text, at),
            context: (params) => d.context(app.id, at, params),
            openLink: (url) => d.confirm(`Open ${url}?`).then((ok) => { if (ok) d.win.open(url, "_blank", "noopener,noreferrer"); return ok; }),
            displayMode: (mode) => (mode === "fullscreen" && v.kind === "panel" ? (d.openPanel(`${app.id}:${surface.id}`, { ...at, full: true }), "fullscreen") : "inline"),
          },
        });
        const handle = {
          retheme: () => frame.retheme(),
          destroy: () => {
            frames.delete(handle);
            frame.destroy();
            if (alive) { d.win.clearInterval(alive); alive = 0; if (where) d.client.viewClosed(app.id, where, view).catch(() => {}); }
          },
        };
        frames.add(handle);
        return handle;
      };

      /** @param {App} app @param {Surface} c @param {At} at @param {unknown} [args] */
      const runCommand = async (app, c, at, args) => {
        const w = whereOf(at);
        if (c.run?.tool) return d.client.call(app.id, w, c.run.tool, args && typeof args === "object" ? args : {});
        if (c.run?.prompt) {
          const p = await d.client.prompt(app.id, w, c.run.prompt);
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

      /** @param {string} id */
      const drop = (id) => { const a = apps.get(id); if (a) for (const u of a.undo.reverse()) u(); apps.delete(id); };
      /** @type {Promise<void>} */
      let queue = Promise.resolve();
      const refresh = () => (queue = queue.catch(() => {}).then(load));
      async function load() {
        const res = await d.client.list();
        /** @type {Row[]} */
        const rows = Array.isArray(res) ? res : Array.isArray(res?.apps) ? res.apps : [];
        const seen = new Set();
        for (const row of rows) {
          if (!row || typeof row.id !== "string") continue;
          seen.add(row.id);
          const key = `${row.version}|${row.state}`;
          const old = apps.get(row.id);
          if (old && old.key === key) { old.row = row; continue; }
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
        for (const id of [...apps.keys()]) if (!seen.has(id)) drop(id);
        ctx.emit("apps:changed", { ids: [...apps.keys()] });
        settings.redraw();
      }
      ctx.effect(() => () => { for (const id of [...apps.keys()]) drop(id); });

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
