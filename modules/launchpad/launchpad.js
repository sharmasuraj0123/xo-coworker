// @ts-check
import { esc } from "../../core/platform/index.js";
import { xi } from "../../core/ui/icons/icon.js";
import { pointerFollows } from "../../core/ui/a11y/keynav.js";
import { redraw } from "../../core/ui/redraw.js";
import { LP_ICON, CACHE, NODES, since, sizeHint, failWords } from "./words.js";
import { installStore } from "./store.js";
import { installViews } from "./views.js";
import { installActions } from "./actions.js";
import { createWindowNotices } from "./notices.js";

export { LP_ICON };

/** @typedef {{ api: any, projectOf: (v: string | null) => string | null, nameOf?: (p: string) => string, findThread?: (p: string, id?: string) => any, go?: (v: string) => void, announce: (s: string) => void, notify?: (text: string, undo?: (() => void) | null, kind?: string) => void, notice?: (mid: string, line: any, ms: number) => void, unnotice?: (mid: string) => void, onChange?: () => void }} LaunchpadDeps */

/** @param {LaunchpadDeps} deps */
export function createLaunchpad({ api, projectOf, nameOf = (p) => p, findThread = () => null, go, announce, notify, notice, unnotice, onChange }) {
  const P = new Map();
  /** @type {Record<string, string>} */
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}") || {}; } catch { /* private mode */ }
  const S = /** @type {any} */ ({ el: null, hs: null, nav: null, notes: null, body: null, key: "", html: "", v: null, shown: null, want: "", lost: [] });
  const { say, unsay, tell, handOver, undoNotice } = createWindowNotices(S, { notify, notice, unnotice });

  /** @param {string} sel */
  const land = (sel) => { S.want = sel; };
  /** @param {{ stopping?: ReturnType<typeof setTimeout> | 0, mid?: string } | null} run */
  const endStop = (run) => { if (!run) return; if (run.stopping) { clearTimeout(run.stopping); run.stopping = 0; } unsay(run.mid); };

  /** @param {string} p */
  const proj = (p) => {
    if (!P.has(p)) P.set(p, { check: null, at: 0, pre: 0, loading: false, err: null, run: null, form: null, device: null, picking: null, asked: null, asking: false, askErr: null, needs: null, warn: null, menu: false, copied: 0, cmdCopied: 0 });
    return P.get(p);
  };
  const changed = () => { onChange && onChange(); };

  /** @type {any} */
  const L = { api, S, P, cached, proj, changed, land, say, unsay, endStop, announce, tell, nameOf, findThread, projectOf, go, onHide: null };
  installStore(L);
  installViews(L);
  installActions(L);
  const { load, preflight, screen, summary, bodyHtml, hintFor, act, menu } = L;

  /** @param {string | null} p */
  function forget(p) {
    const s = p && P.get(p);
    if (!s?.form || s.run?.undo) return;
    s.form.env = {};
    if (S.body && projectOf(S.v) === p) for (const n of S.body.querySelectorAll("[data-lp-env]")) { n.value = ""; n.removeAttribute("value"); }
    S.key = ""; S.html = "";
  }

  /** @param {string} v @param {any} open */
  function paint(v, open) {
    if (!S.el) return;
    const p = projectOf(v);
    if (S.shown && (S.shown !== p || !open)) forget(S.shown);
    S.shown = open && p ? p : null;
    S.v = v;
    if (!p) return;
    const sm = summary(p);
    S.el.dataset.tone = sm.tone;
    const hs = `<span class="lp-st t-${sm.tone}"><i aria-hidden="true"></i><span>${esc(sm.words)}</span>${sm.at ? ` <span class="lp-tm">${since(sm.at)}</span>` : ""}</span>`;
    if (S.hs && S.hs._h !== hs) { redraw(S.hs, hs); S.hs._h = hs; }
    if (S.nav) {
      const s = proj(p), on = s.editing && s.check?.app ? "edit" : "home";
      const nav = `<button type="button" class="nrow${on === "home" ? " is-on" : ""}" data-lp="${on === "home" ? "home" : "edit-cancel"}"${on === "home" ? ' aria-current="page"' : ""}><span class="nr-ic">${xi("dashboard")}</span><span>Overview</span></button>` +
        (s.check?.app && !s.check.app.gone && !s.run ? `<button type="button" class="nrow${on === "edit" ? " is-on" : ""}" data-lp="edit"${on === "edit" ? ' aria-current="page"' : ""}><span class="nr-ic">${xi("settings-general")}</span><span>Settings</span></button>` : "");
      if (S.nav._h !== nav) { redraw(S.nav, nav); S.nav._h = nav; }
    }
    if (!open) return;
    preflight(p);
    const b = bodyHtml(p);
    // a form is drawn once per screen, never under the person's fingers; the rest redraws when it changes
    if (b.form && S.key === b.key && S.body.querySelector(".lp-set")) { syncPreview(p); return; }
    // a clock's figures aren't a change (the app's ticker moves them); a new screen arrives, the same one doesn't
    const same = b.html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1").replace(/(class="lp-count"[^>]*>)\d+/g, "$1");
    if (S.key !== b.key || S.html !== same) {
      const ae = document.activeElement && S.body.contains(document.activeElement) ? (document.activeElement.closest("xo-select") || document.activeElement) : null;
      // the focused control by what it is, and which of its kind (Change shows on two rows)
      const [focus, nth] = ae && ae !== S.body ? keyOf(ae) : [null, 0];
      const caret = ae && ae.matches("input") ? [ae.selectionStart, ae.selectionEnd] : null;
      const fresh = S.key.split("|").slice(0, 2).join("|") !== b.key.split("|").slice(0, 2).join("|");
      redraw(S.body, `<div class="lp${fresh ? " is-new" : ""}" data-screen="${b.key.split("|")[1]}">${b.html}</div>`);
      if (b.form) { const env = proj(p).form?.env || {}; for (const n of S.body.querySelectorAll("[data-lp-env]")) if (env[n.dataset.lpEnv]) n.value = env[n.dataset.lpEnv]; }
      // a dropdown's combobox is its inner button: it carries the field's hint and its invalid state
      for (const x of S.body.querySelectorAll("xo-select[data-lp-f]")) { const btn = x.querySelector(".dd-btn"); if (!btn) continue; for (const a of ["aria-describedby", "aria-invalid"]) if (x.hasAttribute(a)) btn.setAttribute(a, x.getAttribute(a)); }
      if (fresh) S.body.scrollTop = 0;
      S.key = b.key; S.html = same;
      requestAnimationFrame(over);
      const named = () => { const m = S.want && S.body.querySelector(S.want); if (m) S.want = ""; return m; };
      const n = !ae ? null : ae === S.body ? named() : (focus && (S.body.querySelectorAll(focus)[nth] || S.body.querySelector(focus))) || named();
      if (!ae) S.want = "";
      if (n) { n.focus({ preventScroll: true }); if (caret && n.setSelectionRange) try { n.setSelectionRange(...caret); } catch { /* a number field */ } }
      else if (ae && ae !== S.body) {
        if (S.want) S.body.focus({ preventScroll: true });
        else S.lost.push(`${b.key.split("|")[1]}: ${focus || ae.tagName.toLowerCase()}`); // no place named: a bug, and tests say so
      }
    }
  }
  /** @param {any} el @returns {[string | null, number]} */
  function keyOf(el) {
    const sel = el.dataset.lpF ? `[data-lp-f="${el.dataset.lpF}"]` : el.dataset.lpEnv ? `[data-lp-env="${CSS.escape(el.dataset.lpEnv)}"]`
      : el.dataset.lp ? `[data-lp="${el.dataset.lp}"]` : el.matches("a[href]") ? `a[href="${CSS.escape(el.getAttribute("href"))}"]` : null;
    return sel ? [sel, Math.max(0, [...S.body.querySelectorAll(sel)].indexOf(el))] : [null, 0];
  }
  /** @param {string} p */
  function syncPreview(p) {
    const f = proj(p).form, sh = S.body.querySelector("#lp-h-size");
    if (sh && !f.errs?.size && sh.closest(".lp-f")?.querySelector("xo-select")) sh.textContent = sizeHint(proj(p).check, f);
    const go = S.body.querySelector('[data-lp="deploy"] span');
    if (go && !proj(p).editing) go.textContent = `Deploy ${f.name || nameOf(p)}`;
  }

  function over() {
    const b = S.body;
    if (!b) return;
    const more = b.scrollTop + b.clientHeight < b.scrollHeight - 1;
    b.classList.toggle("is-over", more);
    b.classList.toggle("is-fade", more && !b.querySelector(".lp-foot")); // a section without a foot fades at its edge
  }

  /** @param {any} section @param {{ open: () => void, hide: () => void }} frame */
  function mount(section, { hide }) {
    S.el = section; S.hs = section.querySelector(".lp-hs"); S.nav = section.querySelector(".lq-nav"); S.notes = section.querySelector(".lq-notes"); S.body = section.querySelector(".fr-b");
    S.body.addEventListener("scroll", over, { passive: true });
    pointerFollows(S.body); // the ⋯ menu: the item under the mouse is the active one (C058)
    addEventListener("resize", over);
    L.onHide = hide;
    section.addEventListener("click", (/** @type {MouseEvent} */ e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const u = t.closest("[data-lq-undo]");
      if (u) { undoNotice(/** @type {HTMLElement | null} */ (u.closest('[data-mid]'))?.dataset.mid); return; }
      const b = /** @type {HTMLElement | null} */ (t.closest("[data-lp]"));
      if (!b || !section.contains(b)) { if (!t.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) menu(p, false); } return; }
      e.preventDefault();
      act(b.dataset.lp, b, e);
    });
    section.addEventListener("input", (/** @type {InputEvent} */ e) => {
      const p = projectOf(S.v), t = /** @type {HTMLInputElement} */ (e.target);
      if (!p || !t.matches("input, xo-select")) return;
      const f = proj(p).form;
      if (t.dataset.lpF) f[t.dataset.lpF] = t.dataset.lpF === "name" || t.dataset.lpF === "repo" ? t.value.toLowerCase() : t.value.trim();
      if (t.dataset.lpEnv) f.env[t.dataset.lpEnv] = t.value;
      const k = t.dataset.lpF === "diskPath" || t.dataset.lpF === "diskGb" ? "disk" : t.dataset.lpF;
      if (k && f.errs && f.errs[k]) {
        delete f.errs[k]; if (k === "name") delete f.errs.nameFix;
        const l = t.closest(".lp-f"); l?.classList.remove("is-bad");
        for (const n of l ? l.querySelectorAll("[aria-invalid]") : []) n.removeAttribute("aria-invalid");
        t.removeAttribute("aria-invalid"); t.querySelector?.(".dd-btn")?.removeAttribute("aria-invalid");
        l?.querySelector(".lp-fix")?.remove();
        const h = S.body.querySelector(`#lp-h-${k}`); if (h) h.textContent = hintFor(k, p);
        S.key = bodyHtml(p).key; // the form as it now stands: the next paint has nothing to redraw
      }
      syncPreview(p);
    });
    section.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).matches?.(".lp-in")) { e.preventDefault(); const go = S.body.querySelector(".lp-foot .lp-go"); if (go) act(go.dataset.lp, go); }
      // the ⋯ menu: Esc closes it onto More; the arrows, Home and End move within it; Tab leaves and closes it
      const p = projectOf(S.v);
      if (p && proj(p).menu && /** @type {HTMLElement} */ (e.target).closest?.(".lp-mw")) {
        const items = [...S.body.querySelectorAll('.lp-mn [role="menuitem"]')];
        if (e.key === "Tab") { menu(p, false); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && items.length) {
          e.preventDefault();
          const i = items.indexOf(document.activeElement);
          const n = e.key === "Home" || i < 0 ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
          items[n].focus({ preventScroll: true });
        }
      }
    });
    // Esc in the ⋯ menu or an open list closes that, not the window: heard first, in the document's capture phase
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !S.body) return;
      const t = /** @type {HTMLElement | null} */ (e.target);
      const x = /** @type {(HTMLElement & {close(restore: boolean): void}) | null | undefined} */ (t?.closest(".lq xo-select.is-open"));
      if (x) { e.preventDefault(); e.stopPropagation(); x.close(true); return; } // the list closes, focus stays on Size
      if (!t?.closest(".lq .lp-mw")) return;
      const p = projectOf(S.v);
      if (!p || !proj(p).menu) return;
      e.preventDefault(); e.stopPropagation();
      S.body.querySelector('[data-lp="menu"]')?.focus({ preventScroll: true });
      menu(p, false);
    }, true);
    // a menu left by focus (a click elsewhere in the page, the window) closes
    section.addEventListener("focusout", (/** @type {FocusEvent} */ e) => {
      const p = projectOf(S.v);
      if (!p || !proj(p).menu || !/** @type {HTMLElement} */ (e.target).closest?.(".lp-mw")) return;
      setTimeout(() => { const mw = S.body?.querySelector(".lp-mw"); if (proj(p).menu && mw && !mw.contains(document.activeElement)) menu(p, false); }, 0);
    });
  }

  return {
    mount, paint,
    away() { if (S.shown) forget(S.shown); handOver(); S.shown = null; },
    /** @param {string | null} v */
    has(v) {
      const p = projectOf(v);
      if (!p) return false;
      const s = P.get(p);
      if (s?.err && s.err.status === 404 && !s.check) return false; // this Space has no deploy routes, or no such project
      return (s?.check ? s.check.state : cached[p]) !== "not-deployable";
    },
    /** @param {string | null} v */
    tone(v) { const p = projectOf(v); return p ? summary(p).tone : ""; },
    /** @param {string | null} v */
    inspect(v) { const p = projectOf(v); if (!p) return null; const s = proj(p); return { screen: screen(p), err: s.err ? String(s.err.message || s.err) : null, ghErr: s.ghErr || null, workflow: s.check?.github?.workflow ?? null, pre: s.pre }; },
    lostFocus: () => S.lost.slice(),
    /** @param {string} name */
    press(name) { const b = S.body?.querySelector(`[data-lp="${name}"]`); if (b) act(name, b); },
    /** @param {string[]} ps */
    overview(ps) {
      /** @type {Record<string, string>} */
      const overviewSteps = { go: "done", work: "doing", stop: "failed" };
      const all = ps.map((p) => {
        load(p);
        const s = P.get(p), c = s?.check;
        if (!c || c.state === "not-deployable") return null;
        const sc = screen(p), sm = summary(p), r = s.run, app = r?.live || c.app, e = r?.error;
        const ran = r && !r.live && r.steps;
        /** @type {string[]} */
        const steps = ran ? NODES.map((n) => r.steps[n]?.state || "") : app ? ["done", "done", "done", overviewSteps[sm.tone] || ""] : ["", "", "", ""];
        const port = e && e.code === "health_check_failed" && e.declared && e.declared !== e.port;
        const why = port ? `Nothing answered on port ${e.port}; the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}` : e ? e.message || e.text || failWords(e) : sm.tone === "stop" ? "Its instances aren't answering." : "";
        return { p, name: app?.name || s.form?.name || nameOf(p), kind: app || r ? "app" : sc === "needs" || sc === "getting" ? "needs" : "ready",
          tone: sm.tone, words: sm.words, at: sm.at || app?.at || 0, host: app?.host || "", url: app?.url || "", steps, log: e?.url || "",
          need: sm.tone === "stop" || sm.tone === "need" ? { why, act: port ? "fix-port" : "", label: port ? `Use port ${e.declared}` : "" } : null };
      }).filter(Boolean);
      const pending = ps.filter((p) => { const s = P.get(p); return s && !s.check && !s.err; }).length;
      return Object.assign(all, { pending });
    },
    /** @param {string | null} v */
    ensure(v) { const p = projectOf(v); if (p) load(p); },
    /** @param {string | null} v @param {boolean} open */
    button(v, open) {
      const p = projectOf(v);
      if (!p || !this.has(v)) return "";
      const sm = P.get(p)?.check ? summary(p) : { tone: "", words: "" };
      const busy = sm.tone === "work";
      const label = busy ? "Deploying" : "Deploy";
      const tip = sm.tone === "go" ? `Live at ${sm.host}` : sm.tone === "stop" ? `${sm.words}: open Launchpad` : sm.tone === "need" ? "Launchpad waits for you" : busy ? `${sm.words} on Launchpad` : "Deploy on Launchpad";
      return `<button type="button" class="tw-act lp-btn${sm.tone ? ` t-${sm.tone}` : ""}${open ? " is-on" : ""}" data-lp-open aria-pressed="${!!open}" aria-haspopup="dialog" title="${esc(tip)}">${busy ? '<i class="lp-arc" aria-hidden="true"></i>' : LP_ICON.rocket}<span>${label}</span></button>`;
    },
  };
}
