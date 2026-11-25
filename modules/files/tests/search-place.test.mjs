// @ts-check
import assert from "node:assert/strict";
import { filePlace } from "../search-place.js";

const deps = { thread: () => null, project: () => "Research" };
assert.equal(filePlace("home", deps), null, "Home has no Files search scope");
assert.deepEqual(filePlace("p:project", deps), { project: "project", base: "", label: "Research" });
