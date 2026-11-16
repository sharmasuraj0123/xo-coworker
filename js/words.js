// A message's words, for every Copy of a message: the desktop's (msgx.js) and the phone's long-press menu
// (gestures.js) read them the same way, so neither copies what the app adds around them (Launchpad grader on 28d9587,
// S170: the long-press Copy took a code block's "js" and "Copy" ahead of its code, from innerText).
/**
 * A message's words as they read: paragraphs apart, list items and rows on their own lines (a detached copy's
 * innerText has no layout, so blocks ran together, "First paragraph.Second…": Astra RPL-1/C052). Text keeps its
 * lines and spaces wherever its CSS does (your own bubble is pre-wrap; a code block is pre): those are kept as
 * written, untouched. What the app adds to a bubble (the sender's name, Reply and Copy, a sent quote's card, a code
 * block's label and Copy, icons) isn't its words.
 */
const BLOCK = { P: 2, BLOCKQUOTE: 2, PRE: 2, H1: 2, H2: 2, H3: 2, H4: 2, H5: 2, H6: 2, TABLE: 2, UL: 1, OL: 1, LI: 1, DIV: 1, TR: 1, HR: 1, FIGURE: 1, DETAILS: 1, SUMMARY: 1, DL: 1, DT: 1, DD: 1 };
const NOT_WORDS = ".mx-name, .mx-acts, .mx-swipe, .mx-qc, .md-code-head, button, svg, [aria-hidden='true'], .sr-only";
export function wordsOf(root) {
  // flowing: what was written last is text whose spaces the page collapses; keep: where the words end (a block's
  // breaks after the last of them aren't words, but a pre's own blank lines and spaces are, at either end)
  let out = "", flowing = true, keep = 0;
  const tidy = () => { if (flowing) out = out.replace(/ +$/, ""); };
  const brk = (n) => { if (!out) return; tidy(); const have = out.length - out.replace(/\n+$/, "").length; if (have < n) out += "\n".repeat(n - have); };
  const mode = (el, lines, spaces) => { const w = getComputedStyle(el).whiteSpace; return [lines || /^pre|^break-spaces/.test(w), spaces || w === "pre" || w === "pre-wrap" || w === "break-spaces"]; };
  (function walk(el, lines, spaces) {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) {
        let t = c.nodeValue;
        if (!spaces) { t = lines ? t.replace(/[^\S\n]+/g, " ") : t.replace(/\s+/g, " "); if (!out || out.endsWith("\n")) t = t.replace(/^ /, ""); }
        if (t) { out += t; flowing = !spaces; keep = spaces ? out.length : out.replace(/ +$/, "").length; }
        continue;
      }
      if (c.nodeType !== 1 || c.matches(NOT_WORDS)) continue;
      if (c.tagName === "BR") { tidy(); out += "\n"; continue; }
      const b = BLOCK[c.tagName] || 0;
      if (b) brk(b);
      walk(c, ...mode(c, lines, spaces));
      if (b) brk(b); else if (c.tagName === "TD" || c.tagName === "TH") out += " ";
    }
  })(root, ...mode(root, false, false));
  return out.slice(0, keep);
}
