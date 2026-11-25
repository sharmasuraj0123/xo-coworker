// @ts-check
import { createScope } from "../kernel/scope.js";
import { reportFailure } from "./util.js";

// One Server-Sent Events connection, read with fetch so it can send headers and resume from Last-Event-ID, losing nothing.

/** A pure, incremental SSE parser (the WHATWG rules we need). feed(text) → frames. */
export function createParser() {
  let buf = "";
  /** @type {string[]} */
  let data = [];
  let event = "", sawData = false;
  /** @type {string | null} */
  let id = null;
  /** @type {string | null} */
  let lastId = null;
  /** @type {import("./types").SSEFrame[]} */
  const out = [];
  /** @param {string} l */
  function line(l) {
    if (l === "") {
      if (sawData) out.push({ event: event || "message", data: data.join("\n"), id, lastId });
      event = ""; data = []; id = null; sawData = false;
      return;
    }
    if (l[0] === ":") return; // a comment
    const i = l.indexOf(":");
    const field = i < 0 ? l : l.slice(0, i);
    let value = i < 0 ? "" : l.slice(i + 1);
    if (value[0] === " ") value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") { data.push(value); sawData = true; }
    else if (field === "id" && !value.includes("\0")) { id = value; lastId = value; }
  }
  return {
    /** @param {string} text */
    feed(text) {
      buf += text;
      let start = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        if (c === "\n" || c === "\r") {
          // a \r at the very end may be the first half of \r\n: wait for the next chunk
          if (c === "\r" && i === buf.length - 1) break;
          line(buf.slice(start, i));
          if (c === "\r" && buf[i + 1] === "\n") i++;
          start = i + 1;
        }
      }
      buf = buf.slice(start);
      return out.splice(0);
    },
    get lastId() { return lastId; },
  };
}

/** @param {Response} res @param {(event: unknown) => void} on @param {AbortSignal} signal */
export async function readJsonEvents(res, on, signal) {
  const reader = /** @type {ReadableStream<Uint8Array>} */ (res.body).getReader();
  const decoder = new TextDecoder(), parser = createParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (done || signal.aborted) return;
    for (const frame of parser.feed(decoder.decode(value, { stream: true }))) {
      if (!frame.data) continue;
      let event;
      try { event = JSON.parse(frame.data); }
      catch (error) { if (error instanceof SyntaxError) continue; throw error; }
      try { on(event); } catch (error) { reportFailure(error); }
    }
  }
}

const RETRY_MAX_MS = 15000;
const WATCHDOG_MS = 45000; // the server sends a heartbeat after 15 s of silence
const STALE_MS = 25000;    // after a sleep: no byte for this long means the connection is gone
const DOWN_AFTER = 3;      // failed attempts in a row before we say the stream is down

/** @typedef {{ headers?: () => Record<string, string>, lastId?: string | null, onFrame?: (frame: import("./types").StreamFrame) => void, onState?: (state: import("./types").StreamState, info: import("./types").StateInfo) => void, onReset?: (reset: import("./types").Reset) => Promise<unknown> | void, fetchImpl?: typeof fetch }} StreamOptions */

/** One connection at a time, frames of a superseded attempt dropped; `retention`/`ahead` resets await onReset, then resume from from_seq. */
export class SSEStream {
  /** @param {string} url @param {StreamOptions} [opts] */
  constructor(url, { headers = () => ({}), lastId = null, onFrame, onState, onReset, fetchImpl } = {}) {
    this.url = url;
    this.headers = headers;
    this.lastId = lastId;
    this.onFrame = onFrame || (() => {});
    this.onState = onState || (() => {});
    this.onReset = onReset || (async () => {});
    this.fetch = fetchImpl || ((...a) => globalThis.fetch(...a));
    /** @type {import("./types").StreamState | null} */
    this.state = null;
    this.fails = 0;
    this.closed = false;
    /** @type {AbortController | null} */
    this.ctl = null;
    this.gen = 0;
    this.scope = createScope();
    /** @type {(() => void) | null} */
    this.timer = null;
    /** @type {(() => void) | null} */
    this.watch = null;
    this.lastChunk = 0;
  }

  start() { this.connect(); return this; }

  /** @param {import("./types").StreamState} s @param {import("./types").StateInfo} [info] */
  setState(s, info) { if (s !== this.state || info) { this.state = s; this.onState(s, info || null); } }

