export interface AdvisoryFact<T> {
  value: T | null;
  known: boolean;
  source?: string;
  observed_at?: string | null;
  age_s?: number | null;
}

export interface AccountWindow {
  utilization?: AdvisoryFact<number>;
  resets_at?: AdvisoryFact<string>;
  status?: AdvisoryFact<string>;
}

export interface AccountFacts {
  agent: string;
  account?: string | null;
  plan?: AdvisoryFact<string>;
  windows?: Record<string, AccountWindow>;
  paid?: {
    possible?: AdvisoryFact<boolean>;
    in_use?: AdvisoryFact<boolean>;
    credits?: AdvisoryFact<number>;
    status?: AdvisoryFact<string>;
    disabled_reason?: AdvisoryFact<string>;
  };
}

export interface Advisory {
  accounts: AccountFacts[];
  version?: number;
  as_of?: string;
  served_at?: string;
}

export interface Intent {
  scope: string;
  scope_id: string;
  key: string;
  value: string;
  until?: string | null;
  cites?: string | null;
  set_at?: string;
}

export interface PaidPool {
  pool: string;
  agent?: string;
  mode: string;
  source?: string;
  state: string;
  reason?: string | null;
  resets_at?: string | null;
}

export interface AccountIntents {
  intents: Intent[];
  pools: PaidPool[];
}

export interface PaidReceipt {
  intent: Intent | null;
  halted: { session_id: string; turn_id: string | null; interrupted: boolean; released: boolean; ms: number }[];
}
