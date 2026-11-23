export interface Model {
  id: string;
  name: string;
  family?: string;
  family_default?: boolean;
  description?: string;
  is_default?: boolean;
  takes_effort?: boolean;
  efforts?: string[];
}
export interface Runtime { name: string }
export interface Feature { values?: string[]; support?: string }
export interface SetupState {
  prefs: Record<string, string | null>;
  models: Map<string | null, Model[]>;
  read: Set<string | null>;
  failed: Map<string | null, string>;
  pop: { open: boolean; anchor?: HTMLElement; part?: string };
}
export interface SetupDependencies {
  world: { state: { runtimes?: Runtime[]; projects: { id: string; name: string; kind: string }[] } };
  schedule: () => void;
  runtime: (name: string | null) => Runtime | null;
  feature: (runtime: Runtime | null, key: string) => Feature | null;
  cliName: (name: string | null) => string;
}
