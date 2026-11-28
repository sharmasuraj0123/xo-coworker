export interface MapFolder {
  project: string;
  base?: string;
}

export interface TreeEntry {
  name: string;
  relative_path?: string;
}

interface Entry {
  name: string;
  path: string;
}

type GoodDirectory = { state: "ok", dirs: Entry[], files: Entry[] };
type FailedDirectory = { state: "error", error: string };
export type Directory = { state: "loading" } | GoodDirectory | (FailedDirectory & { previous?: GoodDirectory });

export interface MapTree {
  dirs?: TreeEntry[];
  files?: TreeEntry[];
}

export interface TreeReader {
  projectTree: (project: string, rel: string, signal: AbortSignal) => Promise<MapTree>;
}
