KaTeX 0.19.1 (MIT, see LICENSE): dist/katex.min.js (UMD, sets window.katex), dist/katex.min.css and the woff2 fonts
only. The stylesheet's woff/ttf fallbacks were taken out of its @font-face rules (every browser XO supports reads
woff2), so nothing asks for files that aren't here. Loaded on demand by js/rich.js, never at startup.
