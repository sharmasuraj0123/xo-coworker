export interface PingNeed { key: string; group: string; ask: { stopByYou?: boolean }; t: { id: string; project: string } }

export interface DecisionPingDeps<N extends PingNeed> {
  S: { view: string; seen?: Set<string> | null };
  P: { mayPing: (need: N) => boolean };
  PROJ(project: string): string;
  askShort(need: N): string;
  heraldShow(notice: { kind: "ping"; text: string; sub: string; decide: string }, ms: number): void;
}
