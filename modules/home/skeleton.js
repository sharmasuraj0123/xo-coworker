// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { read, reportStorageFailure, write } from "../../core/platform/storage.js";
import { isRecord } from "../../core/platform/util.js";
import { markSkeleton } from "../../core/ui/skeleton-mark.js";

const SHAPE = "xo-home-shape";
const built = new WeakSet();

/** @typedef {{id: string, hidden: HTMLElement["hidden"], h: number, kind?: string, n?: number}} HomePart */

export function greeting(h = new Date().getHours()) {
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
export const today = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** A bar where words will be: `w` its width (a CSS length), `cls` a size (sk-l: a headline's). */
export const bar = (w = "60%", cls = "") => `<i class="sk${cls ? " " + cls : ""}" style="width:${w}"></i>`;

const NAME_W = ["72%", "58%", "80%", "64%", "50%", "68%"];
/** @param {boolean | "page"} where */
export function skTile(where = true, i = 0) {
  const from = where === "page" || where === false ? `<span class="md-from"><span>${bar(NAME_W[(i + 3) % NAME_W.length])}</span></span>` : "";
  return `<li class="md-it is-sk" aria-hidden="true"><span class="md-open"><span class="md-th"></span>` +
    `<span class="md-meta"><b>${bar(NAME_W[i % NAME_W.length])}</b><span>${bar("44%")}</span></span></span>${from}</li>`;
}

/** @param {unknown} value @returns {HomePart | null} */
function partShape(value) {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const { id, hidden, h, kind, n } = value;
  return { id, hidden: hidden === true, h: typeof h === "number" ? h : 0, kind: typeof kind === "string" ? kind : undefined,
    n: typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : undefined };
}

/** @param {string} raw @returns {unknown} */
function parseRecall(raw) {
  try { return JSON.parse(raw); }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
}

function recall() {
  return read(SHAPE, (raw) => {
    const shape = parseRecall(raw);
    if (!isRecord(shape) || !Array.isArray(shape.parts)) return null;
    return { w: typeof shape.w === "number" ? shape.w : 0, parts: shape.parts.map(partShape).filter((part) => part !== null) };
  }, null, "local", reportStorageFailure);
}
export function rememberedMade() {
  const p = recall()?.parts.find((x) => x.id === "hm-made");
  return p ? p.n : null;
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const homeSkeletonModule = {
  manifest: { id: "xo.home-skeleton", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["homeSkeleton"] },
  activate(ctx) { ctx.provide("homeSkeleton", { skTile, skBar: bar, rememberedMade }); },
};
export function rememberHome() {
  const body = document.getElementById("hm-body");
  if (!body || !body.offsetParent || document.querySelector("#home .hm-sk, #hm-head .sk")) return; // hidden, or not drawn yet
  const prev = recall();
  const parts = [.../** @type {HTMLCollectionOf<HTMLElement>} */ (body.children)].map((el) => {
    /** @type {HomePart} */
    const p = { id: el.id, hidden: el.hidden, h: el.offsetHeight };
    if (el.id === "hm-next") p.kind = el.querySelector(".next, .in-panel, .calm") ? "card" : el.querySelector(".calm-line") ? "calm" : "none";
    if (el.id === "hm-made") {
      const sec = /** @type {HTMLElement | null} */ (el.querySelector(".md-recent"));
      p.n = sec && el.querySelector(".is-sk") ? (prev?.parts.find((x) => x.id === "hm-made")?.n ?? 0) : sec && !sec.hidden ? el.querySelectorAll(".md-it").length : 0;
    }
    return p;
  });
  write(SHAPE, JSON.stringify({ w: body.clientWidth, parts }), "local", reportStorageFailure);
}

/** @param {HTMLElement | null} box */
export function homeShell(box = document.getElementById("home")) {
  if (!box || built.has(box) || box.firstElementChild) return;
  const s = recall();
  box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-since"></div><div id="hm-next"></div><div id="hm-then"></div><div id="hm-end"></div><div id="hm-made"></div></div></div>`;
  built.add(box);
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  $("hm-head").innerHTML = `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${today()}</p><h1 class="hm-h" id="home-h">${greeting()}.<span> ${bar("9.5em", "sk-l")}</span></h1></div></header>`;
  const body = $("hm-body");
  const same = s && Math.abs((s.w || 0) - body.clientWidth) < 1;
  const part = (/** @type {string} */ id) => (s && s.parts.find((p) => p.id === id)) || null;
  const h = (/** @type {HomePart | null} */ p, /** @type {number} */ dflt) => (same && p && p.h > 0 ? p.h : dflt);
  const next = part("hm-next");
  const kind = next ? next.kind : "calm";
  $("hm-next").innerHTML = kind === "card"
    ? `<div class="hm-sk is-card" style="height:${h(next, 236)}px"><p class="hm-lbl">${bar("112px", "sk-lb")}&#8203;</p><div class="sk-card">${bar("38%")}${bar("86%", "sk-l")}${bar("62%")}</div></div>`
    : kind === "calm" ? `<div class="hm-sk" style="height:${h(next, 32)}px"><p class="calm-line">${bar("21em")}</p></div>` : "";
  const then = part("hm-then");
  if (then && !then.hidden && then.h > 0 && same) $("hm-then").innerHTML = `<div class="hm-sk" style="height:${then.h}px"></div>`;
  $("hm-end").innerHTML = `<section class="handled hm-sk" aria-hidden="true"><div class="hd-row0"><div><div class="hd"><span class="hd-ic"></span><span class="hd-t"><b>Handled</b> · ${bar("8em")}</span></div></div></div></section>`;
  const made = part("hm-made");
  if (made && (/** @type {number} */ (made.n)) > 0) {
    $("hm-made").innerHTML = `<section class="md-recent hm-sk" aria-hidden="true"><h2 class="hm-lbl"><svg aria-hidden="true"></svg>${bar("104px", "sk-lb")}&#8203;</h2><ul class="md-grid is-strip">${Array.from({ length: /** @type {number} */ (made.n) }, (_, i) => skTile(true, i)).join("")}</ul></section>`;
  }
  if (s) for (const p of s.parts) { const el = $(p.id); if (el) { el.hidden = !!p.hidden; body.appendChild(el); } }
  for (const id of ["hm-head", "hm-next", "hm-then", "hm-end", "hm-made"]) markSkeleton($(id));
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const scope = createScope();
  homeShell();
  scope.listen(window, "pagehide", (event) => {
    rememberHome();
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  scope.listen(document, "visibilitychange", () => { if (document.hidden) rememberHome(); });
}
