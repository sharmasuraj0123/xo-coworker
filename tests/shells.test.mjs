import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { declarationsFor, resolveValue } from "./lib/css-snapshot.mjs";
import { deferred, dom, same, settle } from "./lib/dom.mjs";
import replies from "../core/platform/tests/fixtures/terminal-responses.json" with { type: "json" };
import { busyWith, isDetached, span, whereOf, stateLine, dotOf, runningOf, listRows, cleanName, nameFor, createFlow, backoff, closeMeaning, HIGH, LOW } from "../modules/shells/model.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const NOW = Date.parse("2026-10-23T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const later = (ms) => new Date(NOW + ms).toISOString();
const H = 3600e3;
const T = (o = {}) => ({ id: "t_" + Math.random().toString(36).slice(2, 18), name: "Shell", scope: "project", project: "billing", status: "running", viewers: 0, foreground: "bash", ...o });

t("busyWith: the shell itself is idle; anything else running asks before Close", () => {
  for (const sh of ["bash", "zsh", "-bash", "fish", "sh"]) assert.equal(busyWith(T({ foreground: sh })), "");
  assert.equal(busyWith(T({ foreground: "vim" })), "vim");
  assert.equal(busyWith(T({ foreground: "claude" })), "claude");
  assert.equal(busyWith(T({ foreground: null })), "");
  assert.equal(busyWith(T({ status: "exited", foreground: "vim" })), "");
  assert.equal(busyWith(null), "");
});

t("stateLine: watching, detached with its close time, ended with its code", () => {
  assert.equal(stateLine(T({ viewers: 1 }), NOW), "watching");
  assert.equal(stateLine(T({ viewers: 2 }), NOW), "2 views open");
  assert.equal(stateLine(T({ detached_since: ago(2 * H), closes_at: later(22 * H) }), NOW), "detached 2 h ago · closes in 22 h");
  assert.equal(stateLine(T({ detached_since: ago(20e3) }), NOW), "detached under a minute ago");
  assert.equal(stateLine(T({ detached_since: ago(25 * H), closes_at: ago(1e3) }), NOW), "detached 1 day ago · closing");
  assert.equal(stateLine(T({ status: "exited", exit_code: 0, ended_reason: "exited" }), NOW), "exited");
  assert.equal(stateLine(T({ status: "exited", exit_code: 130, ended_reason: "exited" }), NOW), "exited 130");
  assert.equal(stateLine(T({ status: "exited", exit_code: -1, ended_reason: "closed after being left unwatched" }), NOW), "closed after being left unwatched");
});

t("span: rounded the way a person says it", () => {
  assert.equal(span(30e3), "under a minute");
  assert.equal(span(5 * 60e3), "5 min");
  assert.equal(span(90 * 60e3), "2 h");
  assert.equal(span(36 * H), "2 days");
});

t("whereOf and dotOf", () => {
  assert.equal(whereOf(T({ scope: "workspace", project: null })), "Workspace");
  assert.equal(whereOf(T(), (p) => p.toUpperCase()), "BILLING");
  assert.equal(dotOf(T({ viewers: 1 })), "on");
  assert.equal(dotOf(T()), "away");
  assert.equal(dotOf(T({ status: "exited" })), "ended");
  assert.equal(isDetached(T()), true);
  assert.equal(isDetached(T({ viewers: 1 })), false);
  assert.equal(isDetached(T({ status: "exited" })), false);
});

t("runningOf and listRows: counts per project, running before ended, filters", () => {
  const list = [
    T({ id: "a", status: "exited" }),
    T({ id: "b" }),
    T({ id: "c", project: "web" }),
    T({ id: "d", scope: "workspace", project: null }),
  ];
  assert.equal(runningOf(list).length, 3);
  assert.equal(runningOf(list, "billing").length, 1);
  assert.deepEqual(listRows(list).map((x) => x.id), ["b", "c", "d", "a"]);
  assert.deepEqual(listRows(list, "billing").map((x) => x.id), ["b", "a"]);
  assert.deepEqual(listRows(list, "workspace").map((x) => x.id), ["d"]);
});

