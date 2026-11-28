/** Resolve aliases to the fixed dark palette used by normal and inverse surfaces. */
export function paletteValue(value, primitives) {
  const alias = /^var\((--dark-[\w-]+)\)$/.exec(value);
  return alias ? primitives.get(alias[1]) ?? value : value;
}
