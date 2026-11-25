// @ts-check
import assert from "node:assert/strict";
import { window } from "./boot/environment.mjs";

const fixtureFetch = globalThis.fetch;
const headers = [];
location.search = "?coder_session_token=boot-test&keep=yes";
const replaceState = history.replaceState.bind(history);
history.replaceState = (state, title, url) => {
  if (url) location.href = new URL(url, location.href).href;
  replaceState(state, title, url);
};
const saved = new Map();
sessionStorage.setItem = (key, value) => saved.set(key, value);
globalThis.fetch = (input, init) => {
  if (new URL(String(input), location.href).pathname.startsWith("/api/")) {
    headers.push(new Headers(init?.headers).get("Coder-Session-Token"));
  }
  return fixtureFetch(input, init);
};

await import("../boot.js");
try {
  assert.ok(headers.length > 0, "boot made an API request");
  assert.equal(headers[0], "boot-test", "the first API request carries the incoming token");
  assert.equal(saved.get("xo-coder-token"), "boot-test");
  assert.equal(location.search, "?keep=yes");
} finally {
  window.dispatchEvent(new window.Event("pagehide"));
}