t("cleanName and nameFor: 1–60 printable characters, as the backend takes them", () => {
  assert.equal(cleanName("  dev server "), "dev server");
  assert.equal(cleanName(""), null);
  assert.equal(cleanName("a\u0007b\nc"), "abc");
  assert.equal(cleanName("x".repeat(61)), null);
  assert.equal(nameFor("x".repeat(80)), "x".repeat(60));
  assert.equal(nameFor(null), null);
  // a hostile name is kept as text: escaping is the renderer's job (esc), not refused here
  assert.equal(cleanName('<img src=x onerror="alert(1)">'), '<img src=x onerror="alert(1)">');
});

t("createFlow: pause above the high mark, resume below the low one, once each", () => {
  const f = createFlow();
  assert.equal(f.wrote(HIGH), null);
  assert.equal(f.wrote(1), "pause");
  assert.equal(f.wrote(50000), null); // already paused
  assert.equal(f.drew(HIGH), null);   // still above LOW
  assert.equal(f.drew(50001 - LOW + 1), "resume");
  assert.equal(f.paused, false);
  assert.equal(f.drew(10), null);
  assert.equal(f.pending >= 0, true);
  f.wrote(HIGH + 1); f.reset();
  assert.equal(f.paused, false); assert.equal(f.pending, 0);
});

t("backoff grows to 15 s; close codes say whether to retry", () => {
  assert.equal(backoff(0, () => 0.5), 500);
  assert.equal(backoff(3, () => 0.5), 4000);
  assert.equal(backoff(20, () => 0.5), 15000);
  assert.ok(backoff(20, () => 1) <= 15000 * 1.15);
  assert.equal(closeMeaning(4404), "ended");
  assert.equal(closeMeaning(1000), "ended");
  assert.equal(closeMeaning(4403), "off");
  assert.equal(closeMeaning(4429), "full");
  assert.equal(closeMeaning(1008), "refused");
  assert.equal(closeMeaning(4401), "retry");
  assert.equal(closeMeaning(1006), "retry");
});

