// A thread beside the coordinator's chat (the owner chose the proper build, 19 Nov 15:20Z): the panel's Thread page.
// One page, its key the thread it shows; its own head, checklist, conversation (the chat's own drawing over its own
// elements), typing line and composer; it opens from the panel's Threads beside a chat (⌘/Ctrl-click: full width).
//   node tests/thread-page.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const storm = readFileSync(new URL("../js/storm.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");

// registered on the panel's page model: one page (single), 560 wide, its own box, kept while hidden
assert.match(app, /STAGE\.page\("thread", \{\n\s*single: true, width: 560,/);
assert.match(app, /mount: \(box\) => tpMount\(box\),\n\s*onShow: \(key, o\) => tpShow\(key, o\),\n\s*unmount: \(\) => tpUnmount\(\),/);
// its own elements (unique ids beside the main chat's), its own follower, drawing, composer and decoration
for (const id of ["tscroller", "tcolumn", "tmsgs", "ttyping", "tpdock", "tptdock", "tpcomposer", "tsay", "tsend"]) assert.match(app, new RegExp(`id="${id}"`), id);
assert.match(app, /TP\.follow = createFollow\(els\);/);
assert.match(app, /TP\.C = createConv\(\{ view: tpView, msgs: els\.msgs/);
assert.match(app, /wireComposer\(TP\.K\);/);
assert.match(app, /decorateConversation\(\{ conv: box, msgs: els\.msgs/);
// it draws with everything else, as its own conversation; a thread that's gone leaves the panel
assert.match(app, /if \(TP\.C && TP\.tid && STAGE\.pageShown\?\.name === "thread"\) drawThreadPage\(needs\);/);
assert.match(app, /drawConv\(TP\.C, needs\);/);
assert.match(app, /checklistRender\(needs, \$\("#tpthead"\), tpView\(\), "tck-list"\);/);
assert.match(app, /if \(!t\) \{ STAGE\.closeTab\("thread"\); return; \}/);
// watched beside the main thread (storm keeps both)
assert.match(app, /world\.act\.watchSideThread\?\.\(key\);/);
assert.match(storm, /watchSideThread: \(ts\) => \{ watched\.side = ts \|\| null;/);
// opening: beside a chat, from the panel's rows; ⌘/Ctrl-click or elsewhere: today's full page
const ofp = app.slice(app.indexOf("function openFromPanel("), app.indexOf("\n}\n", app.indexOf("function openFromPanel(")));
assert.match(ofp, /const besideChat = S\.view === "ws" \|\| S\.view\.startsWith\("p:"\);/);
assert.match(ofp, /!\(e && \(e\.metaKey \|\| e\.ctrlKey\)\)/);
assert.match(ofp, /STAGE\.show\("thread", v\.slice\(2\), \{ focus: true \}\); return;/);
assert.match(app, /const STAGE = createStage\(\{[^\n]*go: \(v, e\) => openFromPanel\(v, e\)/);
assert.match(app, /if \(g && !t\.closest\("#all"\) && !t\.closest\("#stage"\)\)/, "the panel's own links are the panel's");
// Open full width: its own page, as today
assert.match(app, /data-tp-full="\$\{esc\(t\.id\)\}"/);
// CSS: the panel's reading column, tokens only
const block = css.slice(css.indexOf("── The Thread page"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/inset 0 -1px 0/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("thread-page: ok");
// clicks inside it act on its own thread (P1 step 8): older pages, folds, Stop, Interrupt, Edit, its checklist, runs, a
// changed file's chip
{
  const a = app;
  for (const re of [/if \(t\.closest\("\[data-older\]"\)\) \{ loadOlderNow\(convAt\(t\)\); return; \}/, /stopRun\(convAt\(t\)\.view\)/, /interruptRun\(convAt\(t\)\.view\)/,
    /editFailed\(ed\.dataset\.edit, composerAt\(ed\)\)/, /S\.tbToggled = \{ k, open: S\.tbOpen\[k\], focus: [^\n]*, in: tc\.msgs \};/, /const cv = convAt\(cf\), c = CHG\.forTarget\(cv\.view, cf\.dataset\.file\);/,
    /:is\(#thead,#tpthead\) \[data-runs\]/, /const convAt = \(el\) => \(TP\.box && el && TP\.box\.contains\(el\) \? TP\.C : MAIN\);/]) assert.match(a, re, String(re));
  // what it asks you: one line above its composer that opens the decision
  assert.match(a, /class="tp-ask" data-tp-full="\$\{esc\(t\.id\)\}"/);
  console.log("thread-page clicks: ok");
}
