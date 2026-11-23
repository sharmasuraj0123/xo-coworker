// @ts-check

import { xi } from "./icon.js";

/** The app's names for the icons it uses most, each one file of the pack. */
export const ICON = {
  project: xi("project"),
  globe: xi("web"),
  send: xi("send"),
  thread: xi("chat"),
  branch: xi("branch"),
  back: xi("chevron-left"),
  arrow: xi("arrow-right"),
  close: xi("close"),
  search: xi("search"),
  // the tick draws itself in where it lands (.tk, css/app.css): its length is 24 to the animation
  check: xi("check").replace("<path ", '<path class="tk" pathLength="24" '),
  rewind: xi("send-back"),
  reply: xi("reply"),
  copy: xi("copy"),
  retry: xi("retry"),
  edit: xi("edit"),
  chevron: xi("chevron-down"),
  list: xi("list"),
  lock: xi("lock"),
  stop: xi("stop"),
  needs: xi("state-needs-you"),
  doing: xi("step-doing"),
  todo: xi("state-idle"),
  sound: xi("sound"),
  plus: xi("plus"),
  home: xi("home"),
  right: xi("chevron-right"),
  clock: xi("clock"),
  brain: xi("brain"),
  // a refusal or an error said in a line
  warn: xi("warning"),
  menu: xi("menu"),
  eye: xi("eye"),
  clip: xi("attach"),
  doc: xi("doc"),
  image: xi("image"),
  folder: xi("folder"),
  folderOpen: xi("folder-open"),
  moon: xi("moon"),
  spark: xi("suggestion"),
  // act now: interrupt, send now
  bolt: xi("interrupt"),
  // this file runs code (the viewer's badge)
  runsCode: xi("runs-code"),
  gear: xi("gear"),
  sliders: xi("settings-general"),
  pause: xi("pause"),
  hourglass: xi("hourglass"),
  sun: xi("sun"),
  contrast: xi("contrast"),
  rule: xi("rules"),
  key: xi("key"),
  // a thread: one agent's conversation with words in it (Chats keeps the empty bubble, `thread`)
  threadOne: xi("thread"),
  // the panel's Threads frame
  threads: xi("threads"),
  // artifacts: what threads made
  stack: xi("artifacts"),
  pin: xi("pin"),
  shell: xi("terminal"),
  minimize: xi("minimize"),
  // the sidebar (or the file tree) folding to its rail
  sidebar: xi("sidebar-left"),
  panel: xi("panel-right"),
  full: xi("full-size"),
  unfull: xi("exit-full-size"),
  foldRail: xi("fold-to-rail"),
  changes: xi("changes"),
  map: xi("map"),
  graph: xi("graph"),
  follow: xi("follow"),
  toMain: xi("open-in-main"),
  fit: xi("fit"),
  // needs you: the mark the sidebar and the lists use
  diamond: xi("state-needs-you"),
  // more: every ⋯
  more: xi("more"),
  // the stamps a decision lands with (Allowed, Sent back): their mark draws itself in (.sk, css/app.css)
  stampAllow: xi("stamp-allowed", "stamp-svg").replace("<path ", '<path class="sk" pathLength="60" '),
  stampBack: xi("stamp-sent-back", "stamp-svg").replace("<path ", '<path class="sk" pathLength="60" '),
  // where an agent is on the Map: the pack's cursor, framed so its tip sits at (1, 1) of an 18 box
  cursor: xi("agent-cursor", "dg-arrow").replace('viewBox="0 0 24 24"', 'viewBox="4.5 2.5 18 18"'),
  runtime: xi("runtime"),
  router: xi("routing"),
  shape: xi("shape"),
  out: xi("external-link"),
  backTo: xi("arrow-left"),
  fileNew: xi("file-new"),
  link: xi("link"),
  split: xi("split-view"),
  code: xi("code"),
  table: xi("table"),
  undo: xi("undo"),
  download: xi("download"),
  hide: xi("arrow-down"),
  good: xi("thumbs-up"),
  bad: xi("thumbs-down"),
  del: xi("delete"),
  agent: xi("agent"),
  plug: xi("plug"),
  ask: xi("question"),
  dot: xi("step-dot"),
  deploy: xi("deploy"),
  github: xi("github"),
  person: xi("person"),
  container: xi("container"),
  server: xi("server"),
};

export const DOTS = `<i class="dots" aria-hidden="true"><i></i><i></i><i></i></i>`;
/** @param {string} state */
export const stepMark = (state) => (state === "done" ? ICON.check : state === "doing" ? ICON.doing : ICON.todo);

/** The "next" glyph: XO's own chevron, from the mark. */
export const NEXT_GLYPH = xi("next-move", "nx-g");

/** Effort: how much of you an ask takes, Glance, Decide or Think (the pack's three marks). @param {string} effort */
export function dial(effort) {
  const e = { glance: 1, decide: 1, think: 1 }[effort] ? effort : "decide";
  return xi(`effort-${e}`, `dial d-${e}`);
}

/** The XO mark: the X in the theme's ink, the O green (.x, .o: css/app.css). */
export const XO = xi("xo-mark", "xo-mark");