t("a shell's status dot is never blue (the owner: no blue dots; blue is for work in progress only)", () => {
  const rows = declarationsFor((selector) => selector.includes(".shd-dot"));
  assert.ok(new Set(rows.map(({ context }) => context)).size >= 4, "the dot's rules are found");
  const blue = rows.filter(({ value }) => /var\(--(?:info|work)\)/.test(value)
    || /#(?:75ADF1|1F63C7)|rgb\(\s*117\s*,\s*173\s*,\s*241/i.test(String(resolveValue(value))));
  assert.deepEqual(blue, []);
});

{
  const { document, window } = await dom('<main id="scroller" tabindex="-1"></main><button id="nv-shells"><span class="sh-n"></span></button><section id="shd"></section>');
  globalThis.localStorage = globalThis.sessionStorage = { getItem: () => null, setItem() {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globalThis.location = new URL("http://local/");
  const observers = new Set();
  globalThis.MutationObserver = globalThis.ResizeObserver = class {
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  };
  const onlineListeners = new Set();
  globalThis.addEventListener = (type, listener, options) => {
    if (type === "online") onlineListeners.add(listener);
    window.addEventListener(type, listener, options);
  };
  globalThis.removeEventListener = (type, listener, options) => {
    if (type === "online") onlineListeners.delete(listener);
    window.removeEventListener(type, listener, options);
  };
  const closed = [], sockets = [];
  let closeError = null;
  globalThis.WebSocket = class {
    static OPEN = 1;
    sent = [];
    constructor() { sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close(code, reason) {
      if (closeError) throw closeError;
      closed.push({ code, reason });
    }
  };
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url), "http://local/").pathname;
    if (path === "/api/terminal/status") return Response.json(replies.status);
    assert.equal(path, "/api/terminal/sessions");
    if (options?.method === "POST") return Response.json({
      terminal: { ...replies.terminal, id: "demo", project: "demo", scope: "project", name: "Demo" },
      ...replies.ticket, ticket: "attach-ticket",
    });
    return Response.json({ terminals: [] });
  };
  const hooks = registerHooks({
    load(url, context, next) {
      if (url.endsWith("/vendor/xterm/addon-fit.mjs")) {
        const source = "export class FitAddon { fit() { if (this.failure) throw this.failure; this.fits = (this.fits || 0) + 1; } }";
        return { format: "module", shortCircuit: true, source };
      }
      if (url.endsWith("/vendor/xterm/xterm.mjs")) {
        return {
          format: "module",
          shortCircuit: true,
          source: `export class Terminal {
            loadAddon(fit) { this.fit = fit; }
            attachCustomKeyEventHandler() {}
            onData() {}
            onBinary() {}
            onTitleChange() {}
            onBell() {}
            open(host) {
              this.input = document.createElement("textarea");
              this.input.className = "xterm";
              host.append(this.input);
            }
            focus() { this.input.focus(); }
            dispose() { this.input.remove(); }
          }`,
        };
      }
      return next(url, context);
    },
  });
  const { createShells } = await import("../modules/shells/dock.js").finally(() => hooks.deregister());
  const { mountShell } = await import("../modules/shells/term.js");
  t("a shell fits only a visible host with nonzero width and height, and detaches its view", () => {
    const host = document.createElement("div");
    document.body.append(host);
    let width = 0, height = 120, parent = document.body;
    Object.defineProperties(host, {
      clientWidth: { get: () => width }, clientHeight: { get: () => height }, offsetParent: { get: () => parent },
    });
    const shell = mountShell(host, { id: "demo", ticket: "attach-ticket" });
    assert.equal(observers.size, 2);
    assert.equal(onlineListeners.size, 1);
    const socket = sockets.at(-1);
    socket.onopen();
    assert.deepEqual(socket.sent.map(({ type, ticket }) => [type, ticket]), [["auth", "attach-ticket"]]);
    assert.equal(shell.term.fit.fits ?? 0, 0);
    width = 100;
    shell.refit();
    assert.equal(shell.term.fit.fits, 1);
    height = 0;
    shell.refit();
    assert.equal(shell.term.fit.fits, 1);
    height = 120;
    parent = null;
    shell.refit();
    assert.equal(shell.term.fit.fits, 1);
    shell.dispose();
    assert.equal(host.childElementCount, 0);
    assert.deepEqual(closed, [{ code: 1000, reason: "detached" }]);
    assert.equal(observers.size, 0, "disconnect the host and theme observers");
    assert.equal(onlineListeners.size, 0, "remove the terminal's online listener");
    host.remove();
  });
  t("fit errors and malformed control frames are reported and a valid frame still reaches the terminal", () => {
    const host = document.createElement("div");
    document.body.append(host);
    Object.defineProperties(host, {
      clientWidth: { value: 300 }, clientHeight: { value: 120 }, offsetParent: { value: document.body },
    });
    const errors = [], previous = globalThis.reportError;
    const events = [];
    globalThis.reportError = (error) => errors.push(error);
    const shell = mountShell(host, { id: "demo", ticket: "attach-ticket", on: { error: (event) => events.push(event.code) } });
    try {
      const fitError = new Error("fit failed");
      shell.term.fit.failure = fitError;
      shell.refit();
      const socket = sockets.at(-1);
      socket.onmessage({ data: "{invalid control data" });
      socket.onmessage({ data: JSON.stringify({ type: "error", code: "closed" }) });
      assert.equal(errors[0], fitError);
      assert.equal(errors[1]?.message, "The terminal sent malformed control JSON.");
      assert.equal(errors.length, 2);
      assert.deepEqual(events, ["closed"]);
    } finally {
      shell.dispose();
      globalThis.reportError = previous;
      host.remove();
    }
  });
  t("a socket close failure is reported while the terminal still disposes", () => {
    const host = document.createElement("div");
    document.body.append(host);
    closeError = new Error("socket closed unexpectedly");
    const previous = globalThis.reportError;
    const errors = [];
    globalThis.reportError = (error) => errors.push(error.message);
    try {
      const shell = mountShell(host, { id: "demo", ticket: "attach-ticket" });
      shell.dispose();
      assert.equal(host.childElementCount, 0);
      assert.deepEqual(errors, [closeError.message]);
    } finally {
      closeError = null;
      globalThis.reportError = previous;
      host.remove();
    }
  });
  {
    const host = document.createElement("div");
    document.body.append(host);
    const held = deferred(), attempts = [];
    const original = { fetch, setTimeout, clearTimeout };
    const timers = new Map();
    let timer = 0;
    Object.assign(globalThis, {
      fetch: (url, options) => {
        assert.equal(new URL(String(url), "http://local/").pathname, "/api/terminal/sessions/demo/attach");
        assert.equal(options.method, "POST");
        attempts.push(options.signal);
        return held.promise;
      },
      setTimeout: (callback) => { timers.set(++timer, callback); return timer; },
      clearTimeout: (id) => timers.delete(id),
    });
    const shell = mountShell(host, { id: "demo", ticket: "initial" });
    const stale = sockets.at(-1);
    const socketCount = sockets.length;
    try {
      stale.onclose({ code: 1006, reason: "" });
      const retry = timers.values().next().value;
      assert.equal(typeof retry, "function");
      retry();
      assert.equal(shell.state, "retrying");
      assert.equal(attempts.length, 1);
      window.dispatchEvent(new window.Event("online"));
      window.dispatchEvent(new window.Event("online"));
      shell.reconnect();
      assert.equal(attempts.length, 1, "reconnect triggers share the held attach");
      assert.equal(attempts[0].aborted, false);
      stale.onopen();
      assert.equal(stale.sent.length, 0, "an obsolete socket cannot send auth during the retry");
      shell.dispose();
      assert.equal(attempts[0].aborted, true, "disposing aborts the request's fetch signal");
      stale.onopen();
      assert.equal(stale.sent.length, 0, "an obsolete socket cannot send auth");
    } finally {
      shell.dispose();
      held.resolve(Response.json({ ...replies.ticket, ticket: "late" }));
      Object.assign(globalThis, original);
      host.remove();
    }
    await settle();
    assert.equal(sockets.length, socketCount, "a late response cannot open a socket after disposal");
    passed++;
    console.log("  ok  a held retry stays singular, aborts on disposal and ignores late socket callbacks");
  }
  const schedule = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    return delay ? timer.unref() : timer;
  };
  try {
    const shells = createShells();
    await settle();
    assert.equal(shells.enabled, true);
    shells.showList();
    assert.equal(shells.shown, true);
    const tab = document.querySelector(".shd-tab-list");
    same(document.activeElement, tab, "opening Shells focuses its list tab");
    await settle();
    same(document.activeElement, tab, "a shell list response preserves the tab's focus");
    const hide = document.querySelector("[data-sh-min]");
    hide.focus();
    hide.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(shells.shown, false);
    same(document.activeElement, hide, "the minimized dock keeps focus on its button");
    shells.hide();
    same(document.activeElement, document.getElementById("scroller"), "closing returns focus to the conversation");
    await shells.openProject("demo");
    const terminal = document.querySelector(".shd-term .xterm");
    assert.ok(terminal, "opening a shell mounts the terminal");
    same(document.activeElement, terminal, "opening a shell focuses the terminal input");
    assert.equal(shells.owns({ target: terminal }), true, "terminal shortcuts belong to the shell");
    assert.equal(shells.owns({ target: tab }), false, "list shortcuts stay outside the terminal");
    shells.redraw();
    same(document.activeElement, terminal, "redraw leaves the terminal input focused");
    shells.hide();
    assert.equal(shells.shown, false);
    same(document.activeElement, document.getElementById("scroller"), "closing a focused terminal returns to the conversation");
  } finally {
    globalThis.setTimeout = schedule;
  }
}

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
