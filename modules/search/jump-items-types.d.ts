export interface JumpThread { id: string; title: string; state: string }
export interface JumpActionDeps {
  create: () => void;
  settings: () => void;
  keys: () => void;
  theme: () => void;
  intelligence: () => boolean;
  openIntelligence: () => void;
  stage: () => boolean;
  toggleStage: () => void;
}
export interface WorkspaceJumpDeps extends Omit<import("./types.d.ts").JumpDeps, "field" | "list" | "places" | "actions" | "more"> {
  sources: Parameters<typeof import("../../shell/places.js").contributedSearch>[0] &
    Pick<import("../../core/kernel/types").Places, "watch">;
  items: JumpItemsDeps;
  actions: JumpActionDeps;
}
export interface JumpItemsDeps {
  D: { needItems: () => { t: { id: string; project: string }; admitted?: boolean; later?: boolean }[] };
  projects: () => { id: string; name: string }[];
  threadsOf: (project: string) => JumpThread[];
  projectIcon: (project: string) => string;
  glyphOf: (thread: JumpThread) => string;
  wordOf: (thread: JumpThread) => string;
}
export type JumpHost = Pick<WorkspaceJumpDeps, "go" | "focusIn" | "onHidden">
  & Pick<JumpActionDeps, "create" | "settings" | "keys" | "toggleStage">
  & Pick<JumpItemsDeps, "projectIcon"> & {
    IQ: { kindOf(session: string): unknown; open(session: string, chip: HTMLElement): unknown };
  };
