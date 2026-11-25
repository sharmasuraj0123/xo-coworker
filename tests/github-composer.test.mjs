// @ts-check
import assert from "node:assert/strict";
import { connectorReplies, document, flushFrames, initialChats, setImmediate, window } from "./boot/environment.mjs";

const fixtureFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const { pathname } = new URL(String(input), "http://localhost");
  if (pathname === "/api/connectors/github/status") return Promise.resolve(Response.json(connectorReplies.connected));
  if (pathname.endsWith("/github/issues")) return Promise.resolve(Response.json(connectorReplies.issues));
  if (pathname.endsWith("/github/pulls")) return Promise.resolve(Response.json({ pulls: [] }));
  return fixtureFetch(input, init);
};
await import("../boot.js");
const { default: kernel } = await import("../js/app.js");
try {
  initialChats.resolve(Response.json({ chats: [{ id: "project-chat", kind: "project", project: "demo" }] }));
  async function settle() { await new Promise((resolve) => setImmediate(resolve)); flushFrames(); }
  await settle();
  kernel.register({
    manifest: { id: "test.github-project", version: "1.0.0", kernel: "^1.1.0", needs: ["navigation"] },
    activate(ctx) { ctx.use("navigation").go("p:demo"); },
  });
  assert.deepEqual((await kernel.enable("test.github-project")).failed, []);
  await settle();
  async function click(selector) {
    const button = document.querySelector(selector);
    assert.ok(button, selector);
    button.dispatchEvent(new window.Event("click", { bubbles: true }));
    await settle();
  }
  await click("#stage [data-open-gh]");
  await click('[data-gh-open="i1"]');
  const say = document.querySelector("#say");
  say.value = "Before / after";
  say.selectionStart = 7;
  say.selectionEnd = 8;
  say.setRangeText = (text, from, to) => { say.value = say.value.slice(0, from) + text + say.value.slice(to); };
  await click("[data-gh-work]");
  assert.equal(say.value, "Before Work on issue #1, “Example”: https://github.com/example/demo/issues/1 after");
} finally {
  window.dispatchEvent(new window.Event("pagehide"));
  globalThis.fetch = fixtureFetch;
}
