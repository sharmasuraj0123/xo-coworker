// The app's send paths give a message's notice its states through the real herald (core/services/notices.js; the states
// themselves run in tests/herald.test.mjs): out when it's sent and when a Retry sends it again, then sent or failed,
// each set whole by heraldFor + noticeFor. No browser.
//   node tests/send-notice.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const delivery = readFileSync(new URL("../modules/conversation/delivery.js", import.meta.url), "utf8");
const fileQuestion = readFileSync(new URL("../modules/conversation/file-question.js", import.meta.url), "utf8");
const body = (name) => { const source = `${app}\n${delivery}\n${fileQuestion}`; const i = source.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0, j = source.indexOf("{", i); for (let k = j; k < source.length; k++) { if (source[k] === "{") d++; else if (source[k] === "}") { d--; if (!d) return source.slice(j, k + 1); } } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a message aimed elsewhere shows its own 'out' notice (never 'Sent' before the server answers)", () => {
  for (const name of ["sendLive", "sendAbout"]) {
    const b = body(name) || "";
    assert.match(b, /heraldShow\(noticeFor\(m, "out"\), 9000\)/, `${name}: noticeFor(m, "out")`);
    assert.match(b, /\bto: /, `${name}: the message says where it goes (m.to)`);
    assert.doesNotMatch(b, /text: `Sent to/, `${name}: no "Sent" text of its own`);
  }
});
t("each attempt and each answer sets that notice whole: out (a Retry too), sent, failed", () => {
  const b = body("postLive") || "";
  assert.match(b, /heraldFor\(m\.id, \(\) => noticeFor\(m, "out"\)\)/, "an attempt: out");
  assert.match(b, /heraldFor\(m\.id, \(\) => noticeFor\(m, "sent"\)\)/, "an answer: sent");
  assert.match(b, /const fail = noticeFor\(m, "failed"\)/, "or failed");
  assert.doesNotMatch(b, /\.replace\(\/\^Sending/, "never a text edit of the last notice");
});
t("the file actions' Tell says nothing itself before the answer (the message's notice does)", () => {
  const v = readFileSync(new URL("../modules/files/viewer-events.js", import.meta.url), "utf8");
  const i = v.indexOf('e.target.closest("[data-vw-tell]")'), line = v.slice(i, v.indexOf("\n", i));
  assert.doesNotMatch(line, /Told the agent/);
});
t("a plain chat's message is never routed: its gate and its line agree (no Off line beside a send that goes)", () => {
  assert.match(body("composerDest") || "", /if \(CH\.isChats\(view\)\) return \{ thread: true \};/); // view: the conversation asked about (P1)
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
