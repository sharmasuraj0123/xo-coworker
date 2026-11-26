// @ts-check

/** @import {Runtime, RuntimePolicy, RuntimeError} from "../../core/services/runtime-types" */

/** @import {SettingsState, PaidRow} from "./settings-types" */

import { esc, reportFailure } from "../../core/platform/util.js";
import { clockWords, rtName, isInstalled, allowedOf, defaultOf, errorField } from "../../core/services/runtimes.js";
import { once, isPending, busyAttrs } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { rovingTab, menuKeys, focusOpened } from "../../core/ui/a11y/keynav.js";
import { MODES, MODE_NAME, MODE_SUB, heldModes, effectiveMode, accountRows, onPaid, creditsWords } from "../../core/services/world/paid.js";
import { receipts } from "./receipts.js";
import { rowHtml } from "./rows.js";

const REFRESH_MS = 30000;
const PREF_MAX = 2000;
/** @returns {RuntimePolicy} */
const blank = () => ({ allowed: null, default: null, preferences: null, fallback: null });
const POLICY = "runtime-policy";

/** @param {RuntimePolicy | null | undefined} policy @param {Runtime[] | null | undefined} rts */
export function usualOf(policy, rts) {
  const list = rts || [];
  const permits = (/** @type {string | null | undefined} */ a) => !!a && !(policy && Array.isArray(policy.allowed) && !policy.allowed.includes(a));
  const own = defaultOf({ default: null }, list);
  return [policy && policy.default, own].find(permits) || list.find((r) => permits(r.name) && isInstalled(r))?.name || null;
}

