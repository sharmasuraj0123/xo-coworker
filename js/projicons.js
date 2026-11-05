// A project's icon, from what the project is about (thread-28ea9d). Instant and offline: no model, no
// network. It scores a small keyword table against the project's name (weighted) and its thread titles,
// and picks a Lucide glyph (js/vendor/lucide/projects.js, 32 glyphs, ~8 KB). A project it can't place
// keeps the cube. The same inputs always give the same icon.
import { LUCIDE_PROJECTS } from "./vendor/lucide/projects.js";

// Order is the tie-break: earlier wins. Each keyword is a whole word; in a project's name, a keyword of
// 4+ letters also counts inside a run-together word ("agentadvisory" → agent, advisory).
const CLASSES = [
  ["rocket", "deploy deployment deploys release releases ship shipping rollout launchpad hosting ci cd"],
  ["telescope", "research researching study studies investigation investigate explore exploration survey literature findings"],
  ["cpu", "firmware hardware chip chips embedded device devices iot robot robotics sensor sensors kernel computer computers silicon"],
  ["network", "swarm swarms hub cluster mesh distributed orchestration orchestrator fleet federation"],
  ["bot", "agent agents agentic assistant assistants bot bots advisor advisory copilot llm llms gpt claude codex prompt prompts ai"],
  ["users", "human humans people team teams hiring recruiting hr community customers interaction interactions persona personas"],
  ["presentation", "pitch pitcher pitches deck decks slides investor investors fundraising fundraise keynote"],
  ["megaphone", "marketing campaign campaigns growth seo ads advertising newsletter gtm go-to-market brand-awareness social"],
  ["panels-top-left", "ui ux interface interfaces sidebar panel panels layout dashboard frontend dropdown dropdowns screen screens titlebar polish pixel"],
  ["palette", "design designs brand branding logo illustration typography figma mockup mockups visual visuals art"],
  ["server", "backend server servers api apis database databases infra infrastructure kubernetes docker cloud storage architecture runtime runtimes storm"],
  ["notebook-pen", "writing write blog essay essays docs documentation copywriting book books notes article articles script screenplay"],
  ["chart-line", "data analytics metrics report reports kpi kpis forecast forecasting statistics benchmark benchmarks"],
  ["wallet", "finance financial money budget budgets invoice invoices accounting payments payment pricing tax taxes cost costs spend revenue"],
  ["scale", "legal contract contracts policy policies compliance terms law gdpr countersign license licensing"],
  ["shield", "security secure auth authentication privacy risk risks audit threat threats vulnerability redteam"],
  ["globe", "web website websites site domain domains browser vercel landing seo-site"],
  ["smartphone", "mobile ios android phone iphone"],
  ["messages-square", "chat chats messaging message messages inbox slack email support"],
  ["image", "image images photo photos gallery media picture pictures"],
  ["clapperboard", "video videos film movie youtube animation"],
  ["music", "music song songs audio podcast"],
  ["gamepad-2", "game games gaming"],
  ["graduation-cap", "course courses learn learning education school tutorial teaching"],
  ["heart-pulse", "health medical fitness clinic wellness"],
  ["shopping-bag", "shop store ecommerce commerce checkout catalog retail"],
  ["plane", "travel trip trips flight flights hotel hotels"],
  ["orbit", "space orbit satellite astro astronomy rocketry"],
  ["code-xml", "code coding cli sdk library refactor bug bugs engine compiler"],
  ["workflow", "automation automate workflow workflows jobs schedule cron pipeline pipelines"],
  ["briefcase", "work coworker workspace office business company startup"],
].map(([icon, words], order) => ({ icon, order, words: new Set(words.split(/\s+/)) }));

const NAME_W = 4;                         // a word in the name counts four times a word in a title
const NOISE = new Set(["xo", "the", "and", "for", "with", "new"]);
const words = (s) => String(s || "")
  .replace(/&amp;/g, "&").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  .split(/[^a-z0-9]+/).filter((w) => w && !NOISE.has(w));

/** Classify a project: { icon, scores } (icon is a Lucide name; "box" when nothing matched). */
export function classify(name, titles = []) {
  const score = new Map();
  const nameScore = new Map();
  const add = (c, n) => score.set(c, (score.get(c) || 0) + n);
  const nameWords = words(name);
  for (const c of CLASSES) {
    for (const w of nameWords) {
      if (c.words.has(w)) add(c, NAME_W);
      else for (const k of c.words) if (k.length >= 4 && w !== k && w.includes(k)) { add(c, NAME_W); break; }
    }
    if (score.get(c)) nameScore.set(c, score.get(c));
  }
  for (const t of titles) {
    const seen = new Set(words(t));
    for (const c of CLASSES) for (const w of seen) if (c.words.has(w)) add(c, 1);
  }
  // the name decides when it can (so an icon doesn't drift as threads come and go); titles break its
  // ties, and place a project whose name says nothing
  const named = new Set([...score.keys()].filter((c) => nameScore.get(c)));
  let best = null;
  for (const [c, n] of score) {
    if (named.size && !named.has(c)) continue;
    if (!best || n > best[1] || (n === best[1] && c.order < best[0].order)) best = [c, n];
  }
  return { icon: best ? best[0].icon : "box", scores: Object.fromEntries([...score].map(([c, n]) => [c.icon, n])) };
}

/** The glyph as an <svg>, drawn like the sidebar's own icons (24 grid, 1.6 stroke, round ends). */
export function glyph(icon) {
  const d = LUCIDE_PROJECTS[icon] || LUCIDE_PROJECTS.box;
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
