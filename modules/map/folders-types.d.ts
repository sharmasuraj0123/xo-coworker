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

export type Directory =
  | { state: "loading" }
  | { state: "ok", dirs: Entry[], files: Entry[] }
  | { state: "error", error: string };

export interface MapTree {
  dirs?: TreeEntry[];
  files?: TreeEntry[];
}

export interface TreeReader {
  projectTree: (project: string, rel: string) => Promise<MapTree>;
}
