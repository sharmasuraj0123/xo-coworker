import type { Runtime, RuntimePolicy } from "../../core/services/runtime-types";
import type { accountRows, heldModes } from "../../core/services/world/paid";
import type { receipts } from "./settings";

type AccountSources = Parameters<typeof accountRows>[0];
export interface SettingsState {
  timer: ReturnType<typeof setTimeout> | undefined;
  err: { field: string; text: string } | null;
  saved: ReturnType<typeof receipts>;
  saving: string | null;
  pref: string | null;
  next: RuntimePolicy | null;
}

export interface PaidRow {
  pool: string;
  agent: string;
  name: string;
  plan: string;
  own: string | null;
  mode: string;
  possible: boolean | null;
  credits: number | null;
  inUse: boolean | null;
  why: string;
  state: string | null;
  note: string;
}

export interface SettingsWorld {
  state: {
    runtimes?: Runtime[] | null;
    policy?: { space?: RuntimePolicy | null } | null;
    paid?: Parameters<typeof heldModes>[0];
    advisory: AccountSources["advisory"];
    pools: AccountSources["pools"];
    paidPools: AccountSources["served"];
    paidOk?: boolean;
  };
  act: {
    setPolicy(chat: null, policy: RuntimePolicy): Promise<unknown>;
    setPaid(scope: string, pool: string, value: string | null): Promise<unknown>;
    loadRuntimes(): Promise<unknown>;
    loadPolicies?(): Promise<unknown>;
    loadPaid?(): Promise<unknown>;
  };
  subscribe?(listener: () => void): unknown;
}
