// @ts-check

// Settings › Runtimes: the agents XO runs threads on, their health and usage, the defaults and paid usage.

import { esc } from "../../js/world.js";
import { clockWords, rtName, isInstalled, healthOf, windowsOf, resetWords, allowedOf, defaultOf, errorField } from "../../core/services/runtimes.js";
import { once, isPending, busyAttrs } from "../../core/platform/index.js";
import { redraw } from "../../js/redraw.js";
import { rovingTab } from "../../js/keynav.js";
import { MODES, MODE_NAME as MODE_NAMES, MODE_SUB as MODE_SUBS, heldModes, effectiveMode, accountRows, onPaid, creditsWords } from "../../core/services/world/paid.js";

const REFRESH_MS = 30000;
const PREF_MAX = 2000;
const blank = () => ({ allowed: null, default: null, preferences: null, fallback: null });
const pct = (/** @type {number} */ u) => `${Math.round(u * 100)}%`;
const POLICY = "runtime-policy";
const MODE_NAME = /** @type {Record<string, string>} */ (MODE_NAMES);
const MODE_SUB = /** @type {Record<string, string>} */ (MODE_SUBS);

/** The runtime new work goes to when its coordinator doesn't choose, as XO picks it. @param {any} policy @param {any[] | null | undefined} rts @returns {string | null} */
export function usualOf(policy, rts) {
  const list = rts || [];
  const permits = (/** @type {string | null | undefined} */ a) => !!a && !(policy && Array.isArray(policy.allowed) && !policy.allowed.includes(a));
  const own = defaultOf({ default: null }, list);
  return [policy && policy.default, own].find(permits) || (list.find((/** @type {any} */ r) => permits(r.name) && isInstalled(r)) || {}).name || null;
}

/** @param {unknown} a @param {unknown} b */
export const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** "Saved" beside a field for ms, only while it shows exactly what the server took. @param {number} ms @param {() => void} onClear */
export function receipts(ms, onClear) {
  /** @type {{ field: string, value: unknown } | null} */
  let cur = null;
  return {
    get field() { return cur && cur.field; },
    /** @param {string} field @param {unknown} now */
    says(field, now) { return !!cur && cur.field === field && sameValue(cur.value, now); },
    /** @param {string} field @param {unknown} value */
    set(field, value) {
      const r = { field, value };
      cur = r;
      const t = setTimeout(() => { if (cur === r) { cur = null; onClear(); } }, ms);
      /** @type {any} */ (t).unref?.();
    },
    clear() { cur = null; },
  };
}

