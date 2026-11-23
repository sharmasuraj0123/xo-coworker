// @ts-check

import { esc, space } from "../../core/platform/index.js";
import { api } from "../../core/platform/api.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { rovingTab } from "../../core/ui/a11y/keynav.js";
import { rtMark } from "../../core/services/runtimes.js";
import { EFFORT_WORD, EFFORT_HINT } from "./effort.js";

/** @typedef {import("./setup-types").SetupState} SetupState @typedef {import("./setup-types").SetupDependencies} SetupDependencies @typedef {import("./setup-types").Model} Model @typedef {import("./setup-types").Runtime} Runtime */

/** @type {Record<string, [string, string, string]>} */
export const MODE_WORDS = {
  plan: ["Plan only", "Looks around and suggests a plan. Changes nothing.", "lightbulb"],
  ask: ["Ask first", "Checks with you before every step.", "question"],
  accept_edits: ["Edits", "Edits files on its own, checks with you for the rest.", "edit"],
  auto: ["Auto", "Works on its own; a safety check holds back anything risky.", "shield-check"],
  deny_unasked: ["Rules only", "Does only what your saved rules allow.", "rules"],
};
const MODE_ORDER = Object.keys(MODE_WORDS);

const PREFS = "cv-chat-prefs";
export const store = { get() { try { return JSON.parse(localStorage.getItem(PREFS) || "{}"); } catch { return {}; } }, set(/** @type {Record<string, string | null>} */ v) { try { localStorage.setItem(PREFS, JSON.stringify(v)); } catch { /* private */ } } };

