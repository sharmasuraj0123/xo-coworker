// @ts-check
import { sharedFileRoute } from "./world/relay.js";

/** @param {{ currentView(): string, convThread(view: string): Parameters<typeof sharedFileRoute>[0] }} options */
export function createFileRoute({ currentView, convThread }) {
  /** @param {string | null | undefined} path */
  function fileRoute(path, conv = currentView()) {
    const t = convThread(conv);
    const pid = !t && conv.startsWith("p:") ? conv.slice(2) : null;
    const rel = String(path || "").replace(/^\.\//, "");
    return pid && rel && !rel.startsWith("/") && !rel.split("/").some((x) => x === ".." || x === "")
      ? { project: pid, rel } : sharedFileRoute(t, path);
  }
  return fileRoute;
}
