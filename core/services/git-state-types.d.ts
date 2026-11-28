import type { BranchReceipt } from "../platform/record-response-types.d.ts";

export type BranchGit = Pick<BranchReceipt, "commits" | "merged" | "unpushed" | "upstream" | "pr" | "tree">;
