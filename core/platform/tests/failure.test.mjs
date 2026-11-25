import assert from "node:assert/strict";
import test from "node:test";
import { createFailureSurface } from "../failure.js";

test("the notice presenter receives the source and readable failure details", () => {
  const notices = [];
  const surface = createFailureSurface((message) => notices.push(message));
  surface.report(new Error("Connection lost"), "Sync");
  surface.report("Timed out", "History");
  surface.report(null, "Startup failed");
  assert.deepEqual(notices, ["Sync: Connection lost", "History: Timed out", "Startup failed"]);
});
