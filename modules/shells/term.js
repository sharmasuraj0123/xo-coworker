// @ts-check

// The terminal viewer detaches when its socket closes. The shell keeps running on the server.

import { Terminal } from "../../js/vendor/xterm/xterm.mjs";
import { FitAddon } from "../../js/vendor/xterm/addon-fit.mjs";
import { api, terminalSocketUrl } from "../../core/platform/api.js";
import { copyText } from "../../core/platform/index.js";
import { createFlow, backoff, closeMeaning } from "./model.js";

/** @typedef {'connecting' | 'live' | 'retrying' | 'ended' | 'off' | 'error'} TerminalState */

/** @typedef {{ code?: number, reason?: string, wait?: number }} TerminalDetail */

/** @typedef {{ state?: (state: TerminalState, detail?: TerminalDetail) => void, ready?: (terminal: import('./model.js').Shell) => void, exit?: (detail: TerminalDetail) => void, title?: (text: string) => void, bell?: () => void, copy?: (ok: boolean) => void, error?: (error: { code: string, message?: string }) => void }} TerminalCallbacks */

/** @typedef {{ type: 'ready', terminal: import('./model.js').Shell } | { type: 'resync' } | { type: 'exit', code: number, reason: string } | { type: 'error', code: string, message?: string }} TerminalFrame */

const RESIZE_MS = 120;
const enc = new TextEncoder();

/** The terminal's colours, from the app's theme tokens (light or dark, whichever is on). */
export function themeFromCss(el = document.documentElement) {
  const cs = getComputedStyle(el);
  /** @param {string} name @param {string} d */
  const v = (name, d) => cs.getPropertyValue(name).trim() || d;
  const light = el.dataset.theme === "light";
  return {
    background: v("--canvas", light ? "#F6F6F4" : "#141414"),
    foreground: v("--ink", light ? "#1E1E1E" : "#E1E1E1"),
    cursor: v("--accent-fill", "#83D63A"),
    cursorAccent: v("--canvas", "#141414"),
    selectionBackground: light ? "rgba(72,118,32,.25)" : "rgba(131,214,58,.28)",
    // the ANSI colours, tuned per theme to read on its canvas
    ...(light ? {
      black: "#1E1E1E", red: "#C9252D", green: "#487620", yellow: "#8A4B0B", blue: "#0851A7", magenta: "#6D33B8", cyan: "#0B7285", white: "#BBBBBB",
      brightBlack: "#6B6B6B", brightRed: "#D7373F", brightGreen: "#5A8F2A", brightYellow: "#A86412", brightBlue: "#1F6FCB", brightMagenta: "#8A4FD6", brightCyan: "#1098AD", brightWhite: "#E2E2E2",
    } : {
      black: "#252525", red: "#E68388", green: "#83D63A", yellow: "#F5A623", blue: "#75ADF1", magenta: "#BF8DFF", cyan: "#66D9E8", white: "#C1C1C1",
      brightBlack: "#6A6A6A", brightRed: "#F0A3A7", brightGreen: "#A6E46E", brightYellow: "#F8C063", brightBlue: "#9CC5F5", brightMagenta: "#D4B2FF", brightCyan: "#99E9F2", brightWhite: "#FFFFFF",
    }),
  };
}

