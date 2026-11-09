// A message's notice says what happened to it (the Launchpad grader on 83929bb, in the browser: a named-recipient
// send whose POST failed 503 kept "Sent to demo · open to follow the reply" on screen, because "Sent" was said before
// the POST and the failure's notice was dropped under it). While it's out it says "Sending to …"; the server's answer
// turns that same notice into "Sent to …" or the failure, in place; only that message's own notice is replaced, and
// a failure never yields to a passing notice (behind an Undo it waits its turn). No browser.
//   node tests/send-notice.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const body = (name) => { const i = app.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0, j = app.indexOf("{", i); for (let k = j; k < app.length; k++) { if (app[k] === "{") d++; else if (app[k] === "}") { d--; if (!d) return app.slice(j, k + 1); } } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("while it's out, a message aimed elsewhere says 'Sending to …', never 'Sent'", () => {
  const send = body("sendLive") || "", about = body("sendAbout") || "";
  for (const [name, b] of [["sendLive", send], ["sendAbout", about]]) {
    assert.doesNotMatch(b, /heraldShow\(\{ kind: "sent", text: `Sent to/, `${name}: no "Sent" before the server answers`);
    assert.match(b, /text: `Sending to \$\{/, `${name}: "Sending to …"`);
    assert.match(b, /mid: m\.id/, `${name}: the notice is that message's (mid)`);
  }
});
t("the server's answer turns that same notice into Sent, or the failure, in place (heraldFor)", () => {
  const post = body("postLive") || "";
  assert.ok(body("heraldFor"), "app.js has heraldFor(mid, make)");
  assert.match(post, /heraldFor\(m\.id, \(h\) => \(\{[^\n]*"Sent to \$1"/, "sent: the notice says Sent");
  assert.match(post, /heraldFor\(m\.id, \(\) => fail/, "failed: the same notice becomes the failure");
});
t("a failure's notice never yields to a passing one (forced: behind an Undo it waits, it isn't dropped)", () => {
  const post = body("postLive") || "";
  assert.match(post, /const fail = \{ kind: "stopped",[^\n]*force: true \};/, "the failure's notice is forced");
});
t("heraldFor replaces only that message's notice: on screen, or waiting in the queue", () => {
  const b = body("heraldFor") || "";
  assert.match(b, /S\.herald\.mid === mid/);
  assert.match(b, /HQ\.find\(\(q\) => q\.h\.mid === mid\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
