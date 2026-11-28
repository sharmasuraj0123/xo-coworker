// @ts-check

/** @import { MayChoice, Persona } from "../../core/platform/persona-response-types" */

/** @import { AgentDraft, MayKey } from "./types" */

const SPACE_ID = ".space";

/** Level, project ("" for the Space's) and name. @param {{ level: string, project: string, name: string }} a */
export const keyOf = (a) => `${a.level}:${a.project}:${a.name}`;

/** The Workspace has no folder: it sees the Space's agents and holds none of its own. */
const WORKSPACE = "workspace";

/** The list a project's agents are read from: the Space's ("") for the Workspace. @param {string} project */
export const scopeOf = (project) => project === WORKSPACE ? "" : project;

/** The key of the agent an automation names, run in a project. @param {{ level: string, name: string }} ref @param {string} project */
export const refKeyOf = (ref, project) => keyOf({ ...ref, project: ref.level === "space" ? "" : scopeOf(project) });
export const AGENTS_DIR = ".xo/agents";
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FRONT = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const KEYS = /** @type {const} */ (["name", "description", "runtime", "model", "effort", "tools", "disallowedTools", "mcpServers"]);

/** "release-checker" as people read it: "Release checker". @param {string} name */
export const titleOf = (name) => name.replace(/-+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase());

/** "Release checker" as a file's name: "release-checker". @param {string} title */
export const slugOf = (title) => title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

/** @param {string} name */
export const isName = (name) => NAME.test(name);

/** The folder an agent's file is in, as the files routes name it. @param {Persona["level"]} level @param {string} project */
export const ownerOf = (level, project) => level === "space" ? SPACE_ID : project;

/** @param {Persona["level"]} level @param {string} name */
export const pathOf = (level, name) => level === "space" ? `${name}.md` : `${AGENTS_DIR}/${name}.md`;

/** A file's instructions, after its front matter. @param {string} text */
export const instructionsOf = (text) => FRONT.exec(text)?.[2].replace(/^\r?\n/, "") ?? text;

/** One front-matter value as written by XO, JSON being YAML; anything else reads as plain text. @param {string} raw */
function valueOf(raw) {
  const v = raw.trim();
  if (!v) return null;
  try { return JSON.parse(v); } catch { return v.replace(/^'(.*)'$/, "$1"); }
}

/** The front matter's top-level keys, one line each. @param {string} text @returns {Record<string, unknown>} */
export function frontOf(text) {
  const head = FRONT.exec(text)?.[1] ?? "";
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const line of head.split(/\r?\n/)) {
    const at = /^([A-Za-z]+):(.*)$/.exec(line);
    if (at) out[at[1]] = valueOf(at[2]);
  }
  return out;
}

/** The file for a draft: front matter in JSON, which YAML reads, then the instructions. @param {AgentDraft} d */
export function fileOf(d) {
  /** @type {Record<string, unknown>} */
  const keys = { name: d.name, description: d.description.trim(), runtime: d.runtime, model: d.model, effort: d.effort,
    tools: d.tools, disallowedTools: d.disallowedTools.length ? d.disallowedTools : null, mcpServers: d.mcpServers };
  const head = KEYS.filter((k) => keys[k] !== null && keys[k] !== "").map((k) => `${k}: ${JSON.stringify(keys[k])}`).join("\n");
  return `---\n${head}\n---\n\n${d.body.trim()}\n`;
}

/** A tool list's "May" choice, or its own. @param {string[] | null} tools @param {Record<string, MayChoice>} may @returns {MayKey} */
export function mayOf(tools, may) {
  if (tools === null) return "all";
  const has = new Set(tools), same = (/** @type {string[]} */ list) => list.length === has.size && list.every((t) => has.has(t));
  if (same(toolsOf("read", may) ?? [])) return "read";
  if (same(toolsOf("edit", may) ?? [])) return "edit";
  if (same(toolsOf("run", may) ?? [])) return "run";
  return "own";
}

/** The tools a choice allows, each wider one keeping what the narrower allow. @param {MayKey} key @param {Record<string, MayChoice>} may */
export function toolsOf(key, may) {
  const read = may.read?.tools ?? [], edit = may.edit?.tools ?? [], run = may.run?.tools ?? [];
  if (key === "read") return [...read];
  if (key === "edit") return [...new Set([...read, ...edit])];
  if (key === "run") return [...new Set([...read, ...edit, ...run])];
  return null;
}

/** "Read the project", "Read and change files", "Anything its runtime allows". @param {MayKey} key */
export const MAY_WORDS = { read: "Only read the project", edit: "Read and change files", run: "Read, change files and run commands",
  all: "Anything its runtime allows", own: "Its own list of tools" };
