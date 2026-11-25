export interface DecisionPresentation {
  pings(needs: import("./controller-types.d.ts").DecisionNeed[]): void;
  D: ReturnType<typeof import("./controller.js").createDecisions>;
  Kit: typeof import("./kit.js");
  evidenceFor: typeof import("./rank.js").evidenceFor;
  EFFORT: typeof import("./rank.js").EFFORT;
  askTitle: typeof import("./ask-label.js").askTitle;
  askShort: typeof import("./ask-label.js").askShort;
  waitSince: Map<string, number>;
}
declare module "../../core/kernel/types" {
  interface Services { decisionPresentation: DecisionPresentation }
}

type DecisionRenderer = { render(host: HTMLElement, need: import("./controller-types").DecisionNeed): void };

declare module "../../core/kernel/types" {
  interface PlaceEntries {
    "decision.card": DecisionRenderer;
    "decision.detail": DecisionRenderer;
    "decision.evidence": { mount(host: HTMLElement, at: import("../../core/kernel/types").At, evidence: unknown): void | (() => void) };
  }
}
