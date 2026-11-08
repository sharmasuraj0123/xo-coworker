// Settings › Shape, the first-run question, and the few places the page reads the shape directly
// (density on <html>, the Settings rail's Advanced group, Home's order). js/shape.js holds the rules;
// this only draws them. Every change is the person's own click, applied at once and said back plainly.
// The sidebar is never touched here: a shape may only hide its Shells row (js/shells/dock.js).
//
// app.js calls: apply (the shape changed), open (the page was opened), homeOrder, firstRun.

import { esc } from "./util.js";
import { ICON } from "./ui.js";
import { PRESETS, createShape, describeShape } from "./shape.js";
import { once, isPending, busyAttrs } from "./pending.js";
import { redraw } from "./redraw.js";
import { rovingTab } from "./keynav.js";

/** Settings' rail icon for Shape: a window and its parts. */
export const SHAPE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15M9.5 11h11"/></svg>';

/** Home's parts by surface: Your next move (and the asks after it), Handled, Recently made. */
const HOME = { "xo:home/next": ["hm-next", "hm-then"], "xo:home/handled": ["hm-end"], "xo:home/recent": ["hm-made"] };
// a preset chosen, or your JSON saved: each may read a preset file first, so one goes at a time
const SHAPING = "shape";

/**
 * Put els in this order, side by side, among their parent's other children, without ever moving the one that holds
 * the keyboard (moving a node takes focus off it): it's the anchor, and the rest are placed before and after it.
 * When they're already in order nothing moves at all.
 */
function inOrder(els) {
  const a = document.activeElement;
  const k = Math.max(0, els.findIndex((el) => el.contains(a)));
  for (let i = k - 1; i >= 0; i--) if (els[i].nextElementSibling !== els[i + 1]) els[i + 1].before(els[i]);
  for (let i = k + 1; i < els.length; i++) if (els[i].previousElementSibling !== els[i - 1]) els[i - 1].after(els[i]);
}

