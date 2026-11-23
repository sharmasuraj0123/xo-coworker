import type { createFolderReads, FolderRead } from "./folder-reads.js";
import type { marksOf, touched } from "./marks.js";
import type { FilesScope } from "./scope.js";

export type ProjectScope = FilesScope & { project: string };
export type CachedElement = HTMLElement & { _h?: string | null };
export interface TreeGroup { el: HTMLElement; sig: string | null; open: Set<string> }
export interface TreeState { key: string | null; groups: Map<string, TreeGroup>; on: Element | null; q: string | null; changed: number }
export interface TreeContext { marks: ReturnType<typeof marksOf>; open: Set<string>; openIn: Map<string, string[]>; q: string }

interface ChangeCount { path: string; binary?: boolean; additions?: number | null; deletions?: number | null }

export interface TreeDependencies {
  F: { pick: string | null; follow: FilesScope | null; viewKey: string; view: string; q: string; undo?: { s?: FilesScope | null; err?: string | null; name: string } | null; sel: string | null };
  M: { btn: HTMLElement | null; row: HTMLElement | null };
  NW: { el: HTMLElement | null };
  dirs: Map<string, FolderRead>;
  load: ReturnType<typeof createFolderReads>["load"];
  paths?: { of(scope: { project: string; base: string }): { paths?: string[]; state?: string; truncated?: boolean } } | null;
  folded: (scope: ProjectScope, part: string) => boolean;
  setOf: (key: string) => Set<string>;
  ops: (scope: ProjectScope) => boolean;
  world: Parameters<typeof touched>[1] & { state: { projects?: { id: string; name?: string | null }[] } };
  viewer: { hasFile: boolean; file?: { rel?: string | null; show?: string | null } | null };
  changes?: { of(view: string): { state: string; files: Map<string, ChangeCount> } | null; activity(view: string): { live: Set<string> } } | null;
  isBusy: Parameters<typeof touched>[2];
  placeNew: () => void;
  moreAt: (row: HTMLElement | null) => void;
  base: (path: string) => string;
}
