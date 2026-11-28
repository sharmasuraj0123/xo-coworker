export type EdgeName = "files" | "decisions";
export interface EdgeCard { isOpen(): boolean; park(): void; unpark(): void }
declare module "../core/kernel/types" {
  interface Services { edgeCards: { register(name: EdgeName, card: EdgeCard): () => void } }
  interface Topics { "app:card-opened": EdgeName; "app:card-closed": EdgeName }
}