/** @param {{ world: any, announce: (words: string) => void, PROJ?: unknown }} deps */
export function createRuntimeSettings({ world, announce, PROJ }) {
  /** @type {{ timer: any, err: { field: string, text: string } | null, saved: ReturnType<typeof receipts>, saving: string | null, pref: string | null, next: any }} */
  const R = { timer: null, err: null, saved: receipts(1600, () => { if (onScreen()) draw(); }), saving: null, pref: null, next: null };
  /** @type {{ err: { key: string, text: string } | null, saving: string | null, saved: ReturnType<typeof receipts> }} */
  const P = { err: null, saving: null, saved: receipts(1600, () => { if (onScreen()) draw(); }) };
  const paidKey = (/** @type {string} */ k) => `paid:${k}`;
  const page = () => document.querySelector('[data-page="runtimes"]');
  const live = () => page()?.querySelector(".set-live");
  const onScreen = () => { const p = /** @type {HTMLElement | null} */ (page()); return !!p && !p.hidden && !/** @type {HTMLElement} */ (document.querySelector("#settings")).hidden; };
  const rts = () => /** @type {any[]} */ (world.state.runtimes || []);
  const installed = () => rts().filter(isInstalled);

  /** @param {any} rt @param {any[]} paidRows */
  function cardHtml(rt, paidRows = []) {
    const h = rt.health || {}, hl = healthOf(rt);
    const ver = h.cli_version || (rt.cli && rt.cli.version);
    const acct = h.logged_in ? `Logged in${h.account ? ` as <span class="rt-acct">${esc(h.account)}</span>` : ""}` : "";
    const wins = windowsOf(rt);
    const meters = wins.map((/** @type {any} */ w) => {
      const tone = w.state === "closed" ? "bad" : w.state === "warn" || w.state === "paid" ? "warn" : "ok";
      const word = w.state === "closed" ? "At limit" : w.state === "paid" ? "Paid usage" : w.utilization != null ? `${pct(w.utilization)} used` : w.state === "warn" ? "Near limit" : "Open";
      const reset = w.resetsAt ? `${w.state === "closed" ? "Opens" : "Resets"} ${resetWords(w.resetsAt)}` : "";
      return `<li class="rt-w t-${tone}"><span class="rt-wn">${esc(w.name)}</span>` +
        (w.utilization != null || w.state === "closed" ? `<span class="rt-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((w.utilization ?? 1) * 100)}" aria-label="${esc(w.name)}: ${esc(word)}"><i style="--u:${w.utilization ?? 1}"></i></span>` : `<span class="rt-bar is-none"></span>`) +
        `<span class="rt-wu">${esc(word)}</span><span class="rt-wr">${esc(reset)}</span></li>`;
    }).join("");
    const trouble = hl.tone === "off" || hl.tone === "bad";
    return `<li class="rt-card${trouble ? " is-down" : ""}">` +
      `<div class="rt-hd"><b>${esc(rtName(rt.name))}</b>${ver ? `<span class="rt-v">${esc(ver)}</span>` : ""}${rt.default ? `<span class="rt-v">XO's own</span>` : ""}${onPaid(paidRows, rt.name) ? `<span class="rt-v rt-paid">On paid usage</span>` : ""}<span class="rt-pill t-${hl.tone}">${esc(hl.word)}</span></div>` +
      (acct ? `<p class="rt-sub">${acct}</p>` : "") +
      (hl.why || hl.fix ? `<p class="rt-why">${esc(hl.why)}${hl.fix ? ` <span class="rt-fix">${fixHtml(hl.fix)}</span>` : ""}</p>` : "") +
      (meters ? `<ul class="rt-ws" aria-label="${esc(rtName(rt.name))}'s usage">${meters}</ul>` : "") + `</li>`;
  }
  const fixHtml = (/** @type {string} */ s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  function listHtml() {
    if (!world.state.runtimes) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    if (!rts().length) return `<p class="set-empty"><b>No runtimes.</b> XO didn't list any agent runtime on this server.</p>`;
    const at = rts().map((r) => r.health && r.health.checked_at).filter(Boolean).sort().pop();
    const pr = paidRows();
    return `<ul class="rt-list">${rts().map((r) => cardHtml(r, pr)).join("")}</ul>` +
      `<p class="rt-checked">${at ? `Checked at ${esc(clockWords(at))}. ` : ""}Read again every 30 seconds while this page is open.</p>`;
  }

  const space = () => ({ ...blank(), ...((world.state.policy && world.state.policy.space) || {}) });
  const shown = () => R.next || space();
  /** @param {Record<string, unknown>} patch @param {string} field @param {string} words @returns {Promise<boolean>} */
  async function put(patch, field, words) {
    if (isPending(POLICY)) return false;
    const next = { ...space(), ...patch };
    if (next.preferences != null && !String(next.preferences).trim()) next.preferences = null;
    R.err = null; R.next = next; R.saving = field; R.saved.clear();
    const p = once(POLICY, async () => {
      try { await world.act.setPolicy(null, next); }
      catch (/** @type {any} */ err) { R.err = { field: errorField(err) === "form" ? field : errorField(err), text: err.message }; return false; }
      finally { R.next = null; R.saving = null; }
      R.saved.set(field, next[field]); announce(words);
      return true;
    });
    draw();
    const ok = await p;
    draw();
    // a draft left while this save was out goes now, read from the page as it settles, unless you're typing there
    const draft = R.pref == null ? undefined : (R.pref.trim() || null);
    const active = /** @type {any} */ (document.activeElement);
    const typing = active && active.matches && active.matches("[data-rtd-pref]");
    if (draft !== undefined && draft !== (next.preferences ?? null) && !typing) savePref();
    return ok;
  }
  /** @param {string} f */
  const fieldNow = (f) => (f === "preferences" && R.pref != null ? (R.pref.trim() || null) : shown()[f]);
  function defaultsHtml() {
    if (!world.state.policy) return "";
    const p = shown(), names = installed().map((r) => r.name);
    if (names.length < 2 && !p.allowed) return "";
    const allowed = allowedOf(p, rts());
    const usual = usualOf(p, rts());
    const note = (/** @type {string} */ f) => (R.err && R.err.field === f ? `<p class="rt-ferr" role="alert">${esc(R.err.text)}</p>`
      : R.saving === f ? `<span class="rt-saved is-saving" role="status">Saving…</span>`
        : R.saved.says(f, fieldNow(f)) ? `<span class="rt-saved" role="status">Saved</span>` : "");
    const busy = busyAttrs(POLICY);
    /** @param {string} f @param {string} label @param {string} sub @param {string} ctl */
    const row = (f, label, sub, ctl) => `<div class="set-row rt-def"><div class="set-l"><b id="rtd-${f}">${label}</b><span>${sub}</span>${note(f)}</div>${ctl}</div>`;
    return `<section class="set-sec" aria-labelledby="rtsp-h"><h3 id="rtsp-h">Defaults</h3>` +
      `<p class="set-lead">Each thread runs on one runtime for its whole life. A project or a thread picks its own in the composer, beside its model.</p>` +
      `<div class="rt-defs">` +
      row("default", "Usual runtime", "Where new work runs when its coordinator doesn't choose.",
        `<div class="rt-seg" role="radiogroup" aria-labelledby="rtd-default">${allowed.map((/** @type {string} */ n, /** @type {number} */ i) => `<button type="button" role="radio" aria-checked="${usual === n}" data-rtd-default="${esc(n)}"${rovingTab(usual === n, i === 0 && !allowed.includes(usual))}${busy}>${esc(rtName(n))}</button>`).join("")}</div>`) +
      row("allowed", "Runtimes XO may use", "Work never goes to a runtime you turn off: no thread starts or moves there.",
        `<div class="rt-checks" role="group" aria-labelledby="rtd-allowed">${names.map((/** @type {string} */ n) => `<label class="rt-check"><input type="checkbox" data-rtd-allowed="${esc(n)}"${allowed.includes(n) ? " checked" : ""}${busy}><span>${esc(rtName(n))}</span></label>`).join("")}</div>`) +
      row("fallback", "Start elsewhere at a limit", "When a runtime can't take work, a new thread may start on another one. <strong>It goes to another provider without asking you.</strong>",
        `<button type="button" class="switch" role="switch" aria-checked="${!!p.fallback}" aria-labelledby="rtd-fallback" data-rtd-fallback${busy}><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button>`) +
      `<div class="set-row rt-def is-col"><div class="set-l"><label for="rtd-pref"><b id="rtd-preferences">How coordinators choose</b></label><span>In your words, read when a coordinator on Auto picks a runtime for a new thread.</span>${note("preferences")}</div>` +
      `<div class="field"><textarea id="rtd-pref" rows="2" maxlength="${PREF_MAX}" data-rtd-pref placeholder="Refactors and tests on Codex, UI work on Claude Code.">${esc(R.pref != null ? R.pref : p.preferences || "")}</textarea></div></div>` +
      `</div></section>`;
  }

  const held = () => heldModes(world.state.paid);
  const paidRows = () => accountRows({ advisory: world.state.advisory, held: held(), pools: world.state.pools, served: world.state.paidPools });
  /** @param {string} scope @param {any} row @returns {string} */
  const choiceNow = (scope, row) => (scope === "space" ? effectiveMode(held(), "").mode : row.own || "same");
  function paidHtml() {
    if (!world.state.paidOk) return "";
    const space = effectiveMode(held(), "").mode, rows = paidRows();
    /** @param {string} k @param {unknown} now */
    const note = (k, now) => (P.err && P.err.key === k ? `<p class="rt-ferr" role="alert">${esc(P.err.text)}</p>`
      : P.saving === k ? `<span class="rt-saved is-saving" role="status">Saving…</span>`
        : P.saved.says(k, now) ? `<span class="rt-saved" role="status">Saved</span>` : "");
    /** @param {string} k @param {string} labelId @param {string} scope @param {string} pool @param {string} now @param {string[][]} choices */
    const seg = (k, labelId, scope, pool, now, choices) => `<div class="rt-seg is-paid" role="radiogroup" aria-labelledby="${labelId}">${choices.map(([v, name], i) =>
      `<button type="button" role="radio" aria-checked="${now === v}" data-paid-scope="${scope}"${pool ? ` data-paid-pool="${esc(pool)}"` : ""} data-paid-val="${v}"${rovingTab(now === v, i === 0 && !choices.some(([x]) => x === now))}${busyAttrs(paidKey(k))}>${esc(name)}</button>`).join("")}</div>`;
    const modes = MODES.map((m) => [m, MODE_NAME[m]]);
    const spaceRow = `<div class="set-row rt-def"><div class="set-l"><b id="rtp-space">All accounts</b><span>${esc(MODE_SUB[space])}</span>${note("space", space)}</div>` +
      seg("space", "rtp-space", "space", "", space, modes) + `</div>`;
    const acct = rows.map((/** @type {any} */ r, /** @type {number} */ i) => {
      const id = `rtp-a${i}`, now = choiceNow("pool", r);
      const facts = [r.possible === false ? (r.why || "It can’t go on to paid usage.") : r.possible === null ? "XO can’t tell whether it can go on to paid usage." : "",
        r.credits != null && r.possible !== false ? `${creditsWords(r.credits)} left.` : "", r.note].filter(Boolean).join(" ");
      const mode = r.own ? MODE_SUB[r.mode] : `Same as all accounts: ${MODE_NAME[r.mode]}.`;
      return `<div class="set-row rt-def"><div class="set-l"><b id="${id}">${esc(r.name)}${r.plan ? ` · ${esc(r.plan)}` : ""}${r.inUse ? ` <span class="rt-v rt-paid">On paid usage</span>` : ""}</b>` +
        `<span>${esc([facts, mode].filter(Boolean).join(" "))}</span>${note(r.pool, now)}</div>` +
        seg(r.pool, id, "pool", r.pool, now, [["same", "Same as all"], ...modes]) + `</div>`;
    }).join("");
    return `<section class="set-sec" aria-labelledby="rtp-h"><h3 id="rtp-h">Paid usage</h3>` +
      `<p class="set-lead">When an account’s plan runs out it may go on to paid usage. You choose here whether XO lets work go on, for every account or for one.</p>` +
      `<div class="rt-defs">${spaceRow}${acct}</div></section>`;
  }
  /** @param {string} scope @param {string} pool @param {string} val */
  async function choosePaid(scope, pool, val) {
    const k = scope === "space" ? "space" : pool, key = paidKey(k);
    const row = scope === "space" ? null : paidRows().find((/** @type {any} */ r) => r.pool === pool);
    if (isPending(key) || (scope !== "space" && !row) || val === choiceNow(scope, row)) return;
    const value = val === "same" ? null : val;
    P.err = null; P.saving = k; P.saved.clear();
    const p = once(key, async () => {
      try { await world.act.setPaid(scope, pool, value); }
      catch (/** @type {any} */ err) { P.err = { key: k, text: err.message }; return false; }
      finally { P.saving = null; }
      P.saved.set(k, val);
      const who = scope === "space" ? "Paid usage" : `${row.name} paid usage`;
      announce(value ? `${who}: ${MODE_NAME[value]}. ${MODE_SUB[value]}` : `${who} follows all accounts.`);
      return true;
    });
    draw();
    await p;
    draw();
  }

  function draw() {
    const el = live();
    if (el) redraw(el, `<section class="set-sec" aria-labelledby="rtl-h"><h3 id="rtl-h">On this machine</h3><div class="rt-live">${listHtml()}</div></section>` + paidHtml() + defaultsHtml());
  }
  function drawList() { const l = live()?.querySelector(".rt-live"); if (l) redraw(l, listHtml()); else draw(); }

  async function refresh() {
    clearTimeout(R.timer);
    if (!onScreen()) return;
    try { await world.act.loadRuntimes(); } catch { /* the cards keep the last reading */ }
    if (!onScreen()) return;
    drawList();
    R.timer = setTimeout(refresh, REFRESH_MS);
  }

  const root = /** @type {HTMLElement} */ (document.querySelector("#settings"));
  root.addEventListener("click", (/** @type {any} */ e) => {
    const pd = e.target.closest?.("[data-paid-val]");
    if (pd) { choosePaid(pd.dataset.paidScope, pd.dataset.paidPool || "", pd.dataset.paidVal); return; }
    // a box can't change while a save is out: aria-disabled doesn't stop a checkbox
    if (e.target.matches?.("[data-rtd-allowed]") && isPending(POLICY)) { e.preventDefault(); return; }
    const d = e.target.closest("[data-rtd-default]");
    // choosing XO's own runtime stores null, as XO does
    if (d && !isPending(POLICY)) { const n = d.dataset.rtdDefault; if (n !== usualOf(space(), rts())) put({ default: n === defaultOf({ default: null }, rts()) ? null : n }, "default", `New work runs on ${rtName(n)} unless its coordinator chooses.`); return; }
    const f = e.target.closest("[data-rtd-fallback]");
    if (f && !isPending(POLICY)) { const on = !space().fallback; put({ fallback: on }, "fallback", on ? "A new thread may start on another runtime at a limit." : "A new thread waits for its runtime at a limit."); }
  });
  root.addEventListener("change", (/** @type {any} */ e) => {
    if (!e.target.matches("[data-rtd-allowed]") || isPending(POLICY)) return;
    const names = installed().map((r) => r.name);
    const picked = [.../** @type {Element} */ (live()).querySelectorAll("[data-rtd-allowed]:checked")].map((x) => /** @type {HTMLElement} */ (x).dataset.rtdAllowed);
    if (!picked.length) { e.target.checked = true; R.err = { field: "allowed", text: "Keep at least one runtime." }; draw(); return; }
    const p = space();
    const allowed = picked.length === names.length ? null : picked;
    put({ allowed, ...(p.default && !picked.includes(p.default) ? { default: null } : {}) }, "allowed", allowed ? `XO uses only ${picked.map(rtName).join(" and ")}.` : "XO may use every runtime.");
  });
  root.addEventListener("input", (/** @type {any} */ e) => { if (e.target.matches("[data-rtd-pref]")) R.pref = e.target.value; });
  // leaving the field saves it; the draft stays until the save lands
  root.addEventListener("focusout", (/** @type {any} */ e) => { if (e.target.matches("[data-rtd-pref]")) savePref(); });
  async function savePref() {
    if (R.pref == null) return;
    if (isPending(POLICY)) return;
    const v = R.pref;
    if ((v.trim() || null) === (space().preferences || null)) { R.pref = null; draw(); return; }
    const ok = await put({ preferences: v.trim() || null }, "preferences", "Saved. Coordinators read it when they choose.");
    // typed on while it saved: that's the new draft, still to save
    if (ok && R.pref === v) { R.pref = null; draw(); }
  }
  // a new reading from elsewhere shows while the page is open, never mid-typing
  if (world.subscribe) {
    let sig = "";
    world.subscribe(() => {
      if (!onScreen()) return;
      const st = world.state;
      const next = JSON.stringify([st.policy, st.paidOk, st.paid, st.paidPools, paidRows().map((/** @type {any} */ r) => [r.pool, r.name, r.plan, r.possible, r.inUse, r.credits, r.why, r.state, r.note])]);
      if (next === sig) return;
      sig = next;
      if (!isPending(POLICY) && R.pref == null) draw();
    });
  }

  return {
    open() {
      R.err = null;
      draw();
      refresh();
      world.act.loadPolicies?.().then(() => { if (onScreen() && R.pref == null) draw(); });
      world.act.loadPaid?.().then(() => { if (onScreen() && R.pref == null) draw(); });
    },
  };
}
