// A small, safe Markdown renderer for chat messages.
//
// Supported: paragraphs (soft line breaks kept), headings, bullet and numbered
// lists (one level of nesting by indent), blockquotes, horizontal rules, tables,
// fenced code blocks (with a copy button and colours, js/highlight.js), inline code, **bold**, *italic*,
// _italic_, ~~strike~~, [links](…) and bare http(s) URLs.
//
// Safety: the input is never interpreted as HTML. Every piece of text goes
// through esc(); the only tags in the output are the ones built here. Links
// are allowed only to http(s) URLs (opened in a new tab), to in-app
// "#cmsg_…" thread anchors (data-thread, handled by the app) and to relative
// file paths (data-file, opened in the viewer). Anything else renders as its
// plain text.
//
// Links say where they go by their shape, not by words (design-research/links):
// - Inside Coworker (a thread, a file) a link is a token: a soft capsule led by
//   the thing's own glyph (the thread's live state, the file's icon). It opens in place.
// - Outside (the web) a link stays text, underlined, with a small ↗ after it:
//   the arrow every Apple page uses for "this leaves". It opens a new tab.
//
// Pictures from the web (the owner's call: someone looking for a place to stay sees the listing's photos):
// `![alt](https://…)`, or a bare http(s) address whose path ends in a picture's extension, on a line of its
// own is a picture, shown like a shared one (js/media.js, through the app's setWebImages); consecutive such
// lines make one album. Only http(s): any other scheme stays text. Inside a sentence it stays a link (an
// image's alt as its words, never a stray "!"). Without the app's renderer (node, or "Show pictures from
// the web" off on this device) the same lines are outbound links, so nothing is lost.

import { esc } from "./util.js";
import { highlight } from "./highlight.js";
import { fileIcon } from "./fileicons.js";

const THREAD_HREF = /^#(cmsg_[A-Za-z0-9_-]{1,128})$/;
const HTTP_HREF = /^https?:\/\/[^\s<>"'`]+$/i;
// a relative path to a file in the conversation's folder: no scheme, no "..", with a name that has an extension
const FILE_HREF = /^(?:\.\/)?(?!\/)(?![a-z][a-z0-9+.-]*:)((?:[\w@~+-][\w@~+.-]*\/)*[\w@~+-][\w@~+.-]*\.[A-Za-z0-9]{1,10})(?:#L\d+(?:-L?\d+)?)?$/;

// How the app describes a thread it knows: {state, word, title}. Set once by app.js; the renderer stays pure without it.
let threadInfo = null;
/** Let the app tell the renderer about threads it knows (their live state), for thread tokens. */
export function setThreadInfo(fn) { threadInfo = typeof fn === "function" ? fn : null; }

const ARROW_OUT = `<svg class="lk-ar" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3.5 8.5 8.5 3.5M4.6 3.5h3.9v3.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const THREAD_G = `<svg class="lk-tg" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M13.6 7.8a5.6 5.6 0 0 1-8.1 5L2.4 13.6l.9-3A5.6 5.6 0 1 1 13.6 7.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const STATES = new Set(["working", "idle", "needs_reply", "needs_approval", "done", "failed", "paused", "resolved"]);

/** The "leaves XO" arrow after an outbound link (js/media.js uses it for a web picture that couldn't show). */
export { ARROW_OUT };

/** A web address as people read it: the host and path, no scheme, "www." or trailing slash; long ones keep their ends. */
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
function hostOf(u) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(u);
  return m ? m[1].replace(/^www\./i, "").replace(/^[^@]*@/, "") : "";
}

/** A link's HTML, or null when the target is not allowed. `label` is rendered HTML, or null for a bare URL. */
function linkHtml(href, label) {
  const h = String(href || "").trim();
  const t = THREAD_HREF.exec(h);
  if (t) {
    const id = t[1];
    const info = (threadInfo && threadInfo(id)) || null;
    const st = info && STATES.has(info.state) ? info.state : "";
    const g = st ? `<i class="g g-${st}" aria-hidden="true"></i>` : THREAD_G;
    const tip = info ? [info.word, "thread"].filter(Boolean).join(" · ") : "Thread";
    // a short title stays one capsule; a long one may wrap (each line keeps its capsule)
    const text = label != null ? label.replace(/<[^>]*>/g, "") : String(info?.title || "");
    return `<a href="#${esc(id)}" class="lk lk-in lk-thread${info ? "" : " is-unknown"}${text.length > 36 ? " is-long" : ""}" data-thread="${esc(id)}" title="${esc(tip)}">` +
      `<span class="lk-ic">${g}</span><span class="lk-t">${label ?? esc(info?.title || "a thread")}</span></a>`;
  }
  if (HTTP_HREF.test(h)) {
    const host = hostOf(h);
    const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host);
    return `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer nofollow" class="lk lk-out${local ? " is-local" : ""}${label == null ? " is-bare" : ""}" title="${esc(h)}">` +
      `<span class="lk-t">${label ?? esc(shortUrl(h))}</span>${ARROW_OUT}</a>`;
  }
  const f = FILE_HREF.exec(h);
  if (f && label != null) {
    const path = f[1], name = path.split("/").pop();
    // an <a> like a thread's, so both capsules are the same inline box (a button would be an inline-block)
    return `<a href="#${esc(path)}" class="lk lk-in lk-file" data-file="${esc(path)}" data-file-name="${esc(name)}" data-file-type="" data-file-bytes="" title="${esc(path)}">` +
      `<span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${label}</span></a>`;
  }
  return null;
}

