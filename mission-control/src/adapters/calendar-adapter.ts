import type { CalEvent } from "../domain/meeting";
import { parseIcs } from "../ics/parse-ics";
import { ownerEmailFromUrl } from "../ics/owner-email";
import type { Snapshot, SourceAdapter } from "./types";

export interface CalendarAdapterDeps {
  fetchText?: (url: string) => Promise<string>; // injectable for tests
  now?: () => number;                            // injectable clock
  windowMs?: number;
  pollMs?: number;
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export class CalendarAdapter implements SourceAdapter<CalEvent[]> {
  private snapshot: Snapshot<CalEvent[]> = { status: "unavailable", value: null, fetchedAt: 0, stale: false };
  private listeners: Array<(s: Snapshot<CalEvent[]>) => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;

  private readonly fetchText: (url: string) => Promise<string>;
  private readonly now: () => number;
  private readonly windowMs: number;
  private readonly pollMs: number;
  private readonly ownerEmail?: string;

  constructor(private readonly url: string, deps: CalendarAdapterDeps = {}) {
    this.fetchText = deps.fetchText ?? defaultFetchText;
    this.now = deps.now ?? (() => Date.now());
    this.windowMs = deps.windowMs ?? 36 * 60 * 60 * 1000; // look 36h ahead
    this.pollMs = deps.pollMs ?? 60 * 1000;               // re-fetch the feed every 60s for timely updates
    this.ownerEmail = ownerEmailFromUrl(url);
  }

  start(): void {
    if (this.timer) return;
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.pollMs);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  latest(): Snapshot<CalEvent[]> {
    return this.snapshot;
  }
  onChange(cb: (s: Snapshot<CalEvent[]>) => void): void {
    this.listeners.push(cb);
  }

  /** Exposed for tests and the initial synchronous read. */
  async pollOnce(): Promise<void> {
    const now = this.now();
    if (!this.url || this.url.trim() === "") {
      this.set({ status: "no-config", value: null, fetchedAt: now, stale: false });
      return;
    }
    try {
      const text = await this.fetchText(this.url);
      const events = parseIcs(text, now, this.windowMs, this.ownerEmail);
      this.consecutiveFailures = 0;
      this.set({ status: "ok", value: events, fetchedAt: now, stale: false });
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 3) {
        // Spec §10: after 3+ consecutive failures, enter fault state — value null
        // so the action's `unavailable && value === null` branch shows NO LINK.
        this.set({ status: "unavailable", value: null, fetchedAt: now, stale: false });
      } else {
        // Still within grace period — return cached value flagged stale.
        this.set({
          status: "unavailable",
          value: this.snapshot.value,
          fetchedAt: now,
          stale: this.snapshot.value !== null,
        });
      }
    }
  }

  private set(s: Snapshot<CalEvent[]>): void {
    this.snapshot = s;
    for (const cb of this.listeners) cb(s);
  }
}
