// What Settings › Routing says about chats is read from the routing as it is, never kept from an action (the
// create-project grader on 65e84b7, S113: Disconnect's chat cleanup refused, then "Use the Space's" for that chat: its
// routing null, its row gone, and "demo still names it" stayed, a flag Disconnect set that only it would clear).
// Checked from the source; the drawn page is the settings case "S113 a refused chat cleanup after Disconnect".
//   node tests/routing-words.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/settings.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n  }\n", i)); };

t("the page says which chats name a model that isn't connected, from their routing, each time it's drawn", () => {
  const b = body("routingHtml");
  assert.match(b, /const orphans = overrides\.filter\(\(p\) => p\.routing\.mode === "decision" && !\(R\.models\.find\(\(m\) => m\.id === p\.routing\.decision_model\) \|\| \{\}\)\.connected\);/);
  assert.match(b, /orphans\.length \? `<p class="set-err" data-orphans>/);
});
t("Disconnect keeps no words of its own about chats: it says it once, aloud", () => {
  const b = body("disconnect");
  assert.doesNotMatch(b, /R\.err\.route\s*=/, "no flag that outlives the routing it was about");
  assert.match(b, /announce\(`Disconnected\. Its key is removed\.\$\{left\.length \?/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
