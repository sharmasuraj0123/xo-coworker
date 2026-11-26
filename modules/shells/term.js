// @ts-check

// The terminal viewer detaches when its socket closes. The shell keeps running on the server.

import { Terminal } from "../../vendor/xterm/xterm.mjs";
import { FitAddon } from "../../vendor/xterm/addon-fit.mjs";
import { createScope } from "../../core/kernel/scope.js";
import { api, terminalSocketUrl } from "../../core/platform/api.js";
import { copyText } from "../../core/platform/index.js";
import { reportFailure } from "../../core/services/notices/failures.js";
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
    selectionBackground: v("--fill-selection", light ? "rgba(72,118,32,.25)" : "rgba(131,214,58,.28)"),
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

/** @param {InstanceType<typeof Terminal>} term @param {(event: KeyboardEvent) => boolean} keys @param {TerminalCallbacks} on */
function bindTerminalKeys(term, keys, on) {
  term.attachCustomKeyEventHandler((/** @type {KeyboardEvent} */ e) => {
    if (keys(e) === false) return false;
    if (e.type === "keydown" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "c") { const sel = term.getSelection(); if (sel) copyText(sel).then((ok) => on.copy?.(ok)); e.preventDefault(); return false; }
      if (k === "v") return false;
    }
    return true;
  });
}

/** @param {ReturnType<typeof createScope>} scope @param {HTMLElement} host @param {() => void} refit @param {() => void} recolor */
function observeTerminal(scope, host, refit, recolor) {
  let cancelResize = () => {};
  const resize = new ResizeObserver(() => { cancelResize(); cancelResize = scope.timeout(refit, RESIZE_MS); });
  resize.observe(host);
  scope.observe(resize);
  const theme = new MutationObserver(recolor);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-flavour"] });
  scope.observe(theme);
}

/** @typedef {{ticket: string} | {state: TerminalState, reason: string} | {retry: string}} AttachResult */

/** @param {string} id @param {AbortSignal} signal @returns {Promise<AttachResult | null>} */
async function attachTicket(id, signal) {
  if (signal.aborted) return null;
  try { return await api.attachTerminal(id, { signal }); }
  catch (error) {
    if (signal.aborted) return null;
    const failure = /** @type {import("../../core/platform/http.js").ApiError} */ (error);
    if (failure.code === "terminal_not_found") return { state: "ended", reason: "This shell was closed." };
    if (failure.code === "terminal_disabled") return { state: "off", reason: failure.message };
    if (failure.code === "signed_out" || failure.code === "not_local") {
      return { state: "error", reason: failure.message };
    }
    return { retry: failure.message };
  }
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

  const flow = createFlow(), scope = createScope();
  let ws = /** @type {WebSocket | null} */ (null), state = /** @type {TerminalState} */ ("connecting");
  let tries = 0, attaching = false, fresh = ticket, lastSize = "", cancelRetry = () => {};
  let gen = 0; // which connection a write callback belongs to: an old one's never counts against the new

  /** @param {TerminalState} s @param {TerminalDetail} [detail] */
  const emit = (s, detail) => { state = s; on.state?.(s, detail); };

  bindTerminalKeys(term, keys, on);

  /** @param {string | Uint8Array<ArrayBuffer>} data */
  const send = (data) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(data); };
  /** @param {{ type: string, rows?: number, cols?: number }} msg */
  const control = (msg) => send(JSON.stringify(msg));
  term.onData((/** @type {string} */ d) => send(enc.encode(d)));
  term.onBinary((/** @type {string} */ d) => send(Uint8Array.from(d, (c) => c.charCodeAt(0) & 0xff)));
  term.onTitleChange((/** @type {string} */ t) => on.title?.(t));
  term.onBell(() => on.bell?.());

  const visible = () => host.offsetParent !== null && Boolean(host.clientWidth && host.clientHeight);
  function refit({ tell = true } = {}) {
    if (!visible()) return;
    try { fit.fit(); } catch (error) { reportFailure(error); return; }
    const size = `${term.rows}x${term.cols}`;
    if (tell && size !== lastSize) { lastSize = size; control({ type: "resize", rows: term.rows, cols: term.cols }); }
  }

  async function connect(reset = false) {
    if (scope.signal.aborted || attaching || ws) return;
    attaching = true;
    try {
      cancelRetry();
      if (reset) tries = 0;
      emit(tries ? "retrying" : "connecting");
      const supplied = fresh;
      fresh = null;
      const answer = supplied ? { ticket: supplied } : await attachTicket(id, scope.signal);
      if (scope.signal.aborted || !answer) return;
      if ("state" in answer) return end(answer.state, { reason: answer.reason });
      if ("retry" in answer) return retry(answer.retry);
      refit({ tell: false });
      if (!scope.signal.aborted) openSocket(answer.ticket);
    } finally { attaching = false; }
  }
  /** @param {string} ticketValue */
  function openSocket(ticketValue) {
    const sock = new WebSocket(terminalSocketUrl(id));
    sock.binaryType = "arraybuffer";
    ws = sock;
    gen++;
    flow.reset();
    let opened = false;
    sock.onopen = () => {
      if (ws !== sock || scope.signal.aborted) return;
      opened = true;
      sock.send(JSON.stringify({ type: "auth", ticket: ticketValue, rows: term.rows, cols: term.cols }));
      lastSize = `${term.rows}x${term.cols}`;
    };
    sock.onmessage = (ev) => {
      if (ws !== sock) return;
      if (typeof ev.data !== "string") return write(new Uint8Array(ev.data));
      /** @type {TerminalFrame} */
      let m;
      try { m = JSON.parse(ev.data); } catch { reportFailure(new Error("The terminal sent malformed control JSON.")); return; }
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
      if (scope.signal.aborted) return;
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
    if (scope.signal.aborted) return;
    const wait = backoff(tries++);
    emit("retrying", { reason: why, wait });
    cancelRetry = scope.timeout(connect, wait);
  }
  /** @param {TerminalState} s @param {TerminalDetail} detail */
  function end(s, detail) {
    cancelRetry();
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

  const online = () => { if (state === "retrying") connect(true); };
  scope.listen(globalThis, "online", online);
  observeTerminal(scope, host, refit, () => { term.options.theme = themeFromCss(); });
  connect();

  return {
    id,
    get state() { return state; },
    term,
    focus: () => term.focus(),
    refit: () => refit(),
    /** Try again now (after an error or while waiting out a backoff). */
    reconnect: () => { if (state !== "live") connect(true); },
    /** Leave: close the socket (the shell keeps running) and free the terminal. */
    dispose() {
      if (scope.signal.aborted) return;
      scope.dispose();
      const attached = ws;
      ws = null;
      try { attached?.close(1000, "detached"); }
      catch (error) { reportFailure(error); }
      finally { term.dispose(); }
    },
  };
}
