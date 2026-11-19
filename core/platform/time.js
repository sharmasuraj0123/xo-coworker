// @ts-check

// Time words. Formatters are made once: toLocale*String with options builds a new one per call.

/** Parse an ISO time ("…Z") into epoch ms, or NaN. @param {string | null | undefined} iso */
export function toMs(iso) {
  if (!iso) return NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}
