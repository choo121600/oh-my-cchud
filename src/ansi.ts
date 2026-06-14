// Minimal ANSI helpers. No deps. Honors NO_COLOR (https://no-color.org).

const ESC = "\x1b";
const enabled = !process.env.NO_COLOR;

const wrap =
  (open: string, close = "0") =>
  (s: string | number) =>
    enabled ? `${ESC}[${open}m${s}${ESC}[${close}m` : String(s);

export const c = {
  reset: `${ESC}[0m`,
  bold: wrap("1", "22"),
  dim: wrap("2", "22"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  gray: wrap("90"),
  brightGreen: wrap("92"),
  brightYellow: wrap("93"),
  brightRed: wrap("91"),
};

// OSC 8 clickable hyperlink (iTerm2, Kitty, WezTerm). BEL (\x07) terminates both
// the URL introducer and the closing sequence — without it the terminal swallows
// the label into the URL and the link never renders.
export function link(label: string, url: string) {
  if (!enabled) return label;
  const BEL = "\x07";
  return `${ESC}]8;;${url}${BEL}${label}${ESC}]8;;${BEL}`;
}
