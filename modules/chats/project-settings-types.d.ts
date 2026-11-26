import type { IntelModel, IntelWorld } from "./intel-types.js";
import type { createIntel } from "./intel.js";

export type PsNote = { saving?: boolean; err?: string } | undefined;
export type PsPage = "coord" | "threads";
export type PsRuntimeOption = { id: string; label: string; usable: boolean; why: string };
export type PsRoute = { id: string; label: string; on: boolean };

export interface PsCoordinator {
  name: string;
  busy: boolean;
  runtime: string | null;
  runtimes: PsRuntimeOption[];
  rtNote: string;
  models: IntelModel[] | null;
  auto: boolean;
  model: string | null;
  effort: string | null;
  efforts: string[];
  routes: PsRoute[];
  routeLine: string;
  notes: Record<string, PsNote>;
}

export interface PsPolicy {
  allowed: string[] | null;
  default: string | null;
  preferences: string | null;
  fallback: boolean | null;
}

export interface PsThreads {
  name: string;
  ready: boolean;
  busy: boolean;
  own: PsPolicy;
  allowed: string[];
  installed: string[];
  spaceDefault: string | null;
  spaceFallback: boolean;
  spacePref: string | null;
  pref: string;
  notes: Record<string, PsNote>;
}

export interface ProjectSettingsOptions {
  world: IntelWorld;
  writes: ReturnType<typeof createIntel>["writes"];
  PROJ: (project: string) => string;
  iconOf: (project: string) => string;
}

export interface PsState {
  project: string | null;
  page: PsPage;
  busy: boolean;
  models: IntelModel[] | null;
  dms: { id: string; label: string; connected?: boolean }[];
  notes: Record<string, PsNote>;
  pref: string | null;
  back: Element | null;
}

export type PsCatalog = ReturnType<typeof createIntel>["writes"]["catalog"];

export interface PsActions {
  go(page: PsPage): void;
  close(): void;
  setModel(id: string): void;
  setEffort(effort: string): void;
  toggleAllowed(name: string): void;
  setPref(value: string): void;
  route(id: string): void;
  runtime(id: string): void;
  policy(patch: Partial<PsPolicy>, key: string): void;
}
