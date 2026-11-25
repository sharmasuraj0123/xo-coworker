// @ts-check

// Inline Markdown, safe by construction: every piece of text goes through esc(), links only to http(s), thread anchors and relative files.

import { xi, stateMark } from "../icons/icon.js";
import { fileIcon } from "../icons/fileicons.js";
import { esc } from "../../platform/index.js";

const THREAD_HREF = /^#(cmsg_[A-Za-z0-9_-]{1,128})$/;
const HTTP_HREF = /^https?:\/\/[^\s<>"'`]+$/i;
// a relative path to a file in the conversation's folder: no scheme, no "..", with a name that has an extension
const FILE_HREF = /^(?:\.\/)?(?!\/)(?![a-z][a-z0-9+.-]*:)((?:[\w@~+-][\w@~+.-]*\/)*[\w@~+-][\w@~+.-]*\.[A-Za-z0-9]{1,10})(?:#L\d+(?:-L?\d+)?)?$/;

/** @type {((id: string) => { state?: string, word?: string, title?: string } | null) | null} */
let threadInfo = null;
/** @param {unknown} fn */
export function setThreadInfo(fn) { threadInfo = typeof fn === "function" ? /** @type {NonNullable<typeof threadInfo>} */ (fn) : null; }

const ARROW_OUT = xi("external-link", "lk-ar");
const THREAD_G = xi("chat", "lk-tg");
const STATES = new Set(["working", "idle", "needs_reply", "needs_approval", "done", "failed", "paused", "resolved"]);

/** The "leaves XO" arrow after an outbound link. */
export { ARROW_OUT };

/** A web address as people read it: the host and path, no scheme, "www." or trailing slash; long ones keep their ends. @param {unknown} u */
export function shortUrl(u) {
  let s = String(u || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  if (s.length > 52) {
    s = s.replace(/[?#].*$/, "");
    const slash = s.indexOf("/");
    const host = slash < 0 ? s : s.slice(0, slash);
    const tail = s.slice(s.lastIndexOf("/") + 1);
    s = host.length + tail.length < 46 && slash >= 0 ? `${host}/…/${tail}` : s.slice(0, 50) + "…";
  }
  return s;
}
// An address breaks only after / - _ or before . ? & = #, and its last piece never parts from the ↗.
const BREAK_AFTER = /([/\-_])/g, BREAK_BEFORE = /([.?&=#])/g;
/** @param {string} s */
function addrHtml(s) {
  const parts = String(s).replace(BREAK_AFTER, "$1\u0000").replace(BREAK_BEFORE, "\u0000$1").split("\u0000").filter(Boolean);
  return parts.map(esc);
}
/** Text pieces (already HTML) and the arrow: every piece but the last can break; the last holds the ↗. @param {string[]} pieces @param {string} joiner */
function outHtml(pieces, joiner) {
  let last = pieces.pop() ?? "";
  // a long last piece keeps only its tail with the arrow (entities are counted as written; close enough)
  const plain = last.replace(/<[^>]*>/g, "");
  if (plain.length > 20 && !/[<&]/.test(last)) { pieces.push(last.slice(0, -6)); last = last.slice(-6); }
  const head = pieces.join(joiner);
  return (head ? `<span class="lk-t">${head}</span>` : "") + `<span class="lk-end"><span class="lk-t">${last}</span>${ARROW_OUT}</span>`;
}
/** A labelled link's text: its last word holds the ↗; a label ending in markup keeps the arrow on with a word joiner. @param {string} label */
function labelOut(label) {
  if (/>\s*$/.test(label)) return `<span class="lk-t">${label}</span>\u2060${ARROW_OUT}`;
  const m = /^([\s\S]*?)(\s*)([^\s]+)$/.exec(label);
  if (!m) return `<span class="lk-t">${label}</span>${ARROW_OUT}`;
  const pieces = m[1] ? [m[1] + m[2]] : [];
  pieces.push(m[3]);
  return outHtml(pieces, "");
}

/** Plain words (or, with address, a web address or host) set like an outbound link's text, its last piece holding the ↗. @param {string} plain */
export function outText(plain, { address = false } = {}) {
  return address ? outHtml(addrHtml(plain), "<wbr>") : labelOut(esc(plain));
}

/** @param {string} u */
function hostOf(u) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(u);
  return m ? m[1].replace(/^www\./i, "").replace(/^[^@]*@/, "") : "";
}

/** A short capsule kept whole on one line, wrapping inside its own box only when wider than the line (.lk-fit); a long one flows. @param {string} a @param {boolean} short */
function fit(a, short) { return short ? `<span class="lk-fit">${a}</span>` : a; }

/** A link's HTML, or null when the target is not allowed. `label` is rendered HTML, or null for a bare URL. @param {unknown} href @param {string | null} label @returns {string | null} */
export function linkHtml(href, label) {
  const h = String(href || "").trim();
  const t = THREAD_HREF.exec(h);
  if (t) {
    const id = t[1];
    const info = (threadInfo && threadInfo(id)) || null;
    const st = info && info.state && STATES.has(info.state) ? info.state : "";
    const g = st ? stateMark(st) : THREAD_G;
    const tip = info ? [info.word, "thread"].filter(Boolean).join(" · ") : "Thread";
    // a short title stays one capsule; a long one may wrap (each line keeps its capsule)
    const text = label != null ? label.replace(/<[^>]*>/g, "") : String(info?.title || "");
    const long = text.length > 36;
    return fit(`<a href="#${esc(id)}" class="lk lk-in lk-thread${info ? "" : " is-unknown"}${long ? " is-long" : ""}" data-thread="${esc(id)}" title="${esc(tip)}">` +
      `<span class="lk-ic">${g}</span><span class="lk-t">${label ?? esc(info?.title || "a thread")}</span></a>`, !long);
  }
  if (HTTP_HREF.test(h)) {
    const host = hostOf(h);
    const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host);
    return `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer nofollow" class="lk lk-out${local ? " is-local" : ""}${label == null ? " is-bare" : ""}" title="${esc(h)}">` +
      `${label != null ? labelOut(label) : outHtml(addrHtml(shortUrl(h)), "<wbr>")}</a>`;
  }
  const f = FILE_HREF.exec(h);
  if (f && label != null) {
    const path = f[1], name = path.split("/").pop();
    // an <a> like a thread's, so both capsules are the same inline box (a button would be an inline-block)
    const long = label.replace(/<[^>]*>/g, "").length > 36;
    return fit(`<a href="#${esc(path)}" class="lk lk-in lk-file${long ? " is-long" : ""}" data-file="${esc(path)}" data-file-name="${esc(name)}" data-file-type="" data-file-bytes="" title="${esc(path)}">` +
      `<span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${label}</span></a>`, !long);
  }
  return null;
}

/** Math and diagrams are drawn by rich.js through these hooks; unset or not drawn yet, they stay their source. @type {{ math: ((tex: string, display: boolean) => string | null) | null, diagram: ((src: string) => { html?: string, theme?: string, w?: number, error?: string } | null) | null }} */
let rich = { math: null, diagram: null };
/** Let the app draw math and diagrams (js/rich.js): cached drawings come back synchronously, or null. @param {object | null | undefined} hooks */
export function setRich(hooks) { rich = { math: null, diagram: null, ...(hooks || {}) }; }
/** A formula: drawn when its drawing is cached, else its TeX as written (js/rich.js draws it in place). @param {string} tex @param {boolean} display */
export function mathHtml(tex, display) {
  const t = String(tex).trim();
  if (!t) return "";
  const done = rich.math ? rich.math(t, display) : null;
  return `<span class="md-math${display ? " is-block" : ""}${done != null ? " is-done" : ""}" data-tex="${esc(t)}">${done ?? esc(t)}</span>`;
}
/** A mermaid diagram: its drawing when cached for this theme (or the other one, until it's redrawn), else its source. @param {string} src */
export function diagramHtml(src) {
  const done = rich.diagram ? rich.diagram(src) : null;
  const state = !done ? "" : done.error ? " is-failed" : " is-done";
  const w = done && Number.isFinite(done.w) ? ` style="--dg-w:${done.w}px"` : "";
  return `<figure class="md-diagram${state}"${done && done.theme ? ` data-dg-theme="${esc(done.theme)}"` : ""}${w}>` +
    (done && done.html ? done.html : "") +
    (done && done.error ? `<figcaption class="md-dg-why">This diagram couldn't be drawn: ${esc(done.error)}</figcaption>` : "") +
    `<pre class="md-dg-src"><code>${esc(src)}</code></pre></figure>`;
}

// ── pictures from the web ──────────────────────────────────────────────────────
const IMG_PATH = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i;
const IMG_MD = /!\[([^\]\n]{0,500})\]\(([^()\s]{1,2000})\)/;
/** A web picture's address, or null: http(s) only; a bare one also needs a path ending in a picture's extension. @param {unknown} u */
export function webImageUrl(u, { bare = false } = {}) {
  const h = String(u || "").trim();
  if (!HTTP_HREF.test(h)) return null;
  if (bare) {
    try { if (!IMG_PATH.test(new URL(h).pathname)) return null; }
    catch (error) { if (error instanceof TypeError) return null; throw error; }
  }
  return h;
}
/** A picture in the conversation's folder, `![alt](plots/fit.png)`: its relative path, or null. @param {unknown} u */
export function fileImagePath(u) {
  const f = FILE_HREF.exec(String(u || "").trim());
  return f && IMG_PATH.test(f[1]) ? f[1] : null;
}
/** The pictures a line is made of, [{alt, url} or {alt, file}], when it holds only pictures or one bare picture address; else null. @param {unknown} line @returns {{ alt: string, url?: string, file?: string }[] | null} */
export function imageLine(line) {
  const s = String(line || "").trim();
  if (!s) return null;
  if (/^https?:\/\/\S+$/i.test(s)) { const url = webImageUrl(s, { bare: true }); return url ? [{ alt: "", url }] : null; }
  /** @type {{ alt: string, url?: string, file?: string }[]} */
  const out = [];
  const re = new RegExp(IMG_MD.source + "\\s*", "y");
  while (re.lastIndex < s.length) {
    const m = re.exec(s);
    if (!m) return null; // anything else on the line: it's a sentence, not pictures
    const url = webImageUrl(m[2]), file = url ? null : fileImagePath(m[2]);
    if (!url && !file) return null;
    out.push({ alt: m[1].replace(/\s+/g, " ").trim(), ...(url ? { url } : { file: /** @type {string} */ (file) }) });
  }
  return out.length ? out : null;
}
/** @type {((list: { alt: string, url?: string, file?: string }[]) => string | null) | null} */
let webImages = null;
/** Set the web-picture renderer; when unset, web pictures render as links. @param {unknown} fn */
export function setWebImages(fn) { webImages = typeof fn === "function" ? /** @type {NonNullable<typeof webImages>} */ (fn) : null; }
/** @param {{ alt: string, url?: string, file?: string }[]} list */
export function imagesHtml(list) {
  const shown = webImages && webImages(list);
  if (shown) return shown;
  // as links, one per line: the alt as words, else the address as a bare link reads
  return `<p>${list.map((x) => linkHtml(x.url || x.file, x.alt ? renderInline(x.alt, true) : x.file ? esc(x.file.split("/").pop()) : null) || esc(x.alt || x.url || x.file)).join("<br>")}</p>`;
}

// Inline patterns, tried at each position; the earliest match wins.
const INLINE = [
  { name: "code", re: /(`+)([\s\S]*?[^`])\1(?!`)/ },
  // math: \$ is a dollar; $$…$$ and \[…\] display; $…$ (no inner space at either end, no word after) and \(…\) inline
  { name: "dollar", re: /\\\$/ },
  { name: "dmath", re: /\$\$([^$]+?)\$\$|\\\[([\s\S]+?)\\\]/ },
  { name: "math", re: /(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\\\n])*?[^\s\\$])\$(?![\w$])|\\\(([\s\S]+?)\\\)/ },
  { name: "img", re: IMG_MD },
  { name: "link", re: /\[([^\]\n]{1,500})\]\(([^()\s]{1,2000})\)/ },
  { name: "url", re: /\bhttps?:\/\/[^\s<>()"'`]+[^\s<>()"'`.,;:!?]/i },
  { name: "bold", re: /\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__/ },
  { name: "strike", re: /~~(?=\S)([\s\S]*?\S)~~/ },
  { name: "em", re: /\*(?=[^\s*])([^*\n]*?[^\s*])\*|(?<![A-Za-z0-9_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![A-Za-z0-9_])/ },
];

/** Render inline markdown. `noLinks` disables links (used inside link text). @param {unknown} text @returns {string} */
export function renderInline(text, noLinks = false) {
  return formatInline(text, noLinks, false);
}

/** @param {string} text @param {string} [kind] */
export function stepLineHtml(text, kind) {
  return kind === "subagent" ? esc(text.replace(/`([^`]*)`/g, "$1")) : renderInline(text, true);
}

/** @param {unknown} text */
export function inlineText(text) {
  return formatInline(text, true, true);
}

/** @param {unknown} text @param {boolean} noLinks @param {boolean} plain */
function formatInline(text, noLinks, plain) {
  const literal = plain ? String : esc;
  /** @param {string} tag @param {string} content */
  const wrap = (tag, content) => plain ? content : `<${tag}>${content}</${tag}>`;
  let out = "";
  let rest = String(text ?? "");
  let guard = 0;
  while (rest && guard++ < 10000) {
    let best = null;
    for (const p of INLINE) {
      if (noLinks && (p.name === "link" || p.name === "url")) continue;
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) best = { p, m };
    }
    if (!best) {
      out += literal(rest);
      break;
    }
    const { p, m } = best;
    out += literal(rest.slice(0, m.index));
    switch (p.name) {
      case "code":
        out += wrap("code", literal(m[2].replace(/^ (.*) $/, "$1")));
        break;
      case "dollar":
        out += "$";
        break;
      case "dmath":
        out += noLinks ? literal(m[0]) : mathHtml(m[1] ?? m[2], true);
        break;
      case "math":
        out += noLinks ? literal(m[0]) : mathHtml(m[1] ?? m[2], false);
        break;
      case "link": {
        const label = formatInline(m[1], true, plain);
        out += linkHtml(m[2], label) ?? label;
        break;
      }
      case "img": {
        // a picture inside a sentence stays a link (its alt as words, else its address); inside a link, its alt
        const label = formatInline(m[1], true, plain);
        const url = noLinks ? null : webImageUrl(m[2]);
        out += url ? linkHtml(url, label || null) : label;
        break;
      }
      case "url":
        out += linkHtml(m[0], null) ?? esc(m[0]);
        break;
      case "bold":
        out += wrap("strong", formatInline(m[1] ?? m[2], noLinks, plain));
        break;
      case "strike":
        out += wrap("del", formatInline(m[1], noLinks, plain));
        break;
      case "em":
        out += wrap("em", formatInline(m[1] ?? m[2], noLinks, plain));
        break;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}
