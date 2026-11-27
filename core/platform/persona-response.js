// @ts-check

import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @import { Importable, Imported, Persona, PersonaApi, PersonaList } from "./persona-response-types" */

/** @param {unknown} value */
const texts = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
/** @param {unknown} value */
const textOrNull = (value) => value === null || typeof value === "string";
/** @param {unknown} value */
const isLevel = (value) => value === "project" || value === "space";
/** @param {unknown} value */
const isRef = (value) => value === null || (isResponseObject(value) && typeof value.name === "string" && typeof value.level === "string");

/** @param {unknown} value */
const isProblems = (value) => Array.isArray(value) && value.every((p) => isResponseObject(p) && typeof p.message === "string"
  && (p.line === null || Number.isInteger(p.line)) && textOrNull(p.key));

/** @param {unknown} value @returns {value is Persona} */
function isPersona(value) {
  if (!isResponseObject(value)) return false;
  const used = value.used_by;
  return typeof value.name === "string" && typeof value.description === "string" && isLevel(value.level)
    && typeof value.path === "string" && typeof value.version === "string"
    && [value.runtime, value.model, value.effort].every(textOrNull)
    && (value.tools === null || texts(value.tools)) && texts(value.disallowedTools)
    && (value.mcpServers === null || texts(value.mcpServers))
    && isRef(value.shadows) && isRef(value.shadowed) && isProblems(value.problems)
    && isResponseObject(used) && Array.isArray(used.jobs)
    && used.jobs.every((j) => isResponseObject(j) && typeof j.id === "string" && typeof j.name === "string");
}

/** @param {unknown} m */
const isMay = (m) => isResponseObject(m) && typeof m.label === "string" && texts(m.tools);

/** @param {unknown} value @returns {value is PersonaList} */
const isList = (value) => isResponseObject(value) && Array.isArray(value.personas) && value.personas.every(isPersona)
  && isResponseObject(value.may) && Object.values(value.may).every(isMay);

/** @param {unknown} value @returns {value is Importable} */
const isImportable = (value) => isResponseObject(value) && typeof value.id === "string" && typeof value.name === "string"
  && isLevel(value.level) && typeof value.text === "string" && texts(value.dropped) && typeof value.adapter === "string"
  && typeof value.from === "string" && isProblems(value.problems)
  && (value.description === undefined || textOrNull(value.description));

/** @param {unknown} value @returns {value is { importable: Importable[] }} */
const isImportables = (value) => isResponseObject(value) && Array.isArray(value.importable) && value.importable.every(isImportable);

/** @param {unknown} value @returns {value is Imported} */
const isImported = (value) => isResponseObject(value) && typeof value.name === "string" && isLevel(value.level)
  && typeof value.relative_path === "string" && typeof value.version === "string" && texts(value.dropped);

/** @param {unknown} value @returns {value is { chat_id: string, ts: string }} */
const isTry = (value) => isResponseObject(value) && typeof value.chat_id === "string" && typeof value.ts === "string";

/** @param {string | null} project */
const scope = (project) => project ? { project } : {};

/** @type {PersonaApi} */
export const personaApi = {
  personas: (project, signal) => requestChecked("/personas", isList, { signal, query: scope(project) }),
  importable: (project, signal) => requestChecked("/personas/importable", isImportables, { signal, query: scope(project) }),
  importPersona: (body) => requestChecked("/personas/import", isImported, { method: "POST", body }),
  tryOnce: (body) => requestChecked("/chat/try", isTry, { method: "POST", body }),
};
