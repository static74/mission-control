import { THEME } from "./mission-theme";
import type { CountdownState } from "../domain/countdown-state";

export interface CountdownView {
  state: CountdownState;
  title: string;             // meeting title; "" when none
  big: string;               // main readout: "T- 1:24" | "04:59" | "NOW" | "CLEAR" | "SET URL"
  pulsePhase?: 0 | 1;        // terminal alternation; toggled by the action each redraw
  ringFraction?: number;     // 0..1 cruise orbit-ring depletion (1 = far away)
}

const SIZE = 144;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

export function renderCountdown(v: CountdownView): string {
  const titleSize = v.state === "terminal" ? 14 : 18;
  const bigSize = v.big.length > 5 ? 30 : 40;
  const parts: string[] = [`<rect width="${SIZE}" height="${SIZE}" fill="${background(v)}"/>`];
  if (v.state === "cruise" && v.ringFraction !== undefined) parts.push(orbitRing(v.ringFraction));
  if (v.state === "terminal") parts.push(hazardChevrons());
  if (v.title) {
    parts.push(
      `<text x="${SIZE / 2}" y="32" fill="${THEME.white}" font-family="${THEME.font}"
        font-size="${titleSize}" text-anchor="middle" opacity="0.85">${esc(v.title.slice(0, 14))}</text>`,
    );
  }
  parts.push(
    `<text x="${SIZE / 2}" y="${SIZE / 2 + 14}" fill="${bigColor(v)}" font-family="${THEME.font}"
      font-size="${bigSize}" font-weight="700" text-anchor="middle">${esc(v.big)}</text>`,
  );
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

/** SVG -> data URI for setImage(). */
export function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
