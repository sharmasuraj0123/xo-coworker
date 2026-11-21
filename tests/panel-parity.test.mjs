// A thread in the panel behaves as it does in the main chat (the owner, 21 Nov: "I want consistency in the system"):
// each of the 12 differences found between the two goes through the one shared path, keyed by the conversation.
//   node tests/panel-parity.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), msgx = read("js/msgx.js"), gest = read("js/gestures.js"), mcss = read("css/msgx.css"), acss = read("css/app.css"), pcss = read("css/panel.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const fn = (src, name) => { const i = src.indexOf(name); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n}\n", i)); };
const mount = fn(app, "function tpMount(box)");

t("the conversation in use: the panel's thread page while focus is in it or it covers the chat, else the main chat", () => {
  const now = fn(app, "function composerNow()");
  assert.match(now, /if \(!TP\.K \|\| STAGE\.pageShown\?\.name !== "thread"\) return MK;/);
  assert.match(now, /if \(document\.body\.classList\.contains\("stage-full"\) \|\| PHONE\.matches\) return TP\.K;/);
  assert.match(now, /if \(!a \|\| a === document\.body\) return S\.kNow \|\| MK;\n\s*return TP\.box\.contains\(a\) \? TP\.K : MK;/, "focus dropped with a redrawn control: the conversation you were in (an Interrupt's Undo)");
});
t("1 · a drop: the app's one drop path hides the veil and adds the files to the composer under the pointer", () => {
  assert.doesNotMatch(mount, /addEventListener\("drop"|addEventListener\("dragover"|stopPropagation/, "the panel no longer swallows the drop (the veil stayed up)");
  assert.match(app, /if \(takes\(composerAt\(e\.target\)\)\) \{ depth\+\+; veil\.hidden = false; \}/);
  assert.match(app, /const on = !veil\.hidden, K = composerAt\(e\.target\); hide\(\); if \(on && takes\(K\)\) addFiles\(e\.dataTransfer\.files, K\);/);
});
t("2 · notices: the panel's thread page has its own line, over its own composer, and the line follows you", () => {
  assert.match(mount, /<div class="dock tp-dock" id="tpdock"><div class="herald" id="tpherald" aria-live="polite"><\/div>/);
  assert.match(app, /const heraldBox = \(\) => \(composerNow\(\) === MK \? \$\("#herald"\) : \$\("#tpherald"\)\);/);
  assert.match(fn(app, "function heraldRender("), /const box = heraldBox\(\);\n\s*for \(const o of \[\$\("#herald"\), \$\("#tpherald"\)\]\) if \(o && o !== box && o\.firstChild\)/, "the other line is emptied");
  assert.match(app, /document\.addEventListener\("focusin", \(\) => \{ const K = composerNow\(\); if \(K !== S\.kNow\) \{ S\.kNow = K; schedule\(\); \} \}\);/);
  assert.match(mount, /herald: \$\("#tpherald"\)/, "its back-to-latest button moves with its line");
  assert.match(pcss, /body\.stage-covers \.herald:not\(\.tp \.herald\)\{position:fixed/, "only the chat's line rises over a covering panel");
  assert.match(acss, /body:not\(\.stage-covers\) \.dock\.is-stacked>\.herald,\.tp \.dock\.is-stacked>\.herald\{/, "over a card docked in the panel it stands above it, covering or not");
  assert.match(app, /connLine\(world\.state, box === \$\("#herald"\) \? connDest\(\) : \{ thread: true \}\)/, "routing Off is never said over a thread's reply");
});
t("3 · a decision's Undo in the panel's dock ends its done line at once, as the chat's does", () => {
  assert.match(app, /onUndone: \(key\) => \{[^\n]*for \(const d of \[TD, TP\.dock\?\.TD\]\) if \(d\?\.undone && d\.undone\.key === key\) d\.undone\.end\(\); \},/);
});
t("4 · a line capsule opens the file in its own conversation's place", () => {
  assert.match(fn(app, "function openLineRef("), /const s = CHG\.scope\(convAt\(a\)\.view\), path = a\.dataset\.ref;/);
});
t("5 · / and the model shortcut act on the conversation in use", () => {
  assert.match(app, /intel: \(\) => \{ const K = composerNow\(\); toggleIq\(sessionOf\(K\.view\), K\.iq\); \},/);
  assert.match(app, /write: \(\) => composerNow\(\)\.say\.focus\(\),/);
});
t("6 · focus after Retry, Pick back up and a notice's Undo goes to that conversation's composer", () => {
  const r = fn(app, "function retry(id)");
  assert.match(r, /K = composerAt\(document\.activeElement\);/);
  assert.match(r, /if \(had\) K\.say\.focus\(\{ preventScroll: true \}\);/);
  assert.match(fn(app, "async function unfreeze("), /const K = composerAt\(btn\); S\.focusNext = \[\(\) => K\.say, \(\) => K\.conv\.scroller\];/);
  assert.match(app, /const K = composerNow\(\); S\.focusNext = \[\.\.\.\(\(h && h\.back\) \|\| \[\]\), \(\) => K\.say\];/);
  assert.match(app, /function heraldBack\(h\) \{ return \[[^\n]*composerNow\(\)\.say\]\.find\(usable\)/);
  assert.match(app, /S\.focusNext = \[\(\) => heraldBox\(\)\?\.querySelector\("\[data-herald-undo\]"\)\];/, "Interrupt's Undo, in the line where it shows");
  assert.doesNotMatch(app, /"#herald \[data-herald-undo\]"|S\.focusNext = \["#say"|"#send"\]/);
  assert.match(app, /const inUse = \(sel\) => \(\) => \{ const K = composerNow\(\); return sel === "#send" \? K\.send : K\.main \? \$\(sel\) : TP\.box\.querySelector\(sel\); \};/, "a Stop's notice goes back to its own conversation's controls");
});
t("7 · the @ list and the target line: one code for both composers", () => {
  assert.match(mount, /<ul id="tat-list" class="at-list" role="listbox" aria-label="Projects" hidden><\/ul>/);
  assert.match(mount, /aria-autocomplete="list" aria-controls="tat-list" aria-expanded="false"/);
  assert.match(mount, /<button type="button" class="target" id="ttarget" title="Aim at a project \(@\)"><\/button>/);
  assert.match(mount, /atList: TP\.K\.at,/, "Enter and Esc in the field leave an open list to it");
  const w = fn(app, "function wireComposer(K)");
  assert.match(w, /if \(atKeys\(e, K\)\) return;/);
  assert.match(w, /wireAt\(K\);\n\s*K\.target\.addEventListener\("click", \(\) => aimAt\(K\)\);/);
  assert.match(fn(app, "function updateComposer("), /sendRender\(K\); growSay\(K\);\n\s*if \(document\.activeElement === K\.say\) atRender\(K\); else atClose\(K\);/, "a redraw while you're elsewhere never opens it");
  assert.match(w, /K\.say\.addEventListener\("input", \(\) => \{ K\.at\._sel = 0;/, "typing starts the list at its first row, as the chat's does");
  assert.match(app, /if \(atKeys\(e, MK\)\) return;/, "the main chat's field: the same keys");
  assert.match(app, /aimAt\(MK\);\n\}\);/);
  assert.match(app, /if \(TP\.K && document\.activeElement === TP\.K\.say && !TP\.K\.at\.hidden\) \{ atShut\(TP\.K\); return true; \}/, "the page's Esc shuts an open list first, as the chat's field does");
});
t("8 · the room under the last message is each conversation's own", () => {
  assert.match(mcss, /:root\[data-msgx\] :is\(\.app\.has-tdock \.scroller:not\(\.tp \.scroller\),\.tp\.has-tdock \.scroller\)\{/);
  const room = fn(app, "function heraldRoom()");
  assert.match(room, /\[\[\$\("#herald"\), \$\("#dock"\), \$\("#app"\)\], \[\$\("#tpherald"\), \$\("#tpdock"\), TP\.box\]\]/, "the panel sets its own, never inherits the chat's");
  assert.match(app, /TP\.dockRO = watchDock\(els\.dock, box\);/, "its dock measured as the chat's is (is-stacked too)");
});
t("9 · a link in the panel keeps the message it points at, and a thread link opens the panel's way", () => {
  const o = fn(app, "function openFromPanel(");
  assert.match(o, /msg = e\?\.target\?\.closest\?\.\("\[data-go\]"\)\?\.dataset\.goMsg;/);
  assert.match(o, /if \(msg\) showMsg\(msg, TP\.C\); return;/);
  assert.match(o, /go\(v, \{ panel: true \}\);\n\s*if \(msg\) showMsg\(msg\);/);
  assert.match(fn(app, "function showMsg("), /const el = C\.msgs\.querySelector/);
  assert.match(app, /if \(t\.closest\("#stage"\)\) openFromPanel\("t:" \+ tl\.dataset\.thread, e\); else go\("t:" \+ tl\.dataset\.thread\);/);
});
t("10 · a coordinator's avatar wears its own conversation's project, not the sidebar's place", () => {
  assert.match(msgx, /const pid = E\.project\?\.\(\), row = document\.querySelector\(pid \? `#projects \.prow\[data-go="p:\$\{CSS\.escape\(pid\)\}"\]` :/);
  assert.match(mount, /project: \(\) => convProject\(tpView\(\)\)/);
});
t("11 · touch: long-press Copy and a drag down that lowers the keyboard, in every conversation", () => {
  assert.match(gest, /export function conversationGestures\(C\) \{/);
  assert.match(gest, /conversationGestures\(\{ scroller: \$\("#scroller"\), msgs: document\.getElementById\("msgs"\), say: A\.say, toast: A\.toast \}\);/);
  assert.doesNotMatch(fn(gest, "function longPress(A)"), /getElementById/);
  assert.match(mount, /conversationGestures\(\{ scroller: els\.scroller, msgs: els\.msgs, say: TP\.K\.say, toast: \(text\) => toastLine\(text\) \}\);/);
  assert.match(acss, /\.composer-field>textarea\{min-height:var\(--h-touch\)\}/, "a phone's field is touch height in both");
  assert.doesNotMatch(acss, /#say\{min-height/);
});
t("12 · a model change redraws every composer's chip", () => {
  assert.match(app, /onChange: \(o\) => \{ for \(const K of composers\(\)\) chipRender\(o && o\.fade, K\); \},/);
  assert.match(app, /const composers = \(\) => \(TP\.K \? \[MK, TP\.K\] : \[MK\]\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
