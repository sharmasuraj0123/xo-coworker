// The notices' line while Files has the chat folded away (the controls grader on cb7afe7, S137 and V22): a Tell
// refused in Files on a phone showed nothing, because the line (#herald) sat in the chat's dock, which is inert and
// out of sight while folded. The real mover (js/herald.js heraldOut) runs here on a small stand-in page; then the
// Files view is checked to move it wherever it folds or opens the chat, and the CSS to draw it above Files.
// No browser: the drawn line at 390 and 1440 is the flows case's.
//   node tests/herald-out.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as herald from "../js/herald.js";

let passed = 0;
// a pattern in a whole file: says which, not the file
const has = (src, re, msg) => assert.ok(re.test(src), msg ? `${msg} (${re})` : String(re));
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// a stand-in page: body > .app > #dock > .cbar > [#herald, #composer]
function node(name, id) {
  const n = { name, id, parentNode: null, children: [], cls: new Set(),
    get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; },
    get isConnected() { let x = this; while (x.parentNode) x = x.parentNode; return x.name === "html"; },
    appendChild(c) { return this.insertBefore(c, null); },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1);
      const i = ref ? this.children.indexOf(ref) : -1;
      if (ref && i < 0) throw new Error("insertBefore: not a child");
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parentNode = this; return c;
    },
  };
  n.classList = { add: (k) => n.cls.add(k), remove: (k) => n.cls.delete(k), contains: (k) => n.cls.has(k) };
  return n;
}
function page() {
  const html = node("html"), body = node("body"), app = node("div"), dock = node("div", "dock"), cbar = node("div"), h = node("div", "herald"), comp = node("form", "composer");
  html.appendChild(body); body.appendChild(app); app.appendChild(dock); dock.appendChild(cbar); cbar.appendChild(h); cbar.appendChild(comp);
  const all = [html, body, app, dock, cbar, h, comp];
  return { doc: { body, getElementById: (id) => all.find((x) => x.id === id && x.isConnected) || null }, body, dock, cbar, h, comp };
}

t("folded: the line leaves the chat's dock for the page, marked to be drawn there", () => {
  assert.equal(typeof herald.heraldOut, "function", "js/herald.js exports heraldOut(doc, out)");
  const P = page();
  herald.heraldOut(P.doc, true);
  assert.equal(P.h.parentNode, P.body, "on the page, out of the inert dock");
  assert.ok(P.h.classList.contains("is-out"));
  assert.equal(P.doc.getElementById("herald"), P.h, "the same element, its id kept: the app finds it and draws into it");
  let inDock = false; for (let x = P.h; x; x = x.parentNode) if (x === P.dock) inDock = true;
  assert.ok(!inDock, "nothing of the dock's inert part holds it");
});
t("folded twice, then opened: it goes back to its own place, before the composer", () => {
  const P = page();
  herald.heraldOut(P.doc, true);
  herald.heraldOut(P.doc, true); // a second fold (the width folds it again) doesn't lose where it came from
  herald.heraldOut(P.doc, false);
  assert.equal(P.h.parentNode, P.cbar);
  assert.equal(P.h.nextSibling, P.comp, "where it was: above the composer");
  assert.ok(!P.h.classList.contains("is-out"));
});
t("opened when it never left: nothing moves", () => {
  const P = page();
  herald.heraldOut(P.doc, false);
  assert.equal(P.h.parentNode, P.cbar);
  assert.equal(P.h.nextSibling, P.comp);
});

const fv = readFileSync(new URL("../js/filesview.js", import.meta.url), "utf8");
t("the Files view moves it wherever it folds or opens the chat (the phone's sheet, the rail, leaving Files)", () => {
  has(fv, /import \{[^}]*\bheraldOut\b[^}]*\} from "\.\/herald\.js"/);
  // every place that makes the chat's dock inert or not says the same to the line: folded → out, opened → back
  const sheet = /n && n\.toggleAttribute\("inert", min\);\s*\n\s*heraldOut\(document, min\);/;
  const rail = /n && n\.setAttribute\("inert", ""\);\s*\n\s*heraldOut\(document, true\);/;
  const opened = /n && n\.removeAttribute\("inert"\);\s*\n\s*heraldOut\(document, false\);/g;
  has(fv, sheet, "the phone's sheet, down to its bar or up");
  has(fv, rail, "the chat folded to its rail");
  const inert = (fv.match(/\[\$\("#conv"\), \$\("#dock"\)\]\) n && n\.(?:toggleAttribute|setAttribute|removeAttribute)\("inert"/g) || []).length;
  assert.equal((fv.match(opened) || []).length, inert - 2, "each place that opens the chat (un-fold, leaving Files)");
});

const css = readFileSync(new URL("../css/fileview.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
t("drawn above Files at the page's foot; on a phone above the folded chat's bar; only notices", () => {
  const out = /(?:^|[}\s])\.herald\.is-out\{([^}]*)\}/.exec(css);
  assert.ok(out, "a rule for the line out of the dock");
  assert.match(out[1], /position:fixed/);
  assert.match(out[1], /z-index:var\(--z-popover\)/, "above Files, as over a covering panel (body.stage-covers .herald)");
  assert.match(out[1], /visibility:visible/);
  // the bar: fixed, 12 px off the foot, 56 tall; the line sits 8 above it
  const bar = /body\.chat-sheet\.files-open:not\(\.sheet-up\) \.crail\{([^}]*)\}/.exec(css);
  assert.ok(bar, "the folded chat's bar");
  const bb = +/bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/.exec(bar[1])[1], bh = +/height:(\d+)px/.exec(bar[1])[1];
  const lift = /body\.chat-sheet\.files-open:not\(\.sheet-up\) \.herald\.is-out\{bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)\}/.exec(css);
  assert.ok(lift, "on a phone, lifted over the bar");
  assert.equal(+lift[1], bb + bh + 8, `the bar's top (${bb + bh}) and 8 between`);
  has(css, /\.herald\.is-out \.hr-conn\{display:none\}/, "the composer's own line (Off, can't reach) stays folded with it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
