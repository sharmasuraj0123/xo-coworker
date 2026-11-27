// @ts-check

export type UsageTokens = {input: number; output: number; cache_read: number; cache_write: number; reasoning?: number};
export type UsageDay = {date: string; tokens: number; cost?: number; total_tokens?: UsageTokens};
export type UsageModel = {model_id: string; total_tokens: UsageTokens; total_cost?: number; message_count?: number};
export type RuntimeUsage = {
  total_cost: number;
  total_tokens: UsageTokens;
  daily: UsageDay[];
  by_model: UsageModel[];
  estimated_tokens?: boolean;
};
