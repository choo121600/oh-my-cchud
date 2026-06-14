// Compose enabled segments into the final multi-line status string.

import { SEGMENTS } from "./segments";
import type { Ctx } from "./types";

export function render(ctx: Ctx): string {
  const { separator, lines } = ctx.config;
  return lines
    .map((names) =>
      names
        .map((name) => {
          const seg = SEGMENTS[name];
          if (!seg) return null;
          try {
            return seg(ctx);
          } catch {
            return null; // a broken segment must never break the whole line
          }
        })
        .filter((s): s is string => !!s)
        .join(separator),
    )
    .filter((line) => line.length > 0) // drop fully-empty lines
    .join("\n");
}
