// @ts-check

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
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { px } from "./lib/cascade.mjs";
import { declarationsFor, publishedRules, resolveValue, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const has = (rule, property, value) =>
  rule.declarations.some(({ p, v }) => p === property && (v === value || resolveValue(v) === value));
const exact = (selector) => rules.filter(({ sel }) => sel === selector);
const inRule = (selector, property, value) => exact(selector).some((rule) => has(rule, property, value));
const outline = declarationsFor(":focus-visible", "outline").find(({ value }) => value.endsWith(" solid var(--focus)"));
const offset = valuesFor(":focus-visible", "outline-offset").at(0);
assert.ok(outline && typeof offset === "string", "The common focus ring is published");
const ext = parseFloat(resolveValue(outline.value.split(" ")[0])) + parseFloat(offset);
const room = parseFloat(tokenValuesFor().get("--ring-room"));
const inset = new Set(rules.flatMap((rule) => {
  const match = /^:is\((.*)\):focus-visible$/.exec(rule.sel);
  if (!match || !has(rule, "outline-offset", "-2px") || !has(rule, "outline-color", "var(--ring-in,var(--focus))")) return [];
  return list.comma(match[1]);
}));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// each scroll box: what it holds, and how a focused control's ring stays whole at its edges ("room": the box's padding,
// or that of the one named, gives the ring's room on every side; "inset": its controls draw their ring inside them;
// "inner": the content inside it carries its own room; "text": it holds text or one field, no control)
const SCROLLERS = {
  ".rn-strip": ["room", "the running sub-agents' chips (C047)"],
  ".projects": ["room", "the sidebar's projects (C008: 2 px above the first row cut its ring)"],
  ".mp-legend": ["room", "the Map's agents (none above the first row cut its ring)"],
  ".c-body": ["room", "a decision card's body"], ".jump-list": ["room", "Jump's list"],
  ".keys-cols": ["room", "Settings › Keyboard"], ".set-body": ["room", "Settings' page"], ".set-page": ["room", "a Settings page on a phone"],
  ".rn-body": ["room", "the Sub-agents page"], ".shd-list": ["room", "Shells' list"], ".dd-menu": ["room", "a dropdown's options"], ".at-list": ["room", "the composer's @ projects"],
  ".cs-pop": ["room:.iq-pop", "the new chat's settings (an .iq-pop)"],
".shd-tabs": ["inset:.shd-tab", "a shell's tabs"], ".vw-tabs": ["inset:.vw-tab-b", "the open files' tabs (their close buttons inset too)"],
  ".set-nav": ["inset:.set-nav button", "Settings' rail"], ".fl-list": ["inset:.fl-r", "Files' tree"], ".iq-list": ["inset:.iq-row", "the picker's models"],
  ".stage .cx-list": ["inset:.cx-r", "the changes list"],
  ".fr-b": ["inset:.ag-r", "the stage's frames (agents and changes rows, inset)"], ".stage .ch-old": ["inset:.ch-r", "a change's older lines"],
  ".home": ["inner", "Home's column carries the room"], ".arts": ["inner", "Artifacts' column carries the room"],
  ".lpp": ["inner", "Launchpad's column carries the room"], ".lq-body": ["room", "Launchpad's window body"],
  ".lq-side.nav": ["room", "Launchpad's window sections"],
  ".scroller": ["inner", "the conversation: its column and the bubbles carry the room"], ".dlg": ["inner", "a dialog: its sections are padded"],
  ".card.is-dock.is-one .card-in": ["inner", "the docked decision: its body (16 px) and actions (12 px) are padded"],
  ".md-code pre": ["text", "a code block"], ".md-table": ["text", "a table in a message"],
  ".md-display": ["text", "a displayed formula (KaTeX's drawing, no control)"], ".prose .md-math.is-block": ["text", "a displayed formula inside a sentence"],
  ".md-diagram": ["text", "a diagram (Mermaid's svg, strict: no links or controls)"], ".chg pre": ["text", "a change's text"],
  ".vw-src": ["text", "a file's source"], ".vw-body": ["text", "a file's body"], ".stage .cx-pd": ["text", "a change's diff"],
  ".composer textarea.is-capped": ["text", "the message box itself"], ".shp-jb .shp-ta": ["text", "the shape's JSON field"],
  ".tb-out": ["text", "a step's output"], ":root:root .ckbar.is-open .ck-b>ol": ["text", "a phone's checklist: its steps are words"],
};
const scrolls = ({ p, v }) => /^overflow(-[xy])?$/.test(p) && /^(auto|scroll)$/.test(v);
function padding(value) {
  const [top, right = top, bottom = top, left = right] = list.space(value).map((part) => px(part, {}));
  return [top, right, bottom, left];
}

t("the ring's room covers the ring (2 px, 2 px out)", () => assert.ok(room >= ext, `${room} ≥ ${ext}`));
t("every scroll box is placed, either axis: padded with the ring's room, its controls' ring inset, its content padded, or text only", () => {
  const found = new Set(rules.filter(({ declarations }) => declarations.some(scrolls)).map(({ sel }) => sel));
  const unplaced = [...found].filter((sel) => !(sel in SCROLLERS));
  assert.deepEqual(unplaced, [], `scroll boxes to place: ${unplaced.join(" | ")}`);
});
t("each holds the ring as listed: a padded one by at least the ring on every side, an inset one's controls inside", () => {
  for (const [sel, [how, what]] of Object.entries(SCROLLERS)) {
    if (how.startsWith("room")) {
      const via = how.split(":")[1] || sel, v = declarationsFor(via, "padding").at(0)?.value;
      assert.ok(v, `${sel} (${what}): its padding (${via})`);
      for (const value of [resolveValue(v)].flat()) {
        assert.ok(padding(value).every((x) => x >= ext), `${sel} (${what}): padding ${value} must clear ${ext} px`);
      }
    } else if (how.startsWith("inset:")) {
      const k = how.slice(6);
      const own = rules.some((rule) => rule.sel.includes(k) && rule.sel.includes(":focus-visible")
        && has(rule, "outline-offset", "-2px"));
      const withinCard = k === ".md-from" && exact(".md-it:has(.md-open:focus-visible)::after").length > 0;
      assert.ok(inset.has(k) || own || withinCard, `${sel} (${what}): ${k} draws its ring inside it`);
    }
  }
});
// each other clipping box (overflow:hidden or clip, paint containment, a clip path, a mask), placed the same way, and:
// "page": the page itself; "decor": it holds no control (a bar, a line, words for a screen reader); "fade": a mask
// that fades a scroller's cut edge, over controls that draw their ring inside them or sit clear of it
const CLIPPERS = {
  "html": ["page", "the page"], ".dlg.lq": ["inner", "Launchpad's window: its sections and body are placed (.lq-side.nav, .lq-body)"], "body": ["page", "the page"], ".main": ["inner", "the main area: its views and header pad their controls"],
  ".sr-only": ["decor", "words for a screen reader"], ".agm-openai": ["decor", "an agent's mark (OpenAI's, a mask in the ink)"], ".nv-dot": ["decor", "a mark from the pack, a mask in the ink"], ".pr-d": ["decor", "a mark from the pack, a mask in the ink"], ".spin": ["decor", "a mark from the pack, a mask in the ink"], ".spin.is-load": ["decor", "a mark from the pack, a mask in the ink"], ".hr-dot": ["decor", "a mark from the pack, a mask in the ink"], ".tb-m.is-wait": ["decor", "a mark from the pack, a mask in the ink"], ".shd-dot": ["decor", "a mark from the pack, a mask in the ink"], ".dg-dot": ["decor", "a mark from the pack, a mask in the ink"], ".tb-live": ["decor", "a mark from the pack, a mask in the ink"], ".fl-who i": ["decor", "a mark from the pack, a mask in the ink"], ".fl-rb em": ["decor", "a mark from the pack, a mask in the ink"], ".stage .cx-pill i": ["decor", "a mark from the pack, a mask in the ink"], ".xd-state i": ["decor", "a mark from the pack, a mask in the ink"], ".lp-st>i:not(.lp-arc)": ["decor", "a mark from the pack, a mask in the ink"], ".lp-st:is(.t-go,.t-stop)>i:not(.lp-arc)": ["decor", "a mark from the pack, a mask in the ink"], ".lp-st.t-stop>i:not(.lp-arc)": ["decor", "a mark from the pack, a mask in the ink"], ".lp-st.t-need>i:not(.lp-arc)": ["decor", "a mark from the pack, a mask in the ink"], ".dd-dot": ["decor", "a mark from the pack, a mask in the ink"], ".rn-stop span": ["decor", "words for a screen reader"], ":root:root .thead .rn-log span": ["decor", "words for a screen reader"],
  ".c-ev.is-plan.is-more .ev-plan": ["text", "a plan's first lines on a decision card, plain words"],
  ".ckbar": ["inset:.ck-tog", "a thread's checklist bar: its toggle fills it (C045)"],
  ".ck-b>ol": ["text", "the checklist's steps"], ".ck-b": ["text", "the checklist's steps, clipped as they open (words, no controls)"], ".sg.s-done.is-pop": ["decor", "a step's mark in the progress line"],
  ".card": ["inner", "a decision card: its body pads 16, its actions 12"], ".next": ["inner", "Home's decision card: the same body and action row as a card"], ".chg": ["text", "a change's preview: its caption and text"], ".c-hint": ["text", "a card's hint"],
  ".card.is-dock :is(.c-body,.card-in).fade-b": ["fade", "the docked card's body at a cut edge: its answers sit below it"], ".card.is-dock :is(.c-body,.card-in).fade-t": ["fade", "the same, at its top"], ".card.is-dock :is(.c-body,.card-in).fade-t.fade-b": ["fade", "the same, both edges"],
  ".mini": ["decor", "a progress bar"], ".cp-bar": ["decor", "a progress bar"], ".rt-bar": ["decor", "a progress bar"], ".hm-sk": ["decor", "a loading shape"],
  ".sheet-card": ["inner", "a sheet (Jump, Keys, Runs): its head and body pad their controls; Jump's field, its whole head, draws its ring inside (C020)"],
  ".kl": ["text", "Settings › Keyboard's keys"], ".rl-list": ["inner", "Settings' rules: each row pads its buttons"], ".wt-list": ["inner", "Settings' checkouts: each row pads its buttons"],
  ".viewer": ["inner", "the file viewer: its head pads its controls, its body is text"], ".vw-body.is-frame": ["text", "a page in a frame"],
  ".vw-doc": ["inner", "the editor pads its search and go-to-line panels"],
  ".vw-tab-x.is-dirty>i": ["decor", "the unsaved tab indicator"],
  ".att": ["inner", "a file on a message: its padding (6–10, 4 at its right) holds its buttons' ring"], ".m-files .tb-fb.is-img .tb-fi": ["decor", "a picture's thumbnail"],
  ".shd.is-half": ["inner", "a phone's Shells sheet: its tabs and list are placed (.shd-tabs, .shd-list)"],
  ".md-it": ["inner", "a Made card: its ring a layer inside it (C013), its from line and pin inset"], ".md-th": ["decor", "a picture's thumbnail"], ".md-well": ["decor", "an Artifacts card's well, its page on it (no control inside)"], ".md-sheet": ["decor", "the page of the thing on that well: words, never a control"],
  ".mp-sub": ["text", "the Map's sub-line"], ".dg": ["inner", "the diagram: the camera brings what the keyboard reaches into view with room (S208)"],
  ".stage": ["bars", "the side panel: every control in its bar draws its ring inside (C076)"], ".fr": ["bars", "a frame of the panel: every control in its head draws its ring inside (C076: Deploy, 36 tall in the 40 px head on a phone), its body is placed (.fr-b)"],
  ".fr[data-fr=\"map\"] .fr-b": ["inner", "the Map's frame: its host pads"], ".stage .fr[data-fr=\"changes\"] .fr-b": ["inner", "the changes frame: its list and pane are placed"],
  ".stg-t": ["text", "a tab's words"], ".ag-t": ["text", "an agent's name"], ".stage .ag-t": ["text", "an agent's name"], ".stage .cx-t": ["text", "a change's name"], ".stage .ch-copy": ["text", "a change's name and path"],
  ".stage .cx-pane": ["bars", "a change's pane: its head's controls and the diff (.cx-pd, panel.css) draw their ring inside"], ".ximg-c": ["decor", "a picture compared"],
  ".stage :is([data-fr=\"agents\"]>.fr-b,.ch-old).is-fade": ["fade", "a panel list at its cut foot"], ".rt-in.is-clamp .prose": ["fade", "a sub-agent's long task, 4 lines until Show all"],
  ".mx-album": ["decor", "a message's pictures"], ".lbx-frame": ["decor", "the lightbox's picture"], ".mx-wt": ["text", "the working line"],
  ":root[data-msgx] .m-them .tcard": ["inner", "a thread card in a message: its ring is drawn around the card itself (msgx.css), not inside it"],
  ".pj-s": ["margin", "a project's count line: \"Coordinator needs you\" leads it (S005)"], ":root:root .top .pj-s": ["margin", "the same line in a phone's bar"],
  ".ev-t": ["margin", "an event line's words: Passed to a project, Continued in a thread"],
  ".target": ["text", "the composer's target line: the chat's is a button (its ring drawn outside it), the Thread page's only words"],
  ":root[data-msgx] .m-them .tc-segs .sg.mx-seg-done": ["decor", "a step's mark"], ":root[data-msgx] .m-them .tc-segs .sg.mx-seg-next": ["decor", "a step's mark"],
};
const CLIPS = (d) => (/^overflow(-[xy])?$/.test(d.p) && /hidden|clip/.test(d.v)) || (d.p === "contain" && /paint|strict|content/.test(d.v)) || (d.p === "clip-path" && d.v !== "none") || (/^(-webkit-)?mask(-image)?$/.test(d.p) && d.v !== "none");
const elements = templateElements(fileURLToPath(new URL("../", import.meta.url)));
const controlSelector = "button,summary,select,a,input,textarea,[role=button],[role=tab],[role=option],"
  + "[role=menuitem],[role=menuitemradio],[role=switch],[role=radio],[role=checkbox]";
const controls = new Set();
const elsewhere = new Set();
for (const element of elements) {
  const classes = element.matches(controlSelector) ? controls : elsewhere;
  for (const name of element.classList) classes.add(name);
}
// a box the CSS draws a control inside (a later compound of some selector names a control): never only words (S005:
// a project's count line ellipsizes, and "Coordinator needs you" leads it)
const holders = new Set();
for (const r of rules) {
  const parts = r.sel.split(/[\s>+~]+/);
  parts.forEach((c, i) => { if (i < parts.length - 1 && parts.slice(i + 1).some((x) => /^(button|a|summary|select)\b/.test(x) || (x.match(/\.[\w-]+/g) || []).some((k) => controls.has(k.slice(1))))) for (const k of c.match(/\.[\w-]+/g) || []) holders.add(k.slice(1)); });
}
const own = (sel) => (sel.split(/[\s>+~]+/).pop().replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "").match(/\.[\w-]+/g) || []).map((k) => k.slice(1));
const holds = (sel) => own(sel).some((k) => holders.has(k));
// placed by the rule itself: a line that ellipsizes or clamps (holding no control), a picture or a frame, a
// pseudo-element, a control's own
const byRule = (sel, ds) => { const last = sel.split(/[\s>+~]+/).pop(); return /::/.test(last) ? "a pseudo-element" : ds.some((d) => d.p === "text-overflow" || d.p === "-webkit-line-clamp") && !holds(sel) ? "a line of text" : /^(img|svg|video|canvas|pre|code|textarea|input|iframe)\b/.test(last) ? "a picture, a frame or a field" : own(sel).some((k) => controls.has(k) && !elsewhere.has(k)) || /^(button|summary|a)\b/.test(last) ? "a control's own (its ring is drawn outside it)" : null; };
t("every other clipping box is placed too: overflow hidden or clip, paint containment, a clip path, a mask", () => {
  const unplaced = [];
  for (const r of rules) {
    const ds = r.declarations;
    if (!ds.some(CLIPS) || ds.some(scrolls)) continue;
    if (r.sel in SCROLLERS || r.sel in CLIPPERS || byRule(r.sel, ds)) continue;
    unplaced.push(`${r.f}: ${r.sel}`);
  }
  assert.deepEqual([...new Set(unplaced)], [], "clipping boxes to place");
});
t("each clipping box listed is still one, and holds the ring as listed", () => {
  const sels = new Set(rules.filter(({ declarations }) => declarations.some(CLIPS)).map(({ sel }) => sel));
  const gone = Object.keys(CLIPPERS).filter((k) => !sels.has(k));
  assert.deepEqual(gone, [], "listed, but no longer a clipping box: take it off");
  // "margin": a line that clips with the ring's room as its clip margin, so a control in it keeps its whole ring
  for (const [sel, [how, what]] of Object.entries(CLIPPERS)) if (how === "margin") {
    const r = exact(sel).find(({ declarations }) => declarations.some(CLIPS));
    const ds = r.declarations;
    assert.ok(ds.some((d) => /^overflow(-[xy])?$/.test(d.p) && d.v === "clip") && ds.some((d) => d.p === "overflow-clip-margin" && d.v === "var(--ring-room)"), `${sel} (${what}): clips with the ring's room as its margin`);
  }
  for (const [sel, [how, what]] of Object.entries(CLIPPERS)) if (how.startsWith("inset:")) {
    const k = how.slice(6);
    const own = rules.some((rule) => rule.sel.includes(k) && rule.sel.includes(":focus-visible")
      && has(rule, "outline", "2px solid var(--ring-in,var(--focus))") && has(rule, "outline-offset", "-2px"));
    assert.ok(inset.has(k) || own, `${sel} (${what}): ${k} draws its ring inside it`);
  }
});
t("C076: every control in the panel's bars (its own, a frame's head, a change's head) draws its ring inside it, by kind, not a list of names", () => {
  const barRing = ".stage :is(.ag-r,.ch-r,.fr-t,.fr-ib,.stg-ic,:is(.stg-bar,.fr-h,.cx-ph) :is(button,a[href],[role=tab])):focus-visible";
  assert.ok(exact(barRing).some((rule) => has(rule, "outline", "2px solid var(--ring-in,var(--focus))")
    && has(rule, "outline-offset", "-2px")));
  for (const [sel, [how]] of Object.entries(CLIPPERS)) if (how === "bars") assert.ok([".stage", ".fr", ".stage .cx-pane"].includes(sel), `${sel}: only the panel's boxes are placed by its bars' rule`);
});
t("C045: the checklist's toggle draws its ring inside it, on the bar's inner corners", () => {
  assert.ok(inset.has(".ck-tog"));
  const toggle = {
    flex: "1", "min-width": "0", display: "flex", "align-items": "center", gap: "12px",
    height: "var(--h-ctl)", padding: "0 calc(var(--edge-text) - var(--ic) * var(--ic-ink-chev)) 0 var(--edge-text)",
    "border-radius": "var(--r-lg-in)",
  };
  assert.ok(exact(".ck-tog").some((rule) => Object.entries(toggle).every(([p, v]) => has(rule, p, v))));
  assert.ok(inRule(".ckbar", "border-radius", "var(--r-lg)"));
  assert.ok(valuesFor(".ckbar", "border").some((variants) =>
    [variants].flat().every((value) => value.startsWith("1px solid"))));
});
t("S089: a code block clips nothing (its text clips itself and rounds its own corners), and its head holds its Copy", () => {
  assert.ok(exact(".md-code").length);
  assert.ok(exact(".md-code").every(({ declarations }) => declarations.every(({ p }) => !p.startsWith("overflow"))));
  const pre = { margin: "0", padding: "12px 16px", "overflow-x": "auto", "border-radius": "0 0 var(--r-lg-in) var(--r-lg-in)" };
  assert.ok(exact(".md-code pre").some((rule) => Object.entries(pre).every(([p, v]) => has(rule, p, v))));
  const header = { display: "flex", "align-items": "center", "justify-content": "space-between", "min-height": "34px" };
  assert.ok(exact(".md-code-head").some((rule) => Object.entries(header).every(([p, v]) => has(rule, p, v))));
});
t("the runs strip gives the room back in its margin: its chips sit where they did (8 px under the head's line)", () => {
  const selector = ".rn-strip";
  assert.ok(valuesFor(selector, "display").includes("flex"));
  assert.ok(valuesFor(selector, "gap").includes("4px"));
  assert.ok(valuesFor(selector, "margin").includes("calc(8px - 6px) calc(-1 * 6px) calc(-1 * 6px)"));
  assert.ok(declarationsFor(selector, "padding").some(({ value }) => value === "var(--ring-room)"));
  assert.ok(valuesFor(selector, "overflow-x").includes("auto"));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
