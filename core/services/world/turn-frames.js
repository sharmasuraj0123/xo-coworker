// @ts-check
import { isRecord } from "../../platform/util.js";

import { number, strings, text } from "./frame-values.js";

/** @template T @param {unknown} value @param {(entry: unknown) => T | null} decode */
function list(value, decode) {
  if (!Array.isArray(value)) return undefined;
  const entries = [];
  for (const raw of value) {
    const entry = decode(raw);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

/** @param {unknown} raw */
function step(raw) {
  if (!isRecord(raw)) return null;
  const p = raw.progress;
  return { ...raw, kind: text(raw.kind) ?? "", status: text(raw.status) ?? "", call_id: text(raw.call_id),
    line: text(raw.line), target: text(raw.target), summary: text(raw.summary), tool: text(raw.tool),
    output: text(raw.output), output_append: text(raw.output_append), waiting: raw.waiting === true || undefined,
    pending: raw.pending === true || undefined,
    progress: isRecord(p) ? { tool_calls: number(p.tool_calls), duration_ms: number(p.duration_ms) } : undefined };
}

/** @param {unknown} raw */
function item(raw) {
  return isRecord(raw) && typeof raw.state === "string" ? { ...raw, state: raw.state, text: text(raw.text) } : null;
}

/** @param {unknown} raw */
function file(raw) {
  if (!isRecord(raw)) return null;
  return { ...raw, id: text(raw.id), chat: text(raw.chat), name: text(raw.name), path: text(raw.path), type: text(raw.type),
    title: text(raw.title), size: number(raw.size), bytes: number(raw.bytes), tint: text(raw.tint),
    w: number(raw.w) ?? text(raw.w), h: number(raw.h) ?? text(raw.h), made_id: text(raw.made_id) ?? number(raw.made_id),
    relative_path: text(raw.relative_path), project_id: text(raw.project_id), mtime: text(raw.mtime) ?? number(raw.mtime) };
}

/** @param {unknown} raw */
function block(raw) {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.type !== "string") return null;
  return { ...raw, id: raw.id, type: raw.type, index: number(raw.index) ?? null, header: text(raw.header),
    started_at: text(raw.started_at), steps: strings(raw.steps), text: text(raw.text), rows: list(raw.rows, step),
    items: list(raw.items, item), files: list(raw.files, file), caption: text(raw.caption) };
}

/** @param {unknown} raw */
export function turnEnvelope(raw) {
  if (!isRecord(raw)) return null;
  return { type: text(raw.type), data: isRecord(raw.data) ? raw.data : {}, turn_id: text(raw.turn_id), session_id: text(raw.session_id),
    chat_id: text(raw.chat_id), thread_ts: text(raw.thread_ts), ts: text(raw.ts), seq: number(raw.seq) };
}

/** @param {unknown} raw */
function snapshot(raw) {
  const env = turnEnvelope(raw);
  if (!env?.turn_id || !isRecord(raw)) return null;
  return { ...env, blocks: list(raw.blocks, block), held: strings(raw.held) };
}

/** @param {string} type @param {Record<string, unknown>} raw */
export function turnData(type, raw) {
  return { ...raw, status: text(raw.status), origin: text(raw.origin), wakes: strings(raw.wakes),
    by: text(raw.by), last_step: text(raw.last_step), wall_ms: number(raw.wall_ms), reason: text(raw.reason),
    block: type === "block.started" || type === "block.finished" ? block(raw.block) : null,
    type: text(raw.type), block_id: text(raw.block_id), append: text(raw.append), header: text(raw.header),
    steps: strings(raw.steps), items: list(raw.items, item), rows: list(raw.rows, step),
    turns: type === "snapshot" ? list(raw.turns, snapshot) : undefined };
}
