// Loading in its final shape. What can be drawn at once is drawn at once (Home's greeting and date need
// nothing from the server); what is still coming holds the place and the size it will have, as a quiet
// fill where its words and pictures will be, so nothing below moves when it lands (the owner, 4 Nov:
// "you first load properly the things you gotta show immediately, then you can load on scroll").
//
// Home's shell is drawn by this module as soon as it loads: index.html loads it ahead of app.js, whose
// module graph takes far longer to arrive, so the greeting is on screen with the first paint. Which blocks
// Home had and how tall they were is remembered from the last visit (per browser, when the page is hidden
// or closed), so the shell is the page you are about to see, not a generic one.
//
// No imports: anything imported here would hold the first paint back.

const SHAPE = "xo-home-shape";

/** Home's greeting for the hour. */
export function greeting(h = new Date().getHours()) {
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
/** "Wednesday, November 4". */
export const today = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** A bar where words will be: `w` its width (a CSS length), `cls` a size (sk-l: a headline's). */
export const bar = (w = "60%", cls = "") => `<i class="sk${cls ? " " + cls : ""}" style="width:${w}"></i>`;

// widths for the stand-in names, so a row of them reads as names and not as a barcode
const NAME_W = ["72%", "58%", "80%", "64%", "50%", "68%"];
/**
 * A made card still coming, in the card's own shape (same classes, so the same size). where: true on
 * Home's strip, "page" on the Artifacts page (its "from" line too), false in the panel's Made.
 */
export function skTile(where = true, i = 0) {
  const from = where === "page" || where === false ? `<span class="md-from"><span>${bar(NAME_W[(i + 3) % NAME_W.length])}</span></span>` : "";
  return `<li class="md-it is-sk" aria-hidden="true"><span class="md-open"><span class="md-th"></span>` +
    `<span class="md-meta"><b>${bar(NAME_W[i % NAME_W.length])}</b><span>${bar("44%")}</span></span></span>${from}</li>`;
}

/** What Home looked like when you last left it: {w, parts: [{id, hidden, h, kind, n}]}, or null. */
function recall() {
  try {
    const s = JSON.parse(localStorage.getItem(SHAPE) || "null");
    return s && Array.isArray(s.parts) ? s : null;
  } catch { return null; }
}
/** How many things Home's Recently made showed last time (null: it was never seen). */
export function rememberedMade() {
  const p = recall()?.parts.find((x) => x.id === "hm-made");
  return p ? p.n : null;
}
/** Remember Home's blocks (order, shown, height, kind) while it's on screen and fully drawn. */
export function rememberHome() {
  const body = document.getElementById("hm-body");
  if (!body || !body.offsetParent || document.querySelector("#home .hm-sk, #hm-head .sk")) return; // hidden, or not drawn yet
  const prev = recall();
  const parts = [...body.children].map((el) => {
    const p = { id: el.id, hidden: el.hidden, h: el.offsetHeight };
    if (el.id === "hm-next") p.kind = el.querySelector(".next, .in-panel, .calm") ? "card" : el.querySelector(".calm-line") ? "calm" : "none";
    if (el.id === "hm-made") {
      const sec = el.querySelector(".md-recent");
      // still waiting for what was made: keep what we knew
      p.n = sec && el.querySelector(".is-sk") ? (prev?.parts.find((x) => x.id === "hm-made")?.n ?? 0) : sec && !sec.hidden ? el.querySelectorAll(".md-it").length : 0;
    }
    return p;
  });
  try { localStorage.setItem(SHAPE, JSON.stringify({ w: body.clientWidth, parts })); } catch { /* private mode */ }
}

/**
 * Home before the world has loaded: the date and the greeting as they will be, and every block in the
 * place and size it had last time, with bars where its words will be. app.js (homeRender) draws the real
 * blocks into the same elements; each lands with motion.js arrive().
 */
export function homeShell(box = document.getElementById("home")) {
  if (!box || box._built || box.firstElementChild) return;
  const s = recall();
  box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-next"></div><div id="hm-then"></div><div id="hm-end"></div><div id="hm-made"></div></div></div>`;
  box._built = true;
  const $ = (id) => document.getElementById(id);
  $("hm-head").innerHTML = `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${today()}</p><h1 class="hm-h" id="home-h">${greeting()}.<span> ${bar("9.5em", "sk-l")}</span></h1></div></header>`;
  const body = $("hm-body");
  // the same width as last time: the same heights; else each block's usual one
  const same = s && Math.abs((s.w || 0) - body.clientWidth) < 1;
  const part = (id) => (s && s.parts.find((p) => p.id === id)) || null;
  const h = (p, dflt) => (same && p && p.h > 0 ? p.h : dflt);
  const next = part("hm-next");
  const kind = next ? next.kind : "calm";
  $("hm-next").innerHTML = kind === "card"
    ? `<div class="hm-sk is-card" style="height:${h(next, 236)}px"><p class="hm-lbl">${bar("112px", "sk-lb")}&#8203;</p><div class="sk-card">${bar("38%")}${bar("86%", "sk-l")}${bar("62%")}</div></div>`
    : kind === "calm" ? `<div class="hm-sk" style="height:${h(next, 32)}px"><p class="calm-line">${bar("21em")}</p></div>` : "";
  const then = part("hm-then");
  if (then && !then.hidden && then.h > 0 && same) $("hm-then").innerHTML = `<div class="hm-sk" style="height:${then.h}px"></div>`;
  $("hm-end").innerHTML = `<section class="handled hm-sk" aria-hidden="true"><div class="hd-row0"><div><div class="hd"><span class="hd-ic"></span><span class="hd-t"><b>Handled</b> · ${bar("8em")}</span></div></div></div></section>`;
  const made = part("hm-made");
  if (made && made.n > 0) {
    $("hm-made").innerHTML = `<section class="md-recent hm-sk" aria-hidden="true"><h2 class="hm-lbl"><svg aria-hidden="true"></svg>${bar("104px", "sk-lb")}&#8203;</h2><ul class="md-grid is-strip">${Array.from({ length: made.n }, (_, i) => skTile(true, i)).join("")}</ul></section>`;
  }
  // the order and the parts the shape shows (shapeview.js homeOrder puts them right again once it loads)
  if (s) for (const p of s.parts) { const el = $(p.id); if (el) { el.hidden = !!p.hidden; body.appendChild(el); } }
  for (const id of ["hm-head", "hm-next", "hm-then", "hm-end", "hm-made"]) $(id)._sk = true;
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  homeShell();
  addEventListener("pagehide", rememberHome);
  document.addEventListener("visibilitychange", () => { if (document.hidden) rememberHome(); });
}
