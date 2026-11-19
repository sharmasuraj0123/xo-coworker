// @ts-check

// Markdown for chat messages, safe by construction: the input is never HTML; math, charts and diagrams are drawn when the page has them.

import { esc } from "../../platform/index.js";
import { highlight } from "./highlight.js";
import { chartHtml } from "./chart.js";
import { renderInline, mathHtml, diagramHtml, imagesHtml, imageLine } from "./inline.js";

export { setThreadInfo, ARROW_OUT, shortUrl, outText, setRich, webImageUrl, fileImagePath, imageLine, setWebImages, renderInline } from "./inline.js";

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

/** @param {string} lang @param {string} code */
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

/** A table row's cells: split on "|" outside `code`, with the outer pipes dropped. (Files' page edits tables by it.) @param {string} line @returns {string[]} */
export function cells(line) {
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
/** @param {string} head @param {string} sep @param {string[]} rows */
function renderTable(head, sep, rows) {
  const align = cells(sep).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : ""));
  const td = (/** @type {string} */ tag, /** @type {string} */ c, /** @type {number} */ i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ""}>${renderInline(c)}</${tag}>`;
  const h = cells(head);
  return `<div class="md-table"><table><thead><tr>${h.map((c, i) => td("th", c, i)).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => { const rc = cells(r); return `<tr>${h.map((_, i) => td("td", rc[i] ?? "", i)).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}

/** @param {{ indent: number, ordered: boolean, start?: number, text: string }[]} lines */
function renderList(lines) {
  let html = "";
  let i = 0;
  const walk = (/** @type {number} */ baseIndent) => {
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

/** Render a message's markdown to an HTML string (safe to assign to innerHTML). @param {unknown} src @returns {string} */
export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  /** @type {string[]} */
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
      const closed = i < lines.length;
      i++; // closing fence (or end of input)
      // a chart, a diagram or a formula is drawn only once its fence is closed: while it streams it's code
      const lang = fence[2].toLowerCase(), code = body.join("\n");
      if (closed && lang === "chart") { const c = chartHtml(code); if (c) { out.push(c); continue; } }
      if (closed && lang === "mermaid" && code.trim()) { out.push(diagramHtml(code)); continue; }
      if (closed && (lang === "math" || lang === "katex") && code.trim()) { out.push(`<div class="md-display">${mathHtml(code, true)}</div>`); continue; }
      out.push(codeBlock(fence[2], code));
      continue;
    }
    // display math on lines of its own: $$ … $$ or \[ … \] (one line or several); unclosed (still streaming), it's text
    const dm = /^\s{0,3}(\$\$|\\\[)/.exec(line);
    if (dm) {
      const close = dm[1] === "$$" ? "$$" : "\\]";
      const first = line.trim().slice(2);
      let j = i, tex = null;
      if (first.trimEnd().endsWith(close) && first.trim().length > close.length - 1) tex = first.trimEnd().slice(0, -close.length);
      else {
        const acc = [first];
        for (j = i + 1; j < lines.length; j++) {
          const t = lines[j].trimEnd();
          if (t.endsWith(close)) { acc.push(t.slice(0, -close.length)); tex = acc.join("\n"); break; }
          if (!t.trim() && dm[1] === "$$" && j > i + 40) break;
          acc.push(lines[j]);
        }
      }
      // only the formula on its lines: "$$x$$ and more" is a sentence, drawn inline
      if (tex != null && tex.trim() && !tex.includes(close === "$$" ? "$$" : "\\]")) {
        flush();
        out.push(`<div class="md-display">${mathHtml(tex, true)}</div>`);
        i = j + 1;
        continue;
      }
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
      while (i < lines.length && QUOTE.test(lines[i])) body.push(/** @type {RegExpExecArray} */ (QUOTE.exec(lines[i++]))[1]);
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

/** A long message's start: whole blocks up to about max characters, else the first block cut at a word, its fence closed. Returns {md, more}. @param {unknown} src */
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

/** Every "#cmsg_…" thread id linked from a message, in order. @param {unknown} src */
export function threadLinks(src) {
  /** @type {string[]} */
  const ids = [];
  const re = /\]\(#(cmsg_[A-Za-z0-9_-]{1,128})\)/g;
  let m;
  while ((m = re.exec(String(src ?? "")))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}
