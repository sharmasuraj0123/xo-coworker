// Settings › Shape, the first-run question, and the few places the page reads the shape directly
// (density on <html>, the Settings rail's Advanced group, Home's order). js/shape.js holds the rules;
// this only draws them. Every change is the person's own click, applied at once and said back plainly.
// The sidebar is never touched here: a shape may only hide its Shells row (js/shells/dock.js).
//
// app.js calls: apply (the shape changed), open (the page was opened), homeOrder, firstRun.

import { esc } from "./util.js";
import { ICON } from "./ui.js";
import { PRESETS, createShape, describeShape } from "./shape.js";

/** Settings' rail icon for Shape: a window and its parts. */
export const SHAPE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15M9.5 11h11"/></svg>';

/** Home's parts by surface: Your next move (and the asks after it), Handled, Recently made. */
const HOME = { "xo:home/next": ["hm-next", "hm-then"], "xo:home/handled": ["hm-end"], "xo:home/recent": ["hm-made"] };

export function createShapeView({ shape, announce = () => {} }) {
  const V = { confirm: null, err: null, draft: null, built: false };
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
    if (want.length !== cur.length || want.some((el, i) => cur[i] !== el)) for (const el of want) nav.appendChild(el);
  }
  /** Home's parts in the shape's order; a part it doesn't keep is hidden. Moved only when the order changed. */
  function homeOrder(body) {
    if (!body) return;
    const list = shape.list("home").map((s) => s.id);
    const on = new Set(list);
    const order = [...list, ...Object.keys(HOME).filter((id) => !on.has(id))];
    const want = order.flatMap((id) => HOME[id].map((x) => body.querySelector(`#${x}`))).filter(Boolean);
    for (const [id, parts] of Object.entries(HOME)) for (const x of parts) { const el = body.querySelector(`#${x}`); if (el) el.hidden = !on.has(id); }
    const cur = [...body.children];
    if (want.some((el, i) => cur[i] !== el)) for (const el of want) body.appendChild(el);
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
      `<div class="set-choices" role="radiogroup" aria-labelledby="shp-h-p">${cardsOf().map((p) => `<button type="button" class="set-choice${p.id === id ? " is-on" : ""}" role="radio" aria-checked="${p.id === id}" data-shp-preset="${esc(p.id)}"><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(p.name)}</b><span>${esc(p.summary)}</span></span></button>`).join("")}</div>` +
      (c ? `<div class="shp-confirm" role="alertdialog" aria-labelledby="shp-cf"><p id="shp-cf"><b>Switch to ${esc(nameOf(c))}?</b> Your own changes are cleared. What you set on this device stays.</p><div class="set-fa"><button type="button" class="btn" data-shp-keep>Keep mine</button><button type="button" class="btn btn-pri" data-shp-switch="${esc(c)}">Switch</button></div></div>` : "") +
      (shape.presetError(id) ? `<p class="set-err" role="alert">${esc(nameOf(id))} couldn't be read (${esc(shape.presetError(id))}). XO shows everything until it can.</p>` : "") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="shp-h-d"><h3 id="shp-h-d">What it changes</h3>` +
      (diff.length ? list(diff) : `<p class="set-lead">Nothing: every part of XO, as it is today.</p>`) +
      (own.length ? `<p class="set-lead shp-own">Your own changes on top</p>${list(own)}` : "") +
      (V.err ? `<p class="set-err" role="alert">${esc(V.err)}</p>` : "") +
      `<div class="set-fa shp-acts"><button type="button" class="btn" data-shp-reset${own.length ? "" : " disabled"}>Reset to preset</button><button type="button" class="btn" data-shp-all>Show everything</button></div></section>` +
      `<section class="set-sec" aria-labelledby="shp-h-v"><h3 id="shp-h-v">On this device</h3>` +
      `<div class="set-row"><div class="set-l"><b id="shp-dense-l">Compact</b><span>Tighter rows and controls, and 14 px reading text. Only here: your other devices keep their own.</span></div>` +
      `<button type="button" class="switch" role="switch" aria-checked="${dense}" aria-labelledby="shp-dense-l" data-shp-dense><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></div></section>`;
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
    d.querySelector(".shp-status").textContent = r.error || (V.draft == null ? "" : probs.length ? "It can be saved: XO uses what it understands, as the list below says." : "Looks right.");
    d.querySelector(".shp-status").classList.toggle("is-err", !!r.error);
    d.querySelector("[data-shp-save]").disabled = V.draft == null || !!r.error;
    d.querySelector("[data-shp-revert]").disabled = V.draft == null;
  }
  function render() {
    if (!box) return;
    if (!V.built) {
      box.innerHTML = `<div class="shp-top"></div>`;
      box.appendChild(jsonBuild());
      V.built = true;
    }
    const top = box.querySelector(".shp-top");
    // a redraw keeps the keyboard where it was (by the control's data-* key), never on <body>
    const a = document.activeElement;
    const key = a && top.contains(a) ? [...a.attributes].find((x) => x.name.startsWith("data-shp")) : null;
    const html = topHtml();
    if (top._h !== html) { top.innerHTML = html; top._h = html; for (const k of top.querySelectorAll(".th-knob")) k.innerHTML = ICON.list; }
    if (key && !top.contains(document.activeElement)) {
      // the same control again; if it's gone or now disabled (Reset, once there's nothing to reset), the chosen card
      const same = top.querySelector(`[${key.name}${key.value ? `="${CSS.escape(key.value)}"` : ""}]`);
      (same && !same.disabled ? same : top.querySelector(`[data-shp-preset][aria-checked="true"]`))?.focus({ preventScroll: true });
    }
    jsonRender();
  }
  const said = (r, ok) => { V.err = r && r.error ? r.error : null; if (!V.err) announce(ok); render(); };
  async function choose(id) {
    V.confirm = null;
    const r = await shape.choose(id);
    const d = describeShape(createShape([]), shape.presetShape(id));
    said(r, `${nameOf(id)}. ${d.length ? d[0] : "Every part of XO, as it is today."}`);
  }

  if (box) {
    box.addEventListener("click", (e) => {
      const t = e.target;
      const p = t.closest("[data-shp-preset]");
      if (p) {
        const id = p.dataset.shpPreset;
        if (id === (shape.presetId || "everything") && !V.confirm) return;
        // your own changes are cleared by a switch: asked first, in place
        if (shape.ownKeys().length && id !== V.confirm) { V.confirm = id; render(); box.querySelector("[data-shp-switch]")?.focus({ preventScroll: true }); return; }
        choose(id); return;
      }
      if (t.closest("[data-shp-keep]")) { V.confirm = null; render(); box.querySelector(`[data-shp-preset][aria-checked="true"]`)?.focus({ preventScroll: true }); return; }
      const sw = t.closest("[data-shp-switch]");
      if (sw) { choose(sw.dataset.shpSwitch); return; }
      if (t.closest("[data-shp-reset]")) { V.draft = null; said(shape.resetToPreset(), `Back to ${nameOf(shape.presetId || "everything")}, as it comes.`); return; }
      if (t.closest("[data-shp-all]")) { V.draft = null; said(shape.showEverything(), "Everything shows. Reset to preset takes it back."); return; }
      if (t.closest("[data-shp-dense]")) { const on = shape.get("density") !== "compact"; said(shape.setDevice({ density: on ? "compact" : "comfortable" }), on ? "Compact on this device." : "Comfortable on this device."); return; }
      if (t.closest("[data-shp-revert]")) { V.draft = null; jsonRender(); announce("Back to what's saved."); return; }
      if (t.closest("[data-shp-save]")) {
        const r = check(V.draft ?? "");
        if (r.error) { jsonRender(); return; }
        shape.setMine(r.doc).then((res) => { if (!res.error) V.draft = null; said(res, "Saved. Your shape is applied."); });
      }
    });
    box.addEventListener("input", (e) => {
      if (!e.target.matches("[data-shp-json]")) return;
      V.draft = e.target.value === mineText() ? null : e.target.value;
      jsonRender();
    });
    // Tab in the JSON writes two spaces (Shift+Tab and Esc still move on)
    box.addEventListener("keydown", (e) => {
      if (!e.target.matches("[data-shp-json]") || e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    });
  }

  // ── the first run: one question, never again once answered ──────────────────
  function firstRun() {
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
    const done = async (id) => {
      if (el._done) return;
      el._done = true;
      await shape.choose(id);
      el.classList.add("is-out");
      setTimeout(() => el.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
      (back && back.isConnected && back !== document.body ? back : document.getElementById("say"))?.focus?.({ preventScroll: true });
      announce(id === "everything" ? "Everything shows. Settings › Shape changes it any time." : `${nameOf(id)}. Settings › Shape changes it any time.`);
    };
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
      // the keyboard stays in the sheet until it's answered
      const f = [...el.querySelectorAll("[data-shf]"), el.querySelector("[data-shf-close]")];
      const i = f.indexOf(document.activeElement);
      if (i < 0) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); return; }
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    // the sheet itself takes focus, so no choice looks made before you make it; Tab reaches the first
    el.querySelector(".shp-first").focus({ preventScroll: true });
  }

  return { apply, open, render, homeOrder, firstRun };
}
