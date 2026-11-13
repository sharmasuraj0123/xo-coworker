// A notice says what kind of news it is: Launchpad's failures read as failures (an error's mark and ink), never with
// the success check (Launchpad grader on 842a6d1: "Couldn't unlink…" showed a green check, because the app drew every
// Launchpad notice as kind "done"). No browser: the source says which kind each notice carries, and the herald draws
// each kind.
//   node tests/notice-kind.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lp = readFileSync(new URL("../js/launchpad.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// every notify(…) call in Launchpad, with its arguments' text (up to the call's own closing paren)
function calls(src) {
  const out = [];
  for (let i = src.indexOf("notify("); i >= 0; i = src.indexOf("notify(", i + 1)) {
    if (/[\w.]$/.test(src[i - 1] || "") && src.slice(i - 7, i) !== "notify " && !/&& $/.test(src.slice(i - 3, i))) { if (src[i - 1] !== " ") continue; }
    let depth = 0, j = i + 6;
    for (; j < src.length; j++) { const c = src[j]; if (c === "(") depth++; else if (c === ")") { depth--; if (!depth) break; } }
    const args = src.slice(i + 7, j), line = src.slice(0, i).split("\n").length;
    if (/^\s*\*/.test(src.slice(src.lastIndexOf("\n", i) + 1, i))) continue; // a comment
    out.push({ line, args });
  }
  return out;
}
const FAIL = /Couldn't|didn't|ran out|COPY_REFUSED|failWords/;
// a subject's one notice (a stop's, an unlink's: say(mid, { text, kind, … }), changed in place): each say(…) call's
// line object, from its first { to its matching }
function says(src) {
  const out = [];
  for (let i = src.indexOf("say("); i >= 0; i = src.indexOf("say(", i + 1)) {
    if (/[\w.]/.test(src[i - 1] || "") || src.slice(i - 6, i).endsWith("const ")) continue; // unsay(, a definition
    const o = src.indexOf("{", i);
    if (o < 0 || o - i > 40) continue;
    let depth = 0, j = o;
    for (; j < src.length; j++) { const c = src[j]; if (c === "{") depth++; else if (c === "}") { depth--; if (!depth) break; } }
    out.push({ line: src.slice(0, i).split("\n").length, obj: src.slice(o, j + 1) });
  }
  return out;
}
t("Launchpad: every notice that says something failed is sent as an error", () => {
  const bad = calls(lp).filter((c) => FAIL.test(c.args.split(",")[0]) && !/"err"\s*\)?\s*$/.test(c.args.trim()));
  assert.deepEqual(bad.map((c) => `launchpad.js:${c.line} notify(${c.args.slice(0, 60)}…)`), [], "failures not sent as errors");
  const badSay = says(lp).filter((c) => FAIL.test((/text: ([^,]+)/.exec(c.obj) || [])[1] || "") && !/kind: "err"/.test(c.obj));
  assert.deepEqual(badSay.map((c) => `launchpad.js:${c.line} say(${c.obj.slice(0, 60)}…)`), [], "failures (in a subject's notice) not sent as errors");
});
t("Launchpad: a stop on its way isn't announced with a success check", () => {
  const stop = says(lp).filter((c) => /text: `Stopping the deploy/.test(c.obj));
  assert.ok(stop.length >= 2, "the stop's notice: in its window, and once the stop is on its way");
  for (const c of stop) assert.match(c.obj, /kind: "halt"/, `its kind: ${c.obj.slice(0, 80)}`);
});
t("the app carries a Launchpad notice's kind to the herald (never one kind for all)", () => {
  const m = /notify:\s*\(([^)]*)\)\s*=>\s*heraldShow\(\{\s*kind(?:\s*:\s*([^,]+))?,/.exec(app);
  assert.ok(m, "Launchpad's notify is wired to heraldShow");
  assert.match(m[1], /kind/, `it takes a kind: (${m[1]})`);
  assert.ok(m[2] == null || /\bkind\b/.test(m[2]), `and passes it on, not one kind for all: kind: ${m[2]}`);
  assert.match(m[2] || "", /kind === "err" \? "stopped"/, "a failure becomes the app's own failure kind (stopped), as every other failure notice");
});
t("the herald draws a failure as a failure: its own mark, in the error's ink (never the success check)", () => {
  assert.match(app, /h\.kind === "stopped"\s*\?\s*`<span class="hr-ic k-stopped">/, "a failure notice gets the k-stopped mark");
  assert.match(css, /\.hr-ic\.k-stopped\{[^}]*var\(--err-ink\)/, ".hr-ic.k-stopped is in the error's ink");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
