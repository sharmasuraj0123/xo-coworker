// @ts-check
import { createBridge } from "./bridge.js";

/** @typedef {import("./bridge.js").Handlers} Handlers @typedef {import("./manifest.js").App} App @typedef {{ doc: Document, win: EventTarget, app: App, title: string, load: () => Promise<{ html: string, app: App, granted: string[] }>, ready?: (notify: (method: string, params: unknown) => void) => void, handlers: Omit<Handlers, "resize" | "initialized" | "hostContext">, displayMode?: string, timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout, setInterval: typeof setInterval, clearInterval: typeof clearInterval } }} FrameOpts */

export const CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:; connect-src 'none'; frame-src 'none'; child-src blob:; form-action 'none'; base-uri 'none'; object-src 'none'";
export const SANDBOX = "allow-scripts";
export const ALLOW = "camera 'none'; microphone 'none'; geolocation 'none'; usb 'none'; serial 'none'; hid 'none'; bluetooth 'none'; payment 'none'; display-capture 'none'; fullscreen 'none'; clipboard-read 'none'; publickey-credentials-get 'none'";
const PING_MS = 5000, DEAD_MS = 10000, OPEN_MS = 15000;

export const THEME_VARS = Object.freeze([
  ["--color-background-primary", "--surface"], ["--color-background-secondary", "--sunken"], ["--color-background-tertiary", "--fill-1"],
  ["--color-text-primary", "--ink"], ["--color-text-secondary", "--ink-2"], ["--color-text-tertiary", "--ink-3"],
  ["--color-border-primary", "--line"], ["--color-border-secondary", "--line-soft"],
  ["--color-text-success", "--accent"], ["--color-background-success", "--accent-fill"], ["--color-text-warning", "--warn"],
  ["--color-text-danger", "--err-ink"], ["--color-background-danger", "--err"],
  ["--font-sans", "--sans"], ["--font-mono", "--mono"],
  ["--font-text-xs-size", "--fs-xs"], ["--font-text-sm-size", "--fs-sm"], ["--font-text-md-size", "--fs-base"], ["--font-text-lg-size", "--fs-lg"],
  ["--border-radius-xs", "--r-xs"], ["--border-radius-sm", "--r-sm"], ["--border-radius-md", "--r"], ["--border-radius-lg", "--r-lg"], ["--border-radius-xl", "--r-xl"], ["--border-radius-full", "--r-pill"],
  ["--shadow-hairline", "--hairline"], ["--shadow-md", "--shadow-md"], ["--shadow-lg", "--shadow-lg"],
  ["--xo-accent", "--accent"], ["--xo-accent-ink", "--accent-ink"], ["--xo-yours", "--need"], ["--xo-voice", "--violet"],
  ["--font-text-md-line-height", "--lh-ui"], ["--xo-space-1", "--s-1"], ["--xo-space-2", "--s-2"], ["--xo-space-3", "--s-3"], ["--xo-space-4", "--s-4"],
  ["--xo-ease", "--ease"], ["--xo-dur-fast", "--dur-fast"], ["--xo-dur-base", "--dur-base"], ["--xo-dur-slow", "--dur-slow"],
]);

/** XO's tokens under the MCP Apps names; a value that could leave its declaration is dropped. @param {(token: string) => string} read @returns {Record<string, string>} */
export function themeVariables(read) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, token] of THEME_VARS) {
    const v = String(read(token) || "").trim();
    if (v && v.length < 300 && !/[<>{};\\]/.test(v)) out[name] = v;
  }
  return out;
}

/** A view's document with XO's CSP as the first thing parsed, and its theme on :root. @param {string} html @param {{ theme: string, variables: Record<string, string> }} look */
export function buildSrcdoc(html, look) {
  const body = String(html).replace(/^﻿?\s*<!doctype[^>]*>/i, "");
  const vars = Object.entries(look.variables).map(([k, v]) => `${k}:${v}`).join(";");
  const theme = look.theme === "light" ? "light" : "dark";
  return `<!doctype html><html class="xo-${theme}" data-theme="${theme}"><head><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"><style>:root{color-scheme:${theme};${vars}}</style></head>${body}`;
}

