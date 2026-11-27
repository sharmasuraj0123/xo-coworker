import type { RuntimeUsage } from "../../core/platform/usage-types.d.ts";

export interface UsagePart {
  name: string;
  usage: RuntimeUsage;
}

export interface UsageState {
  days: number;
  parts: UsagePart[] | null;
  failed: { name: string; message: string }[];
}

export interface UsageHost {
  paint(id: string, html: string): void;
}

export interface UsageSource {
  runtimes(signal: AbortSignal): Promise<string[]>;
  usage(name: string, days: number, signal: AbortSignal): Promise<RuntimeUsage>;
}
