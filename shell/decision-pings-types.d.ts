export interface PingNeed { key: string; group: string; t: { id: string; project: string } }

export interface DecisionPingDeps<N extends PingNeed> {
  view(): string;
  P: { mayPing: (need: N) => boolean };
  PROJ(project: string): string;
  askShort(need: N): string;
  heraldShow(notice: { kind: "ping"; text: string; sub: string; decide: string }, ms: number): void;
}