/** @param {Document} doc */
const readTokens = (doc) => {
  const cs = doc.defaultView ? doc.defaultView.getComputedStyle(doc.documentElement) : null;
  return (/** @type {string} */ t) => (cs ? cs.getPropertyValue(t) : "");
};
/** @param {Document} doc */
const themeOf = (doc) => (doc.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

/** XO's frame around one sandboxed view: loading, live, stopped; the view draws only its content. @param {HTMLElement} host @param {FrameOpts} o */
export function createAppFrame(host, o) {
  const { doc } = o;
  let app = o.app;
  const T = o.timers || globalThis;
  const box = doc.createElement("div");
  box.className = "xa-frame";
  box.tabIndex = -1;
  box.dataset.state = "loading";
  const status = doc.createElement("div");
  status.className = "xa-frame-status";
  status.setAttribute("role", "status");
  const say = doc.createElement("span");
  const reload = doc.createElement("button");
  reload.type = "button";
  reload.className = "btn";
  reload.textContent = "Reload";
  reload.hidden = true;
  status.append(say, reload);
  box.append(status);
  host.append(box);

  /** @type {HTMLIFrameElement | null} */
  let iframe = null;
  /** @type {ReturnType<typeof createBridge> | null} */
  let bridge = null;
  let watch = /** @type {any} */ (null), opening = /** @type {any} */ (null), loads = 0, gone = false, gen = 0;
  let mode = o.displayMode || "inline";

  /** @param {"loading" | "live" | "stopped"} state @param {string} text */
  const show = (state, text) => {
    box.dataset.state = state;
    say.textContent = text;
    reload.hidden = state !== "stopped";
  };
  const look = () => ({ theme: themeOf(doc), variables: themeVariables(readTokens(doc)) });
  const hostContext = () => ({ theme: themeOf(doc), styles: { variables: look().variables }, displayMode: mode, availableDisplayModes: ["inline", "fullscreen"], platform: "web", locale: doc.documentElement.lang || "en" });

  const unmount = () => {
    if (watch) { T.clearInterval(watch); watch = null; }
    if (opening) { T.clearTimeout(opening); opening = null; }
    if (bridge) { bridge.close(); bridge = null; }
    if (iframe) { iframe.remove(); iframe = null; }
  };
  /** @param {string} text */
  const stop = (text) => {
    const hadFocus = box.contains(doc.activeElement);
    unmount();
    show("stopped", text);
    if (hadFocus) reload.focus();
  };

  async function mount() {
    unmount();
    const my = ++gen;
    loads = 0;
    show("loading", `Opening ${app.name}…`);
    let html, granted;
    try { ({ html, app, granted } = await o.load()); } catch (e) { if (my === gen && !gone) stop(`${app.name} couldn't open: ${String(/** @type {any} */ (e)?.message || e)}`); return; }
    if (my !== gen || gone) return;
    const f = doc.createElement("iframe");
    f.className = "xa-frame-view";
    f.setAttribute("sandbox", SANDBOX);
    f.setAttribute("allow", ALLOW);
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("title", o.title);
    f.addEventListener("load", () => { if (++loads > 1) stop(`${app.name} tried to leave its frame, so XO closed it.`); });
    f.srcdoc = buildSrcdoc(html, look());
    iframe = f;
    const b = createBridge({
      app, granted, win: o.win, frame: () => f.contentWindow, timers: T,
      handlers: {
        ...o.handlers,
        hostContext,
        resize: (h) => box.style.setProperty("--xa-view-h", `${Math.ceil(h)}px`),
        initialized: () => {
          if (my !== gen) return;
          if (opening) { T.clearTimeout(opening); opening = null; }
          const focusView = doc.activeElement === box;
          show("live", "");
          if (focusView) f.focus();
          if (o.ready) o.ready((m, p) => b.notify(m, p));
          watch = T.setInterval(() => { b.request("ping", undefined, DEAD_MS).catch(() => { if (bridge === b) stop(`${app.name} stopped responding.`); }); }, PING_MS);
        },
        displayMode: (m) => { const next = o.handlers.displayMode(m); mode = next; return next; },
      },
    });
    bridge = b;
    box.append(f);
    opening = T.setTimeout(() => { if (my === gen && !b.ready) stop(`${app.name} didn't open.`); }, OPEN_MS);
  }

  reload.addEventListener("click", () => { box.focus(); void mount(); });
  void mount();

  return {
    element: box,
    get state() { return box.dataset.state; },
    retheme() { if (bridge && bridge.ready) bridge.notify("ui/notifications/host-context-changed", hostContext()); },
    /** @param {string} method @param {unknown} params */
    notify(method, params) { if (bridge && bridge.ready) bridge.notify(method, params); },
    reload: mount,
    /** Close the view but keep XO's frame, its words and Reload. @param {string} text */
    halt(text) { if (!gone) { gen++; stop(text); } },
    destroy() {
      if (gone) return;
      gone = true;
      gen++;
      const b = bridge;
      if (b) b.quiesce();
      if (b && b.ready) b.request("ui/resource-teardown", {}, 500).catch(() => {}).finally(() => { unmount(); box.remove(); });
      else { unmount(); box.remove(); }
    },
  };
}
