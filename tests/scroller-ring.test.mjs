// Every box that clips keeps the focus ring's room inside it, or holds nothing a ring is drawn around at its edges. The
// rows found one box at a time: the runs strip (C047, overflow-x:auto, a chip's ring cut on three sides), the
// sidebar's project list (C008, 2 px above its first row), the checklist's bar in a thread's head (C045,
// overflow:hidden: the toggle fills it, only the ring's right edge showed), and a code block on a phone (S089,
// overflow:hidden: Copy, 36 tall in a 34 px head, lost its ring's top). A box that clips one way clips the other too.
// The ring, 4 px outside a control, is cut unless the control draws its ring inside itself or the box pads it with the
// ring's room (--ring-room). So every clipping box is placed, scroll or not: overflow on either axis, paint
// containment, a clip path or a mask. A new one fails here until it's placed, with what it holds and how the ring
// stays whole. What can't hold a control is placed by the rule itself: a line of text that ellipsizes, a picture, a
// pseudo-element, a control's own overflow (its own ring is drawn outside it). The sweep of the page as drawn, every
// control focused and every clipping box around it checked, is flows' RINGCLIP.
//   node tests/scroller-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rules as cascade, decls } from "./lib/cascade.mjs";

const R = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const css = readdirSync(new URL("css/", R)).filter((f) => f.endsWith(".css")).map((f) => [f, read(`css/${f}`)]);
const all = css.map((x) => x[1]).join("\n");
const base = read("css/base.css"), fnd = read("css/foundation.css"), tokens = read("css/tokens.css");
const ring = base.match(/(^|\n):focus-visible\{outline:(\d+)px solid var\(--focus\);outline-offset:(\d+)px\}/);
const ext = +ring[2] + +ring[3], room = +tokens.match(/--ring-room:(\d+)px/)[1];
const inset = (fnd.match(/:is\(([^)]*)\):focus-visible\{outline-offset:-2px\}/) || [])[1] || "";
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// each scroll box: what it holds, and how a focused control's ring stays whole at its edges ("room": the box's padding,
// or that of the one named, gives the ring's room on every side; "inset": its controls draw their ring inside them;
// "inner": the content inside it carries its own room; "text": it holds text or one field, no control)
const SCROLLERS = {
  ".rn-strip": ["room", "the running sub-agents' chips (C047)"],
  ".projects": ["room", "the sidebar's projects (C008: 2 px above the first row cut its ring)"],
  ".mp-legend": ["room", "the Map's agents (none above the first row cut its ring)"],
  ".c-body": ["room", "a decision card's body"], ".all-list": ["room", "All threads"], ".jump-list": ["room", "Jump's list"],
  ".keys-cols": ["room", "Settings › Keyboard"], ".set-body": ["room", "Settings' page"], ".set-page": ["room", "a Settings page on a phone"],
  ".rn-body": ["room", "Runs' sheet"], ".shd-list": ["room", "Shells' list"], ".dd-menu": ["room", "a dropdown's options"],
  ".cs-pop": ["room:.iq-pop", "the new chat's settings (an .iq-pop)"],
  ".now": ["inset:.nw", "the Now strip's chips"], ".shd-tabs": ["inset:.shd-tab", "a shell's tabs"], ".stg-tabs": ["inset:.stg-tab", "the stage's tabs"],
  ".set-nav": ["inset:.set-nav button", "Settings' rail"], ".fl-list": ["inset:.fl-r", "Files' tree"], ".iq-list": ["inset:.iq-row", "the picker's models"],
  ".syl-b": ["inset:.syl-ln", "a record's lines"], ".stage .cx-list": ["inset:.cx-r", "the changes list"],
  ".md-body": ["inset:.md-from", "Made's cards (their ring a layer inside them, C013; their from line and pin inset)"],
  ".fr-b": ["inset:.ag-r", "the stage's frames (agents and changes rows, inset)"], ".stage .ch-old": ["inset:.ch-r", "a change's older lines"],
  ".home": ["inner", "Home: its .hm column carries the room"], ".arts": ["inner", "Artifacts: its column carries the room"],
  ".scroller": ["inner", "the conversation: its column and the bubbles carry the room"], ".dlg": ["inner", "a dialog: its sections are padded"],
  ".card.is-dock.is-one .card-in": ["inner", "the docked decision: its body (16 px) and actions (12 px) are padded"],
  ".md-code pre": ["text", "a code block"], ".md-table": ["text", "a table in a message"], ".chg pre": ["text", "a change's text"],
  ".vw-src": ["text", "a file's source"], ".vw-body": ["text", "a file's body"], ".stage .cx-pd": ["text", "a change's diff"],
  ".composer textarea.is-capped": ["text", "the message box itself"], ".shp-jb .shp-ta": ["text", "the shape's JSON field"],
  ".tb-out": ["text", "a step's output"], ":root:root .ckbar.is-open .ck-b>ol": ["text", "a phone's checklist: its steps are words"],
};
const padOf = (sel) => { const m = all.match(new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{[^}]*?(?:^|;)padding:([^;}]+)`)); return m ? m[1].trim() : null; };
const px4 = (v) => { const p = v.split(/\s+(?![^(]*\))/).map((x) => (x === "var(--ring-room)" ? room : /^(\d+)px$/.test(x) ? +x.slice(0, -2) : x === "0" ? 0 : NaN)); return [p[0], p[1] ?? p[0], p[2] ?? p[0], p[3] ?? p[1] ?? p[0]]; };

t("the ring's room covers the ring (2 px, 2 px out)", () => assert.ok(room >= ext, `${room} ≥ ${ext}`));
t("every scroll box is placed, either axis: padded with the ring's room, its controls' ring inset, its content padded, or text only", () => {
  const found = new Set();
  for (const [, c] of css) for (const m of c.matchAll(/([^{}]+)\{([^{}]*overflow(?:-[xy])?:(?:auto|scroll)[^{}]*)\}/g)) found.add(m[1].trim().split("\n").pop().trim());
  const unplaced = [...found].filter((sel) => !(sel in SCROLLERS));
  assert.deepEqual(unplaced, [], `scroll boxes to place: ${unplaced.join(" | ")}`);
});
t("each holds the ring as listed: a padded one by at least the ring on every side, an inset one's controls inside", () => {
  for (const [sel, [how, what]] of Object.entries(SCROLLERS)) {
    if (how.startsWith("room")) {
      const via = how.split(":")[1] || sel, v = padOf(via);
      assert.ok(v, `${sel} (${what}): its padding (${via})`);
      const p = px4(v);
      assert.ok(p.every((x) => x >= ext), `${sel} (${what}): padding ${v} gives the ring ${ext} px on every side`);
    } else if (how.startsWith("inset:")) {
      const k = how.slice(6);
      const own = new RegExp(`${k.replace(/\./g, "\\.")}[^{]*:focus-visible[^{]*\\{[^}]*outline-offset:-2px|${k.replace(/\./g, "\\.")}:focus-visible\\)`).test(all);
      assert.ok(inset.split(",").map((x) => x.trim()).includes(k) || own || /\.md-it:has\(\.md-open:focus-visible\)::after/.test(all) && k === ".md-from", `${sel} (${what}): ${k} draws its ring inside it`);
    }
  }
});
// each other clipping box (overflow:hidden or clip, paint containment, a clip path, a mask), placed the same way, and:
// "page": the page itself; "decor": it holds no control (a bar, a line, words for a screen reader); "fade": a mask
// that fades a scroller's cut edge, over controls that draw their ring inside them or sit clear of it
const CLIPPERS = {
  "html": ["page", "the page"], "body": ["page", "the page"], ".main": ["inner", "the main area: its views and header pad their controls"],
  ".sr-only": ["decor", "words for a screen reader"], ".rn-stop span": ["decor", "words for a screen reader"], "body.chat-docked .thead .rn-log span": ["decor", "words for a screen reader"], ":root:root .thead .rn-log span": ["decor", "words for a screen reader"],
  ".now.fade-r": ["fade", "the Now strip's edge, while more chips lie that way (its chips' ring inset, .nw)"], ".now.fade-l": ["fade", "the same, at its start"], ".now.fade-l.fade-r": ["fade", "the same, both ends"],
  ".ckbar": ["inset:.ck-tog", "a thread's checklist bar: its toggle fills it (C045)"],
  ".ck-b>ol": ["text", "the checklist's steps"], ".sg.s-done.is-pop": ["decor", "a step's mark in the progress line"],
  ".card": ["inner", "a decision card: its body pads 16, its actions 12"], ".chg": ["text", "a change's preview: its caption and text"], ".c-hint": ["text", "a card's hint"],
  ".card.is-dock :is(.c-body,.card-in).fade-b": ["fade", "the docked card's body at a cut edge: its answers sit below it"], ".card.is-dock :is(.c-body,.card-in).fade-t": ["fade", "the same, at its top"], ".card.is-dock :is(.c-body,.card-in).fade-t.fade-b": ["fade", "the same, both edges"],
  ".mini": ["decor", "a progress bar"], ".cp-bar": ["decor", "a progress bar"], ".rt-bar": ["decor", "a progress bar"], ".lpv-link": ["decor", "a dashed line"], ".lpm-l": ["decor", "a dashed line"], ".hm-sk": ["decor", "a loading shape"],
  ".sheet-card": ["inner", "a sheet (All, Jump, Keys, Runs): its head and body pad their controls"], ".ar-di": ["inset:.ar", "All threads' done fold: its rows"],
  ".kl": ["text", "Settings › Keyboard's keys"], ".rl-list": ["inner", "Settings' rules: each row pads its buttons"], ".wt-list": ["inner", "Settings' checkouts: each row pads its buttons"],
  ".viewer": ["inner", "the file viewer: its head pads its controls, its body is text"], ".vw-body.is-frame": ["text", "a page in a frame"],
  ".att": ["inner", "a file on a message: its padding (6–10, 4 at its right) holds its buttons' ring"], ".m-files .tb-fb.is-img .tb-fi": ["decor", "a picture's thumbnail"],
  ".shd.is-half": ["inner", "a phone's Shells sheet: its tabs and list are placed (.shd-tabs, .shd-list)"], ".syl": ["inner", "a record: its lines are placed (.syl-b)"],
  ".md-it": ["inner", "a Made card: its ring a layer inside it (C013), its from line and pin inset"], ".md-th": ["decor", "a picture's thumbnail"],
  ".map": ["inner", "the Map: its head and toolbar pad their controls"], ".mp-sub": ["text", "the Map's sub-line"], ".dg": ["inner", "the diagram: the camera brings what the keyboard reaches into view with room (S208)"],
  ".stage": ["bars", "the side panel: every control in its bar draws its ring inside (C076)"], ".fr": ["bars", "a frame of the panel: every control in its head draws its ring inside (C076: Deploy, 36 tall in the 40 px head on a phone), its body is placed (.fr-b)"],
  ".fr[data-fr=\"map\"] .fr-b": ["inner", "the Map's frame: its host pads"], ".stage .fr[data-fr=\"changes\"] .fr-b": ["inner", "the changes frame: its list and pane are placed"],
  ".stg-t": ["text", "a tab's words"], ".ag-t": ["text", "an agent's name"], ".stage .ag-t": ["text", "an agent's name"], ".stage .cx-t": ["text", "a change's name"], ".stage .ch-copy": ["text", "a change's name and path"],
  ".stage .cx-pane": ["bars", "a change's pane: its head's controls and the diff (.cx-pd, panel.css) draw their ring inside"], ".ximg-c": ["decor", "a picture compared"],
  ".stage .fr-lp>.fr-b.is-fade": ["fade", "Launchpad's frame at its cut foot"], ".lp-hs": ["text", "Launchpad's head line"],
  ".mx-album": ["decor", "a message's pictures"], ".lbx-frame": ["decor", "the lightbox's picture"], ".mx-wt": ["text", "the working line"],
  ":root[data-msgx] .m-them .tcard": ["inner", "a thread card in a message: its ring is drawn around the card itself (msgx.css), not inside it"],
  ".pj-s": ["margin", "a project's count line: \"Coordinator needs you\" leads it (S005)"], ":root:root .top .pj-s": ["margin", "the same line in a phone's bar"],
  ".ev-t": ["margin", "an event line's words: Passed to a project, Continued in a thread"],
  ":root[data-msgx] .m-them .tc-segs .sg.mx-seg-done": ["decor", "a step's mark"], ":root[data-msgx] .m-them .tc-segs .sg.mx-seg-next": ["decor", "a step's mark"],
};
const CLIPS = (d) => (/^overflow(-[xy])?$/.test(d.p) && /hidden|clip/.test(d.v)) || (d.p === "contain" && /paint|strict|content/.test(d.v)) || (d.p === "clip-path" && d.v !== "none") || (/^(-webkit-)?mask(-image)?$/.test(d.p) && d.v !== "none");
const srcs = [readFileSync(new URL("index.html", R), "utf8"), ...readdirSync(new URL("js/", R)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/${f}`, R), "utf8")), ...readdirSync(new URL("js/shells/", R)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/shells/${f}`, R), "utf8"))].join("\n");
const controls = new Set();
for (const m of srcs.matchAll(/<(button|summary|select|a|input|textarea)\b([^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[2]); if (c) for (const k of c[1].split(/\s+/)) if (k) controls.add(k); }
for (const m of srcs.matchAll(/<\w+\b([^>]*role="(?:button|tab|option|menuitem|menuitemradio|switch|radio|checkbox)"[^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[1]); if (c) for (const k of c[1].split(/\s+/)) if (k) controls.add(k); }
// a box the CSS draws a control inside (a later compound of some selector names a control): never only words (S005:
// a project's count line ellipsizes, and "Coordinator needs you" leads it)
const holders = new Set();
for (const r of cascade(new URL("tests/lib/x.mjs", R))) {
  const parts = r.sel.split(/[\s>+~]+/);
  parts.forEach((c, i) => { if (i < parts.length - 1 && parts.slice(i + 1).some((x) => /^(button|a|summary|select)\b/.test(x) || (x.match(/\.[\w-]+/g) || []).some((k) => controls.has(k.slice(1))))) for (const k of c.match(/\.[\w-]+/g) || []) holders.add(k.slice(1)); });
}
const own = (sel) => (sel.split(/[\s>+~]+/).pop().replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "").match(/\.[\w-]+/g) || []).map((k) => k.slice(1));
const holds = (sel) => own(sel).some((k) => holders.has(k));
// a class drawn on something that isn't a control too (a count line's span and the Workspace's Home button share .pj-s)
const elsewhere = new Set();
for (const m of srcs.matchAll(/<(?!button|summary|select|a\b|input|textarea)(\w+)\b([^>]*)>/g)) { if (/role="(?:button|tab|option|menuitem|menuitemradio|switch|radio|checkbox)"/.test(m[2])) continue; const c = /class="([^"$]*)/.exec(m[2]); if (c) for (const k of c[1].split(/\s+/)) if (k) elsewhere.add(k); }
// placed by the rule itself: a line that ellipsizes or clamps (holding no control), a picture or a frame, a
// pseudo-element, a control's own
const byRule = (sel, ds) => { const last = sel.split(/[\s>+~]+/).pop(); return /::/.test(last) ? "a pseudo-element" : ds.some((d) => d.p === "text-overflow" || d.p === "-webkit-line-clamp") && !holds(sel) ? "a line of text" : /^(img|svg|video|canvas|pre|code|textarea|input|iframe)\b/.test(last) ? "a picture, a frame or a field" : own(sel).some((k) => controls.has(k) && !elsewhere.has(k)) || /^(button|summary|a)\b/.test(last) ? "a control's own (its ring is drawn outside it)" : null; };
t("every other clipping box is placed too: overflow hidden or clip, paint containment, a clip path, a mask", () => {
  const unplaced = [];
  for (const r of cascade(new URL("tests/lib/x.mjs", R))) {
    const ds = decls(r.d);
    if (!ds.some(CLIPS) || ds.some((d) => /^overflow(-[xy])?$/.test(d.p) && /auto|scroll/.test(d.v))) continue;
    if (r.sel in SCROLLERS || r.sel in CLIPPERS || byRule(r.sel, ds)) continue;
    unplaced.push(`${r.f}: ${r.sel}`);
  }
  assert.deepEqual([...new Set(unplaced)], [], "clipping boxes to place");
});
t("each clipping box listed is still one, and holds the ring as listed", () => {
  const sels = new Set(cascade(new URL("tests/lib/x.mjs", R)).filter((r) => decls(r.d).some(CLIPS)).map((r) => r.sel));
  const gone = Object.keys(CLIPPERS).filter((k) => !sels.has(k));
  assert.deepEqual(gone, [], "listed, but no longer a clipping box: take it off");
  // "margin": a line that clips with the ring's room as its clip margin, so a control in it keeps its whole ring
  for (const [sel, [how, what]] of Object.entries(CLIPPERS)) if (how === "margin") {
    const r = cascade(new URL("tests/lib/x.mjs", R)).find((x) => x.sel === sel && decls(x.d).some(CLIPS));
    const ds = decls(r.d);
    assert.ok(ds.some((d) => /^overflow(-[xy])?$/.test(d.p) && d.v === "clip") && ds.some((d) => d.p === "overflow-clip-margin" && d.v === "var(--ring-room)"), `${sel} (${what}): clips with the ring's room as its margin`);
  }
  for (const [sel, [how, what]] of Object.entries(CLIPPERS)) if (how.startsWith("inset:")) {
    const k = how.slice(6);
    const own = new RegExp(`${k.replace(/\./g, "\\.")}\\)?:focus-visible\\{outline:2px solid var\\(--focus\\);outline-offset:-2px\\}`).test(all);
    assert.ok(inset.split(",").map((x) => x.trim()).includes(k) || own, `${sel} (${what}): ${k} draws its ring inside it`);
  }
});
t("C076: every control in the panel's bars (its own, a frame's head, a change's head) draws its ring inside it, by kind, not a list of names", () => {
  assert.match(all, /\.stage :is\(\.ag-r,\.ch-r,\.fr-t,\.fr-ib,\.stg-ic,:is\(\.stg-bar,\.fr-h,\.cx-ph\) :is\(button,a\[href\],\[role=tab\]\)\):focus-visible\{outline:2px solid var\(--focus\);outline-offset:-2px\}/);
  for (const [sel, [how]] of Object.entries(CLIPPERS)) if (how === "bars") assert.ok([".stage", ".fr", ".stage .cx-pane"].includes(sel), `${sel}: only the panel's boxes are placed by its bars' rule`);
});
t("C045: the checklist's toggle draws its ring inside it, on the bar's inner corners", () => {
  assert.ok(inset.split(",").includes(".ck-tog"));
  assert.match(all, /\.ck-tog\{flex:1;min-width:0;display:flex;align-items:center;gap:12px;height:var\(--h-lg\);padding:0 10px 0 12px;border-radius:calc\(var\(--r-lg\) - 1px\);/);
  assert.match(all, /\.ckbar\{border-radius:var\(--r-lg\);[^}]*border:1px solid/);
});
t("S089: a code block clips nothing (its text clips itself and rounds its own corners), and its head holds its Copy", () => {
  const code = all.match(/(?:^|\n)\.md-code\{([^}]*)\}/)[1];
  assert.doesNotMatch(code, /overflow/, "the block itself doesn't clip");
  assert.match(all, /\.md-code pre\{margin:0;padding:12px 16px;overflow-x:auto;border-radius:0 0 calc\(var\(--r-lg\) - 1px\) calc\(var\(--r-lg\) - 1px\);/);
  assert.match(all, /\.md-code-head\{display:flex;align-items:center;justify-content:space-between;min-height:34px;/, "a phone's 36 px Copy grows its head");
});
t("the runs strip gives the room back in its margin: its chips sit where they did (8 px under the head's line)", () => {
  assert.match(all, /\.rn-strip\{display:flex;gap:6px;margin:calc\(8px - var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\);padding:var\(--ring-room\);overflow-x:auto;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
