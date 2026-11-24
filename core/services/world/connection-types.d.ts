import type { Runtime } from "../runtime-types.d.ts";
import type { currentPools } from "./sessions.js";

type Routing = { mode?: string } | null;

export interface Connection {
  projects?: { id: string; routing?: Routing }[];
  router?: Routing;
  statusCode?: string | null;
  errorCode?: string | null;
  error?: unknown;
  statusError?: unknown;
  conn?: string;
  runtimes?: Runtime[] | null;
  pools?: Parameters<typeof currentPools>[0];
  loaded?: boolean;
}
