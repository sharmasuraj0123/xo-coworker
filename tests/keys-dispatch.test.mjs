// Settings and the page agree on every key that works anywhere (the controls grader's C118 on c055e74: Settings took
// Ctrl+Shift+J for All shortcuts, stored and announced it, and pressing it did nothing: the page answered ⌘/Ctrl keys
// for four actions only). The real js/keys.js: for each "Anywhere" action and each candidate key, if set() takes it,
// the keydown that key makes sets that action off (globalFor), while typing too when it has ⌘/Ctrl, and never while
// typing when it hasn't; and app.js asks globalFor, not a list of its own. Also: ⌥ alone is refused (it types).
//   node tests/keys-dispatch.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const K = await import("../js/keys.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// the keydown a combo makes, as a browser on Windows/Linux reports it (Ctrl; a letter's code; a symbol's key)
const SHIFTED = { "/": "?", "\\": "|", "`": "~", ".": ">", ",": "<", ";": ":", "'": '"', "[": "{", "]": "}" };
const keydown = (combo) => {
  const parts = combo.split("+"), key = parts.pop() || "+", mod = parts.includes("mod"), alt = parts.includes("alt"), shift = parts.includes("shift");
  const letter = /^[a-z]$/.test(key);
  return { key: letter ? (shift ? key.toUpperCase() : key) : key, code: letter ? `Key${key.toUpperCase()}` : "", ctrlKey: mod, metaKey: false, altKey: alt, shiftKey: shift || (!letter && Object.values(SHIFTED).includes(key)), isComposing: false, composedPath: () => [] };
};
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split(""), SYMBOLS = ["/", "?", "\\", "`", ".", ",", ";", "'", "[", "]", "|", "~", ">", "!"];
const CANDIDATES = [
  ...LETTERS.flatMap((l) => [`mod+${l}`, `mod+shift+${l}`, `mod+alt+${l}`, `alt+${l}`, l, `shift+${l}`]),
  ...SYMBOLS.flatMap((s) => [s, `mod+${s}`, `alt+${s}`]),
  ..."0123456789".split("").flatMap((d) => [d, `mod+${d}`]),
];
const GLOBAL = K.ACTIONS.filter((a) => a.scope === "global" && !a.fixed).map((a) => a.id);

t("every key Settings takes for an Anywhere action, the page answers with that action", () => {
  assert.equal(typeof K.globalFor, "function", "js/keys.js globalFor(e, { typing })");
  const wrong = [];
  let taken = 0;
  for (const id of GLOBAL) {
    for (const combo of CANDIDATES) {
      K.resetAll();
      if (!K.set(id, combo).ok) continue;
      taken++;
      const e = keydown(K.binding(id));
      const got = K.globalFor(e, { typing: false });
      if (got !== id) wrong.push(`${id} = ${combo}: not typing, the page answers ${got}`);
      const mod = K.hasMod(id), whileTyping = K.globalFor(e, { typing: true });
      if (mod && whileTyping !== id) wrong.push(`${id} = ${combo} (⌘/Ctrl): while typing, the page answers ${whileTyping}`);
      if (!mod && whileTyping === id) wrong.push(`${id} = ${combo} (no ⌘/Ctrl): it fired while typing`);
    }
  }
  K.resetAll();
  assert.ok(taken > 100, `a real sweep (${taken} keys taken)`);
  assert.deepEqual(wrong.slice(0, 12), [], `${wrong.length} disagree`);
});
t("the grader's case: Ctrl+Shift+J for All shortcuts is taken, and opens it; the defaults still answer", () => {
  assert.equal(typeof K.globalFor, "function");
  K.resetAll();
  assert.equal(K.set("keys", "mod+shift+j").ok, true);
  assert.equal(K.globalFor(keydown("mod+shift+j"), { typing: false }), "keys");
  assert.equal(K.globalFor(keydown("mod+shift+j"), { typing: true }), "keys", "a ⌘/Ctrl key works while typing");
  assert.equal(K.globalFor(keydown("mod+j"), { typing: false }), "chatFold", "⌘J is still the chat's fold");
  K.resetAll();
  assert.equal(K.globalFor(keydown("?"), { typing: false }), "keys", "? by default");
  assert.equal(K.globalFor(keydown("?"), { typing: true }), null, "never while typing");
  assert.equal(K.globalFor(keydown("mod+k"), { typing: true }), "jump");
});
t("⌥ alone (it types a character of its own) is refused for an Anywhere action", () => {
  K.resetAll();
  assert.ok(K.set("keys", "alt+/").error, "alt+/ refused");
  assert.ok(K.set("write", "alt+.").error, "alt+. refused");
  assert.equal(K.set("keys", "mod+alt+j").ok, true, "with ⌘/Ctrl it's fine");
  K.resetAll();
});
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
t("the page asks the one rule, not a list of its own", () => {
  assert.doesNotMatch(app, /for \(const id of \["jump", "intel", "shells", "map"\]\)/, "the four-action list is gone");
  assert.match(app, /const g = K\.globalFor\(e\);\s*if \(g && K\.hasMod\(g\) && runGlobal\(g\)\)/, "⌘/Ctrl keys: the one rule, everywhere");
  assert.match(app, /const s = K\.globalFor\(e, \{ typing: false \}\);\s*if \(s && !K\.hasMod\(s\) && runGlobal\(s\)\)/, "symbol keys: the one rule, not while typing");
  assert.match(app, /function runGlobal\(id\) \{[\s\S]*?chatFold[\s\S]*?treeFold[\s\S]*?GLOBAL\[id\]\(\);/, "every Anywhere action runs from it, the folds included");
  for (const id of ["jump", "intel", "write", "keys", "shells", "map"]) assert.match(app, new RegExp(`^  ${id}: \\(\\) =>`, "m"), `GLOBAL.${id}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
