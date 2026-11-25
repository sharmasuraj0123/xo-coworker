// @ts-check

import { PHONE_MAX_WIDTH } from "../../core/platform/viewport.js";
import { closingParen, valueTokens } from "./css-values.mjs";

const TOKEN_FILE = new Set(["core/ui/tokens.css", "css/flavours.css"]);
const PHONE_QUERIES = new Set([`max-width:${PHONE_MAX_WIDTH}px`, `min-width:${PHONE_MAX_WIDTH + 1}px`]);
const COLOR_FN = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk|light-dark)$/i;
const HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const PX = /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)px$/i;
const NAMED_COLORS = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
  mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab
  orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhipp peachpuff
  peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue
  tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen
`.trim().split(/\s+/));

/** @param {string} prop */
function lengthClass(prop) {
  if (/^(?:margin|padding|gap|row-gap|column-gap|inset)(?:-|$)/i.test(prop)) return "spacing";
  if (/radius/i.test(prop)) return "radius";
  if (/^(?:font|line-height|letter-spacing|word-spacing|text-indent)/i.test(prop)) return "typography";
  if (/^(?:box-shadow|text-shadow|filter|backdrop-filter)$/i.test(prop)) return "effect";
  if (/^(?:border|outline|stroke-width)/i.test(prop)) return "stroke";
  if (/^(?:top|right|bottom|left|translate|transform|offset)/i.test(prop)) return "position";
  return "size";
}

/** @param {string} prop */
function acceptsNamedColors(prop) {
  return prop.startsWith("--") || /color|background|border|outline|shadow|decoration|^(?:fill|stroke|filter|caret|mask)$/i.test(prop);
}

/** @param {string} file @param {object} tree @param {Function} report */
export function cssRules(file, tree, report, migrated = new Set()) {
  const tokenFile = TOKEN_FILE.has(file);
  tree.walkDecls((decl) => {
    const line = decl.source.start.line;
    if (decl.important) report("important", line);
    if (tokenFile || migrated.has(decl)) return;
    const tokens = valueTokens(decl.value);
    for (let index = 0; index < tokens.length; index++) {
      const { text } = tokens[index];
      const lower = text.toLowerCase();
      const isFunction = tokens[index + 1]?.text === "(";
      if (lower === "url" && isFunction) {
        const end = closingParen(tokens, index + 1);
        if (end !== -1) index = end;
        continue;
      }
      if (HEX.test(text) || (isFunction && COLOR_FN.test(text))
          || (!isFunction && NAMED_COLORS.has(lower) && acceptsNamedColors(decl.prop))) {
        report("rawColor", line);
      }
      const dimension = PX.exec(text);
      if (dimension && ![0, 1].includes(Number(dimension[1]))) report(`px-${lengthClass(decl.prop)}`, line);
    }
  });
  tree.walkRules((rule) => {
    if (tokenFile || migrated.has(rule)) return;
    const tokens = valueTokens(rule.selector).filter(({ text }) => text.trim() && !text.startsWith("/*"));
    for (let index = 1; index < tokens.length; index++) {
      if (tokens[index - 1].text === "[" && tokens[index].text.toLowerCase() === "data-theme") {
        report("themeSelector", rule.source.start.line + rule.selector.slice(0, tokens[index].offset).split("\n").length - 1);
      }
    }
  });
  tree.walkAtRules("media", (rule) => {
    for (const [feature] of rule.params.matchAll(/\([^()]*\b(?:min-|max-)?width\b[^()]*\)/gi)) {
      if (!PHONE_QUERIES.has(feature.slice(1, -1).replace(/\s/g, "").toLowerCase())) {
        report("widthMediaQuery", rule.source.start.line);
      }
    }
  });
}