// ── pictures from the web ──────────────────────────────────────────────────────
const IMG_PATH = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i;
const IMG_MD = /!\[([^\]\n]{0,500})\]\(([^()\s]{1,2000})\)/;
/** A web picture's address, or null: http(s) only; a bare one also needs a path ending in a picture's extension. */
export function webImageUrl(u, { bare = false } = {}) {
  const h = String(u || "").trim();
  if (!HTTP_HREF.test(h)) return null;
  if (bare) {
    let path = "";
    try { path = new URL(h).pathname; } catch { return null; }
    if (!IMG_PATH.test(path)) return null;
  }
  return h;
}
/** The pictures a line is made of, [{alt, url}], when it holds only `![alt](url)`s or one bare picture address; else null. */
export function imageLine(line) {
  const s = String(line || "").trim();
  if (!s) return null;
  if (/^https?:\/\/\S+$/i.test(s)) { const url = webImageUrl(s, { bare: true }); return url ? [{ alt: "", url }] : null; }
  const out = [];
  const re = new RegExp(IMG_MD.source + "\\s*", "y");
  while (re.lastIndex < s.length) {
    const m = re.exec(s);
    if (!m) return null; // anything else on the line: it's a sentence, not pictures
    const url = webImageUrl(m[2]);
    if (!url) return null;
    out.push({ alt: m[1].replace(/\s+/g, " ").trim(), url });
  }
  return out.length ? out : null;
}
// The app's way to show web pictures ({alt, url} list → HTML, or null to keep them links). Set once by app.js.
let webImages = null;
/** Let the app draw pictures from the web (js/media.js); unset, they're links. */
export function setWebImages(fn) { webImages = typeof fn === "function" ? fn : null; }
function imagesHtml(list) {
  const shown = webImages && webImages(list);
  if (shown) return shown;
  // as links, one per line: the alt as words, else the address as a bare link reads
  return `<p>${list.map((x) => linkHtml(x.url, x.alt ? renderInline(x.alt, true) : null) || esc(x.alt || x.url)).join("<br>")}</p>`;
}

