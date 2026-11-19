// @ts-check

// Settings › Shape, the Settings rail's Advanced group, density on <html> and Home's order; js/shape.js holds the rules.

import { esc, once, isPending, busyAttrs } from "../../core/platform/index.js";
import { ICON } from "../../js/ui.js";
import { PRESETS, createShape, describeShape } from "../../js/shape.js";
import { redraw } from "../../js/redraw.js";
import { bringWhole } from "../../js/focusview.js";
import { rovingTab } from "../../js/keynav.js";

export const SHAPE_IC = ICON.shape;

// said when a change applied but this browser won't keep it (the shape store's kept: false)
export const UNKEPT = "Applied for now: this browser won't keep it after a reload (its storage is full or switched off).";

/** @type {Record<string, string[]>} */
const HOME = { "xo:home/next": ["hm-next", "hm-then"], "xo:home/handled": ["hm-end"], "xo:home/recent": ["hm-made"] };
// a preset chosen, or your JSON saved: each may read a preset file first, so one goes at a time
const SHAPING = "shape";

/** @param {Element[]} els */
function inOrder(els) {
  const a = document.activeElement;
  const k = Math.max(0, els.findIndex((el) => el.contains(a)));
  for (let i = k - 1; i >= 0; i--) if (els[i].nextElementSibling !== els[i + 1]) els[i + 1].before(els[i]);
  for (let i = k + 1; i < els.length; i++) if (els[i].previousElementSibling !== els[i - 1]) els[i - 1].after(els[i]);
}

