import type { ChangeFile, ChangePage, DiffHandle, Scope } from "../../core/services/change-types.d.ts";

export type { ChangeFile, ChangesApi, DiffHandle, DiffOptions, HttpError, Scope } from "../../core/services/change-types.d.ts";
export interface Total { add: number; del: number }
export interface PlaceChanges {
  state: "idle" | "loading" | "ok" | "error" | "unsupported"; data: ChangePage | null; files: Map<string, ChangeFile>; total: Total;
  sig: string | null; inflight: boolean; again: boolean; cancel: (() => void) | null; err?: string | null;
}
export interface Activity { sig: string; busy: boolean; live: Set<string>; last: string | null }
export interface FollowState { follow: boolean; sel: string | null; pill: string | null; sig: string | null; all?: boolean; reveal?: Set<string | undefined> | null }
export interface Drawn {
  key: string | null; path: string | null; patch: string | null; ver: unknown; handle: DiffHandle | null; img: { drop(): void } | null;
  gen: number; failed: boolean; pend?: { key: string; path: string; patch: string | null; ver: unknown } | null;
}
export type FrameFile = ChangeFile & { live?: boolean; version?: unknown };
export interface FrameDeps {
  host: HTMLElement; changes: import("./store.js").Changes; view: () => string;
  openFile: (s: Scope, path: string, from: HTMLElement | null) => void; onChange?: () => void;
}
