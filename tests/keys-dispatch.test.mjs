import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { wireGlobalKeys } from "../shell/global-keys.js";

const K = await import("../core/platform/keys.js");
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
  assert.equal(typeof K.globalFor, "function");
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
  assert.equal(K.globalFor(keydown("mod+j"), { typing: false }), null, "⌘J is the browser's again: it folded the chat docked beside a file, which is gone (Files is a page of the panel)");
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
const { document, window } = await dom('<button id="page"></button><textarea></textarea><div id="jump" hidden></div><div id="keys" hidden></div><div id="all" hidden></div>');
const page = document.querySelector("#page"), editor = document.querySelector("textarea");
const S = { view: "t:thread", recording: false }, jump = document.querySelector("#jump");
const calls = [];
let terminal = false, modal = false, handlesEscape = false;
wireGlobalKeys({
  S, jump, keys: document.querySelector("#keys"), allEl: document.querySelector("#all"),
  SH: { owns: () => terminal }, IQ: { isOpen: false }, CREATE: { isOpen: () => modal },
  GLOBAL: Object.fromEntries(GLOBAL.map((id) => [id, () => calls.push(id)])),
  LAYERS: { escape() { calls.push("escape"); return handlesEscape; } },
  FP: { toggleTree() { calls.push("treeFold"); return true; } },
  QO: { isOpen: false, open(mode) { calls.push(mode); return true; } },
  back: () => calls.push("back"), go: (view) => calls.push(view),
});
function press(target, combo, composing = false) {
  const props = keydown(combo);
  delete props.composedPath;
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(event, props, { isComposing: composing });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}
t("custom chords, symbol shortcuts and Files keys dispatch through the live listener", () => {
  assert.equal(K.set("keys", "mod+shift+j").ok, true);
  assert.equal(press(editor, "mod+shift+j"), true);
  K.resetAll();
  assert.equal(press(editor, "?"), false);
  assert.equal(press(page, "?"), true);
  assert.equal(press(page, "mod+b"), true);
  assert.equal(press(page, "mod+p"), true);
  assert.deepEqual(calls.splice(0), ["keys", "keys", "treeFold", "files"]);
});
t("editor, recording, native modal, composition and terminal retain their keys", () => {
  editor.addEventListener("keydown", (e) => e.preventDefault(), { once: true });
  press(editor, "mod+b");
  S.recording = true;
  press(page, "mod+k");
  S.recording = false;
  modal = true;
  press(page, "Escape");
  modal = false;
  press(editor, "Escape", true);
  terminal = true;
  press(page, "Escape");
  press(page, "mod+k");
  assert.deepEqual(calls.splice(0), []);
  press(page, K.binding("shells"));
  assert.deepEqual(calls.splice(0), ["shells"]);
  terminal = false;
});
t("Escape falls through to thread Back or Chats when the shell has no closing layer", () => {
  press(page, "Escape");
  S.view = "c:chat";
  press(page, "Escape");
  handlesEscape = true;
  press(page, "Escape");
  jump.hidden = false;
  assert.equal(press(page, "Escape"), true);
  assert.deepEqual(calls.splice(0), ["escape", "back", "escape", "chats", "escape", "escape"]);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