/** @param {import("./types").ShapeViewDeps} deps */
export function createShapeView({ shape, announce = () => {}, notice = () => {} }) {
  /** @type {import("./types").ShapeViewState} */
  const V = { confirm: null, err: null, pickErr: null, draft: null, saveErr: null, unkept: false, sharedAt: null, built: false };
  const page = /** @type {HTMLElement} */ (document.querySelector('[data-page="shape"]'));
  const box = /** @type {HTMLElement} */ (page && page.querySelector(".shp"));
  const nav = /** @type {HTMLElement} */ (document.querySelector("#settings .set-nav"));
  const navOrder = nav ? [.../** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll("[data-set]"))].map((b) => /** @type {string} */ (b.dataset.set)) : [];
  const cardsOf = () => PRESETS.map((/** @type {any} */ p) => { const f = shape.presetFile(p.id) || {}; return { id: p.id, name: f.name || p.name, summary: f.summary || p.summary }; });
  /** @param {string} id */
  const nameOf = (id) => (cardsOf().find((c) => c.id === id) || { name: id }).name;

  function apply() {
    document.documentElement.dataset.density = shape.get("density");
    railRender();
    if (page && !page.hidden && !/** @type {HTMLElement} */ (document.querySelector("#settings")).hidden) render();
  }
  // technical pages a shape marks advanced move under one quiet "Advanced" label at the rail's foot
  function railRender() {
    if (!nav) return;
    const adv = new Set(shape.list("settings").filter((/** @type {any} */ s) => s.advanced).map((/** @type {any} */ s) => s.id.slice("xo:settings/".length)));
    let head = /** @type {HTMLElement | null} */ (nav.querySelector(".shp-navh"));
    if (!head) { head = document.createElement("p"); head.className = "shp-navh"; head.setAttribute("aria-hidden", "true"); head.textContent = "Advanced"; }
    /** @param {string} id */
    const btn = (id) => nav.querySelector(`[data-set="${id}"]`);
    const want = /** @type {Element[]} */ ([...navOrder.filter((id) => !adv.has(id)).map(btn), ...(adv.size ? [head, ...navOrder.filter((id) => adv.has(id)).map(btn)] : [])].filter(Boolean));
    if (!adv.size) head.remove();
    for (const id of navOrder) btn(id)?.toggleAttribute("data-advanced", adv.has(id));
    const cur = [...nav.children];
    if (want.length !== cur.length || want.some((el, i) => cur[i] !== el)) placeInOrder(want);
  }
  /** The rail's items in order without ever moving the one with focus: what's around it moves instead. @param {Element[]} want */
  function placeInOrder(want) {
    const focus = document.activeElement;
    /** @type {ChildNode | null} */
    let ref = nav.firstChild;
    for (const el of want) {
      if (el === ref) { ref = ref.nextSibling; continue; }
      if (focus && el.contains(focus)) {
        while (ref && ref !== el) { const next = ref.nextSibling; nav.appendChild(ref); ref = next; }
        ref = el.nextSibling; continue;
      }
      nav.insertBefore(el, ref);
    }
  }
  /** Home's parts in the shape's order, a part it doesn't keep hidden; only those parts move, never one in place. @param {HTMLElement | null} body */
  function homeOrder(body) {
    if (!body) return;
    const list = /** @type {string[]} */ (shape.list("home").map((/** @type {any} */ s) => s.id));
    const on = new Set(list);
    const order = [...list, ...Object.keys(HOME).filter((id) => !on.has(id))];
    for (const [id, parts] of Object.entries(HOME)) for (const x of parts) { const el = /** @type {HTMLElement | null} */ (body.querySelector(`#${x}`)), hide = !on.has(id); if (el && el.hidden !== hide) el.hidden = hide; }
    inOrder(/** @type {Element[]} */ (order.flatMap((id) => HOME[id].map((x) => body.querySelector(`:scope > #${x}`))).filter(Boolean)));
  }

  shape.onHeld?.(() => { if (page && !page.hidden && !/** @type {HTMLElement} */ (document.querySelector("#settings")).hidden) { render(); inSightHeld(); } });

  // the page was opened: the cards are named from the presets' own files (GET, once a page)
  async function open() {
    render();
    await Promise.all(PRESETS.filter((/** @type {any} */ p) => !p.builtin).map((/** @type {any} */ p) => shape.loadPreset(p.id).catch(() => null)));
    if (!page.hidden) render();
  }
  const mineText = () => JSON.stringify(shape.mine || { shape: 1 }, null, 2);
  /** @param {string[]} lines */
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
  // Edit as JSON: built once, so typing is never redrawn under you; checked as you type
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
  /** @param {string} text @returns {import("./types").ShapeCheck} */
  function check(text) {
    let doc;
    try { doc = JSON.parse(text); } catch (/** @type {any} */ err) { return { error: `Not JSON yet: ${String(err.message).replace(/^JSON\.parse: /, "")}` }; }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { error: "Your layer must be a JSON object, { … }." };
    const id = typeof doc.preset === "string" ? doc.preset : shape.presetId;
    const file = id && shape.presetFile(id);
    const s = createShape([file && { from: "preset", doc: file }, { from: "mine", doc }, { from: "device", doc: shape.device }].filter(Boolean));
    return { doc, problems: s.problems };
  }
  function jsonRender() {
    const d = /** @type {HTMLElement} */ (box.querySelector(".shp-json"));
    const ta = /** @type {HTMLTextAreaElement} */ (d.querySelector("[data-shp-json]"));
    if (V.draft == null && ta.value !== mineText()) ta.value = mineText();
    ta.rows = Math.min(24, Math.max(8, ta.value.split("\n").length + 1));
    /** @type {import("./types").ShapeCheck} */
    const r = V.draft == null ? { doc: shape.mine, problems: shape.problems } : check(V.draft);
    const probs = r.problems || [];
    const pl = /** @type {HTMLElement} */ (d.querySelector(".shp-probs"));
    pl.hidden = !probs.length;
    const probsEl = /** @type {HTMLElement} */ (d.querySelector("[data-shp-probs]"));
    probsEl.innerHTML = probs.map((p) => `<li><span class="shp-where">${esc(p.from === "mine" ? "Yours" : p.from === "device" ? "This device" : p.from === "preset" ? "The preset" : p.from)}</span><span class="shp-sep" aria-hidden="true">·</span><code>${esc(p.path || "the layer")}</code> ${esc(p.text)}.</li>`).join("");
    const nEl = /** @type {HTMLElement} */ (d.querySelector("[data-shp-n]"));
    nEl.textContent = probs.length ? `${probs.length} ${probs.length === 1 ? "problem" : "problems"}` : "";
    const bad = V.saveErr || r.error || (V.unkept === "json" && V.draft == null ? UNKEPT : null); // saved, not kept: said here too
    const status = /** @type {HTMLElement} */ (d.querySelector(".shp-status"));
    status.textContent = bad || (V.draft == null ? "" : probs.length ? "It can be saved: XO uses what it understands, as the list below says." : "Looks right.");
    status.classList.toggle("is-err", !!bad);
    const hj = /** @type {HTMLElement} */ (d.querySelector("[data-shp-held-json]")), hs = heldAt("json");
    if (hj.innerHTML !== hs) hj.innerHTML = hs;
    const save = /** @type {HTMLButtonElement} */ (d.querySelector("[data-shp-save]")), busy = isPending(SHAPING);
    save.disabled = !busy && (V.draft == null || !!r.error);
    for (const a of ["aria-busy", "aria-disabled"]) if (busy) save.setAttribute(a, "true"); else save.removeAttribute(a);
    /** @type {HTMLButtonElement} */ (d.querySelector("[data-shp-revert]")).disabled = V.draft == null;
  }
  function render() {
    if (!box) return;
    if (!V.built) {
      box.innerHTML = `<div class="shp-top"></div>`;
      box.appendChild(jsonBuild());
      V.built = true;
    }
    redraw(box.querySelector(".shp-top"), topHtml());
    jsonRender();
  }
  /** @param {any} r @param {string} ok @param {string} where */
  const said = (r, ok, where) => {
    if (where !== "device") V.sharedAt = where;
    V.err = r && r.error ? r.error : null;
    if (!V.err) { V.unkept = r.kept === false ? where : null; if (!V.unkept) announce(ok); }
    render();
    inSightUnkept();
  };
  const inSightUnkept = () => { const w = V.unkept && box.querySelector("[data-shp-unkept]"); if (w) bringWhole(w); };
  /** @param {string} where */
  const unkeptAt = (where) => (V.unkept === where ? `<p class="set-err" role="alert" data-shp-unkept>${esc(UNKEPT)}</p>` : "");
  /** @param {string | null} where */
  const heldAt = (where) => {
    const held = shape.held;
    if (!held || (V.sharedAt || null) !== where) return "";
    return held.why === "refused"
      ? `<p class="set-err" role="alert" data-shp-held>XO refused your last shape change. ${esc(held.text)} ${held.kept ? "It's kept on this device only: your other devices don't have it." : "This browser can't keep it after a reload either: it lasts only while this page is open."} Your next change tries again.</p>`
      : held.kept ? `<p class="set-note" role="status" data-shp-held>Not on your other devices yet: XO couldn't be reached. It's sent again when XO answers.</p>`
        : `<p class="set-err" role="alert" data-shp-held>Not saved yet: XO couldn't be reached, and this browser can't keep it after a reload. It's sent again while this page is open.</p>`;
  };
  const inSightHeld = () => { const w = V.sharedAt && box && box.querySelector("[data-shp-held]"); if (w) bringWhole(w); };
  /** @param {Element | null | undefined} el @param {Element | null} from */
  function landOn(el, from) {
    const a = /** @type {HTMLButtonElement | null} */ (document.activeElement);
    if (a && a !== document.body && a !== from && a.isConnected && !a.disabled) return;
    /** @type {HTMLElement | null | undefined} */ (el)?.focus({ preventScroll: true });
  }
  const chosenCard = () => /** @type {HTMLElement | null} */ (box.querySelector('[data-shp-preset][aria-checked="true"]'));
  /** @param {string} id @param {Element} from */
  async function choose(id, from) {
    V.pickErr = null;
    V.sharedAt = "preset";
    const p = once(SHAPING, async () => {
      const r = await shape.choose(id);
      if (r && r.error) { V.pickErr = r.error; render(); return; }
      const d = describeShape(createShape([]), shape.presetShape(id));
      V.confirm = null; V.err = null; V.unkept = r.kept === false ? "preset" : null;
      if (!V.unkept) announce(`${nameOf(id)}. ${d.length ? d[0] : "Every part of XO, as it is today."}`);
      render();
      landOn(chosenCard(), from);
      inSightUnkept();
    });
    render();
    await p;
    render();
  }

  if (box) {
    box.addEventListener("click", (e) => {
      const t = /** @type {Element} */ (e.target);
      const p = /** @type {HTMLElement | null} */ (t.closest("[data-shp-preset]"));
      if (p) {
        const id = /** @type {string} */ (p.dataset.shpPreset);
        if (isPending(SHAPING) || (id === (shape.presetId || "everything") && !V.confirm)) return;
        if (shape.ownKeys().length && id !== V.confirm) { V.confirm = id; render(); /** @type {HTMLElement | null} */ (box.querySelector("[data-shp-switch]"))?.focus({ preventScroll: true }); return; }
        choose(id, p); return;
      }
      if (t.closest("[data-shp-keep]")) { if (isPending(SHAPING)) return; V.confirm = null; V.pickErr = null; render(); chosenCard()?.focus({ preventScroll: true }); return; }
      const sw = /** @type {HTMLElement | null} */ (t.closest("[data-shp-switch]"));
      if (sw) { choose(/** @type {string} */ (sw.dataset.shpSwitch), sw); return; }
      if (t.closest("[data-shp-reset]")) { const b = t.closest("[data-shp-reset]"); V.draft = null; said(shape.resetToPreset(), `Back to ${nameOf(shape.presetId || "everything")}, as it comes.`, "preset"); landOn(chosenCard(), b); return; }
      if (t.closest("[data-shp-all]")) { V.draft = null; said(shape.showEverything(), "Everything shows. Reset to preset takes it back.", "acts"); return; }
      if (t.closest("[data-shp-dense]")) { const on = shape.get("density") !== "compact"; said(shape.setDevice({ density: on ? "compact" : "comfortable" }), on ? "Compact on this device." : "Comfortable on this device.", "device"); return; }
      const ta = () => box.querySelector("[data-shp-json]");
      const rv = t.closest("[data-shp-revert]");
      if (rv) { V.draft = null; V.saveErr = null; jsonRender(); landOn(ta(), rv); announce("Back to what's saved."); return; }
      const sv = t.closest("[data-shp-save]");
      if (sv) { save(sv); return; }
    });
    box.addEventListener("input", (e) => {
      const ta = /** @type {HTMLTextAreaElement} */ (e.target);
      if (!ta.matches("[data-shp-json]")) return;
      V.draft = ta.value === mineText() ? null : ta.value;
      V.saveErr = null;
      jsonRender();
    });
    box.addEventListener("keydown", (e) => {
      if (!/** @type {Element} */ (e.target).matches("[data-shp-json]") || e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    });
  }

  /** @param {Element} from */
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
      if (V.draft === sent) V.draft = null;
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
