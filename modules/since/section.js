// @ts-check

// Since you left on Home: one quiet line per project that moved while you were away.

/** @param {{ homeSinceLines: (needs: any[]) => string }} rec @returns {{ id: string, order: number, mount: (el: HTMLElement) => void, render: (el: HTMLElement, c: { needs: any[], patch: (el: HTMLElement, html: string) => boolean }) => void }} */
export const sinceSection = (rec) => ({ id: "hm-since", order: 10, mount() {}, render: (el, c) => { c.patch(el, rec.homeSinceLines(c.needs)); } });
