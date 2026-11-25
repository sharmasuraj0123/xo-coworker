import type { QuickOpenDeps } from "./types.d.ts";

export interface FileSearchHost extends Pick<QuickOpenDeps, "place" | "announce"> {
  syncInert(): void;
}
export interface SearchFiles {
  tree: { pathsChanged(): void };
  viewer: {
    openFiles: { rel?: string }[];
    open(file: { path: string; name?: string; project: string; rel: string; lines?: [number, number] }, from: null): void;
  };
}
