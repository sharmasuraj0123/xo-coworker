export interface ShellStartup {
  THEME: { get: () => "light" | "dark" };
  applyTheme: (mode: "light" | "dark") => void;
  SIDE: { folded: boolean, fold: (folded: boolean, options: { quiet: boolean }) => void };
  PHONE: EventTarget;
  setDrawer: (open: boolean) => void;
  render: () => void;
  world: { subscribe: (callback: () => void) => () => void };
  schedule: () => void;
  follow: () => void;
  loadDraft: () => void;
}
