// The app's faces: one family token per role, each face served from fonts/ with its licence, sizes left to the type scale.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const tokens = read("core/ui/tokens.css"), app = read("css/app.css"), html = read("index.html");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("three family tokens: the interface (Geist), what is read, code", () => {
  assert.match(tokens, /\n  --sans:"Geist",system-ui,/);
  assert.match(tokens, /\n  --sans-read:"DM Sans",system-ui,/);
  assert.match(tokens, /\n  --mono:"JetBrains Mono",ui-monospace,/);
});
t("every face is local, swaps in, and its file and licence are in fonts/", () => {
  const faces = [...tokens.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
  assert.equal(faces.length, 9);
  for (const f of faces) {
    assert.match(f, /font-display:swap/);
    const src = f.match(/src:url\("([^"]+\.woff2)"\)/)?.[1];
    assert.ok(src, f);
    const url = new URL(src, new URL("../core/ui/tokens.css", import.meta.url));
    assert.ok(url.pathname.includes("/fonts/") && existsSync(url), src);
    assert.ok(["OFL.txt", "LICENSE.txt"].some((l) => existsSync(new URL(l, url))), src);
  }
  assert.doesNotMatch(tokens + app + html, /fonts\.(googleapis|gstatic)|@import url\("https?:/);
});
t("one face is preloaded: the body's, and it exists", () => {
  const pre = [...html.matchAll(/<link rel="preload" href="\.\/(fonts\/[^"]+)" as="font"/g)].map((m) => m[1]);
  assert.deepEqual(pre, ["fonts/geist/Geist-Variable.woff2"]);
  assert.ok(existsSync(new URL(`../${pre[0]}`, import.meta.url)));
});
t("what is read takes the reading face and its metrics, a message's headings too", () => {
  const sw = "font-family:var(--sans-read);--cap-mid:var(--cap-mid-read);--asc:var(--asc-read);--desc:var(--desc-read);";
  assert.match(app, /\n\.composer textarea\{[^}]*font-family:var\(--sans-read\);/);
  for (const sel of ["\\.bubble\\{", "\\.prose\\{max-width:none;"]) assert.match(app, new RegExp("\\n" + sel + "[^}]*" + sw.replace(/[()]/g, "\\$&")), sel);
  assert.doesNotMatch(app, /\.md-h\{[^}]*font-family/);
});
t("the type scale is untouched: sizes and line heights", () => {
  assert.match(tokens, /--fs-meta:12px; --fs-ui:14px; --fs-code:14px; --fs-read:16px; --fs-title:16px; --fs-input:16px; --fs-heading:20px; --fs-display:28px; --fs-hero:40px;/);
  assert.match(tokens, /--lh-meta:16px; --lh-ui:20px; --lh-read:24px; --lh-title:24px; --lh-heading:28px; --lh-display:36px; --lh-hero:44px;/);
});
t("a link capsule is sized from the face it sits in", () => {
  assert.match(read("css/links.css"), /padding:calc\(var\(--cap-mid\) \+ \.735em - var\(--asc\)\) \.6em calc\(\.735em - var\(--cap-mid\) - var\(--desc\)\) \.38em;/);
});
console.log(`\n${passed} passed`);
