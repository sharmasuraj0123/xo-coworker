export type { RuntimeModel as Model } from "../../core/platform/runtime-response-types.d.ts";
import type { RuntimeModel as Model } from "../../core/platform/runtime-response-types.d.ts";
export interface Runtime { name: string }
export interface Feature { values?: string[]; support?: string | null }
export interface SetupState {
  prefs: Record<string, string | null>;
  models: Map<string | null, Model[]>;
  read: Set<string | null>;
  failed: Map<string | null, string>;
  pop: { open: boolean; anchor?: HTMLElement; part?: string };
}
export interface SetupDependencies {
  world: { state: { runtimes?: Runtime[] | null; projects: { id: string; name: string; kind: string }[] } };
  schedule: () => void;
  runtime: (name: string | null) => Runtime | null;
  feature: (runtime: Runtime | null, key: string) => Feature | null;
  cliName: (name: string | null) => string;
}
