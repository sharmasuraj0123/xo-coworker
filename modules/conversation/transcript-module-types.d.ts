declare module "../../core/kernel/types" {
  interface Services { transcript: ReturnType<typeof import("./draw.js").createConversationDrawing> }
}
export {};
