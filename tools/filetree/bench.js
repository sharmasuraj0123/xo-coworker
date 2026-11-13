import { createFiles } from "../../js/files.js";
const world = { state: { turns: [], threads: [], projects: [{ id: "proj", name: "proj" }] }, thread: () => null };
const viewer = { hasFile: false, file: null, open(f) { this.hasFile = true; this.file = f; }, close() { this.hasFile = false; this.file = null; }, leave(cb) { cb(); } };
const files = createFiles({ world, viewer, isBusy: () => false, PROJ: (id) => id, go: () => {}, changes: null });
window.B = { files, viewer };
window.B.mountOurs = () => { files.mount(document.querySelector("#ours .fv-b")); files.show("p:proj"); };
window.B.ready = true;