/** @param {HTMLElement} host @param {{ id: string, ticket?: string | null, on?: TerminalCallbacks, keys?: (event: KeyboardEvent) => boolean }} options */
export function mountShell(host, { id, ticket = null, on = {}, keys = () => true }) {
  const term = new Terminal({
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "monospace",
    fontSize: 13,
    lineHeight: 1.15,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: false,
    theme: themeFromCss(),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(host);

  const flow = createFlow();
  let ws = /** @type {WebSocket | null} */ (null), state = /** @type {TerminalState} */ ("connecting"), tries = 0, timer = 0, gone = false, fresh = ticket, lastSize = "";
  let gen = 0; // which connection a write callback belongs to: an old one's never counts against the new

  /** @param {TerminalState} s @param {TerminalDetail} [detail] */
  const emit = (s, detail) => { state = s; on.state?.(s, detail); };

  term.attachCustomKeyEventHandler((/** @type {KeyboardEvent} */ e) => {
    if (keys(e) === false) return false;
    // Ctrl+Shift+C / V copy and paste (Ctrl+C and Ctrl+V stay the shell's); ⌘C / ⌘V already work
    if (e.type === "keydown" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      // the copy is said only once the text is on the clipboard; refused, the dock says why (focus stays here)
      if (k === "c") { const sel = term.getSelection(); if (sel) copyText(sel).then((ok) => on.copy?.(ok)); e.preventDefault(); return false; }
      if (k === "v") return false; // the browser's own paste lands in xterm's textarea
    }
    return true;
  });

  /** @param {string | Uint8Array<ArrayBuffer>} data */
  const send = (data) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(data); };
  /** @param {{ type: string, rows?: number, cols?: number }} msg */
  const control = (msg) => send(JSON.stringify(msg));
  term.onData((/** @type {string} */ d) => send(enc.encode(d)));
  term.onBinary((/** @type {string} */ d) => send(Uint8Array.from(d, (c) => c.charCodeAt(0) & 0xff)));
  term.onTitleChange((/** @type {string} */ t) => on.title?.(t));
  term.onBell(() => on.bell?.());

  // ── size: fit the host, tell the server (debounced) ─────────────────────
  const visible = () => host.offsetParent !== null && host.clientWidth > 0 && host.clientHeight > 0;
  function refit({ tell = true } = {}) {
    if (!visible()) return;
    try { fit.fit(); } catch { return; }
    const size = `${term.rows}x${term.cols}`;
    if (tell && size !== lastSize) { lastSize = size; control({ type: "resize", rows: term.rows, cols: term.cols }); }
  }
  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(refit, RESIZE_MS); });
  ro.observe(host);

  // ── the socket ─────────────────────────────────────────────────────────
  async function connect() {
    if (gone) return;
    clearTimeout(timer);
    emit(tries ? "retrying" : "connecting");
    let tk = fresh;
    fresh = null; // a ticket is good for one attach
    if (!tk) {
      try { tk = (await api.attachTerminal(id)).ticket; }
      catch (err) {
        if (gone) return;
        if ((/** @type {import("../../core/platform/http.js").ApiError} */ (err)).code === "terminal_not_found") return end("ended", { reason: "This shell was closed." });
        if ((/** @type {import("../../core/platform/http.js").ApiError} */ (err)).code === "terminal_disabled") return end("off", { reason: (/** @type {import("../../core/platform/http.js").ApiError} */ (err)).message });
        if ((/** @type {import("../../core/platform/http.js").ApiError} */ (err)).code === "signed_out" || (/** @type {import("../../core/platform/http.js").ApiError} */ (err)).code === "not_local") return end("error", { reason: (/** @type {import("../../core/platform/http.js").ApiError} */ (err)).message });
        return retry((/** @type {import("../../core/platform/http.js").ApiError} */ (err)).message);
      }
    }
    if (gone) return;
    refit({ tell: false });
    const sock = new WebSocket(terminalSocketUrl(id));
    sock.binaryType = "arraybuffer";
    ws = sock;
    gen++;
    flow.reset();
    let opened = false;
    sock.onopen = () => {
      opened = true;
      sock.send(JSON.stringify({ type: "auth", ticket: tk, rows: term.rows, cols: term.cols }));
      lastSize = `${term.rows}x${term.cols}`;
    };
    sock.onmessage = (ev) => {
      if (ws !== sock) return;
      if (typeof ev.data !== "string") return write(new Uint8Array(ev.data));
      /** @type {TerminalFrame} */
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "ready") {
        tries = 0;
        // a new viewer replays the kept output from its start: begin from a clean screen
        term.reset();
        emit("live");
        on.ready?.(m.terminal);
        // the same size again still makes full-screen programs redraw
        control({ type: "resize", rows: term.rows, cols: term.cols });
      } else if (m.type === "resync") term.reset();
      else if (m.type === "exit") { on.exit?.({ code: m.code, reason: m.reason }); }
      else if (m.type === "error") on.error?.(m);
    };
    sock.onclose = (ev) => {
      if (ws !== sock) return;
      ws = null;
      if (gone) return;
      const what = closeMeaning(ev.code);
      if (what === "ended") return end("ended", { code: ev.code, reason: ev.reason });
      if (what === "off") return end("off", { reason: ev.reason || "Shells are turned off." });
      if (what === "full") return end("error", { reason: "This shell is already open in too many places (8 at most). Close it in another tab or window, then try again." });
      if (what === "refused") return end("error", { reason: ev.reason || `The server refused the connection (${ev.code}).` });
      retry(opened ? "Connection lost" : "Can't reach the shell");
    };
  }
  /** @param {string} why */
  function retry(why) {
    if (gone) return;
    const wait = backoff(tries++);
    emit("retrying", { reason: why, wait });
    timer = setTimeout(connect, wait);
  }
  /** @param {TerminalState} s @param {TerminalDetail} detail */
  function end(s, detail) {
    clearTimeout(timer);
    // nothing types into an ended shell: its cursor stops blinking and goes
    if (s === "ended" || s === "off") { term.options.cursorBlink = false; term.write("\x1b[?25l"); }
    emit(s, detail);
  }
  /** @param {Uint8Array<ArrayBuffer>} bytes */
  function write(bytes) {
    const n = bytes.length;
    const g = gen;
    const pause = flow.wrote(n);
    if (pause) control({ type: pause });
    term.write(bytes, () => { if (g !== gen) return; const r = flow.drew(n); if (r) control({ type: r }); });
  }

  // a browser that comes back online retries now rather than at the end of its wait
  const online = () => { if (state === "retrying") { tries = 0; connect(); } };
  addEventListener("online", online);

  // a theme switch recolours the terminal
  const mo = new MutationObserver(() => { term.options.theme = themeFromCss(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-flavour"] });

  connect();

  return {
    id,
    get state() { return state; },
    term,
    focus: () => term.focus(),
    refit: () => refit(),
    /** Try again now (after an error or while waiting out a backoff). */
    reconnect: () => { if (!gone && state !== "live") { tries = 0; connect(); } },
    /** Leave: close the socket (the shell keeps running) and free the terminal. */
    dispose() {
      gone = true;
      clearTimeout(timer); clearTimeout(rt);
      removeEventListener("online", online);
      ro.disconnect(); mo.disconnect();
      if (ws) { try { ws.close(1000, "detached"); } catch { /* already closing */ } ws = null; }
      term.dispose();
    },
  };
}
