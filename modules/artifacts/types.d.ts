export type Kind = "image" | "page" | "doc" | "data" | "code" | "link" | "branch";
export interface MadeFile { name?: string; path?: string; type?: string; title?: string | null; bytes?: number | null }
export interface Made {
 key: string; id?: string; server?: boolean; tid: string | null; project: string | undefined; threadTitle: string; title: string | null;
 path: string; name: string; type: string; bytes: number | null; kind: Kind; at: number; pinned: boolean; exists?: boolean;
 url?: string | null; git?: MadeRow["git"]; turn?: string | null; fileProject?: string | null; rel?: string | null; chat?: string | null;
}
export interface MadeThread { id: string; project: string; title?: string; lastAt: number; outputs?: MadeFile[] }
export type MadeRow = import("./row-types").MadeRow;
export interface Group { id: string; label: string; items: Made[] }
export type Preview = { kind: "doc"; title: string | null; text: string } | { kind: "lines"; lines: string[] };
