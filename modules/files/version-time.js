// @ts-check

/** When, in a few words ("just now", "4 min ago", "10:42"). Pure. @param {string | null | undefined} at */
export function whenWords(at, now = Date.now()) {
  const t = Date.parse(at || "");
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  const d = new Date(t);
  const same = new Date(now).toDateString() === d.toDateString();
  return same ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}
