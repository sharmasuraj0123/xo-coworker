// @ts-check

/** @param {{homeParts: () => {next?: {key: string} | null}, heraldShow: (notice: {kind: "calm", text: string}, ms: number) => void, decideKey: (key: string) => void}} options */
export function createOpenNext({ homeParts, heraldShow, decideKey }) {
  return function openNext() {
    const P0 = homeParts();
    if (!P0.next) { heraldShow({ kind: "calm", text: "Nothing needs you right now" }, 2400); return; }
    decideKey(P0.next.key);
  };
}
