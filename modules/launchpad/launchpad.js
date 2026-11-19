// @ts-check

// Launchpad, in the panel: put a project on the web; typed secrets stay in memory until the deploy request carries them, never in storage, a URL or a log.
import { esc } from "../../core/platform/index.js";
import { pointerFollows } from "../../core/ui/a11y/keynav.js";
import { redraw } from "../../core/ui/redraw.js";
import { LP_ICON, CACHE, since, sizeHint } from "./words.js";
import { installStore } from "./store.js";
import { installViews } from "./views.js";
import { installActions } from "./actions.js";

export { LP_ICON };

/** @typedef {{ api: any, projectOf: (v: string | null) => string | null, nameOf?: (p: string) => string, findThread?: (p: string, id?: string) => any, go?: (v: string) => void, announce: (s: string) => void, notify?: (text: string, undo?: (() => void) | null, kind?: string) => void, notice?: (mid: string, line: any, ms: number) => void, unnotice?: (mid: string) => void, onChange?: () => void }} LaunchpadDeps */

/** The Launchpad section: notify is one herald line, notice/unnotice one line per subject changed in place, onChange re-renders the app. @param {LaunchpadDeps} deps */
export function createLaunchpad({ api, projectOf, nameOf = (p) => p, findThread = () => null, go, announce, notify, notice, unnotice, onChange }) {
  const P = new Map();
  /** @type {Record<string, string>} */
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}") || {}; } catch { /* private mode */ }
  // want: where focus goes when a redraw takes away the control that had it; with neither the control nor a named place, lost records it
  const S = /** @type {any} */ ({ el: null, hs: null, ha: null, body: null, key: "", html: "", v: null, shown: null, want: "", lost: [] });
  /** Name where focus goes next, if a redraw takes the focused control away. @param {string} sel */
  const land = (sel) => { S.want = sel; };
  /** A subject's one notice (a stop's, an unlink's), shown or changed in place; without notice() (an older host), a plain line. @param {string} mid @param {any} line @param {number} ms */
  const say = (mid, line, ms) => { if (notice) notice(mid, line, ms); else if (notify) notify(line.text, line.undo || null, line.kind); };
  /** @param {string} [mid] */
  const unsay = (mid) => { if (mid && unnotice) unnotice(mid); };
  /** A stop that won't be asked for, or whose answer no longer matters: its window ends and its notice goes. @param {any} run */
  const endStop = (run) => { if (!run) return; if (run.stopping) { clearTimeout(run.stopping); run.stopping = 0; } unsay(run.mid); };

  /** @param {string} p @returns {any} */
  const proj = (p) => {
    if (!P.has(p)) P.set(p, { check: null, at: 0, pre: 0, loading: false, err: null, run: null, form: null, device: null, picking: null, asked: null, asking: false, askErr: null, needs: null, warn: null, menu: false, copied: 0, cmdCopied: 0 });
    return P.get(p);
  };
  const changed = () => { onChange && onChange(); };

  /** @type {any} */
  const L = { api, S, P, cached, proj, changed, land, say, unsay, endStop, announce, notify, nameOf, findThread, projectOf, go, onOpen: null, onHide: null };
  installStore(L);
  installViews(L);
  installActions(L);
  const { load, preflight, screen, summary, bodyHtml, hintFor, act, menu } = L;

  /** Typed values go when the section does (closed, folded, another project shown); a deploy waiting out its Undo keeps them until it sends. @param {string | null} p */
  function forget(p) {
    const s = p && P.get(p);
    if (!s?.form || s.run?.undo) return;
    s.form.env = {};
    if (S.body && projectOf(S.v) === p) for (const n of S.body.querySelectorAll("[data-lp-env]")) { n.value = ""; n.removeAttribute("value"); }
    S.key = ""; S.html = "";
  }

  /** Paints into the frame the panel made: the head always, the body when open. @param {string} v @param {any} open */
  function paint(v, open) {
    if (!S.el) return;
    const p = projectOf(v);
    if (S.shown && (S.shown !== p || !open)) forget(S.shown);
    S.shown = open && p ? p : null;
    S.v = v;
    if (!p) return;
    const sm = summary(p);
    S.el.dataset.tone = sm.tone;
    const hs = `<span class="lp-st t-${sm.tone}">${sm.tone === "work" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}<span>${esc(sm.words)}</span>${sm.at ? ` <span class="lp-tm">${since(sm.at)}</span>` : ""}</span>${sm.host ? `<a class="lp-hh" href="${esc(sm.url)}" target="_blank" rel="noopener" title="Open ${esc(sm.host)}">${esc(sm.host)}</a>` : ""}`;
    if (S.hs._h !== hs) { redraw(S.hs, hs); S.hs._h = hs; }
    const ha = !open && sm.cta ? `<button type="button" class="lp-hb" data-lp="open">${LP_ICON.rocket}<span>Deploy</span></button>` : sm.url ? `<a class="fr-ib" href="${esc(sm.url)}" target="_blank" rel="noopener" title="Open ${esc(sm.host)}" aria-label="Open it">${LP_ICON.out}</a>` : "";
    if (S.ha._h !== ha) { redraw(S.ha, ha); S.ha._h = ha; }
    if (!open) return;
    preflight(p);
    const b = bodyHtml(p);
    // a form is drawn once per screen, never under the person's fingers; the rest redraws when it changes
    if (b.form && S.key === b.key && S.body.querySelector(".lp-set")) { syncPreview(p); return; }
    // a clock's figures aren't a change (the app's ticker moves them); a new screen arrives, the same one doesn't
    const same = b.html.replace(/(<span class="elapsed" data-since="\d+">)[^<]*/g, "$1").replace(/(class="lp-count"[^>]*>)\d+/g, "$1");
    if (S.key !== b.key || S.html !== same) {
      const ae = document.activeElement && S.body.contains(document.activeElement) ? (document.activeElement.closest("xo-select") || document.activeElement) : null;
      // the focused control by what it is, and which of its kind (Copy shows twice: the panel's line, the wide card)
      const [focus, nth] = ae && ae !== S.body ? keyOf(ae) : [null, 0];
      const caret = ae && ae.matches("input") ? [ae.selectionStart, ae.selectionEnd] : null;
      const fresh = S.key.split("|").slice(0, 2).join("|") !== b.key.split("|").slice(0, 2).join("|");
      // in place: a control that stays is the same node, so a press on it still clicks as a deploy's steps redraw; a new screen is a new node
      redraw(S.body, `<div class="lp${fresh ? " is-new" : ""}" data-screen="${b.key.split("|")[1]}">${b.html}</div>`);
      // typed environment values go back as properties, never into the markup, so a redraw leaves no copy of a secret behind
      if (b.form) { const env = proj(p).form?.env || {}; for (const n of S.body.querySelectorAll("[data-lp-env]")) if (env[n.dataset.lpEnv]) n.value = env[n.dataset.lpEnv]; }
      // a dropdown's combobox is its inner button: it carries the field's hint and its invalid state
      for (const x of S.body.querySelectorAll("xo-select[data-lp-f]")) { const btn = x.querySelector(".dd-btn"); if (!btn) continue; for (const a of ["aria-describedby", "aria-invalid"]) if (x.hasAttribute(a)) btn.setAttribute(a, x.getAttribute(a)); }
      if (fresh) S.body.scrollTop = 0;
      S.key = b.key; S.html = same;
      requestAnimationFrame(over);
      // focus that was in the section stays: on the same control, else the named place; one not drawn yet holds focus on the section
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
  /** A control's key across a redraw: its field, its action (data-lp), or a link's address; and its place among its kind. @param {any} el @returns {[string | null, number]} */
  function keyOf(el) {
    const sel = el.dataset.lpF ? `[data-lp-f="${el.dataset.lpF}"]` : el.dataset.lpEnv ? `[data-lp-env="${CSS.escape(el.dataset.lpEnv)}"]`
      : el.dataset.lp ? `[data-lp="${el.dataset.lp}"]` : el.matches("a[href]") ? `a[href="${CSS.escape(el.getAttribute("href"))}"]` : null;
    return sel ? [sel, Math.max(0, [...S.body.querySelectorAll(sel)].indexOf(el))] : [null, 0];
  }
  /** As you type: the card's name, address and port follow the fields, and nothing else redraws. @param {string} p */
  function syncPreview(p) {
    const f = proj(p).form, view = S.body.querySelector('.lpv[data-mode="preview"]');
    const sh = S.body.querySelector("#lp-h-size");
    if (sh && !f.errs?.size && sh.closest(".lp-f")?.querySelector("xo-select")) sh.textContent = sizeHint(proj(p).check, f);
    if (!view) return;
    /** @param {string} sel @param {string} html */
    const set = (sel, html) => { const n = S.body.querySelector(sel); if (n && n.innerHTML !== html) n.innerHTML = html; };
    set(".lpm .lpm-app b", esc(f.name || nameOf(p)));
    set('.lpv[data-mode="preview"] .lpv-inst .lpv-top b', esc(f.name || nameOf(p)));
    set('.lpv[data-mode="preview"] .lpv-inst .lpv-facts', `<span>1 instance</span><span>port ${esc(f.port || "—")}</span>`);
    const go = S.body.querySelector('[data-lp="deploy"] span');
    if (go) go.textContent = `Deploy ${f.name || nameOf(p)}`;
  }

  /** More below than the section shows: its foot fades rather than ending on a cut row. */
  function over() {
    const b = S.body;
    if (!b) return;
    const more = b.scrollTop + b.clientHeight < b.scrollHeight - 1;
    b.classList.toggle("is-over", more);
    b.classList.toggle("is-fade", more && !b.querySelector(".lp-foot")); // a section without a foot fades at its edge
  }

  /** @param {any} section @param {{ open: () => void, hide: () => void }} frame */
  function mount(section, { open, hide }) {
    S.el = section; S.hs = section.querySelector(".lp-hs"); S.ha = section.querySelector(".lp-ha"); S.body = section.querySelector(".fr-b");
    S.body.addEventListener("scroll", over, { passive: true });
    pointerFollows(S.body); // the ⋯ menu: the item under the mouse is the active one (C058)
    addEventListener("resize", over);
    L.onOpen = open; L.onHide = hide;
    section.addEventListener("click", (/** @type {any} */ e) => {
      const b = e.target.closest("[data-lp]");
      if (!b || !section.contains(b)) { if (!e.target.closest(".lp-mw")) { const p = projectOf(S.v); if (p && proj(p).menu) menu(p, false); } return; }
      e.preventDefault();
      act(b.dataset.lp, b);
    });
    section.addEventListener("input", (/** @type {any} */ e) => {
      const p = projectOf(S.v), t = e.target;
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
    section.addEventListener("keydown", (/** @type {any} */ e) => {
      if (e.key === "Enter" && e.target.matches?.(".lp-in")) { e.preventDefault(); const go = S.body.querySelector(".lp-foot .lp-go"); if (go) act(go.dataset.lp, go); }
      // the ⋯ menu: Esc closes it onto More; the arrows, Home and End move within it; Tab leaves and closes it
      const p = projectOf(S.v);
      if (p && proj(p).menu && e.target.closest?.(".lp-mw")) {
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
    // Esc in the ⋯ menu closes the menu, not the panel: heard in the document's capture phase, before the panel's own Esc
    document.addEventListener("keydown", (/** @type {any} */ e) => {
      if (e.key !== "Escape" || !S.body) return;
      const x = e.target.closest?.(".fr-lp xo-select.is-open");
      if (x) { e.preventDefault(); e.stopPropagation(); x.close(true); return; } // the list closes, focus stays on Size
      if (!e.target.closest?.(".fr-lp .lp-mw")) return;
      const p = projectOf(S.v);
      if (!p || !proj(p).menu) return;
      e.preventDefault(); e.stopPropagation();
      S.body.querySelector('[data-lp="menu"]')?.focus({ preventScroll: true });
      menu(p, false);
    }, true);
    // a menu left by focus (a click elsewhere in the page, the window) closes
    section.addEventListener("focusout", (/** @type {any} */ e) => {
      const p = projectOf(S.v);
      if (!p || !proj(p).menu || !e.target.closest?.(".lp-mw")) return;
      setTimeout(() => { const mw = S.body?.querySelector(".lp-mw"); if (proj(p).menu && mw && !mw.contains(document.activeElement)) menu(p, false); }, 0);
    });
  }

  return {
    mount, paint,
    /** The panel closed: what was typed in the section goes with it. */
    away() { if (S.shown) forget(S.shown); S.shown = null; },
    /** Does this view's project get a Launchpad section (and the header's Deploy)? Unknown counts as yes. */
    has(/** @type {any} */ v) {
      const p = projectOf(v);
      if (!p) return false;
      const s = P.get(p);
      if (s?.err && s.err.status === 404 && !s.check) return false; // this Space has no deploy routes, or no such project
      return (s?.check ? s.check.state : cached[p]) !== "not-deployable";
    },
    tone(/** @type {any} */ v) { const p = projectOf(v); return p ? summary(p).tone : ""; },
    /** Read-only, for tests: the screen a view's project shows, and its error words. */
    inspect(/** @type {any} */ v) { const p = projectOf(v); if (!p) return null; const s = proj(p); return { screen: screen(p), err: s.err ? String(s.err.message || s.err) : null, ghErr: s.ghErr || null, workflow: s.check?.github?.workflow ?? null, pre: s.pre }; },
    /** Redraws that took the focused control away with no place named for focus (each one is a bug). */
    lostFocus: () => S.lost.slice(),
    /** Read what Space says about the view's project, once in a while. */
    ensure(/** @type {any} */ v) { const p = projectOf(v); if (p) load(p); },
    /** The header's Deploy: what the project's deploy is doing, at a glance; it opens the panel's section. */
    button(/** @type {any} */ v, /** @type {any} */ open) {
      const p = projectOf(v);
      if (!p || !this.has(v)) return "";
      const sm = P.get(p)?.check ? summary(p) : { tone: "", words: "" };
      const busy = sm.tone === "work";
      const label = busy ? "Deploying" : "Deploy";
      const tip = sm.tone === "go" ? `Live at ${sm.host}` : sm.tone === "stop" ? `${sm.words}: open Launchpad in the panel` : sm.tone === "need" ? "Launchpad waits for you" : busy ? `${sm.words} on Launchpad` : "Deploy on Launchpad";
      return `<button type="button" class="tw-act lp-btn${sm.tone ? ` t-${sm.tone}` : ""}${open ? " is-on" : ""}" data-lp-open aria-pressed="${!!open}" aria-controls="stage" title="${esc(tip)}">${busy ? '<i class="lp-arc" aria-hidden="true"></i>' : LP_ICON.rocket}<span>${label}</span></button>`;
    },
  };
}
