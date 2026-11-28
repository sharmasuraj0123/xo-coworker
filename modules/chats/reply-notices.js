// @ts-check

/** @import { StormEvent } from "../../core/services/storm/types" */

/** @typedef {{ kind: "reply"; text: string; sub: string; open: string }} Reply */

/** @typedef {(reply: Reply, duration: number) => void} Show */

/** @param {string | null | undefined} text */
function excerpt(text) {
  const plain = String(text || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 64 ? plain.slice(0, 63).replace(/\s+\S*$/, "") + "…" : plain;
}

/** @typedef {(value: string) => string} Name */

/** @typedef {(s: string) => void} Say */

/** @param {() => string} currentView @param {Name} projectName @param {Show} show @param {Say} announce @param {() => void} schedule */
export function replyNotices(currentView, projectName, show, announce, schedule) {
  return (/** @type {StormEvent} */ event) => {
    if (event.kind !== "message") return false;
    if (event.answered && event.project) {
      const workspace = event.project === "workspace";
      const open = workspace ? "ws" : "p:" + event.project;
      const text = (workspace ? "The coordinator" : projectName(event.project) + " coordinator") + " replied";
      if (currentView() !== open) show({ kind: "reply", text, sub: excerpt(event.text), open }, 7000);
      announce(text + ": " + event.text);
    }
    schedule();
    return true;
  };
}
