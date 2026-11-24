export interface ProjectIconWorld {
  state: { threads: { project?: string, title?: string }[] };
  project: (id: string) => { name?: string } | null | undefined;
}

export interface ProjectIconShape {
  get: (key: "layout") => { icons?: Record<string, unknown> } | null | undefined;
}
