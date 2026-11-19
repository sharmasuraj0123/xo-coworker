export interface Place { project: string; base?: string | null; label?: string }
export interface PathsEntry { state: string; paths?: string[]; truncated?: boolean }
export interface Match { path: string; line: number; col?: number; text: string; ranges?: [number, number][] }
export interface SearchResult { matches?: Match[]; files?: number; truncated?: boolean }
export type Item =
  | { kind: "file"; path: string; hits: number[]; line: number | null }
  | { kind: "head"; path: string; n: number }
  | { kind: "match"; path: string; line: number; col?: number; text: string; ranges?: [number, number][] };
export interface QuickOpenDeps {
  paths: { of(pl: Place): PathsEntry };
  api: { projectSearch(project: string, o: object): Promise<SearchResult> };
  place: () => Place | null;
  openFile: (rel: string, at: { line: number | null; col: number | null }) => void;
  openFiles?: () => { rel?: string }[];
  announce?: (text: string) => void;
  layer?: { shown?: (el: HTMLElement) => void; hidden?: (el: HTMLElement) => void };
}
export interface QuickOpenState {
  mode: string; pl: Place; items: Item[]; sel: number; back: Element | null; gen: number;
  t: ReturnType<typeof setTimeout> | 0; o: Record<string, boolean>; noSearch: boolean; pendingEnter?: boolean;
}
