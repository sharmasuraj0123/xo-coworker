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
