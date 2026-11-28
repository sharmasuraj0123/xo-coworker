import type { Hold } from "../../core/services/world/held.js";

export type ThreadActivity = { state?: string; busy?: boolean; held?: Hold | null };
export type ThreadStatus = ThreadActivity & { state: string; frozen?: boolean; stop?: unknown };
export type HeldThread<T extends ThreadActivity> = T & { held: NonNullable<T["held"]> };
