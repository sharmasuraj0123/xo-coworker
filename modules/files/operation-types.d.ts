import type { FileScope as FilesScope } from "../../core/services/file-scope-types.d.ts";
import type { TreeDependencies, TreeState } from "./tree-types";

export type NameMode = "file" | "folder" | "rename";
export interface NameFeedback { words: string; err?: boolean; runs?: boolean; why?: string }
export interface FileError { status?: number; code?: string; message?: string }

interface Undo { name: string; err?: string; editId?: string; s?: FilesScope; local?: string }
type PathChange = { kind: "rename"; path: string; old_path: string } | { kind: "create" | "delete"; path: string };

export interface OperationDependencies {
  F: { scope: FilesScope; host: HTMLElement | null; q: string; sel: string | null; fileView: boolean; auto: boolean; undo?: Undo | null };
  NW: { key: string | null; dir: string | null; el: HTMLElement | null; busy: boolean; confirm: boolean; mode: NameMode; from: string | null };
  dirs: TreeDependencies["dirs"];
  load: TreeDependencies["load"];
  paths: { changed(scope: { project: string; base: string }, change: PathChange): void } | null;
  changes: { saved?: (project: string, rel: string) => void } | null;
  viewer: { open(file: { path: string; name: string; bytes: number; project: string; rel: string; created: string | true }, from: Element | null): void };
  setOf: TreeDependencies["setOf"];
  paint: () => void;
  groups: () => TreeState["groups"];
  rowOf: (path: string) => HTMLElement | null;
  base: (path: string | null) => string;
  canMake: (scope: FilesScope, path: string) => boolean;
  folderIcon: string;
}
