import type { HopRecord } from "../../platform/chat-response-types.d.ts";

export type Hop = HopRecord & {
  at?: string | null;
};