  async connect() {
    if (this.closed) return;
    this.timer?.(); this.timer = null;
    this.watch?.();
    if (this.ctl) this.ctl.abort(); // never two connections
    const gen = ++this.gen;
    const ctl = new AbortController();
    this.ctl = ctl;
    const current = () => !this.closed && this.gen === gen;
    // the watchdog runs from the start: a connect that never answers is retried too
    const kick = () => { this.watch?.(); this.watch = this.scope.timeout(() => ctl.abort(), WATCHDOG_MS); };
    kick();
    this.setState(this.fails ? "reconnecting" : "connecting");
    let res;
    try {
      /** @type {Record<string, string>} */
      const h = { Accept: "text/event-stream", ...this.headers() };
      if (this.lastId) h["Last-Event-ID"] = this.lastId;
      res = await this.fetch(this.url, { headers: h, signal: ctl.signal, cache: "no-store", redirect: "manual" });
    } catch (error) {
      if (!current()) return;
      if (!ctl.signal.aborted && !(error instanceof TypeError)) reportFailure(error);
      return this.retry({ code: "network", message: "Can't reach the UI server." });
    }
    if (!current()) return;
    if (res.type === "opaqueredirect") return this.retry({ code: "signed_out", message: "Signed out of the workspace. Reopen this app from XO." });
    if (!res.ok) {
      let detail = null;
      try { detail = (await res.json())?.detail; }
      catch (error) { if (!(error instanceof SyntaxError) && !ctl.signal.aborted) reportFailure(error); }
      if (!current()) return;
      const code = (detail && detail.code) || `http_${res.status}`;
      const message = (detail && detail.message) || (typeof detail === "string" ? detail : `${res.status}`);
      // A resume point the server can't read: start again from now, never retry it as is.
      if (res.status === 400 && code === "bad_last_event_id") { this.lastId = null; return this.retry({ code, message }, 0); }
      return this.retry({ code, message, status: res.status });
    }
    const parser = createParser();
    const reader = /** @type {ReadableStream<Uint8Array>} */ (res.body).getReader();
    const dec = new TextDecoder();
    let healthy = false, reset = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (!current()) {
          await reader.cancel().catch((error) => { if (!ctl.signal.aborted) reportFailure(error); });
          return;
        }
        if (done) break;
        kick();
        this.lastChunk = Date.now();
        for (const f of parser.feed(dec.decode(value, { stream: true }))) {
          if (!healthy) { healthy = true; this.fails = 0; this.setState("live"); }
          let env = null;
          try { env = JSON.parse(f.data); }
          catch (error) { if (error instanceof SyntaxError) continue; throw error; }
          if (f.id) this.lastId = f.id;
          if (f.event === "reset") { reset = (env && env.data) || {}; continue; }
          if (f.event === "snapshot" && !this.lastId && env && env.data && env.data.seq != null) this.lastId = String(env.data.seq);
          this.onFrame({ type: f.event, id: f.id, envelope: env });
          if (!current()) return;
        }
      }
    } catch (error) {
      if (!ctl.signal.aborted) reportFailure(error);
    }
    if (!current()) return;
    this.watch?.();
    if (reset) {
      if (reset.reason === "retention" || reset.reason === "ahead") {
        this.setState("reconnecting", { reset: reset.reason });
        try { await this.onReset(reset); }
        catch (error) { if (!ctl.signal.aborted) reportFailure(error); }
        if (!current()) return;
        this.lastId = reset.from_seq != null ? String(reset.from_seq) : null;
      } else if (reset.from_seq != null) {
        this.lastId = String(reset.from_seq);
      }
      return this.retry(null, 0);
    }
    // The server ended the stream (it restarted, or a proxy closed it): resume from the last id.
    this.retry(healthy ? null : { code: "ended", message: "The stream ended." }, healthy ? 300 : undefined);
  }

  /** @param {import("./types").StateInfo} err @param {number} [delay] */
  retry(err, delay) {
    if (this.closed) return;
    if (err) this.fails += 1;
    const wait = delay ?? Math.min(RETRY_MAX_MS, 1000 * 2 ** Math.max(0, this.fails - 1)) + Math.random() * 400;
    this.setState(this.fails >= DOWN_AFTER ? "down" : "reconnecting", err);
    this.timer?.();
    this.timer = this.scope.timeout(() => { this.timer = null; this.connect(); }, wait);
  }

  /** Visible again or back online: retry now rather than wait out the backoff, and drop a connection that went silent in a sleep. */
  nudge() {
    if (this.closed) return;
    if (this.timer) { this.connect(); return; }
    if (this.state === "live" && Date.now() - this.lastChunk > STALE_MS) this.connect();
  }

  close() {
    this.closed = true;
    this.scope.dispose();
    this.timer = this.watch = null;
    if (this.ctl) this.ctl.abort();
    this.setState("closed");
  }
}
