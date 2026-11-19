// @ts-check

// Recently made on Home: the strip of what threads made last.

/** @param {{ homeMade: (box: HTMLElement) => void }} rec @returns {{ id: string, order: number, mount: (el: HTMLElement) => void, render: (el: HTMLElement, c: { needs: any[], patch: (el: HTMLElement, html: string) => boolean }) => void }} */
export const madeSection = (rec) => ({ id: "hm-made", order: 20, mount() {}, render: (el) => rec.homeMade(el) });
