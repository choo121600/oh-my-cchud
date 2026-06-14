// Theme = semantic color roles + a glyph set. Segments never hardcode colors or
// icons; they pull from the resolved theme so users can swap the whole look via
// one `theme` config key. Colors are shared across themes; glyph sets differ so
// you can pick Unicode / Nerd Font / pure-ASCII to match your terminal + font.

import { c } from "./ansi";

type ColorFn = (s: string | number) => string;

export type GlyphKey =
  | "branch"
  | "dirty"
  | "barFull"
  | "barEmpty"
  | "todo"
  | "activeTool"
  | "agent"
  | "worktree"
  | "effort"
  | "thinking"
  | "pr";

export interface Theme {
  accent: ColorFn; // primary (model, headings)
  muted: ColorFn; // secondary (durations, recent tools)
  ok: ColorFn;
  warn: ColorFn;
  crit: ColorFn;
  // pick ok/warn/crit by `value` against thresholds (higher = worse)
  scale: (value: number, warn: number, crit: number) => ColorFn;
  glyphs: Record<GlyphKey, string>;
}

const accent: ColorFn = (s) => c.bold(c.cyan(s));
const roles = {
  accent,
  muted: c.gray,
  ok: c.brightGreen,
  warn: c.brightYellow,
  crit: c.brightRed,
};

const scale = (v: number, warn: number, crit: number): ColorFn =>
  v >= crit ? roles.crit : v >= warn ? roles.warn : roles.ok;

const THEMES: Record<string, Theme> = {
  // Standard Unicode — renders without a Nerd Font. Safe default.
  default: {
    ...roles,
    scale,
    glyphs: {
      branch: "⎇",
      dirty: "*",
      barFull: "█",
      barEmpty: "░",
      todo: "☑",
      activeTool: "●",
      agent: "⟳",
      worktree: "⌥",
      effort: "✱",
      thinking: "✻",
      pr: "⇡",
    },
  },
  // Nerd Font glyphs — requires a patched font (https://www.nerdfonts.com).
  nerd: {
    ...roles,
    scale,
    glyphs: {
      branch: "",
      dirty: "",
      barFull: "█",
      barEmpty: "░",
      todo: "",
      activeTool: "",
      agent: "",
      worktree: "",
      effort: "",
      thinking: "",
      pr: "",
    },
  },
  // Pure ASCII — for minimal terminals or when Unicode glyphs render as tofu.
  ascii: {
    ...roles,
    scale,
    glyphs: {
      branch: "git:",
      dirty: "*",
      barFull: "#",
      barEmpty: "-",
      todo: "[x]",
      activeTool: ">",
      agent: "@",
      worktree: "wt:",
      effort: "eff:",
      thinking: "~",
      pr: "PR",
    },
  },
};

export function resolveTheme(name: string | undefined): Theme {
  return (name && THEMES[name]) || THEMES.default;
}

export const THEME_NAMES = Object.keys(THEMES);
