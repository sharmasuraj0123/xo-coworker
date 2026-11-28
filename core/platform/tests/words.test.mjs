import assert from "node:assert/strict";
import { count, plural } from "../words.js";

for (const [n, one, many, word] of [
  [0, "file", undefined, "files"],
  [1, "file", undefined, "file"],
  [2, "person", "people", "people"],
  [1, "person", "people", "person"],
  [2, "shipped", "shipped", "shipped"],
]) {
  assert.equal(plural(n, one, many), word);
  assert.equal(count(n, one, many), `${n} ${word}`);
}
