// Settings › Shape and the few places the page reads the shape directly
// (density on <html>, the Settings rail's Advanced group, Home's order). js/shape.js holds the rules;
// this only draws them. Every change is the person's own click, applied at once and said back plainly.
// The sidebar is never touched here: a shape may only hide its Shells row (js/shells/dock.js).
//
// app.js calls: apply (the shape changed), open (the page was opened), homeOrder.

import { esc } from "./util.js";
import { ICON } from "./ui.js";
import { PRESETS, createShape, describeShape } from "./shape.js";
import { once, isPending, busyAttrs } from "./pending.js";
import { redraw } from "./redraw.js";
import { bringWhole } from "./focusview.js";
import { rovingTab } from "./keynav.js";

/** Settings' rail icon for Shape: a window and its parts. */
export const SHAPE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15M9.5 11h11"/></svg>';

/** Said when a change applied but this browser won't keep it (the shape store's kept: false). */
export const UNKEPT = "Applied for now: this browser won't keep it after a reload (its storage is full or switched off).";

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

export function createShapeView({ shape, announce = () => {}, notice = () => {} }) {
  // draft: the JSON as typed, not saved yet; saveErr: why the last Save of it was refused
  // pickErr: why the last preset choice was refused (said where it was asked: in the question, or under the cards)
  // unkept: the last change applied but this browser won't keep it after a reload (its storage refused it): where it
  // was made ("preset", "acts", "device" or "json"), so it's said there, beside what you just did, never only at the
  // page's top above the screen (the create-project grader on 8a4ed16, C104/C105/C106: on a phone Reset, Show
  // everything and Compact said it above the viewport, and the control looked as if all was well)
  // sharedAt: where the last change XO is sent was made (preset | acts | json): XO's answer comes later, and is said there
  const V = { confirm: null, err: null, pickErr: null, draft: null, saveErr: null, unkept: false, sharedAt: null, built: false };
  const page = document.querySelector('[data-page="shape"]');
  const box = page && page.querySelector(".shp");
  const nav = document.querySelector("#settings .set-nav");
  const navOrder = nav ? [...nav.querySelectorAll("[data-set]")].map((b) => b.dataset.set) : [];
  const cardsOf = () => PRESETS.map((p) => { const f = shape.presetFile(p.id) || {}; return { id: p.id, name: f.name || p.name, summary: f.summary || p.summary }; });
  const nameOf = (id) => (cardsOf().find((c) => c.id === id) || { name: id }).name;

  // ── what the page reads straight from the shape ─────────────────────────────
  function apply() {
    document.documentElement.dataset.density = shape.get("density");
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
    if (want.length !== cur.length || want.some((el, i) => cur[i] !== el)) placeInOrder(want);
  }
  /** Put the rail's items in order without ever moving the one with focus (moving a focused element drops its
   *  focus to the page: a preset applying while you're on Shape's tab rearranged the rail under it, BODY on every
   *  Marketing path: the create-project grader on 8a4ed16, SHAPE-FOCUS): what's around it moves instead. */
  function placeInOrder(want) {
    const focus = document.activeElement;
    let ref = nav.firstChild;
    for (const el of want) {
      if (el === ref) { ref = ref.nextSibling; continue; }
      if (focus && el.contains(focus)) {
        // what stands before it goes after it, so it stays where it is
        while (ref && ref !== el) { const next = ref.nextSibling; nav.appendChild(ref); ref = next; }
        ref = el.nextSibling; continue;
      }
      nav.insertBefore(el, ref);
    }
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

  // what's held changed (a write refused or unreachable, or it landed): the page says so while it shows
  shape.onHeld?.(() => { if (page && !page.hidden && !document.querySelector("#settings").hidden) { render(); inSightHeld(); } });

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
    return "" + heldAt(null) +
      `<section class="set-sec" aria-labelledby="shp-h-p"><h3 id="shp-h-p">What you mostly do here</h3>` +
      `<div class="set-choices" role="radiogroup" aria-labelledby="shp-h-p">${cardsOf().map((p) => `<button type="button" class="set-choice${p.id === id ? " is-on" : ""}" role="radio" aria-checked="${p.id === id}" data-shp-preset="${esc(p.id)}"${rovingTab(p.id === id)}${busyAttrs(SHAPING)}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(p.name)}</b><span>${esc(p.summary)}</span></span></button>`).join("")}</div>` +
      // once Switch is pressed the choice is on its way (its preset may still be reading): Keep mine waits with it
      (c ? `<div class="shp-confirm" role="alertdialog" aria-labelledby="shp-cf"><p id="shp-cf"><b>Switch to ${esc(nameOf(c))}?</b> Your own changes are cleared. What you set on this device stays.</p>${V.pickErr ? `<p class="set-err" role="alert">${esc(V.pickErr)}</p>` : ""}<div class="set-fa"><button type="button" class="btn" data-shp-keep${isPending(SHAPING) ? ' aria-disabled="true"' : ""}>Keep mine</button><button type="button" class="btn btn-pri" data-shp-switch="${esc(c)}"${busyAttrs(SHAPING)}>Switch</button></div></div>`
        : V.pickErr ? `<p class="set-err" role="alert">${esc(V.pickErr)}</p>` : "") + unkeptAt("preset") + heldAt("preset") +
      (shape.presetError(id) ? `<p class="set-err" role="alert">${esc(nameOf(id))} couldn't be read (${esc(shape.presetError(id))}). XO shows everything until it can.</p>` : "") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="shp-h-d"><h3 id="shp-h-d">What it changes</h3>` +
      (diff.length ? list(diff) : `<p class="set-lead">Nothing: every part of XO, as it is today.</p>`) +
      (own.length ? `<p class="set-lead shp-own">Your own changes on top</p>${list(own)}` : "") +
      (V.err ? `<p class="set-err" role="alert">${esc(V.err)}</p>` : "") +
      `<div class="set-fa shp-acts"><button type="button" class="btn" data-shp-reset${own.length ? "" : " disabled"}>Reset to preset</button><button type="button" class="btn" data-shp-all>Show everything</button></div>` + unkeptAt("acts") + heldAt("acts") + `</section>` +
      `<section class="set-sec" aria-labelledby="shp-h-v"><h3 id="shp-h-v">On this device</h3>` +
      `<div class="set-row"><div class="set-l"><b id="shp-dense-l">Compact</b><span>Tighter rows and controls, and 14 px reading text. Only here: your other devices keep their own.</span></div>` +
      `<button type="button" class="switch" role="switch" aria-checked="${dense}" aria-labelledby="shp-dense-l" data-shp-dense><span class="th-track" aria-hidden="true"><span class="th-knob">${ICON.list}</span></span></button></div>` + unkeptAt("device") + `</section>`;
  }
  /** Edit as JSON: built once, so typing is never redrawn under you; checked as you type. */
  function jsonBuild() {
    const d = document.createElement("details");
    d.className = "shp-json";
    d.innerHTML = `<summary><span class="shp-chev" aria-hidden="true">${ICON.chevron}</span>Edit as JSON<span class="shp-n" data-shp-n></span></summary>` +
      `<div class="shp-jb"><p class="set-lead">Your own layer, on top of the preset. Only what you write here differs from it; a key you leave out comes from the preset. An unknown key is ignored, and a bad value falls back to the preset's.</p>` +
      `<label class="field"><span>Mine</span><textarea class="shp-ta" rows="12" spellcheck="false" autocomplete="off" data-shp-json aria-describedby="shp-js"></textarea></label>` +
      `<p class="shp-status" id="shp-js" role="status"></p><div class="shp-held" data-shp-held-json></div>` +
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
    const bad = V.saveErr || r.error || (V.unkept === "json" && V.draft == null ? UNKEPT : null); // saved, not kept: said here too
    d.querySelector(".shp-status").textContent = bad || (V.draft == null ? "" : probs.length ? "It can be saved: XO uses what it understands, as the list below says." : "Looks right.");
    d.querySelector(".shp-status").classList.toggle("is-err", !!bad);
    // XO's answer to the last Save, when it refused it or couldn't be reached: here, beside the text (drawn only when
    // it changes, so the alert is said once)
    const hj = d.querySelector("[data-shp-held-json]"), hs = heldAt("json");
    if (hj.innerHTML !== hs) hj.innerHTML = hs;
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
  /** What a change did, said truthfully: refused, why; applied but not kept by this browser, that (instead of "done"). */
  const said = (r, ok, where) => {
    if (where !== "device") V.sharedAt = where;
    V.err = r && r.error ? r.error : null;
    if (!V.err) { V.unkept = r.kept === false ? where : null; if (!V.unkept) announce(ok); }
    render();
    inSightUnkept();
  };
  /** The warning, drawn beside what you did, in sight: its scroller moves the least distance if it must (a phone's
   *  screen ends close under a row). Never the page's top. */
  const inSightUnkept = () => { const w = V.unkept && box.querySelector("[data-shp-unkept]"); if (w) bringWhole(w); };
  const unkeptAt = (where) => (V.unkept === where ? `<p class="set-err" role="alert" data-shp-unkept>${esc(UNKEPT)}</p>` : "");
  /** A change XO hasn't taken, said as long as it isn't there: refused (and why), or on its way again (and, when this
   *  browser couldn't keep it either, that it lasts only while this page is open). Said where the last change sent was
   *  made (V.sharedAt), the answer arriving after it; at the top (null) only for one held from before this page. */
  const heldAt = (where) => {
    const held = shape.held;
    if (!held || (V.sharedAt || null) !== where) return "";
    return held.why === "refused"
      ? `<p class="set-err" role="alert" data-shp-held>XO refused your last shape change. ${esc(held.text)} ${held.kept ? "It's kept on this device only: your other devices don't have it." : "This browser can't keep it after a reload either: it lasts only while this page is open."} Your next change tries again.</p>`
      : held.kept ? `<p class="set-note" role="status" data-shp-held>Not on your other devices yet: XO couldn't be reached. It's sent again when XO answers.</p>`
        : `<p class="set-err" role="alert" data-shp-held>Not saved yet: XO couldn't be reached, and this browser can't keep it after a reload. It's sent again while this page is open.</p>`;
  };
  /** XO's answer, drawn where you acted, in sight (its scroller's least move); focus stays where it is. */
  const inSightHeld = () => { const w = V.sharedAt && box && box.querySelector("[data-shp-held]"); if (w) bringWhole(w); };
  /** Where an action that takes its own control away (or disables it) leaves the keyboard: el, unless it moved on. */
  function landOn(el, from) {
    const a = document.activeElement;
    if (a && a !== document.body && a !== from && a.isConnected && !a.disabled) return;
    el?.focus({ preventScroll: true });
  }
  const chosenCard = () => box.querySelector('[data-shp-preset][aria-checked="true"]');
  async function choose(id, from) {
    V.pickErr = null;
    V.sharedAt = "preset";
    const p = once(SHAPING, async () => {
      const r = await shape.choose(id);
      // refused: the question (or the cards) stays, with the reason beside it, and the keyboard stays where it was
      // (on Switch, to try again, or the card)
      if (r && r.error) { V.pickErr = r.error; render(); return; }
      // chosen: the question (if one was asked) goes, and in the same step the keyboard goes to the card now chosen
      const d = describeShape(createShape([]), shape.presetShape(id));
      V.confirm = null; V.err = null; V.unkept = r.kept === false ? "preset" : null;
      if (!V.unkept) announce(`${nameOf(id)}. ${d.length ? d[0] : "Every part of XO, as it is today."}`);
      render();
      landOn(chosenCard(), from);
      inSightUnkept();
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
      if (t.closest("[data-shp-keep]")) { if (isPending(SHAPING)) return; V.confirm = null; V.pickErr = null; render(); chosenCard()?.focus({ preventScroll: true }); return; }
      const sw = t.closest("[data-shp-switch]");
      if (sw) { choose(sw.dataset.shpSwitch, sw); return; }
      // Reset disables itself (there's nothing left to reset): the keyboard goes to the preset it's back to
      if (t.closest("[data-shp-reset]")) { const b = t.closest("[data-shp-reset]"); V.draft = null; said(shape.resetToPreset(), `Back to ${nameOf(shape.presetId || "everything")}, as it comes.`, "preset"); landOn(chosenCard(), b); return; }
      if (t.closest("[data-shp-all]")) { V.draft = null; said(shape.showEverything(), "Everything shows. Reset to preset takes it back.", "acts"); return; }
      if (t.closest("[data-shp-dense]")) { const on = shape.get("density") !== "compact"; said(shape.setDevice({ density: on ? "compact" : "comfortable" }), on ? "Compact on this device." : "Comfortable on this device.", "device"); return; }
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
    V.sharedAt = "json";
    const p = once(SHAPING, async () => {
      const res = await shape.setMine(r.doc);
      if (res.error) { V.saveErr = res.error; return false; }
      if (V.draft === sent) V.draft = null; // typed on while it saved: that's still a draft
      V.err = null; V.unkept = res.kept === false ? "json" : null;
      if (!V.unkept) announce("Saved. Your shape is applied.");
      return true;
    });
    jsonRender();
    const ok = await p;
    render();
    if (ok && V.draft == null) landOn(box.querySelector("[data-shp-json]"), from);
  }

  return { apply, open, render, homeOrder };
}