// Inline patterns, tried at each position; the earliest match wins.
const INLINE = [
  { name: "code", re: /(`+)([\s\S]*?[^`])\1(?!`)/ },
  { name: "img", re: IMG_MD },
  { name: "link", re: /\[([^\]\n]{1,500})\]\(([^()\s]{1,2000})\)/ },
  { name: "url", re: /\bhttps?:\/\/[^\s<>()"'`]+[^\s<>()"'`.,;:!?]/i },
  { name: "bold", re: /\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__/ },
  { name: "strike", re: /~~(?=\S)([\s\S]*?\S)~~/ },
  { name: "em", re: /\*(?=[^\s*])([^*\n]*?[^\s*])\*|(?<![A-Za-z0-9_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![A-Za-z0-9_])/ },
];

/** Render inline markdown. `noLinks` disables links (used inside link text). */
export function renderInline(text, noLinks = false) {
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
      out += esc(rest);
      break;
    }
    const { p, m } = best;
    out += esc(rest.slice(0, m.index));
    switch (p.name) {
      case "code":
        out += `<code>${esc(m[2].replace(/^ (.*) $/, "$1"))}</code>`;
        break;
      case "link": {
        const label = renderInline(m[1], true);
        out += linkHtml(m[2], label) ?? label;
        break;
      }
      case "img": {
        // a picture inside a sentence stays a link (its alt as words, else its address); inside a link, its alt
        const label = renderInline(m[1], true);
        const url = noLinks ? null : webImageUrl(m[2]);
        out += url ? linkHtml(url, label || null) : label;
        break;
      }
      case "url":
        out += linkHtml(m[0], null) ?? esc(m[0]);
        break;
      case "bold":
        out += `<strong>${renderInline(m[1] ?? m[2], noLinks)}</strong>`;
        break;
      case "strike":
        out += `<del>${renderInline(m[1], noLinks)}</del>`;
        break;
      case "em":
        out += `<em>${renderInline(m[1] ?? m[2], noLinks)}</em>`;
        break;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

function codeBlock(lang, code) {
  const label = lang ? esc(lang) : "code";
  // colours only split the escaped text into spans (js/highlight.js): code never becomes HTML
  const hl = highlight(code, lang);
  return (
    `<div class="md-code"><div class="md-code-head"><span>${label}</span>` +
    `<button type="button" class="md-copy" data-copy aria-label="Copy code">Copy</button></div>` +
    `<pre><code${hl != null ? ' class="hl"' : ""}>${hl ?? esc(code)}</code></pre></div>`
  );
}

/** A table row's cells: split on "|" outside `code`, with the outer pipes dropped. */
function cells(line) {
  const out = [];
  let cur = "", tick = false;
  const t = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\" && t[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "`") tick = !tick;
    if (c === "|" && !tick) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}
function renderTable(head, sep, rows) {
  const align = cells(sep).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : ""));
  const td = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ""}>${renderInline(c)}</${tag}>`;
  const h = cells(head);
  return `<div class="md-table"><table><thead><tr>${h.map((c, i) => td("th", c, i)).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => { const rc = cells(r); return `<tr>${h.map((_, i) => td("td", rc[i] ?? "", i)).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}

function renderList(lines) {
  // lines: [{indent, ordered, start, text}]
  let html = "";
  let i = 0;
  const walk = (baseIndent) => {
    const first = lines[i];
    const tag = first.ordered ? "ol" : "ul";
    const start = first.ordered && first.start !== 1 ? ` start="${first.start}"` : "";
    let out = `<${tag}${start}>`;
    while (i < lines.length && lines[i].indent >= baseIndent) {
      const item = lines[i];
      if (item.indent > baseIndent) {
        // a nested list belongs to the previous <li>
        out = out.replace(/<\/li>$/, "") + walk(item.indent) + "</li>";
        continue;
      }
      if (item.ordered !== first.ordered) break;
      out += `<li>${renderInline(item.text)}</li>`;
      i++;
    }
    return out + `</${tag}>`;
  };
  while (i < lines.length) html += walk(lines[i].indent);
  return html;
}

/** Render a message's markdown to an HTML string (safe to assign to innerHTML). */
export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map((l) => renderInline(l)).join("<br>")}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
      i++; // closing fence (or end of input)
      out.push(codeBlock(fence[2], body.join("\n")));
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    if (RULE.test(line)) {
      flush();
      out.push("<hr>");
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flush();
      const head = line, sep = lines[i + 1];
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(lines[i++]);
      out.push(renderTable(head, sep, rows));
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      const level = Math.min(6, h[1].length + 2); // keep headings modest inside chat
      out.push(`<h${level} class="md-h">${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])[1]);
      out.push(`<blockquote>${renderMarkdown(body.join("\n"))}</blockquote>`);
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      flush();
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const b = BULLET.exec(l);
        const o = ORDERED.exec(l);
        if (b) items.push({ indent: b[1].replace(/\t/g, "  ").length, ordered: false, text: b[2] });
        else if (o) items.push({ indent: o[1].replace(/\t/g, "  ").length, ordered: true, start: +o[2], text: o[3] });
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1].text += " " + l.trim();
        else break;
        i++;
      }
      out.push(renderList(items));
      continue;
    }
    const pics = imageLine(line);
    if (pics) {
      // pictures on lines of their own: one picture, or one album for a run of them
      flush();
      const all = [...pics];
      i++;
      for (let more; i < lines.length && (more = imageLine(lines[i])); i++) all.push(...more);
      out.push(imagesHtml(all));
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join("");
}

/**
 * The start of a long message, for a short excerpt (if1 #5): whole blocks up to about `max`
 * characters, cut only at a blank line outside a code fence. A first block longer than that is cut
 * at a word (and an open fence closed). Returns {md, more}.
 */
export function excerptMarkdown(src, max = 600) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  let fence = null, len = 0, cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const f = FENCE.exec(lines[i]);
    if (f && !fence) fence = f[1];
    else if (fence && lines[i].trim().startsWith(fence)) fence = null;
    if (!fence && !lines[i].trim() && len >= max * 0.5) {
      if (len >= max) { cut = i; break; }
      // the next block would run far past the limit: stop before it
      let next = 0;
      for (let j = i + 1; j < lines.length && lines[j].trim(); j++) next += lines[j].length + 1;
      if (len + next > max * 1.4) { cut = i; break; }
    }
    len += lines[i].length + 1;
  }
  let md = lines.slice(0, cut).join("\n").trim();
  let more = cut < lines.length && lines.slice(cut).some((l) => l.trim());
  if (md.length > max * 1.5) {
    md = md.slice(0, max).replace(/\s+\S*$/, "") + "…";
    more = true;
    const open = md.split("\n").filter((l) => FENCE.test(l)).length % 2 === 1;
    if (open) md += "\n```";
  }
  return { md, more };
}

/** Every "#cmsg_…" thread id linked from a message, in order. */
export function threadLinks(src) {
  const ids = [];
  const re = /\]\(#(cmsg_[A-Za-z0-9_-]{1,128})\)/g;
  let m;
  while ((m = re.exec(String(src ?? "")))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}
