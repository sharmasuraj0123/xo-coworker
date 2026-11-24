// @ts-check

/** @param {{ row: string | null; backFrom: string | null; composer: HTMLElement | null; region: HTMLElement }} destination */
export function focusDestination({ row, backFrom, composer, region }) {
  const item = row && document.querySelector(`#msgs > [data-k="${CSS.escape(row)}"]`);
  const opener = item && backFrom && (
    item.querySelector(`[data-go="${CSS.escape(backFrom)}"]`) || item.querySelector("[data-go]")
  );
  if (composer) composer.focus({ preventScroll: true });
  else if (opener instanceof HTMLElement) {
    opener.focus({ preventScroll: true });
    return opener;
  } else if (!document.getElementById("panel")?.contains(document.activeElement)) {
    region.focus({ preventScroll: true });
  }
  return null;
}
