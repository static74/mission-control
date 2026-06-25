import { THEME } from "./mission-theme";
import type { CountdownState } from "../domain/countdown-state";

export interface CountdownView {
  state: CountdownState;
  title: string;             // meeting title; "" when none
  big: string;               // main readout: "T- 1:24" | "04:59" | "+02:30" | "CLEAR" | "SET URL"
  pulsePhase?: 0 | 1;        // terminal alternation; toggled by the action each redraw
  ringFraction?: number;     // 0..1 cruise orbit-ring depletion (1 = far away)
  glow?: string | null;      // meeting-mode edge glow color; null/undefined = no glow
}

const SIZE = 144;
const TITLE_SIZE = 22;       // readable on the physical key (downscaled to ~72px)
const TITLE_MAX_CHARS = 11;  // code points that fit one line at TITLE_SIZE in the mono font
const TITLE_MAX_LINES = 2;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Code-point-aware length/slice so a multi-unit glyph (e.g. an emoji in a calendar
// title) is counted as one character and never split mid-surrogate.
function cpLen(s: string): number {
  return Array.from(s).length;
}
function cpSlice(s: string, n: number): string {
  return Array.from(s).slice(0, n).join("");
}

/**
 * Greedy word-wrap a title into at most `maxLines` lines of at most `maxChars`
 * code points each. A word wider than a line is hard-broken. If the title needs
 * more than `maxLines` lines, the last kept line ends in an ellipsis so the
 * truncation is visible.
 */
export function wrapTitle(title: string, maxChars: number, maxLines: number): string[] {
  const queue = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  while (queue.length > 0) {
    const word = queue.shift() as string;
    if (cpLen(word) > maxChars) {
      // hard-break an over-long word, then reprocess the remainder
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(cpSlice(word, maxChars));
      const rest = Array.from(word).slice(maxChars).join("");
      if (rest) queue.unshift(rest);
      continue;
    }
    if (current === "") {
      current = word;
    } else if (cpLen(current) + 1 + cpLen(word) <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const lastIdx = maxLines - 1;
  const last = kept[lastIdx];
  kept[lastIdx] = (cpLen(last) >= maxChars ? cpSlice(last, maxChars - 1) : last) + "…";
  return kept;
}

function background(v: CountdownView): string {
  if (v.state === "terminal") return v.pulsePhase === 1 ? THEME.red : THEME.amber;
  if (v.state === "liftoff") return THEME.red;
  return THEME.space;
}
function bigColor(v: CountdownView): string {
  if (v.state === "terminal") return THEME.space;
  if (v.state === "liftoff") return THEME.white;
  if (v.state === "idle") return THEME.dim;
  return THEME.ice;
}
function hazardChevrons(): string {
  const stripe = (y: number) =>
    `<rect x="0" y="${y}" width="${SIZE}" height="10" fill="${THEME.space}" opacity="0.55"/>`;
  return stripe(0) + stripe(SIZE - 10);
}
function orbitRing(fraction: number): string {
  const r = 64, c = SIZE / 2, circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, fraction)) * circ;
  return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${THEME.ice}" stroke-width="3"
      opacity="0.45" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 ${c} ${c})"/>`;
}

/**
 * Faux inner-edge glow: a few inset rounded strokes, brightest at the edge and fading
 * inward. Deliberately filter-free — feGaussianBlur support in the Stream Deck SVG
 * renderer is unverified, but layered strokes render everywhere. Tune insets/opacity
 * on the device if the falloff reads poorly.
 */
function glowFrame(color: string): string {
  const layers = [
    { inset: 2, width: 4, opacity: 0.95 },
    { inset: 6, width: 4, opacity: 0.5 },
    { inset: 11, width: 5, opacity: 0.22 },
  ];
  return layers
    .map(({ inset, width, opacity }) => {
      const size = SIZE - 2 * inset;
      return `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="10" ry="10"
        fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
    })
    .join("");
}

/** Render the title as one or two centered lines at the top of the key. */
function titleBlock(title: string): string {
  const lines = wrapTitle(title, TITLE_MAX_CHARS, TITLE_MAX_LINES);
  // One line sits a touch lower; two lines straddle the top zone above the readout.
  const ys = lines.length === 1 ? [36] : [26, 50];
  return lines
    .map(
      (line, i) =>
        `<text x="${SIZE / 2}" y="${ys[i]}" fill="${THEME.white}" font-family="${THEME.font}"
        font-size="${TITLE_SIZE}" text-anchor="middle" opacity="0.9">${esc(line)}</text>`,
    )
    .join("");
}

export function renderCountdown(v: CountdownView): string {
  const bigSize = v.big.length > 5 ? 30 : 40;
  const parts: string[] = [`<rect width="${SIZE}" height="${SIZE}" fill="${background(v)}"/>`];
  if (v.state === "cruise" && v.ringFraction !== undefined) parts.push(orbitRing(v.ringFraction));
  if (v.state === "terminal") parts.push(hazardChevrons());
  if (v.title) parts.push(titleBlock(v.title));
  parts.push(
    `<text x="${SIZE / 2}" y="${SIZE / 2 + 14}" fill="${bigColor(v)}" font-family="${THEME.font}"
      font-size="${bigSize}" font-weight="700" text-anchor="middle">${esc(v.big)}</text>`,
  );
  if (v.glow) parts.push(glowFrame(v.glow));
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

/** SVG -> data URI for setImage(). */
export function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
