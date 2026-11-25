// @ts-check
import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { dom } from "./lib/dom.mjs";

test("a missing application module replaces the loading page with a recovery message", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "coworker-boot-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = join(directory, "boot.mjs");
  await copyFile(new URL("../boot.js", import.meta.url), entry);
  const log = t.mock.method(console, "error", () => {});
  const { document } = await dom('<html><body><main aria-busy="true">Loading</main></body></html>');
  await import(pathToFileURL(entry).href);
  assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /reload the page/i);
  assert.ok(!document.querySelector('[aria-busy="true"]'));
  assert.equal(log.mock.callCount(), 1);
});
