// @ts-check

/** "+5 −8", tabular, green and red; nothing for a side with none. n: {additions, deletions} or {add, del}. @param {{ additions?: number | null, deletions?: number | null, add?: number | null, del?: number | null } | null | undefined} n */
export function countsHtml(n) {
  if (!n) return "";
  const a = n.additions ?? n.add, d = n.deletions ?? n.del;
  if (a == null && d == null) return "";
  if (!a && !d) return ""; // a pure rename, a mode change: its row says what happened
  return `<span class="xd-n" aria-label="${a || 0} added, ${d || 0} removed">${a ? `<b class="xd-a">+${a}</b>` : ""}${d ? `<b class="xd-d">−${d}</b>` : ""}</span>`;
}