export function createShapeView({ shape, announce = () => {} }) {
  // draft: the JSON as typed, not saved yet; saveErr: why the last Save of it was refused
  const V = { confirm: null, err: null, draft: null, saveErr: null, built: false };
  const page = document.querySelector('[data-page="shape"]');
  const box = page && page.querySelector(".shp");
  const nav = document.querySelector("#settings .set-nav");
  const navOrder = nav ? [...nav.querySelectorAll("[data-set]")].map((b) => b.dataset.set) : [];
  const cardsOf = () => PRESETS.map((p) => { const f = shape.presetFile(p.id) || {}; return { id: p.id, name: f.name || p.name, summary: f.summary || p.summary }; });
  const nameOf = (id) => (cardsOf().find((c) => c.id === id) || { name: id }).name;

  // ── what the page reads straight from the shape ─────────────────────────────
  function apply() {
    document.documentElement.dataset.density = shape.get("density");
    // a shape chosen on another device arrived (Storm's) while the first-run question was up: it's answered
    const first = document.getElementById("shape-first");
    if (first && shape.chosen && first._dismiss) first._dismiss();
    railRender();
    if (page && !page.hidden && !document.querySelector("#settings").hidden) render();
  }
  /** Technical pages a shape marks advanced move under one quiet "Advanced" label at the rail's foot. */
  function railRender() {
    if (!nav) return;
    const adv = new Set(shape.list("settings").filter((s) => s.advanced).map((s) => s.id.slice("xo:settings/".length)));
    let head = nav.querySelector(".shp-navh");
    if (!head) { head = document.createElement("p"); head.className = "shp-navh"; head.setAttribute("aria-hidden", "true"); head.textContent = "Advanced"; }
    const btn = (id) => nav.querySelector(`[data-set="${id}"]`);
    const want = [...navOrder.filter((id) => !adv.has(id)).map(btn), ...(adv.size ? [head, ...navOrder.filter((id) => adv.has(id)).map(btn)] : [])].filter(Boolean);
    if (!adv.size) head.remove();
    for (const id of navOrder) btn(id)?.toggleAttribute("data-advanced", adv.has(id));
    const cur = [...nav.children];
    if (want.length !== cur.length || want.some((el, i) => cur[i] !== el)) for (const el of want) nav.appendChild(el);
  }
  /**
   * Home's parts in the shape's order; a part it doesn't keep is hidden. Only the parts the shape orders are
   * compared and moved: Home's other lines (the quiet "since you were away" one) stay where they are, and a part
   * already in its place is never touched, so a control in it keeps the keyboard through every render.
   */
  function homeOrder(body) {
    if (!body) return;
    const list = shape.list("home").map((s) => s.id);
    const on = new Set(list);
    const order = [...list, ...Object.keys(HOME).filter((id) => !on.has(id))];
    for (const [id, parts] of Object.entries(HOME)) for (const x of parts) { const el = body.querySelector(`#${x}`), hide = !on.has(id); if (el && el.hidden !== hide) el.hidden = hide; }
    inOrder(order.flatMap((id) => HOME[id].map((x) => body.querySelector(`:scope > #${x}`))).filter(Boolean));
  }

  // ── Settings › Shape ────────────────────────────────────────────────────────
  /** The page was opened: the cards are named from the presets' own files (GET, once a page). */
  async function open() {
    render();
    await Promise.all(PRESETS.filter((p) => !p.builtin).map((p) => shape.loadPreset(p.id).catch(() => null)));
    if (!page.hidden) render();
  }
  const mineText = () => JSON.stringify(shape.mine || { shape: 1 }, null, 2);
  const list = (lines) => `<ul class="shp-diff">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  function topHtml() {
    const id = shape.presetId || "everything";
    const pre = shape.presetShape(id);
    const diff = describeShape(createShape([]), pre);
    const own = describeShape(pre, shape.shape);
    const dense = shape.get("density") === "compact";
    const c = V.confirm;
    return `<section class="set-sec" aria-labelledby="shp-h-p"><h3 id="shp-h-p">What you mostly do here</h3>` +
      `<div class="set-choices" role="radiogroup" aria-labelledby="shp-h-p">${cardsOf().map((p) => `<button type="button" class="set-choice${p.id === id ? " is-on" : ""}" role="radio" aria-checked="${p.id === id}" data-shp-preset="${esc(p.id)}"${rovingTab(p.id === id)}${busyAttrs(SHAPING)}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(p.name)}</b><span>${esc(p.summary)}</span></span></button>`).join("")}</div>` +
      (c ? `<div class="shp-confirm" role="alertdialog" aria-labelledby="shp-cf"><p id="shp-cf"><b>Switch to ${esc(nameOf(c))}?</b> Your own changes are cleared. What you set on this device stays.</p><div class="set-fa"><button type="button" class="btn" data-shp-keep>Keep mine</button><button type="button" class="btn btn-pri" data-shp-switch="${esc(c)}"${busyAttrs(SHAPING)}>Switch</button></div></div>` : "") +
      (shape.presetError(id) ? `<p class="set-err" role="alert">${esc(nameOf(id))} couldn't be read (${esc(shape.presetError(id))}). XO shows everything until it can.</p>` : "") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="shp-h-d"><h3 id="shp-h-d">What it changes</h3>` +
      (diff.length ? list(diff) : `<p class="set-lead">Nothing: every part of XO, as it is today.</p>`) +
      (own.length ? `<p class="set-lead shp-own">Your own changes on top</p>${list(own)}` : "") +
      (V.err ? `<p class="set-err" role="alert">${esc(V.err)}</p>` : "") +
      `<div class="set-fa shp-acts"><button type="button" class="btn" data-shp-reset${own.length ? "" : " disabled"}>Reset to preset</button><button type="button" class="btn" data-shp-all>Show everything</button></div></section>` +
      `<section class="set-sec" aria-labelledby="shp-h-v"><h3 id="shp-h-v">On this device</h3>` +
      `<div class="set-row"><div class="set-l"><b id="shp-dense-l">Compact</b><span>Tighter rows and controls, and 14 px reading text. Only here: your other devices keep their own.</span></div>` +
      `<button type="button" class="switch" role="switch" aria-checked="${dense}" aria-labelledby="shp-dense-l" data-shp-dense><span class="th-track" aria-hidden="true"><span class="th-knob">${ICON.list}</span></span></button></div></section>`;
  }
  /** Edit as JSON: built once, so typing is never redrawn under you; checked as you type. */
  function jsonBuild() {
    const d = document.createElement("details");
    d.className = "shp-json";
    d.innerHTML = `<summary><span class="shp-chev" aria-hidden="true">${ICON.chevron}</span>Edit as JSON<span class="shp-n" data-shp-n></span></summary>` +
      `<div class="shp-jb"><p class="set-lead">Your own layer, on top of the preset. Only what you write here differs from it; a key you leave out comes from the preset. An unknown key is ignored, and a bad value falls back to the preset's.</p>` +
      `<label class="field"><span>Mine</span><textarea class="shp-ta" rows="12" spellcheck="false" autocomplete="off" data-shp-json aria-describedby="shp-js"></textarea></label>` +
      `<p class="shp-status" id="shp-js" role="status"></p>` +
      `<section class="shp-probs" aria-labelledby="shp-h-pr" hidden><h4 id="shp-h-pr">Shape problems</h4><ul data-shp-probs></ul></section>` +
      `<div class="set-fa"><button type="button" class="btn" data-shp-revert disabled>Revert</button><button type="button" class="btn btn-pri" data-shp-save disabled>Save</button></div></div>`;
    return d;
  }
  /** What the textarea says now: {doc} or {error}, and the problems the whole shape would have with it. */
  function check(text) {
    let doc;
    try { doc = JSON.parse(text); } catch (err) { return { error: `Not JSON yet: ${String(err.message).replace(/^JSON\.parse: /, "")}` }; }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { error: "Your layer must be a JSON object, { … }." };
    const id = typeof doc.preset === "string" ? doc.preset : shape.presetId;
    const file = id && shape.presetFile(id);
    const s = createShape([file && { from: "preset", doc: file }, { from: "mine", doc }, { from: "device", doc: shape.device }].filter(Boolean));
    return { doc, problems: s.problems };
  }
  function jsonRender() {
    const d = box.querySelector(".shp-json");
    const ta = d.querySelector("[data-shp-json]");
    if (V.draft == null && ta.value !== mineText()) ta.value = mineText();
    // the box fits what it holds (up to 24 lines), so the whole layer reads at once
    ta.rows = Math.min(24, Math.max(8, ta.value.split("\n").length + 1));
    const r = V.draft == null ? { doc: shape.mine, problems: shape.problems } : check(V.draft);
    const probs = r.problems || [];
    const pl = d.querySelector(".shp-probs");
    pl.hidden = !probs.length;
    d.querySelector("[data-shp-probs]").innerHTML = probs.map((p) => `<li><span class="shp-where">${esc(p.from === "mine" ? "Yours" : p.from === "device" ? "This device" : p.from === "preset" ? "The preset" : p.from)}</span><span class="shp-sep" aria-hidden="true">·</span><code>${esc(p.path || "the layer")}</code> ${esc(p.text)}.</li>`).join("");
    d.querySelector("[data-shp-n]").textContent = probs.length ? `${probs.length} ${probs.length === 1 ? "problem" : "problems"}` : "";
    // a refused save is said here, beside the text it was for (the text stays, to fix and save again)
    const bad = V.saveErr || r.error;
    d.querySelector(".shp-status").textContent = bad || (V.draft == null ? "" : probs.length ? "It can be saved: XO uses what it understands, as the list below says." : "Looks right.");
    d.querySelector(".shp-status").classList.toggle("is-err", !!bad);
    // saving: Save says it's waiting and keeps the keyboard (aria-disabled, not disabled); a repeat joins it
    const save = d.querySelector("[data-shp-save]"), busy = isPending(SHAPING);
    save.disabled = !busy && (V.draft == null || !!r.error);
    for (const a of ["aria-busy", "aria-disabled"]) if (busy) save.setAttribute(a, "true"); else save.removeAttribute(a);
    d.querySelector("[data-shp-revert]").disabled = V.draft == null;
  }
  function render() {
    if (!box) return;
    if (!V.built) {
      box.innerHTML = `<div class="shp-top"></div>`;
      box.appendChild(jsonBuild());
      V.built = true;
    }
    // in place: the control under the keyboard stays the same node
    redraw(box.querySelector(".shp-top"), topHtml());
    jsonRender();
  }
  const said = (r, ok) => { V.err = r && r.error ? r.error : null; if (!V.err) announce(ok); render(); };
  /** Where an action that takes its own control away (or disables it) leaves the keyboard: el, unless it moved on. */
  function landOn(el, from) {
    const a = document.activeElement;
    if (a && a !== document.body && a !== from && a.isConnected && !a.disabled) return;
    el?.focus({ preventScroll: true });
  }
  const chosenCard = () => box.querySelector('[data-shp-preset][aria-checked="true"]');
  async function choose(id, from) {
    const p = once(SHAPING, async () => {
      const r = await shape.choose(id);
      const d = describeShape(createShape([]), shape.presetShape(id));
      // chosen: the question (if one was asked) goes, and in the same step the keyboard goes to the card now
      // chosen; refused, the question stays with the reason, to switch again or keep yours
      if (!(r && r.error)) V.confirm = null;
      said(r, `${nameOf(id)}. ${d.length ? d[0] : "Every part of XO, as it is today."}`);
      landOn(chosenCard(), from);
    });
    render(); // the choices say they're waiting (a preset's file may be read first)
    await p;
    render();
  }

  if (box) {
    box.addEventListener("click", (e) => {
      const t = e.target;
      const p = t.closest("[data-shp-preset]");
      if (p) {
        const id = p.dataset.shpPreset;
        if (isPending(SHAPING) || (id === (shape.presetId || "everything") && !V.confirm)) return;
        // your own changes are cleared by a switch: asked first, in place
        if (shape.ownKeys().length && id !== V.confirm) { V.confirm = id; render(); box.querySelector("[data-shp-switch]")?.focus({ preventScroll: true }); return; }
        choose(id, p); return;
      }
      if (t.closest("[data-shp-keep]")) { V.confirm = null; render(); chosenCard()?.focus({ preventScroll: true }); return; }
      const sw = t.closest("[data-shp-switch]");
      if (sw) { choose(sw.dataset.shpSwitch, sw); return; }
      // Reset disables itself (there's nothing left to reset): the keyboard goes to the preset it's back to
      if (t.closest("[data-shp-reset]")) { const b = t.closest("[data-shp-reset]"); V.draft = null; said(shape.resetToPreset(), `Back to ${nameOf(shape.presetId || "everything")}, as it comes.`); landOn(chosenCard(), b); return; }
      if (t.closest("[data-shp-all]")) { V.draft = null; said(shape.showEverything(), "Everything shows. Reset to preset takes it back."); return; }
      if (t.closest("[data-shp-dense]")) { const on = shape.get("density") !== "compact"; said(shape.setDevice({ density: on ? "compact" : "comfortable" }), on ? "Compact on this device." : "Comfortable on this device."); return; }
      // Revert and Save leave nothing to revert or save (both disable): the keyboard goes back to the text
      const ta = () => box.querySelector("[data-shp-json]");
      const rv = t.closest("[data-shp-revert]");
      if (rv) { V.draft = null; V.saveErr = null; jsonRender(); landOn(ta(), rv); announce("Back to what's saved."); return; }
      const sv = t.closest("[data-shp-save]");
      if (sv) { save(sv); return; }
    });
    box.addEventListener("input", (e) => {
      if (!e.target.matches("[data-shp-json]")) return;
      V.draft = e.target.value === mineText() ? null : e.target.value;
      V.saveErr = null;
      jsonRender();
    });
    // Tab in the JSON writes two spaces (Shift+Tab and Esc still move on)
    box.addEventListener("keydown", (e) => {
      if (!e.target.matches("[data-shp-json]") || e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    });
  }

  /** Edit as JSON › Save: one save at a time; a refusal keeps the text and says why beside it. */
  async function save(from) {
    if (isPending(SHAPING)) return;
    const r = check(V.draft ?? "");
    if (r.error) { jsonRender(); return; }
    const sent = V.draft;
    V.saveErr = null;
    const p = once(SHAPING, async () => {
      const res = await shape.setMine(r.doc);
      if (res.error) { V.saveErr = res.error; return false; }
      if (V.draft === sent) V.draft = null; // typed on while it saved: that's still a draft
      V.err = null; announce("Saved. Your shape is applied.");
      return true;
    });
    jsonRender();
    const ok = await p;
    render();
    if (ok && V.draft == null) landOn(box.querySelector("[data-shp-json]"), from);
  }

  // ── the first run: one question, never again once answered ──────────────────
  // Answered on another device counts: Storm's shape is read first (briefly; a slow read asks anyway, and
  // the question steps aside if the answer arrives after all).
  const FIRST_WAIT_MS = 2500;
  async function firstRun() {
    if (!shape.chosen && shape.synced) await Promise.race([shape.synced, new Promise((r) => setTimeout(r, FIRST_WAIT_MS))]);
    if (shape.chosen || document.getElementById("shape-first")) return;
    const back = document.activeElement;
    const el = document.createElement("div");
    el.className = "sheet shp-sheet";
    el.id = "shape-first";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "shf-h");
    el.setAttribute("aria-describedby", "shf-l");
    el.innerHTML = `<div class="sheet-card shp-first" tabindex="-1"><header class="sheet-h"><h2 id="shf-h">What will you mostly do here?</h2>` +
      `<button type="button" class="x" data-shf-close aria-label="Not now: show everything" title="Not now: show everything">${ICON.close}</button></header>` +
      `<p class="shp-first-l" id="shf-l">XO shows what fits. You can change it any time in Settings › Shape.</p>` +
      `<div class="set-choices shp-first-c" role="group" aria-labelledby="shf-h">${cardsOf().map((p) => `<button type="button" class="set-choice" data-shf="${esc(p.id)}"><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(p.name)}</b><span>${esc(p.summary)}</span></span></button>`).join("")}</div></div>`;
    document.body.appendChild(el);
    const leave = () => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
      (back && back.isConnected && back !== document.body ? back : document.getElementById("say"))?.focus?.({ preventScroll: true });
    };
    const done = async (id) => {
      if (el._done) return;
      el._done = true;
      await shape.choose(id);
      leave();
      announce(id === "everything" ? "Everything shows. Settings › Shape changes it any time." : `${nameOf(id)}. Settings › Shape changes it any time.`);
    };
    // answered elsewhere meanwhile: nothing is chosen here, the sheet just goes
    el._dismiss = () => { if (el._done) return; el._done = true; leave(); announce("Your shape came from your other device."); };
    el.addEventListener("click", (e) => {
      const c = e.target.closest("[data-shf]");
      if (c) { done(c.dataset.shf); return; }
      // dismissing it is Everything: the UI as it is today
      if (e.target === el || e.target.closest("[data-shf-close]")) done("everything");
    });
    el.addEventListener("keydown", (e) => {
      // the app's own keys wait until this is answered
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); done("everything"); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const cs = [...el.querySelectorAll("[data-shf]")], i = cs.indexOf(document.activeElement);
        if (i >= 0) { e.preventDefault(); cs[(i + (e.key === "ArrowDown" ? 1 : cs.length - 1)) % cs.length].focus(); }
        return;
      }
      if (e.key !== "Tab") return;
      // the keyboard stays in the sheet until it's answered: its controls in the order they're drawn (Not now,
      // then the choices), past the last is the first and before the first is the last, never the page behind
      const f = [...el.querySelectorAll("button")];
      const i = f.indexOf(document.activeElement);
      if (i < 0) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); return; }
      if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    // the sheet itself takes focus, so no choice looks made before you make it; Tab goes on from there
    el.querySelector(".shp-first").focus({ preventScroll: true });
  }

  return { apply, open, render, homeOrder, firstRun };
}
