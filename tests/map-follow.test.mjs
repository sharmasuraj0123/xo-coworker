// Follow keeps the zoom you chose (the controls grader on 65e84b7, S208, all four cells: zoomed in to 2.4, Follow on,
// and the next live thread update Fit the Tree back to 0.67 and the Graph to 0.63). Two things kept apart: "you chose
// this view" (c.user: a zoom, a pan, Fit) and "following" (c.follow: pan to keep the agent in view). Follow never
// touches the first, so the camera's own refit (only for a view you haven't chosen) never runs under your zoom.
// Checked from the source; the drawn result is the flows case "S208 (zoom)" and the grader's follow-stability.
//   node tests/map-follow.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, `function ${name}`); return src.slice(i, src.indexOf("\n  }\n", i)); };

t("Follow, on or off, leaves 'you chose this view' as it was", () => {
  const b = body("tool"), i = b.indexOf('what === "follow"');
  assert.ok(i >= 0, "the Follow button's branch");
  const f = b.slice(i, b.indexOf("\n    }", i));
  assert.doesNotMatch(f, /c\.user\s*=/, "Follow never sets c.user");
  assert.match(f, /c\.follow = !c\.follow;/, "it turns following on or off");
  assert.match(f, /if \(c\.follow\) c\.fitAll = false;/, "following replaces 'all of it' (Fit again to see it all)");
});
t("the only things that hand the camera back to Fit are a fresh look and the view you haven't chosen", () => {
  const resets = [...src.matchAll(/c0?z?\.user = false/g)].length;
  assert.equal(resets, 0, "nothing sets c.user back to false: a new place or mode starts a new camera");
  assert.match(body("frame"), /if \(\(!c\.user \|\| c\.fitAll\) && \(moved \|\| over\)\) \{ fit\(c, true, true\); return; \}/, "the camera refits only a view you haven't chosen, or 'all of it'");
});
t("Follow pans, never zooms", () => {
  const b = body("tool"), i = b.indexOf('what === "follow"'), f = b.slice(i, b.indexOf("\n    }", i));
  assert.match(f, /centerOn\(c, M\.lead\.pt, true\)/, "on: centred on the agent at your zoom (no scale given)");
  assert.doesNotMatch(body("keepInView"), /c\.s\s*=/, "keeping the agent in view never zooms");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
