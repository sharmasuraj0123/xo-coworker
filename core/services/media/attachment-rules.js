// @ts-check

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 10;
/** Above either, a paste becomes a file (`pasted-text-N.md`). */
export const PASTE_CHARS = 4000;
export const PASTE_LINES = 80;

const REFUSED_EXT = new Set([
  "zip", "gz", "tgz", "bz2", "xz", "7z", "rar", "tar", "jar", "war", "whl", "exe", "dll", "so", "dylib", "bin", "dmg", "iso", "pkg", "deb", "rpm", "msi", "apk", "app",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "pages", "numbers", "key", "rtf",
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "mp4", "mov", "avi", "mkv", "webm", "wmv",
  "heic", "heif", "tif", "tiff", "bmp", "ico", "psd", "ai", "sketch", "fig", "raw", "cr2", "nef",
  "sqlite", "db", "pyc", "class", "o", "a", "wasm", "ttf", "otf", "woff", "woff2", "eot",
]);
const REFUSED_TYPE = /^(audio|video|font)\/|^application\/(zip|x-zip|gzip|x-gzip|x-tar|x-7z|x-rar|vnd\.rar|x-msdownload|x-apple-diskimage|vnd\.ms-|vnd\.openxmlformats|msword|vnd\.oasis)/;

/** @param {unknown} name */
export const extOf = (name) => ((/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "").toLowerCase();

/** @param {number | null | undefined} n */
export const fmtSize = (n) => (n == null || !Number.isFinite(+n) ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(/\.0$/, "")} MB`);

/** Why this file can't be sent, from what the browser knows, or "" to let the server decide. @param {Pick<File, "name" | "size" | "type"> | null | undefined} file */
export function refusal(file) {
  if (!file) return "Not a file.";
  if (!file.size) return "This file is empty.";
  if (file.size > MAX_BYTES) return `Over the ${MAX_BYTES / 1048576} MB limit (${fmtSize(file.size)}).`;
  if (REFUSED_EXT.has(extOf(file.name)) || REFUSED_TYPE.test(String(file.type || ""))) return "Only text, images (PNG, JPEG, GIF, WebP) and PDFs can be attached.";
  return "";
}

/** @template {Pick<File, "name" | "size" | "type">} T @param {Iterable<T> | null | undefined} files */
export function sortFiles(files, have = 0) {
  const take = [], refused = [];
  for (const f of files || []) {
    const why = refusal(f);
    if (why) refused.push({ name: f && f.name || "file", why });
    else if (have + take.length >= MAX_FILES) refused.push({ name: f.name, why: `A message takes at most ${MAX_FILES} files.` });
    else take.push(f);
  }
  return { take, refused };
}

/** @param {unknown} text */
const linesOf = (text) => String(text || "").split("\n").length;

/** A paste long enough to send as a file rather than as words in the message. @param {unknown} text */
export const isLargePaste = (text) => String(text || "").length > PASTE_CHARS || linesOf(text) > PASTE_LINES;

/** @param {unknown} text */
export function pasteExt(text) {
  const s = String(text || "").trim();
  if (/^[[{]/.test(s)) { try { JSON.parse(s); return "json"; } catch { /* not JSON */ } }
  if (/^#!.*\b(ba|z)?sh\b/.test(s)) return "sh";
  if (/^#!.*\bpython/.test(s)) return "py";
  if (/^<!doctype html|^<html[\s>]/i.test(s)) return "html";
  if (/^```/.test(s) || /^#{1,6}\s/m.test(s.slice(0, 400))) return "md"; // already markdown
  const lines = s.split("\n").slice(0, 60);
  const share = (/** @type {RegExp} */ re) => lines.filter((l) => re.test(l)).length / Math.max(1, lines.filter((l) => l.trim()).length);
  if (share(/^\s*(def \w+\(|class \w+[(:]|import [\w.]+(\s+as \w+)?$|from [\w.]+ import |if __name__|elif |except\b)/) > 0.15) return "py";
  if (share(/^\s*(import .+ from |export |const |let |function |async |interface |type \w+ =|\}\)?;?$)/) > 0.2) return /:\s*(string|number|boolean)\b|^\s*interface /m.test(s) ? "ts" : "js";
  if (share(/^\s*(fn |let mut |use \w+::|impl |pub )/) > 0.15) return "rs";
  if (share(/^\s*(func |package \w+$|import \(|\w+ := )/) > 0.15) return "go";
  if (share(/^\s*(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |FROM |WHERE |JOIN )/i) > 0.3) return "sql";
  if (share(/^\s*[.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{|^\s*[\w-]+\s*:\s*[^;]+;\s*$/) > 0.4) return "css";
  return "md";
}

/** `pasted-text-N.<ext>` @param {unknown} text @param {number} n */
export const pasteName = (text, n) => `pasted-text-${n}.${pasteExt(text)}`;

/** The chip's words for a paste: `Pasted text · 312 lines · 14 KB`. @param {unknown} text */
export function pasteLabel(text) {
  const n = linesOf(text);
  return `Pasted text · ${n.toLocaleString("en")} line${n === 1 ? "" : "s"} · ${fmtSize(new TextEncoder().encode(String(text || "")).length)}`;
}

/** image | pdf | text, from the server's type (which it sniffed from the bytes). @param {string} type */
export const kindOf = (type) => (/^image\//.test(type) ? "image" : type === "application/pdf" ? "pdf" : "text");

/** A short word for a type, for a chip: PNG, PDF, Markdown, Text. @param {string} type @param {unknown} name */
export function typeWord(type, name) {
  if (type === "application/pdf") return "PDF";
  if (/^image\//.test(type)) return type.slice(6).toUpperCase().replace("JPEG", "JPG");
  if (type === "text/markdown") return "Markdown";
  const ext = extOf(name);
  return ext && ext !== "txt" ? ext.toUpperCase() : "Text";
}

/** What a failed upload says on its chip: short, plain, from the server's code. @param {{code?: string, status?: number} | null | undefined} err */
export function uploadErrorText(err) {
  if (!err) return "Upload failed";
  switch (err.code) {
    case "too_large": return `Over ${MAX_BYTES / 1048576} MB`;
    case "unsupported_type": return "Not text, an image or a PDF";
    case "empty_file": return "Empty file";
    case "too_many_unsent": return "Too many unsent files here";
    case "unsafe_attachments_folder": return "The project's .xo folder needs fixing";
    case "chat_retired": return "This project was removed";
    case "chat_not_found": return "This chat is gone";
    case "timeout": return "No answer from XO";
    case "network": return "Can't reach XO";
    case "cross_origin": return "Refused by the proxy";
    default: return err.status === 413 ? "Too large" : "Upload failed";
  }
}

/** Codes where uploading the same bytes again can't help: the chip offers Remove, not Retry. */
export const FINAL = new Set(["too_large", "unsupported_type", "empty_file", "chat_retired", "chat_not_found"]);
