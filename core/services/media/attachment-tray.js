// @ts-check

import { picDims } from "../world/rows.js";
import { MAX_FILES, sortFiles, pasteName } from "./attachment-rules.js";

/** @typedef {{id: string, name?: string, type: string, bytes: number, w?: number, h?: number, tint?: string}} UploadResult */

/** @typedef {{promise: Promise<UploadResult>, abort: () => void}} UploadJob */

/** @typedef {{lid: string, name: string, size: number, blob: Blob, state: "uploading" | "done" | "failed", paste?: string, chat?: string, id?: string | null, type?: string, bytes?: number, sent?: number, err?: unknown, job?: UploadJob | null, done?: Promise<Chip>}} Chip */

/** @param {{upload: (chat: string, blob: Blob, name: string, options: {onProgress?: (sent: number) => void}) => UploadJob, onChange?: () => void}} deps */
export function createTray({ upload, onChange = () => {} }) {
  /** @type {Map<string, Chip[]>} */
  const trays = new Map(); // conv → [chip]
  let n = 0, pastes = 0;
  const list = (/** @type {string} */ conv) => trays.get(conv) || [];
  const find = (/** @type {string} */ conv, /** @type {string} */ lid) => list(conv).find((c) => c.lid === lid) || null;

  /** @param {Chip} c @param {string} chat */
  function start(c, chat) {
    c.chat = chat; c.state = "uploading"; c.sent = 0; c.err = null; c.id = null;
    const job = upload(chat, c.blob, c.name, { onProgress: (sent) => { c.sent = sent; onChange(); } });
    c.job = job;
    const mine = job.promise.then((a) => {
      if (c.job !== job) return c;
      // a new upload's picture comes back with its size and tint, so the sent message reserves its box at once
      Object.assign(c, { id: a.id, name: a.name || c.name, type: a.type, bytes: a.bytes, ...picDims(a), state: "done", sent: c.size, job: null });
      onChange();
      return c;
    }, (err) => {
      if (c.job !== job) return c;
      c.job = null;
      if (err && err.name === "AbortError") return c;
      c.state = "failed"; c.err = err;
      onChange();
      return c;
    });
    c.done = mine;
    onChange();
    return mine;
  }

  /** @param {string} conv @param {Chip} c */
  function put(conv, c) {
    const l = list(conv);
    l.push(c);
    trays.set(conv, l);
  }

  return {
    list,
    /** Add files picked, dropped or pasted. Returns the refused ones ({name, why}) to say so. @param {string} conv @param {string} chat @param {Iterable<File>} files */
    add(conv, chat, files) {
      const { take, refused } = sortFiles(files, list(conv).length);
      for (const f of take) {
        /** @type {Chip} */
        const c = { lid: `a${++n}`, name: f.name || "file", size: f.size, blob: f, state: "uploading" };
        put(conv, c);
        start(c, chat);
      }
      return refused;
    },
    /** A large paste as a file of its own. Returns false when the message already holds MAX_FILES. @param {string} conv @param {string} chat @param {string} text */
    addPaste(conv, chat, text) {
      if (list(conv).length >= MAX_FILES) return false;
      const name = pasteName(text, ++pastes);
      const blob = new Blob([text], { type: /\.md$/.test(name) ? "text/markdown" : "text/plain" });
      /** @type {Chip} */
      const c = { lid: `a${++n}`, name, size: blob.size, blob, paste: text, state: "uploading" };
      put(conv, c);
      start(c, chat);
      return true;
    },
    /** Put sent-but-failed files back on the composer (Edit on a failed message). @param {string} conv @param {Chip[]} chips */
    restore(conv, chips) {
      for (const c of chips) put(conv, { ...c, lid: `a${++n}`, job: null });
      onChange();
    },
    /** @param {string} conv @param {string} lid */
    remove(conv, lid) {
      const l = list(conv), i = l.findIndex((c) => c.lid === lid);
      if (i < 0) return null;
      const [c] = l.splice(i, 1);
      if (c.job) { const j = c.job; c.job = null; j.abort(); }
      onChange();
      return c;
    },
    /** @param {string} conv @param {string} lid */
    retry(conv, lid) {
      const c = find(conv, lid);
      if (c && c.state === "failed") start(c, /** @type {string} */ (c.chat));
    },
    /** {count, busy, failed}: Send waits while busy and stays off while one has failed. @param {string} conv */
    status(conv) {
      const l = list(conv);
      return { count: l.length, busy: l.some((c) => c.state === "uploading"), failed: l.some((c) => c.state === "failed") };
    },
    /** Take the conversation's files off the composer for a message (each a plain copy). @param {string} conv */
    take(conv) {
      const l = list(conv);
      trays.delete(conv);
      onChange();
      return l.map(({ job, done, ...c }) => c);
    },
    /** @param {Chip[]} chips @param {string | null | undefined} chat */
    async ensure(chips, chat, { again = false } = {}) {
      const ids = [];
      for (const c of chips) {
        if (again || c.chat !== chat || !c.id) {
          if (!chat) throw new Error("No chat is available for these attachments");
          const job = upload(chat, c.blob, c.name, {});
          const a = await job.promise;
          Object.assign(c, { id: a.id, chat, name: a.name || c.name, type: a.type, bytes: a.bytes, ...picDims(a), state: "done" });
          ids.push(a.id);
        } else {
          ids.push(c.id);
        }
      }
      return ids;
    },
  };
}
