// A thread beside the coordinator's chat (the owner chose the proper build, 19 Nov 15:20Z): the panel's Thread page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");

// registered on the panel's page model at the panel's own width (the owner, 20 Nov), its box built once and kept
const tps = app.slice(app.indexOf('STAGE.page("thread", {'), app.indexOf("});", app.indexOf('STAGE.page("thread", {')));
assert.doesNotMatch(tps, /width:|single:/, "no width of its own: a thread opens at the panel's width");
assert.match(tps, /mount: \(box\) => tpMount\(box\),\n\s*onShow: \(key, o\) => tpShow\(key, o\),/);
assert.match(tps, /close: \(\) => tpClose\(\),/);
// opening draws only the page: the chat beside it doesn't change
const tsh = app.slice(app.indexOf("function tpShow("), app.indexOf("\n}\n", app.indexOf("function tpShow(")));
assert.match(tsh, /drawThreadPage\(D\.needItems\(\)\);/);
assert.doesNotMatch(tsh, /\brender\(\)/, "never the whole app");
// its own elements (unique ids beside the main chat's), its own follower, drawing, composer and decoration
for (const id of ["tscroller", "tcolumn", "tmsgs", "ttyping", "tpdock", "tptdock", "tpcomposer", "tsay", "tsend"]) assert.match(app, new RegExp(`id="${id}"`), id);
assert.match(app, /TP\.follow = createFollow\(els\);/);
assert.match(app, /TP\.C = createConv\(\{ view: tpView, msgs: els\.msgs/);
assert.match(app, /wireComposer\(TP\.K\);/);
assert.match(app, /decorateConversation\(\{ conv: box, msgs: els\.msgs/);
// it draws with everything else, as its own conversation; a thread that's gone leaves the panel
assert.match(app, /if \(TP\.C && TP\.tid && !TP\.wait && STAGE\.pageShown\?\.name === "thread"\) drawThreadPage\(needs\);/);
assert.match(app, /drawConv\(TP\.C, needs\);/);
assert.match(app, /checklistRender\(needs, \$\("#tpthead"\), tpView\(\), "tck-list"\);/);
assert.match(app, /if \(!t\) \{ STAGE\.closePage\("thread"\); return; \}/);
// watched beside the main thread (storm keeps both)
assert.match(app, /world\.act\.watchSideThread\?\.\(key\);/);
// opening: beside a chat, from the panel's rows; ⌘/Ctrl-click or elsewhere: today's full page
const ofp = app.slice(app.indexOf("function openFromPanel("), app.indexOf("\n}\n", app.indexOf("function openFromPanel(")));
assert.match(ofp, /const besideChat = S\.view === "ws" \|\| S\.view\.startsWith\("p:"\),/);
assert.match(ofp, /!\(e && \(e\.metaKey \|\| e\.ctrlKey\)\)/);
assert.match(ofp, /STAGE\.show\("thread", v\.slice\(2\), \{ focus: true \}\); if \(msg\) showMsg\(msg, TP\.C\); return;/);
assert.match(app, /const STAGE = createStage\(\{[^\n]*go: \(v, e\) => openFromPanel\(v, e\)/);
assert.match(app, /if \(g && !t\.closest\("#all"\) && !t\.closest\("#stage"\)\)/, "the panel's own links are the panel's");
// Open full width: its own page, as today
assert.match(app, /data-tp-main="\$\{esc\(t\.id\)\}"/);
// CSS: the panel's reading column, tokens only
const block = css.slice(css.indexOf("── The Thread page"));
assert.ok(block.length > 300);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/inset 0 -1px 0|\b1px solid\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b|#[0-9a-f]{3,8}\b/i);
console.log("thread-page: ok");
// clicks inside it act on its own thread (P1 step 8): older pages, folds, Stop, Interrupt, Edit, its checklist, runs, a
// changed file's chip
{
  const a = app;
  for (const re of [/if \(t\.closest\("\[data-older\]"\)\) \{ loadOlderNow\(convAt\(t\)\); return; \}/, /stopRun\(convAt\(t\)\.view\)/, /interruptRun\(convAt\(t\)\.view\)/,
    /editFailed\(ed\.dataset\.edit, composerAt\(ed\)\)/, /S\.tbToggled = \{ k, open: S\.tbOpen\[k\], focus: [^\n]*, in: tc\.msgs \};/, /const cv = convAt\(cf\), c = CHG\.forTarget\(cv\.view, cf\.dataset\.file\);/,
    /t\.closest\(\"\.thead \[data-runs\]\"\)/, /t\.closest\(\"\.thead \[data-run\]\"\)/, /const convAt = \(el\) => \(TP\.box && el && TP\.box\.contains\(el\) \? TP\.C : MAIN\);/]) assert.match(a, re, String(re));
  // sub-agents open from either head, and closing goes back to the head that opened them
  assert.doesNotMatch(a, /#thead \[data-runs?\]/);
  assert.match(a, /RS\.head = \(convAt\(RS\.returnTo\) === MAIN \? \$\("#thead"\) : \$\("#tpthead"\)\);/);
  // what it asks you: decided in place, the chat's own card docked over its composer, with its Undo
  // what it asks you: the chat's own dock over the page's element (one code path, the owner 19 Nov 17:52Z): its
  // card, its fold to a slim line and back (⌄, a drag), its Undo
  assert.match(a, /TP\.dock\.render\(needs\);/);
  assert.match(a, /TP\.dock = createDock\(\{ el: \$\("#tptdock"\), view: tpView, region: \(\) => TP\.C\.scroller \}\);/);
  assert.match(a, /const MDOCK = createDock\(\{ el: tdock, view: \(\) => S\.view, region: \(\) => placeRegion\(\)/);
  const cd = a.slice(a.indexOf("function createDock("), a.indexOf("const MDOCK = createDock("));
  assert.match(cd, /tpl\.innerHTML = D\.cardHtml\(n, "dock"\)\.trim\(\);/);
  assert.match(cd, /data-fold="\$\{esc\(n\.key\)\}"/, "the fold control");
  assert.match(cd, /bar\.dataset\.unfold = n\.key;/, "folded: a slim line that opens it again");
  assert.match(cd, /if \(f\) \{ S\.dockFold\[f\.dataset\.fold\] = true; dockRender\(D\.needItems\(\)\); placeRegion\(\)\.focus/);
  assert.match(cd, /dockGestures\(tdock\);/, "and its drag");
  assert.doesNotMatch(cd, /S\.view/, "its conversation's view, never the main chat's");
  assert.doesNotMatch(a, /tpDockRender|data-tpd-undo/, "no copy of the dock for the page");
  const g = readFileSync(new URL("../shell/gestures.js", import.meta.url), "utf8");
  assert.match(g, /export function dockGestures\(tdock\) \{/);
  assert.doesNotMatch(g.slice(g.indexOf("export function wireGestures(")), /drag\(tdock, \{/, "the drag is bound once per dock, by its dock");
  console.log("thread-page clicks: ok");
}

// the page's one reading column: its messages and its dock (asks line, composer) share their edges
{ const c2 = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
  assert.match(c2, /\.stage \.tp,\.stage \.tp \.dock\{--col-w:min\(var\(--col-max\),100cqw - 2 \* var\(--gut-min\)\);--col-x:calc\(\(100cqw - var\(--col-w\)\) \/ 2\);--measure:max\(calc\(var\(--col-w\) - var\(--s-12\)\), min\(100%, var\(--measure-min\)\)\)\}/, "the main chat's own column rule");
  const a2 = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(a2, /:is\(\.home,\.conv,\.arts,\.lpp,\.dock\)\{container-type:inline-size;--col-w:min\(var\(--col-max\),100cqw - 2 \* var\(--gut-min\)\);--col-x:calc\(\(100cqw - var\(--col-w\)\) \/ 2\);--measure:max\(calc\(var\(--col-w\) - var\(--s-12\)\), min\(100%, var\(--measure-min\)\)\)\}/);
  assert.match(a2, /\n\.main\{--rp:0px;--gut-min:28px;--col-max:calc\(24 \* var\(--h-ctl\)\)\}/);
  const st2 = readFileSync(new URL("../shell/panel/width.js", import.meta.url), "utf8");
  assert.match(st2, /function apply\(\) \{\n\s*const v = clampW\(wSaved \|\| wDef\(\)\);/, "one width for everything the panel shows");
  assert.doesNotMatch(st2, /pageSpecW|PAGE_MIN|WIDE/);
  console.log("thread-page column and width: ok"); }

// a file chip clicked in the thread page opens that thread's file (its worktree), not the main chat's project's
assert.match(app, /VW\.open\(\{ \.\.\.f, \.\.\.fileRoute\(f\.path, convAt\(btn\)\.view\) \}, btn\);/);
assert.match(app, /route: \(p\) => fileRoute\(p, conv\), by:/);
{ // fileRoute, run as written: a thread's path goes through its thread; a project chat's through the project
  const src = app.slice(app.indexOf("function fileRoute("), app.indexOf("\n}\n", app.indexOf("function fileRoute(")) + 2);
  const fr = new Function("convThread", "sharedFileRoute", "S", "drawing", `${src}; return fileRoute;`)(
    (v) => (v === "t:x" ? { id: "x", project: "p" } : null), (t, p) => ({ via: t ? "thread:" + t.id : "none", p }), { view: "p:p" }, null);
  assert.deepEqual(fr("a.md", "t:x"), { via: "thread:x", p: "a.md" }, "the thread page's chip: its thread's worktree");
  assert.deepEqual(fr("a.md", "p:p"), { project: "p", rel: "a.md" }, "the project chat's chip: the project");
  assert.deepEqual(fr("a.md"), { project: "p", rel: "a.md" }, "no conversation named, nothing drawn: the main chat's");
  console.log("thread-page file chips: ok"); }

// its ⋯ is THE thread menu (the owner, 19 Nov 18:59Z): the full header's, opened in the page; its hover and keys
// (menuKeys on the page's head), drawn in the click; a choice acts there or goes to its own page with it started
assert.match(app, /data-tmenu="\$\{esc\(t\.id\)\}" data-tmenu-in="page" aria-haspopup="menu" aria-expanded="\$\{open\}"/);
assert.match(app, /\$\{open \? threadMenuHtml\(t, "page"\) : ""\}/);
assert.match(app, /STAGE\.slot\.append\(acts\);\n\s*menuKeys\(acts, \{ close: \(\) => closeThreadMenu\(\) \}\);/, "its ⋯ in the panel's head, its keys there");
assert.match(app, /const opener = S\.tMenuIn === "page" \? "#tpacts \[data-tmenu\]" : "#top-who \[data-tmenu\]";/);
assert.doesNotMatch(app, /tpMenuHtml|data-tp-menu|TP\.menu/, "no second menu");
assert.match(app, /where === "page" \? item\(`data-tp-main="\$\{esc\(t\.id\)\}"`, "Open in main chat"\) : item\(`data-tside="\$\{esc\(t\.id\)\}"`, "Open beside its project's chat"\)/);
assert.match(app, /render\(\); \/\/ drawn now, in the click/);
// one ⤢ in the head (the panel's full size); the thread's own page is "Open as its own page" in its ⋯ (the owner, 20 Nov:
// two ⤢ did different things)
{ const th = app.slice(app.indexOf("function tpHead("), app.indexOf("\n}\n", app.indexOf("function tpHead(")));
  assert.doesNotMatch(th, /tp-full/);
  assert.match(th, /redraw\(head, html\); redraw\(acts, menu\);/); }
// at full size only the chat's own dock hides under the panel; the Thread page's reply box and decision stay
{ const a3 = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(a3, /body\.stage-full \.dock:not\(\.stage \.dock\),body\.stage-full \.tdock:not\(\.stage \.tdock\)\{visibility:hidden\}/);
  assert.doesNotMatch(a3, /body\.stage-full \.dock,body\.stage-full \.tdock\{/, "never every dock");
  // and at full size the page reads at the chat's own column, centred (it ran edge to edge)
  const p3 = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
  assert.doesNotMatch(p3, /body\.stage-full \.stage \.tp/, "one rule at every panel width"); }
console.log("thread-page menu: ok");

// its composer has files (the paperclip, a paste, a drop on the page) and its model chip, the chat's own code
for (const id of ["tatt-tray", "tattach", "tatt-input", "tiq", "tatt-note"]) assert.match(app, new RegExp(`id="${id}"`), id);
assert.match(app, /wireTray\(TP\.K\);/);
assert.match(app, /wireTray\(MK\);/);
assert.match(app, /const on = !veil\.hidden, K = composerAt\(e\.target\); hide\(\); if \(on && takes\(K\)\) addFiles\(e\.dataTransfer\.files, K\);/, "a drop on the page: the app's one drop, into its composer");
assert.match(app, /trayRender\(K\); chipRender\(false, K\);/);
assert.match(app, /toggleIq\(sessionOf\(tpView\(\)\), TP\.K\.iq\)/);
console.log("thread-page files and model: ok");
// a step of space over the checklist strip, the same in a thread's page and the panel's Thread page (the owner,
// 19 Nov 16:19Z); the page gives the strip the header gutter it uses (undefined, it voided the strip's padding)
{ const a2 = readFileSync(new URL("../css/app.css", import.meta.url), "utf8"), p2 = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
  assert.match(a2, /\n\.thead\{flex:none;padding:var\(--s-1\) var\(--hg\) var\(--s-2\);/);
  assert.doesNotMatch(a2, /\n\s+grader on 8aa58d3, C024[^\n]*\*\/\n/, "no stray comment ending voids the rule after it");
  assert.match(p2, /\.stage \.tp-thead\{--hg:var\(--s-4\)\}/);
  console.log("thread-page checklist gap: ok"); }

// msgx can take down what it hung on the page (its document listeners, its timer, its quote button and sheets); the
// Thread page is built once and kept, so nothing is hung twice
{ const mx = readFileSync(new URL("../js/msgx.js", import.meta.url), "utf8"), ap = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const code = mx.replace(/\/\/[^\n]*/g, "");
  const body = code.slice(code.indexOf("export function decorateConversation(E) {"));
  assert.doesNotMatch(body.replace(/const onDoc = [^\n]*/, ""), /document\.addEventListener\(/, "every document listener goes through onDoc, so destroy() removes it");
  assert.equal((body.match(/\bonDoc\("/g) || []).length, 5);
  assert.match(body, /const tk = setInterval\(tick, 1000\); gone\.push\(\(\) => clearInterval\(tk\)\);/);
  assert.match(body, /document\.body\.append\(qpop\); gone\.push\(\(\) => qpop\.remove\(\)\);/);
  assert.match(body, /return \{ decorate, conv, msgs, destroy: \(\) => \{ while \(gone\.length\) gone\.pop\(\)\(\); \} \};/);
  assert.match(ap, /TP\.deco = decorateConversation\(/);
  assert.match(ap, /TP\.dockRO = watchDock\(els\.dock, box\);/);
  assert.match(ap, /function tpClose\(\) \{/);
  assert.doesNotMatch(ap, /function tpUnmount\(/, "the page is never torn down and rebuilt");
  console.log("thread-page teardown: ok"); }
// Open in main chat, left of the state badge (the owner, 21 Nov): the header's filled control, the owner's icon from the pack;
// the thread takes the main chat with its usual entrance and the panel's page goes back
{ const ui = readFileSync(new URL("../core/ui/icons/names.js", import.meta.url), "utf8");
  const appCss = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(ui, /toMain: xi\("open-in-main"\),/);
  assert.match(app, /const html = `<button type="button" class="stg-btn tp-main" data-tp-main="\$\{esc\(t\.id\)\}" title="Open in main chat" aria-label="Open in main chat">\$\{ICON\.toMain\}<\/button><span class="badge/);
  assert.match(app, /if \(!still\) el\.classList\.add\(/);
  assert.match(app, /function toMain\(id\) \{\n  closeThreadMenu\(\{ focus: false \}\);\n  STAGE\.closePage\("thread"\); go\("t:" \+ id, \{ panel: true \}\);\n\}/);
  assert.doesNotMatch(app, /startViewTransition/, "no pictures of the thread are morphed: nothing zooms or seems to scroll");
  assert.doesNotMatch(appCss, /view-transition/);
  assert.doesNotMatch(app, /data-tp-full/); }
console.log("thread-page open in main: ok");
