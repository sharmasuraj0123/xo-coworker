// @ts-check
import { esc } from "../../core/platform/util.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";

import { fileRef, lineRef } from "./file-references.js";

/** @param {string} text */
export function youText(text) {
  const line = lineRef(text), file = line ?? fileRef(text);
  if (!file) return esc(text);
  const path = esc(file.path), name = file.path.split("/").pop();
  const lines = line && (line.a === line.b ? String(line.a) : line.a + "–" + line.b);
  const title = line ? esc(file.path + ", " + (line.a === line.b ? "line " : "lines ") + lines) : path;
  const range = line ? ' data-ref-a="' + line.a + '" data-ref-b="' + line.b + '"' : "";
  return '<a href="#' + path + '" class="lk lk-in lk-file" data-ref="' + path + '"' + range + ' title="' + title + '">' +
    '<span class="lk-ic">' + fileIcon(name) + '</span><span class="lk-t">' + esc(name) + (lines ? " · " + lines : "") +
    "</span></a>\n" + esc(file.rest);
}
