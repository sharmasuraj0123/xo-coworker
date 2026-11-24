export interface JumpThread { id: string; title: string }
export interface JumpItemsDeps {
  D: { needItems: () => { t: { id: string; project: string }; admitted?: boolean; later?: boolean }[] };
  projects: () => { id: string; name: string }[];
  threadsOf: (project: string) => JumpThread[];
  projectIcon: (project: string) => string;
  glyphOf: (thread: JumpThread) => string;
  wordOf: (thread: JumpThread) => string;
}
