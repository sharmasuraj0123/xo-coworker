// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalMessages } from "../local-messages.js";

test("the echo keeps the local row's identity and a new project replaces its own local rows", () => {
  const messages = createLocalMessages();
  const conv = "p:demo";
  const first = messages.send({ conv, text: "Same text", target: "demo", to: "Demo" });
  const second = messages.send({ conv, text: "Same text", target: "demo", to: "Demo" });
  const echo = { id: "server-first", who: "you", at: first.at, text: first.text };
  messages.mergeEchoes(conv, [echo]);
  messages.mergeEchoes(conv, [echo]);
  assert.equal(messages.alias(echo.id), first.id, "the same acknowledgement cannot claim a second send");
  assert.equal(messages.get(first.id)?.status, "sent");
  assert.equal(messages.get(second.id)?.status, "sending");

  const other = messages.send({ conv: "ws", text: "Keep this", target: "workspace", to: "Workspace" });
  messages.welcome(conv, "Demo is ready");
  assert.deepEqual(messages.list(conv).map((row) => row.text), ["Demo is ready"]);
  assert.equal(messages.get(first.id), undefined);
  assert.equal(messages.get(second.id), undefined);
  assert.equal(messages.get(other.id)?.text, "Keep this");
});