/** @param {import("./settings-types").RuntimeSettingsDeps} deps */
export function createRuntimeSettings({ world, announce, scope: lifetime, root, life, uninstall }) {
  const { signal } = lifetime;
  /** @type {SettingsState} */
  const R = { err: null, saved: receipts(lifetime, 1600, () => { if (onScreen()) draw(); }), saving: null, pref: null, next: null };
  /** @type {{ err: { key: string, text: string } | null, saving: string | null, saved: ReturnType<typeof receipts> }} */
  const P = { err: null, saving: null, saved: receipts(lifetime, 1600, () => { if (onScreen()) draw(); }) };
  const paidKey = (/** @type {string} */ k) => `paid:${k}`;
  const page = root.querySelector('[data-page="runtimes"]'), mount = page?.querySelector(".set-live");
  if (!(page instanceof HTMLElement) || !mount) throw new Error("Runtimes page is missing");
  const live = mount;
  const onScreen = () => !signal.aborted && !page.hidden && !root.hidden;
  lifetime.effect(() => () => live.replaceChildren());
  const rts = () => world.state.runtimes || [];
  const installed = () => rts().filter(isInstalled);

  /** @type {string | null} */
  let menuFor = null;
  /** @param {Runtime} rt @param {PaidRow[]} paidRows */
  const cardHtml = (rt, paidRows) => rowHtml(rt, {
    flow: life.flow(rt.name), job: life.job(rt.name), settling: life.settling(rt.name), err: life.err(rt.name),
    remote: life.remote(rt.name), menuOpen: menuFor === rt.name,
    extra: onPaid(paidRows, rt.name) ? `<span class="rt-v rt-paid">On paid usage</span>` : "",
  });
  function listHtml() {
    if (!world.state.runtimes) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    if (!rts().length) return `<p class="set-empty"><b>No runtimes.</b> XO didn't list any agent runtime on this server.</p>`;
    const at = rts().map((r) => r.health && r.health.checked_at).filter(Boolean).sort().pop();
    const pr = paidRows();
    return `<ul class="rt-list">${rts().map((r) => cardHtml(r, pr)).join("")}</ul>` +
      `<p class="rt-checked">${at ? `Checked at ${esc(clockWords(at))}. ` : ""}Read again every 30 seconds while this page is open, ` +
      "and at once when one is installed or signs in.</p>";
  }

  const space = () => ({ ...blank(), ...((world.state.policy && world.state.policy.space) || {}) });
  const shown = () => R.next || space();
  /** @param {RuntimePolicy} patch @param {keyof RuntimePolicy} field @param {string} words @returns {Promise<boolean>} */
  async function put(patch, field, words) {
    if (isPending(POLICY)) return false;
    const next = { ...space(), ...patch };
    if (next.preferences != null && !String(next.preferences).trim()) next.preferences = null;
    R.err = null; R.next = next; R.saving = field; R.saved.clear();
    const p = once(POLICY, async () => {
      try { await world.act.setPolicy(null, next); }
      catch (err) {
        const failure = /** @type {RuntimeError} */ (err), at = errorField(failure);
        if (!signal.aborted) R.err = { field: at === "form" ? field : at, text: failure.message ?? "" };
        return false;
      }
      finally { R.next = null; R.saving = null; }
      if (signal.aborted) return false;
      R.saved.set(field, next[field]); announce(words);
      return true;
    });
    draw();
    const ok = await p;
    if (signal.aborted) return false;
    draw();
    const draft = R.pref == null ? undefined : (R.pref.trim() || null);
    if (draft !== undefined && draft !== (next.preferences ?? null) && !document.activeElement?.matches("[data-rtd-pref]")) savePref();
    return ok;
  }
  /** @param {keyof RuntimePolicy} f */
  const fieldNow = (f) => (f === "preferences" && R.pref != null ? (R.pref.trim() || null) : shown()[f]);
  function defaultsHtml() {
    if (!world.state.policy) return "";
    const p = shown(), names = installed().map((r) => r.name);
    if (names.length < 2 && !p.allowed) return "";
    const allowed = allowedOf(p, rts());
    const usual = usualOf({ ...p, default: null }, rts());
    const picked = p.default && allowed.includes(p.default) ? p.default : "", auto = !picked && !!usual;
    const note = (/** @type {keyof RuntimePolicy} */ f) => (R.err && R.err.field === f ? `<p class="rt-ferr" role="alert">${esc(R.err.text)}</p>`
      : R.saving === f ? `<span class="rt-saved is-saving" role="status">Saving…</span>`
        : R.saved.says(f, fieldNow(f)) ? `<span class="rt-saved" role="status">Saved</span>` : "");
    const busy = busyAttrs(POLICY), lead = "Where new work runs when its coordinator doesn't choose.";
    const usualSub = auto ? `${lead} On Auto that's ${esc(rtName(usual))} now: the Space's own runtime, ` +
      "else the first one signed in. Pick one to keep it." : lead;
    const seg = ["", ...allowed].map((n) => `<button type="button" role="radio" aria-checked="${picked === n}" ` +
      `data-rtd-default="${esc(n)}"${rovingTab(picked === n)}${busy}>${n ? esc(rtName(n)) : "Auto"}</button>`).join("");

    /** @param {keyof RuntimePolicy} f @param {string} label @param {string} sub @param {string} ctl */
    const row = (f, label, sub, ctl) => `<div class="set-row rt-def"><div class="set-l"><b id="rtd-${f}">${label}</b><span>${sub}</span>${note(f)}</div>${ctl}</div>`;
    return `<section class="set-sec" aria-labelledby="rtsp-h"><h3 id="rtsp-h">Defaults</h3>` +
      `<p class="set-lead">Each thread runs on one runtime for its whole life. A project or a thread picks its own in the composer, beside its model.</p>` +
      `<div class="rt-defs">` +
      row("default", "Usual runtime", usualSub, `<div class="rt-seg" role="radiogroup" aria-labelledby="rtd-default">${seg}</div>`) +
      row("allowed", "Runtimes XO may use", "Work never goes to a runtime you turn off: no thread starts or moves there.",
        `<div class="rt-checks" role="group" aria-labelledby="rtd-allowed">${names.map((/** @type {string} */ n) => `<label class="rt-check"><input type="checkbox" data-rtd-allowed="${esc(n)}"${allowed.includes(n) ? " checked" : ""}${busy}><span>${esc(rtName(n))}</span></label>`).join("")}</div>`) +
      row("fallback", "Start elsewhere at a limit", "When a runtime can't take work, a new thread may start on another one. <strong>It goes to another provider without asking you.</strong>",
        `<button type="button" class="switch" role="switch" aria-checked="${!!p.fallback}" aria-labelledby="rtd-fallback" data-rtd-fallback${busy}><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button>`) +
      `<div class="set-row rt-def is-col"><div class="set-l"><label for="rtd-pref"><b id="rtd-preferences">How coordinators choose</b></label><span>In your words, read when a coordinator on Auto picks a runtime for a new thread.</span>${note("preferences")}</div>` +
      `<div class="field"><textarea id="rtd-pref" rows="2" maxlength="${PREF_MAX}" data-rtd-pref placeholder="Refactors and tests on Codex, UI work on Claude Code.">${esc(R.pref != null ? R.pref : p.preferences || "")}</textarea></div></div>` +
      `</div></section>`;
  }

  const held = () => heldModes(world.state.paid);
  /** @returns {PaidRow[]} */
  const paidRows = () => accountRows({ advisory: world.state.advisory, held: held(), pools: world.state.pools, served: world.state.paidPools });
  /** @param {string} scope @param {PaidRow | null | undefined} row */
  const choiceNow = (scope, row) => (scope === "space" ? effectiveMode(held(), "").mode : row?.own || "same");
  function paidHtml() {
    if (!world.state.paidOk) return "";
    const spaceMode = effectiveMode(held(), "").mode, rows = paidRows();
    /** @param {string} k @param {unknown} now */
    const note = (k, now) => (P.err && P.err.key === k ? `<p class="rt-ferr" role="alert">${esc(P.err.text)}</p>`
      : P.saving === k ? `<span class="rt-saved is-saving" role="status">Saving…</span>`
        : P.saved.says(k, now) ? `<span class="rt-saved" role="status">Saved</span>` : "");
    /** @param {string} k @param {string} labelId @param {string} scope @param {string} pool @param {string} now @param {string[][]} choices */
    const seg = (k, labelId, scope, pool, now, choices) => `<div class="rt-seg is-paid" role="radiogroup" aria-labelledby="${labelId}">${choices.map(([v, name], i) =>
      `<button type="button" role="radio" aria-checked="${now === v}" data-paid-scope="${scope}"${pool ? ` data-paid-pool="${esc(pool)}"` : ""} data-paid-val="${v}"${rovingTab(now === v, i === 0 && !choices.some(([x]) => x === now))}${busyAttrs(paidKey(k))}>${esc(name)}</button>`).join("")}</div>`;
    const modes = MODES.map((m) => [m, MODE_NAME[m]]);
    const spaceRow = `<div class="set-row rt-def"><div class="set-l"><b id="rtp-space">All accounts</b><span>${esc(MODE_SUB[spaceMode])}</span>${note("space", spaceMode)}</div>` +
      seg("space", "rtp-space", "space", "", spaceMode, modes) + `</div>`;
    const acct = rows.map((r, i) => {
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
  /** @param {string} area @param {string} pool @param {string} val */
  async function choosePaid(area, pool, val) {
    const k = area === "space" ? "space" : pool, key = paidKey(k);
    const row = area === "space" ? null : paidRows().find((r) => r.pool === pool);
    if (isPending(key) || (area !== "space" && !row) || val === choiceNow(area, row)) return;
    const value = val === "same" ? null : val;
    P.err = null; P.saving = k; P.saved.clear();
    const p = once(key, async () => {
      try { await world.act.setPaid(area, pool, value); }
      catch (err) {
        if (!signal.aborted) P.err = { key: k, text: (/** @type {RuntimeError} */ (err)).message ?? "" };
        return false;
      }
      finally { P.saving = null; }
      if (signal.aborted) return false;
      P.saved.set(k, val);
      const who = row ? `${row.name} paid usage` : "Paid usage";
      announce(value ? `${who}: ${MODE_NAME[value]}. ${MODE_SUB[value]}` : `${who} follows all accounts.`);
      return true;
    });
    draw();
    await p;
    draw();
  }

  function draw() {
    if (signal.aborted) return;
    redraw(live, `<section class="set-sec" aria-labelledby="rtl-h"><h3 id="rtl-h">On this machine</h3><div class="rt-live">${listHtml()}</div></section>` + paidHtml() + defaultsHtml());
  }
  function drawList() { const l = live.querySelector(".rt-live"); if (l) redraw(l, listHtml()); else draw(); }
  /** @type {(() => void) | undefined} */
  let cancelRefresh;
  let refreshing = false;
  async function refresh() {
    cancelRefresh?.();
    if (!onScreen() || refreshing) return;
    refreshing = true;
    try { await world.act.loadRuntimes(); }
    catch (error) { if (!signal.aborted) reportFailure(error); }
    finally { refreshing = false; }
    if (!onScreen()) return;
    drawList();
    cancelRefresh = lifetime.timeout(refresh, REFRESH_MS);
  }

  const menuButton = (name = "") => live.querySelector(`[data-rt-act="menu"][data-rt="${CSS.escape(name)}"]`);

  function setMenu(name = /** @type {string | null} */ (null), focus = false) {
    if (menuFor === name) return;
    const was = menuFor;
    menuFor = name;
    drawList();
    const back = focus && was ? menuButton(was) : null;
    if (name) focusOpened(/** @type {HTMLElement | null} */ (live.querySelector(".rt-menu")));
    else if (back instanceof HTMLElement) back.focus();
  }
  lifetime.effect(() => menuKeys(live, { close: () => setMenu(null, true) }));
  lifetime.listen(document, "pointerdown", (e) => {
    if (menuFor && !(e.target instanceof Element && e.target.closest(".rt-more"))) setMenu(null);
  });
  /** @param {HTMLElement} b */
  function rowAct(b) {
    const name = b.dataset.rt || "", id = b.dataset.rtAct;
    if (!name || !id) return;
    if (id === "menu") { setMenu(menuFor === name ? null : name); return; }
    if (b.getAttribute("aria-disabled") === "true") return;
    if (menuFor) setMenu(null);
    switch (id) {
      case "open": { const f = life.flow(name); if (f?.code) copy(f.code); life.opened(name); return; }
      case "sign_in": void life.signIn(name); return;
      case "cancel": life.cancelSignIn(name); return;
      case "install": case "update": case "sign_out": void life.run(name, id); return;
      case "retry": life.retry(name); return;
      case "uninstall": uninstall(name, menuButton(name)); return;
      case "log": life.toggleLog(name); return;
      case "rc_on": case "rc_off": void life.setRemote(name, id === "rc_on");
    }
  }
  /** @param {string} code */
  function copy(code) {
    navigator.clipboard?.writeText(code).then(() => announce("Code copied."), (error) => {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) reportFailure(error);
    });
  }
  lifetime.listen(live, "submit", (e) => {
    const form = e.target instanceof Element ? e.target.closest("form[data-rt-form]") : null;
    if (!(form instanceof HTMLFormElement)) return;
    e.preventDefault();
    const input = form.querySelector('input[name="code"]');
    if (input instanceof HTMLInputElement && form.dataset.rtForm) void life.sendCode(form.dataset.rtForm, input.value.trim());
  });
  lifetime.listen(live, "click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const ra = target?.closest("[data-rt-act]");
    if (ra instanceof HTMLElement) { if (ra.dataset.rtAct !== "open") e.preventDefault(); rowAct(ra); return; }
    const pd = target?.closest("[data-paid-val]");
    if (pd instanceof HTMLElement && pd.dataset.paidScope && pd.dataset.paidVal) { choosePaid(pd.dataset.paidScope, pd.dataset.paidPool || "", pd.dataset.paidVal); return; }
    if (target?.matches("[data-rtd-allowed]") && isPending(POLICY)) { e.preventDefault(); return; }
    const d = target?.closest("[data-rtd-default]");
    if (d && !isPending(POLICY)) {
      const n = (/** @type {HTMLElement} */ (d)).dataset.rtdDefault || null;
      const auto = rtName(usualOf({ ...space(), default: null }, rts()));
      const words = n ? `New work runs on ${rtName(n)} unless its coordinator chooses.` : `Auto: new work runs on ${auto} now.`;
      if (n !== (space().default || null)) put({ default: n }, "default", words);
      return;
    }
    const f = target?.closest("[data-rtd-fallback]");
    if (f && !isPending(POLICY)) { const on = !space().fallback; put({ fallback: on }, "fallback", on ? "A new thread may start on another runtime at a limit." : "A new thread waits for its runtime at a limit."); }
  });
  lifetime.listen(live, "change", (e) => {
    if (!(e.target instanceof Element) || !e.target.matches("input[data-rtd-allowed]") || isPending(POLICY)) return;
    const names = installed().map((r) => r.name);
    const picked = [...live.querySelectorAll("[data-rtd-allowed]:checked")].map((x) => /** @type {HTMLElement} */ (x).dataset.rtdAllowed).filter((name) => name !== undefined);
    if (!picked.length) { /** @type {HTMLInputElement} */ (e.target).checked = true; R.err = { field: "allowed", text: "Keep at least one runtime." }; draw(); return; }
    const p = space();
    const allowed = picked.length === names.length ? null : picked;
    put({ allowed, ...(p.default && !picked.includes(p.default) ? { default: null } : {}) }, "allowed", allowed ? `XO uses only ${picked.map(rtName).join(" and ")}.` : "XO may use every runtime.");
  });
  lifetime.listen(live, "input", (e) => {
    const field = e.target;
    if (field instanceof Element && field.matches("textarea[data-rtd-pref]")) {
      R.pref = (/** @type {HTMLTextAreaElement} */ (field)).value;
    }
  });
  lifetime.listen(live, "focusout", (e) => { if (e.target instanceof Element && e.target.matches("[data-rtd-pref]")) savePref(); });
  async function savePref() {
    if (R.pref == null) return;
    if (isPending(POLICY)) return;
    const v = R.pref;
    if ((v.trim() || null) === (space().preferences || null)) { R.pref = null; draw(); return; }
    const ok = await put({ preferences: v.trim() || null }, "preferences", "Saved. Coordinators read it when they choose.");
    if (ok && R.pref === v) { R.pref = null; draw(); }
  }
  let sig = "", rtSig = "";
  lifetime.effect(() => life.subscribe(() => {
    if (onScreen()) drawList();
  }));
  lifetime.effect(() => world.subscribe?.(() => {
    const list = world.state.runtimes;
    const nextRt = JSON.stringify(list || null);
    if (nextRt !== rtSig) { rtSig = nextRt; life.sync(list); if (onScreen()) drawList(); }
    if (!onScreen()) return;
    const st = world.state;
    const rows = paidRows().map((r) => [r.pool, r.name, r.plan, r.possible, r.inUse, r.credits, r.why, r.state, r.note]);
    const next = JSON.stringify([st.policy, st.paidOk, st.paid, st.paidPools, rows]);
    if (next === sig) return;
    sig = next;
    if (!isPending(POLICY) && R.pref == null) draw();
  }));
  return {
    open() {
      if (signal.aborted) return;
      R.err = null;
      draw();
      refresh().then(() => life.readRemotes(world.state.runtimes), reportFailure);
      const redrawOpen = () => { if (onScreen() && R.pref == null) draw(); };
      const reportLive = (/** @type {unknown} */ error) => { if (!signal.aborted) reportFailure(error); };
      world.act.loadPolicies?.().then(redrawOpen, reportLive);
      world.act.loadPaid?.().then(redrawOpen, reportLive);
      const keys = [POLICY, paidKey("space"), ...paidRows().map((row) => paidKey(row.pool))];
      for (const key of keys) if (isPending(key)) once(key, () => {}).then(redrawOpen, reportLive);
    },
  };
}
