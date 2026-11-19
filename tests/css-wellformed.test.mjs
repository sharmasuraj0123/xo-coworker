// Every stylesheet parses the way it reads: no comment left half-deleted, no unclosed comment, braces balanced, and
// every selector whole (balanced brackets and quotes). A browser drops a rule whose selector is broken, silently.
// The owner, 19 Nov 14:06Z: "in every thread, this is extending till the end". 8525acc8 took the Now strip's rules
// out and left the second line of their comment ("grader on 8aa58d3, C024: … specificity) */"); it became part of
// the next selector, so .thead{padding:0 var(--hg) 10px;border-bottom:…} was dropped and the thread's checklist ran
// from edge to edge of the conversation, past the header's own edges.
//   node tests/css-wellformed.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../css/", import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith(".css"));
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };
const line = (s, i) => s.slice(0, i).split("\n").length;

/** the sheet without its comments, each comment kept as spaces so positions (and line numbers) hold */
function uncomment(f, s) {
  let out = "", i = 0;
  for (;;) {
    const o = s.indexOf("/*", i);
    if (o < 0) { out += s.slice(i); break; }
    out += s.slice(i, o);
    const c = s.indexOf("*/", o + 2);
    assert.ok(c >= 0, `${f}:${line(s, o)}: a comment that never closes swallows the rest of the sheet`);
    out += s.slice(o, c + 2).replace(/[^\n]/g, " ");
    i = c + 2;
  }
  return out;
}

const sheets = files.map((f) => { const s = readFileSync(new URL(f, DIR), "utf8"); return { f, s }; });

t("no comment is left open, and no comment's tail is left outside one", () => {
  for (const { f, s } of sheets) {
    const u = uncomment(f, s), k = u.indexOf("*/");
    assert.equal(k, -1, `${f}:${line(u, k)}: the end of a comment whose start was deleted (its words become a selector)`);
  }
});

t("braces balance in every sheet", () => {
  for (const { f, s } of sheets) {
    const u = uncomment(f, s).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => " ".repeat(m.length));
    let d = 0;
    for (let i = 0; i < u.length; i++) {
      if (u[i] === "{") d++;
      else if (u[i] === "}") { d--; assert.ok(d >= 0, `${f}:${line(u, i)}: a } with no {`); }
    }
    assert.equal(d, 0, `${f}: ${d} { never closed`);
  }
});

t("every selector is whole: its brackets and quotes balance, and it holds no words of prose", () => {
  for (const { f, s } of sheets) {
    const u = uncomment(f, s);
    // a selector (or an at-rule's prelude) is what stands between the last ; { or } and the next {
    const re = /(?:^|[;{}])([^;{}]*)\{/g;
    for (let m; (m = re.exec(u)); ) {
      const sel = m[1].trim();
      if (!sel || sel.startsWith("@")) continue;
      const at = `${f}:${line(u, m.index + m[0].length - 1)}: ${sel.replace(/\s+/g, " ").slice(0, 90)}`;
      const bare = sel.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
      assert.ok(!/["']/.test(bare.replace(/""/g, "")), `${at}: an unpaired quote`);
      for (const [o, c] of [["(", ")"], ["[", "]"]]) assert.equal(bare.split(o).length, bare.split(c).length, `${at}: unbalanced ${o}${c}`);
      // three plain words in a row, outside any bracket, is a sentence, not a selector
      const flat = bare.replace(/\([^()]*\)|\[[^\]]*\]/g, "");
      assert.ok(!/(?:^|[\s,])[a-z]{2,}\s+[a-z]{2,}\s+[a-z]{2,}(?:\s+[a-z]{2,})/i.test(flat) || /^(from|to|\d)/.test(flat), `${at}: reads as prose`);
    }
  }
});

t("the thread's header strip has its rule: the header's edges and its rule line", () => {
  const app = uncomment("app.css", readFileSync(new URL("app.css", DIR), "utf8"));
  assert.ok(/(?:^|\})\s*\.thead\{flex:none;padding:0 var\(--hg\) 10px;border-bottom:1px solid var\(--line-faint\)\}/.test(app), ".thead's rule stands on its own, after a closed rule");
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("css-wellformed: all passed");
