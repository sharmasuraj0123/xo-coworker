// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

test("event lines use a bare icon in both message views", () => {
  const size = resolveValue("var(--ic)");
  for (const [property, value] of Object.entries({
    flex: "none", display: "grid", "place-items": "center", width: size, height: size,
    margin: "0 4px", color: resolveValue("var(--accent)"),
  })) assert.deepEqual(valuesFor(".ev-ic", property), [value], property);

  const icon = (selector) => selector.endsWith(".ev-ic");
  for (const property of ["background", "background-color", "border-radius"]) {
    assert.deepEqual(valuesFor(icon, property), [], property);
  }
  const bubble = ":root[data-msgx] .msgs>.ev>.ev-ic";
  const reading = ":root:not([data-msgx]) .msgs>.ev>.ev-ic";
  assert.deepEqual(valuesFor(bubble, "width"), [size]);
  assert.deepEqual(valuesFor(bubble, "margin"), ["0 6px"]);
  assert.deepEqual(valuesFor(reading, "margin"), ["0 4px"]);
});

test("adjacent event lines have 8px before and after", () => {
  const reading = ":root:not([data-msgx]) .msgs";
  assert.deepEqual(valuesFor(`${reading}>.ev:has(+.ev)`, "margin-bottom"), ["8px"]);
  assert.deepEqual(valuesFor(`${reading}>.ev+.ev`, "margin-top"), ["8px"]);
});

test("decision events begin with their verb and prefer the supplied wording", () => {
  const messages = createConversationMessages({
    S: { local: {}, alias: new Map(), showHops: false },
    world: { state: { hist: {}, timeline: { project: [] }, threads: [] }, act: {} },
    D: {
      decisions: () => [
        { id: "allow", project: "project", at: 1, verb: "Allowed", label: "Use this", said: "Read the file", choice: "allow" },
        { id: "deny", project: "project", at: 2, verb: "Denied", label: "Change the rules", choice: "deny" },
      ],
      notSent: () => [],
    },
    PROJ: (id) => id,
    convThread: () => undefined,
    chatOf: () => "project",
    convProject: () => "project",
    threadsOf: () => [],
  });
  assert.deepEqual(messages("p:project").filter((row) => row.who === "event").map((row) => row.text), [
    "Allowed · Read the file",
    "Denied · Change the rules",
  ]);
});