/** @param {SetupState} C @param {SetupDependencies} deps */
export function createSetup(C, { world, schedule, runtime, feature, cliName }) {
  /** The modes a runtime offers (never "bypass": plain chat refuses it). @param {Runtime | null} rt */
  const modesOf = (rt) => ((feature(rt, "permissions.mode") || {}).values || []).filter((m) => m !== "bypass");
  /** The new chat's setup: your last choices, kept only where the chosen runtime still offers them. */
  function setup() {
    const p = C.prefs;
    const rt = runtime(p.agent) || runtime(null);
    const agent = rt ? rt.name : null;
    const modes = modesOf(rt);
    const mode = modes.includes(/** @type {string} */ (p.mode)) ? p.mode : modes.includes("auto") ? "auto" : modes[0] || null;
    let model = p.model || null, gone = null, unsure = null;
    if (model && !(C.read.has(agent) && offered(agent).some((m) => m.id === model))) {
      if (C.read.has(agent)) gone = model; else unsure = { model, failed: C.failed.has(agent) };
      model = null;
    }
    return { rt, agent, model, gone, unsure, effort: p.effort || null, mode, modes, cwd: p.cwd || "" };
  }
  /** @param {string | null} agent */
  const offered = (agent) => (C.models.get(agent) || []).filter((m) => !m.is_default && (m.family_default || !m.family));
  /** The efforts for a model (or the agent's default model): its own list, else the runtime's (§2.7). @param {ReturnType<typeof setup>} st */
  function effortsFor(st) {
    const list = C.models.get(st.agent) || [];
    const m = list.find((x) => x.id === st.model) || list.find((x) => x.is_default) || null;
    if (m && !m.takes_effort) return [];
    if (m && m.efforts && m.efforts.length) return m.efforts;
    const f = feature(st.rt, "effort");
    return f && f.support !== "unsupported" ? f.values || [] : [];
  }
  /** @param {string | null} agent */
  async function ensureModels(agent, { again = false } = {}) {
    if (!agent) return;
    if (again && C.failed.has(agent)) { C.failed.delete(agent); C.models.delete(agent); }
    if (C.models.has(agent)) return;
    C.models.set(agent, []);
    try { C.models.set(agent, (await api.models(agent)).models || []); C.read.add(agent); } catch (err) { C.failed.set(agent, (/** @type {Error} */ (err)).message || "no answer"); /* the agent's default only, said so */ }
    renderSetup(); schedule();
  }

  /** @param {Model} m */
  const modelDesc = (m) => (m.description || "").replace(/\.$/, "");

  /** @param {HTMLElement} anchor */
  async function openSetup(anchor, part = "model") {
    const pop = /** @type {HTMLElement} */ (document.getElementById("cs-pop"));
    if (C.pop.open) C.pop.anchor?.setAttribute("aria-expanded", "false");
    C.pop = { open: true, anchor, part };
    anchor?.setAttribute("aria-expanded", "true");
    // shown (unseen) before it is measured, so it opens where it belongs the first time
    pop.style.visibility = "hidden";
    pop.hidden = false;
    renderSetup();
    pop.style.visibility = "";
    pop.focus({ preventScroll: true });
    const st = setup();
    if (st.agent) await ensureModels(st.agent, { again: true });
  }
  const CHECK = xi("check", "iq-ck");
  function renderSetup() {
    const pop = /** @type {HTMLElement} */ (document.getElementById("cs-pop"));
    if (!C.pop.open) return;
    const st = setup();
    const rts = world.state.runtimes || [];
    const list = C.models.get(st.agent) || [];
    const def = list.find((m) => m.is_default) || null;
    const efforts = effortsFor(st);
    const effort = efforts.includes(/** @type {string} */ (st.effort)) ? st.effort : null;
    const modes = st.modes;
    const folders = [{ id: "", name: "Your projects folder" }, ...world.state.projects.filter((p) => p.kind === "project").map((p) => ({ id: p.id, name: p.name }))];
    /** @param {string} attr @param {string} id @param {string} name @param {string} desc @param {boolean} on @param {boolean} first */
    const row = (attr, id, name, desc, on, first) => `<div class="iq-row${on ? " is-sel" : ""}" role="radio" aria-checked="${on}"${rovingTab(on, first)} ${attr}="${esc(id)}"${desc ? ` title="${esc(desc)}"` : ""}><span class="iq-n">${esc(name)}</span>${desc ? `<span class="iq-tr">${esc(desc)}</span>` : ""}${CHECK}</div>`;
    const agents = rts.length > 1 ? `<div class="iq-sec"><p class="iq-lab" id="cs-agent-l">Agent</p><div class="iq-route" role="radiogroup" aria-labelledby="cs-agent-l">${rts.map((r, i) => {
      const on = r.name === st.agent;
      return `<button type="button" role="radio" aria-checked="${on}"${rovingTab(on, i === 0 && !rts.some((x) => x.name === st.agent))} data-cs-agent="${esc(r.name)}">${rtMark(r.name, { withName: true }) || esc(cliName(r.name))}</button>`;
    }).join("")}</div></div>` : "";
    // why the list holds only the default, whenever it does: gone, unread (with the reason), or still checking
    const why = st.gone ? `“${esc(st.gone)}” isn't offered by ${esc(cliName(st.agent))} any more, so a new chat uses its default model.`
      : C.failed.has(st.agent) ? `Couldn't read ${esc(cliName(st.agent))}'s models: ${esc((/** @type {string} */ (C.failed.get(st.agent))).replace(/[.\s]+$/, ""))}. ${st.unsure ? `“${esc(st.unsure.model)}” isn't confirmed, so a` : "A"} new chat uses its default model. Open this again to try again.`
      : st.unsure ? `Checking that “${esc(st.unsure.model)}” is still offered… until then a new chat uses its default.` : "";
    const models = `<div class="iq-sec"><p class="iq-lab" id="cs-model-l">Model</p><div class="iq-list" role="radiogroup" aria-labelledby="cs-model-l">` +
      row("data-cs-model", "", "Default", def ? modelDesc(def) || def.name : "The agent's own choice", !st.model, false) +
      offered(st.agent).map((m) => row("data-cs-model", m.id, m.name, modelDesc(m), m.id === st.model, false)).join("") + `</div>${why ? `<p class="iq-rl" role="status">${why}</p>` : ""}</div>`;
    const thinking = efforts.length ? `<div class="iq-sec"><p class="iq-lab" id="cs-e-l">Thinking</p><div class="iq-route iq-depth" role="radiogroup" aria-labelledby="cs-e-l">${efforts.map((e, i) =>
      `<button type="button" role="radio" aria-checked="${e === effort}"${rovingTab(e === effort, i === 0 && !effort)} data-cs-effort="${esc(e)}">${esc(EFFORT_WORD[e] || e)}</button>`).join("")}</div><p class="iq-rl">${esc(effort ? EFFORT_HINT[effort] || "" : "The model's own default until you pick one.")}</p></div>` : "";
    const lists = {
      cwd: () => `<header class="iq-h"><h2 id="cs-hh">Folder <span>a new chat works in</span></h2></header><div class="iq-list" role="radiogroup" aria-labelledby="cs-hh">${folders.map((f, i) => row("data-cs-cwd", f.id, f.name, "", f.id === st.cwd, false)).join("")}</div>`,
      mode: () => `<header class="iq-h"><h2 id="cs-hh">How much should it do on its own?</h2></header>` + (!modes.length ? `<p class="iq-rl">This agent doesn't say what it may do on its own; it uses its default.</p>`
        : `<div class="iq-list" role="radiogroup" aria-labelledby="cs-hh">${[...modes].sort((a, b) => (MODE_ORDER.indexOf(a) + 1 || 99) - (MODE_ORDER.indexOf(b) + 1 || 99)).map((m, i) => {
          const [name, desc, ic] = MODE_WORDS[m] || [m, "", "lock"], on = m === st.mode;
          return `<div class="iq-row cs-mrow${on ? " is-sel" : ""}" role="radio" aria-checked="${on}"${rovingTab(on, i === 0 && !modes.includes(/** @type {string} */ (st.mode)))} data-csmode="${esc(m)}">${xi(ic, "cs-mi")}<span class="cs-mt"><span class="iq-n">${esc(name)}</span>${desc ? `<span class="cs-md">${esc(desc)}</span>` : ""}</span>${CHECK}</div>`;
        }).join("")}</div><footer class="iq-f"><span>Used for your next new chat.</span></footer>`),
      model: () => `<header class="iq-h"><h2 id="cs-hh">New chat <span>agent, model and thinking</span></h2></header>${agents}${models}${thinking}<footer class="iq-f"><span>Used for your next new chat.</span><button type="button" class="iq-back" data-cs-done>Done</button></footer>`,
    };
    const part = lists[/** @type {keyof typeof lists} */ (C.pop.part)] ? /** @type {keyof typeof lists} */ (C.pop.part) : "model";
    const html = lists[part]();
    // in place (js/redraw.js): a choice made, a catalog arriving, keep the row you're on
    redraw(pop, html);
    const a = C.pop.anchor;
    if (a && !matchMedia("(max-width: 760px)").matches) {
      // on the chip's outer edge, opening to the side of it with more room, never past the screen
      pop.classList.remove("is-sheet");
      const r = a.getBoundingClientRect(), edge = space("--s-3"), gap = space("--s-2"); const w = Math.min(360, innerWidth - 2 * edge);
      const x = part === "model" ? r.right - w + gap : r.left - gap;
      pop.style.width = `${w}px`; pop.style.left = `${Math.max(edge, Math.min(x, innerWidth - w - edge))}px`;
      const up = r.top - edge - gap, down = innerHeight - r.bottom - edge - gap;
      if (down > up) { pop.style.bottom = ""; pop.style.top = `${r.bottom + gap}px`; pop.style.maxHeight = `${Math.max(240, down)}px`; }
      else { pop.style.top = ""; pop.style.bottom = `${Math.max(edge, innerHeight - r.top + gap)}px`; pop.style.maxHeight = `${Math.max(240, up)}px`; }
    } else { pop.style.left = pop.style.top = pop.style.bottom = pop.style.width = pop.style.maxHeight = ""; pop.classList.add("is-sheet"); }
  }
  function closeSetup() { C.pop.open = false; const pop = /** @type {HTMLElement} */ (document.getElementById("cs-pop")); pop.hidden = true; C.pop.anchor?.setAttribute("aria-expanded", "false"); C.pop.anchor?.focus?.({ preventScroll: true }); }
  /** @param {string} k @param {string | null} v */
  const setPref = (k, v) => {
    C.prefs = { ...C.prefs, [k]: v || null };
    // another agent has its own models, efforts and modes: read them, and start from its defaults
    if (k === "agent") { C.prefs.model = null; C.prefs.effort = null; C.prefs.mode = null; ensureModels(C.prefs.agent); }
    if (k === "model") C.prefs.effort = null;
    store.set(C.prefs);
  };

  /** @param {HTMLElement} anchor @param {string} part */
  function toggleSetup(anchor, part) { if (C.pop.open && C.pop.part === part) closeSetup(); else openSetup(anchor, part); }

  return { setup, effortsFor, ensureModels, openSetup, closeSetup, setPref, renderSetup, toggleSetup };
}
