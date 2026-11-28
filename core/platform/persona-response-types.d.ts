// @ts-check

export type PersonaLevel = "project" | "space";

export interface PersonaProblem {
  line: number | null;
  key: string | null;
  message: string;
}

export interface Persona {
  name: string;
  description: string;
  level: PersonaLevel;
  path: string;
  version: string;
  runtime: string | null;
  model: string | null;
  effort: string | null;
  tools: string[] | null;
  disallowedTools: string[];
  mcpServers: string[] | null;
  shadows: { name: string; level: string } | null;
  shadowed: { name: string; level: string } | null;
  used_by: { jobs: { id: string; name: string }[] };
  problems: PersonaProblem[];
}

export interface MayChoice {
  label: string;
  tools: string[];
}

export interface PersonaList {
  personas: Persona[];
  may: Record<string, MayChoice>;
}

export interface Importable {
  id: string;
  name: string;
  level: PersonaLevel;
  text: string;
  dropped: string[];
  adapter: string;
  from: string;
  problems: PersonaProblem[];
  description?: string | null;
}

export interface Imported {
  name: string;
  level: PersonaLevel;
  relative_path: string;
  version: string;
  dropped: string[];
}

export interface TryBody {
  project?: string;
  task?: string;
  persona?: { name: string; level: PersonaLevel };
  text?: string;
  review_id?: string;
}

export interface PersonaApi {
  personas(project: string | null, signal?: AbortSignal): Promise<PersonaList>;
  importable(project: string | null, signal?: AbortSignal): Promise<{ importable: Importable[] }>;
  importPersona(body: { adapter: string; id: string; project?: string; without_dropped?: boolean }): Promise<Imported>;
  tryOnce(body: TryBody): Promise<{ chat_id: string; ts: string }>;
}
