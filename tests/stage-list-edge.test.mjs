// A list that has the panel's rest fills its frame to the foot (no strip above the next frame) and fades there while more is below
//   node tests/stage-list-edge.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const panel = read("css/panel.css"), stage = read("js/stage.js"), tokens = read("css/tokens.css"), lp = read("css/launchpad.css");
// no rounding to a 48 px row grid the list's 40 px filter and 32 px group heads never sit on
assert.doesNotMatch(panel, /round\(down,100cqh - 44px,48px\)/);
assert.match(panel, /\.stage \.fr\.is-grow\[data-fr="agents"\] \.fr-b\{max-height:none\}/);
assert.match(panel, /\.stage \.ch-old\{flex:0 1 auto;min-height:0;margin-bottom:8px;overflow:auto;/);
// one fade, one token, for every panel list's cut foot
assert.match(tokens, /--edge-fade:var\(--s-8\);/);
assert.match(panel, /\.stage :is\(\[data-fr="agents"\]>\.fr-b,\.ch-old\)\.is-fade\{-webkit-mask-image:linear-gradient\(to bottom,#000 calc\(100% - var\(--edge-fade\)\),transparent\)/);
assert.doesNotMatch(panel + lp, /calc\(100% - 32px\)/);
// the fade follows the list: its scroll, each paint, the stack's size; read once a frame, after layout
assert.match(stage, /const LISTS = '\[data-fr="agents"\] > \.fr-b, \.ch-old';/);
assert.match(stage, /const edge = \(b\) => b\.classList\.toggle\("is-fade", b\.scrollTop \+ b\.clientHeight < b\.scrollHeight - 1\);/);
assert.match(stage, /edgeF = requestAnimationFrame\(/);
assert.match(stage, /el\.addEventListener\("scroll", \(e\) => \{ if \(e\.target\.matches\?\.\(LISTS\)\) edge\(e\.target\); \}, \{ capture: true, passive: true \}\);/);
assert.match(stage, /set\("changes", old, changesHtml\(ch\)\); \}\n\s*edges\(\);/);
assert.match(stage, /if \(S\.open\) \{ capAgents\(\); edges\(\); \}/);
console.log("stage-list-edge: ok");
