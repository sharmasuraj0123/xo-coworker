// @ts-check

import { fileOf, isName, mayOf, slugOf, toolsOf } from "./agent-file.js";

/** @import { MayChoice } from "../../core/platform/persona-response-types" */

/** @import { Agent, AgentDraft, MayKey } from "./types" */

/** @typedef {{ title: string, draft: AgentDraft, may: MayKey, problem: string, tryOn: string }} AgentValues */

/** @param {Agent | null} a @param {string} body @param {string} project @param {Record<string, MayChoice>} may @returns {AgentValues} */
export function agentValues(a, body, project, may) {
  if (!a) {
    return { title: "", may: "read", problem: "", tryOn: "", draft: { name: "", description: "", body: "", runtime: null, model: null,
      effort: null, tools: toolsOf("read", may), disallowedTools: [], mcpServers: null, level: project ? "project" : "space", project } };
  }
  return { title: a.name.replace(/-+/g, " ").replace(/^\w/, (c) => c.toUpperCase()), may: mayOf(a.tools, may), problem: "",
    tryOn: "", draft: { name: a.name, description: a.description, body, runtime: a.runtime, model: a.model, effort: a.effort,
      tools: a.tools, disallowedTools: a.disallowedTools, mcpServers: a.mcpServers, level: a.level, project: a.project } };
}

/** The form as typed. @param {ParentNode} form @param {AgentValues} was @param {Record<string, MayChoice>} may @returns {AgentValues} */
export function readAgentForm(form, was, may) {
  /** @param {string} name @param {string} fallback */
  const text = (name, fallback) => {
    const el = form.querySelector(`[name="${name}"]`);
    return el && "value" in el && typeof el.value === "string" ? el.value : fallback;
  };
  const d = was.draft, mayKey = /** @type {MayKey} */ (text("may", was.may));
  const kept = text("level", d.level === "space" ? "space" : d.project);
  const title = text("title", was.title);
  return { title, may: mayKey, problem: was.problem, tryOn: text("try-project", was.tryOn), draft: { ...d, name: slugOf(title),
    description: text("description", d.description),
    body: text("body", d.body), runtime: text("runtime", d.runtime ?? "") || null, model: text("model", d.model ?? "").trim() || null,
    effort: text("effort", d.effort ?? "") || null, tools: mayKey === "own" ? d.tools : toolsOf(mayKey, may),
    level: kept === "space" ? "space" : "project", project: kept === "space" ? d.project : kept } };
}

/** Why it can't be saved yet, or "". @param {AgentValues} v */
export function agentProblem(v) {
  if (!v.title.trim()) return "Give it a name.";
  if (!isName(v.draft.name)) return "Name it with letters, numbers and spaces, up to 64.";
  if (!v.draft.description.trim()) return "Say what it's for: coordinators read it to choose an agent.";
  if (!v.draft.body.trim()) return "Write its instructions.";
  if (v.draft.level === "project" && !v.draft.project) return "Choose where it's kept.";
  return "";
}

/** @param {AgentValues} v */
export const agentText = (v) => fileOf(v.draft);
