Mermaid 12.3.0 (MIT, see LICENSE): dist/mermaid.esm.min.mjs and its chunks/mermaid.esm.min/*.mjs, without source
maps. The entry imports only what every diagram needs; each diagram type's chunk is fetched when a diagram of that
type is first drawn. Loaded on demand by js/rich.js, never at startup.
