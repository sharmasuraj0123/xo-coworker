// @ts-check

/** @typedef {import("./manifest.js").App} App @typedef {{ callTool(name: string, args: Record<string, unknown>): Promise<unknown>, readResource(uri: string): Promise<unknown>, draft(text: string): void, context(params: { content?: unknown[], structuredContent?: unknown }): void, openLink(url: string): Promise<boolean> | boolean, displayMode(mode: string): string, resize(height: number): void, hostContext(): Record<string, unknown>, initialized(): void, log?(params: unknown): void }} Handlers @typedef {{ app: App, granted: string[], frame: () => (Window | null), win: EventTarget, handlers: Handlers, now?: () => number, timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout } }} BridgeOpts */

export const PROTOCOL = "2026-01-26";
export const MAX_BYTES = 1 << 20;
const BURST = 50, PER_SECOND = 20;
const ERR = { parse: -32700, invalid: -32600, method: -32601, params: -32602, refused: -32001, failed: -32000 };

class Refusal extends Error {
  /** @param {number} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}
/** @param {boolean} ok @param {string} why */
const need = (ok, why) => { if (!ok) throw new Refusal(ERR.params, why); };
const isObj = (/** @type {unknown} */ v) => !!v && typeof v === "object" && !Array.isArray(v);

/** The byte size of a message as JSON, or Infinity for one that can't be one. @param {unknown} data */
export function sizeOf(data) {
  try { return new TextEncoder().encode(JSON.stringify(data)).length; } catch { return Infinity; }
}

/** True only for a message from this view's own frame, at the opaque origin a sandboxed frame has. @param {MessageEvent} e @param {Window | null} frameWin */
export function fromView(e, frameWin) {
  return !!frameWin && e.source === frameWin && e.origin === "null";
}

/** MCP Apps JSON-RPC between XO and one sandboxed view: allow-listed methods, checked params, capped size and rate. @param {BridgeOpts} o */
export function createBridge(o) {
  const { app, handlers } = o;
  const now = o.now || (() => Date.now());
  const T = o.timers || globalThis;
  const granted = new Set(o.granted);
  let tokens = BURST, last = now(), seq = 0, closed = false, ready = false;
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void, timer: any }>} */
  const pending = new Map();

  /** @param {object} msg */
  const post = (msg) => { const w = o.frame(); if (w && !closed) w.postMessage({ jsonrpc: "2.0", ...msg }, "*"); };
  const take = () => {
    const t = now();
    tokens = Math.min(BURST, tokens + ((t - last) / 1000) * PER_SECOND);
    last = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };

  /** @type {Record<string, (p: any) => unknown>} */
  const METHODS = {
    "ui/initialize": () => ({
      protocolVersion: PROTOCOL,
      hostInfo: { name: "xo", version: "0.1.0" },
      hostCapabilities: { openLinks: {}, serverTools: {}, serverResources: {}, logging: {} },
      hostContext: handlers.hostContext(),
    }),
    "ui/notifications/initialized": () => { ready = true; handlers.initialized(); },
    "ui/notifications/size-changed": (p) => { need(isObj(p) && Number.isFinite(p.height), "height must be a number"); handlers.resize(Math.max(0, Math.min(10000, p.height))); },
    "notifications/message": (p) => { if (handlers.log) handlers.log(p); },
    "ping": () => ({}),
    "tools/call": (p) => {
      need(isObj(p) && typeof p.name === "string", "name must be a tool's name");
      need(p.arguments === undefined || isObj(p.arguments), "arguments must be an object");
      const tool = Object.hasOwn(app.tools, p.name) ? app.tools[p.name] : undefined;
      if (!tool || !tool.visibility.includes("app")) throw new Refusal(ERR.refused, `${app.name} has no tool "${p.name}" for its views`);
      return handlers.callTool(p.name, p.arguments || {});
    },
    "resources/read": (p) => {
      need(isObj(p) && typeof p.uri === "string" && p.uri.startsWith(`ui://${app.id}/`), "a view reads only its own app's resources");
      return handlers.readResource(p.uri);
    },
    "ui/update-model-context": (p) => {
      if (!granted.has("context.update")) throw new Refusal(ERR.refused, `${app.name} may not tell the agent what you're pointing at here`);
      need(isObj(p) && (p.content === undefined || Array.isArray(p.content)), "content must be a list");
      handlers.context({ content: p.content, structuredContent: p.structuredContent });
      return {};
    },
    "ui/message": (p) => {
      if (!granted.has("composer.draft")) throw new Refusal(ERR.refused, `${app.name} may not suggest messages here`);
      need(isObj(p) && Array.isArray(p.content), "content must be a list");
      const text = p.content.filter((/** @type {any} */ c) => isObj(c) && c.type === "text" && typeof c.text === "string").map((/** @type {any} */ c) => c.text).join("\n");
      need(text.length > 0 && text.length <= 20000, "a draft is text, 20,000 characters at most");
      handlers.draft(text);
      return {};
    },
    "ui/open-link": async (p) => {
      need(isObj(p) && typeof p.url === "string", "url must be text");
      let u;
      try { u = new URL(p.url); } catch { throw new Refusal(ERR.params, "that isn't a link"); }
      if (u.protocol !== "https:" || u.username || u.password) throw new Refusal(ERR.refused, "only https links open");
      return { opened: !!(await handlers.openLink(u.href)) };
    },
    "ui/request-display-mode": (p) => {
      need(isObj(p) && typeof p.mode === "string", "mode must be text");
      return { mode: handlers.displayMode(p.mode) };
    },
  };

  /** @param {any} msg */
  async function handle(msg) {
    const id = typeof msg.id === "number" || typeof msg.id === "string" ? msg.id : undefined;
    if (typeof msg.method !== "string") {
      const waiter = typeof msg.id === "number" ? pending.get(msg.id) : undefined;
      if (!waiter) return;
      pending.delete(msg.id);
      T.clearTimeout(waiter.timer);
      if (isObj(msg.error)) waiter.reject(new Error(String(msg.error.message || "the view refused")));
      else waiter.resolve(msg.result);
      return;
    }
    const fn = Object.hasOwn(METHODS, msg.method) ? METHODS[msg.method] : undefined;
    if (!ready && fn && !["ui/initialize", "ui/notifications/initialized", "ping", "notifications/message"].includes(msg.method)) {
      if (id !== undefined) post({ id, error: { code: ERR.invalid, message: "initialize first" } });
      return;
    }
    if (!fn) { if (id !== undefined) post({ id, error: { code: ERR.method, message: `XO doesn't offer "${msg.method}" to views` } }); return; }
    try {
      const result = await fn(msg.params);
      if (id !== undefined) post({ id, result: result ?? {} });
    } catch (e) {
      const err = /** @type {any} */ (e);
      if (id !== undefined) post({ id, error: { code: err instanceof Refusal ? err.code : ERR.failed, message: String(err?.message || err) } });
    }
  }

  /** @param {Event} ev */
  const onMessage = (ev) => {
    const e = /** @type {MessageEvent} */ (ev);
    if (closed || !fromView(e, o.frame())) return;
    const msg = e.data;
    if (!isObj(msg) || msg.jsonrpc !== "2.0") return;
    const id = typeof msg.id === "number" || typeof msg.id === "string" ? msg.id : undefined;
    if (sizeOf(msg) > MAX_BYTES) { if (id !== undefined) post({ id, error: { code: ERR.invalid, message: "a message is 1 MiB at most" } }); return; }
    if (typeof msg.method === "string" && !take()) { if (id !== undefined) post({ id, error: { code: ERR.refused, message: "too many calls; slow down" } }); return; }
    void handle(msg);
  };
  o.win.addEventListener("message", onMessage);

  return {
    get ready() { return ready; },
    /** @param {string} method @param {unknown} [params] */
    notify(method, params) { post({ method, ...(params === undefined ? {} : { params }) }); },
    /** @param {string} method @param {unknown} [params] @param {number} [ms] @returns {Promise<any>} */
    request(method, params, ms = 5000) {
      if (closed) return Promise.reject(new Error("the view is closed"));
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = T.setTimeout(() => { pending.delete(id); reject(new Error("the view didn't answer")); }, ms);
        pending.set(id, { resolve, reject, timer });
        post({ id, method, ...(params === undefined ? {} : { params }) });
      });
    },
    close() {
      if (closed) return;
      closed = true;
      o.win.removeEventListener("message", onMessage);
      for (const [, w] of pending) { T.clearTimeout(w.timer); w.reject(new Error("the view is closed")); }
      pending.clear();
    },
  };
}
