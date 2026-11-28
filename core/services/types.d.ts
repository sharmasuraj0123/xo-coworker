export interface Folder { root: string; base: string; project: string; projectRoot: string }
export type Place = { rel: string; abs?: undefined } | { abs: string; rel?: undefined };
export interface ActivityRow { kind: string; target?: string; status?: string; waiting?: boolean }
export type Turn = import("./world/turn-types.d.ts").Turn;
export type Turns = Pick<ReturnType<typeof import("./world/turns.js").createTurns>, "list" | "blocksOf">;
export interface FileMark { path: string; kinds: Set<string>; lastKind?: string; seq: number; live?: boolean; waiting?: boolean; verb?: string; mark?: "new" | "edited" | "deleted" | "read" }
export interface Activity { files: Map<string, FileMark>; outside: Map<string, FileMark>; now: { row: ActivityRow; turn: Turn } | null; last: { row: ActivityRow; turn: Turn } | null; running: Turn | null; nowSpots: string[]; lastFile: string | null }
