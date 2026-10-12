import {
  action,
  streamDeck,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type KeyUpEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { getCalendarAdapter } from "../adapters/calendar-registry";
import { DEFAULT_FILTERS, selectNextMeeting, type MeetingFilters } from "../domain/meeting";
import { pickState } from "../domain/countdown-state";
import { parseThresholdSeconds, DEFAULT_THRESHOLD_SECONDS, DEFAULT_THRESHOLD_MMSS } from "../domain/threshold";
import { buildBig, ringFraction } from "../domain/view-model";
import { renderCountdown, toDataUri, type CountdownView } from "../theme/render-countdown";
import { glowColor } from "../theme/glow";
import { inputFor, isLongPress, webhookForTransition } from "../domain/meeting-mode";
import { getShortcutRunner } from "../shortcut/shortcut-runner-registry";
import type { ShortcutRunner } from "../shortcut/shortcut-runner";

interface CountdownSettings {
  [key: string]: JsonValue;
  icalUrl?: string;
  thresholdMmss?: string; // manual MM:SS terminal threshold; parsed defensively
  attendeesOnly?: boolean;
  hasLinkOnly?: boolean;
  hideAllDay?: boolean;
  excludeTitlePattern?: string;
  shortcutName?: string; // macOS Shortcut run on key-up; stdin is "meeting"/"normal"/"reset meeting"/"reset normal"
  meetingOn?: boolean; // app-owned meeting-mode bit, persisted across reloads
  meetingModeWebhook?: string; // HA webhook POSTed when a press enters meeting mode
  noMeetingWebhook?: string; // HA webhook POSTed when a press leaves meeting mode
}

const CRUISE_MS = 60_000;
const TERMINAL_MS = 1_000;

function filtersFrom(s: CountdownSettings): MeetingFilters {
  return {
    attendeesOnly: s.attendeesOnly ?? DEFAULT_FILTERS.attendeesOnly,
    hasLinkOnly: s.hasLinkOnly ?? DEFAULT_FILTERS.hasLinkOnly,
    hideAllDay: s.hideAllDay ?? DEFAULT_FILTERS.hideAllDay,
    excludeTitlePattern: s.excludeTitlePattern ?? DEFAULT_FILTERS.excludeTitlePattern,
  };
}

type Ctx = {
  action: { id: string; setImage(img: string): Promise<void> };
  payload: { settings: CountdownSettings };
};

@action({ UUID: "com.static74.mission-control.meeting-countdown" })
export class MeetingCountdownAction extends SingletonAction<CountdownSettings> {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pulse = new Map<string, 0 | 1>();
  private meetingOn = new Map<string, boolean>(); // app-owned meeting-mode bit
  private pressedAt = new Map<string, number>(); // key-down time; key-up decides short vs long
  private inFlight = new Set<string>(); // a Shortcut run is open (its menu may be on screen)
  private readonly runner: ShortcutRunner = getShortcutRunner();

  override onWillAppear(ev: WillAppearEvent<CountdownSettings>): void {
    // Seed the default terminal threshold so the PI field shows 05:00 instead of blank.
    const s = ev.payload.settings ?? {};
    if (!(s.thresholdMmss ?? "").trim()) {
      void ev.action.setSettings({ ...s, thresholdMmss: DEFAULT_THRESHOLD_MMSS });
    }
    // Restore the persisted meeting-mode bit so the glow survives a plugin reload.
    this.meetingOn.set(ev.action.id, s.meetingOn ?? false);
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  override onWillDisappear(ev: WillDisappearEvent<CountdownSettings>): void {
    const id = ev.action.id;
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    this.pulse.delete(id);
    this.meetingOn.delete(id);
    this.pressedAt.delete(id);
    // inFlight is left alone: the run's own `finally` clears it when the Shortcut exits.
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<CountdownSettings>): void {
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  /** Record the press time; the decision waits for key-up so a long press can be told apart. */
  override onKeyDown(ev: KeyDownEvent<CountdownSettings>): void {
    this.pressedAt.set(ev.action.id, Date.now());
  }

  /**
   * Short press: run the Shortcut toward the other mode, flip the bit on exit 0, notify HA.
   * Long press: ask the Shortcut to forget both Quick Config picks and re-pick the current
   * mode. A long press never flips the bit and never fires a webhook.
   */
  override async onKeyUp(ev: KeyUpEvent<CountdownSettings>): Promise<void> {
    const id = ev.action.id;
    const downAt = this.pressedAt.get(id);
    this.pressedAt.delete(id);
    // ponytail: a key-up with no recorded key-down (plugin reloaded mid-press) is ignored.
    if (downAt === undefined) return;
    if (this.inFlight.has(id)) {
      streamDeck.logger.info("[mc] press ignored: a Shortcut run is already open");
      return;
    }
    const settings = ev.payload.settings ?? {};
    const name = (settings.shortcutName ?? "").trim();
    if (!name) {
      streamDeck.logger.info("[mc] press ignored: no shortcut configured");
      return;
    }
    const long = isLongPress(Date.now() - downAt);
    const before = this.meetingOn.get(id) ?? settings.meetingOn ?? false;
    // ponytail: exit 0 gates the flip — no read-back of real system state (the Shortcut
    // may touch many settings). The bit can drift across a reboot; a press re-syncs.
    this.inFlight.add(id);
    let ok: boolean;
    try {
      ok = await this.runner.run(name, inputFor(long, before));
    } finally {
      this.inFlight.delete(id);
    }
    // The key may have disappeared during the run; don't re-arm a hidden page.
    if (!this.timers.has(id)) return;
    if (!ok) {
      streamDeck.logger.warn("[mc] shortcut run failed; meeting-mode bit unchanged");
      this.scheduleNext(ev as unknown as Ctx, 0);
      return;
    }
    if (long) {
      streamDeck.logger.info("[mc] Quick Config re-picked; meeting-mode bit unchanged");
      this.scheduleNext(ev as unknown as Ctx, 0);
      return;
    }
    const after = !before;
    this.meetingOn.set(id, after);
    void ev.action.setSettings({ ...settings, meetingOn: after }); // persist across reloads
    // Every short press that succeeds is a real flip, so this fires the correct direction.
    const hook = webhookForTransition(
      before,
      after,
      settings.meetingModeWebhook ?? "",
      settings.noMeetingWebhook ?? "",
    );
    if (hook) this.notifyHomeAssistant(hook);
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  /** Fire-and-forget POST to a Home Assistant webhook. Never awaited; never blocks the press. */
  private notifyHomeAssistant(url: string): void {
    void fetch(url, { method: "POST" })
      .then((res) => {
        // A wrong/misconfigured webhook id returns 200 and still RESOLVES — can't detect it.
        // Log the status only; the URL carries the secret webhook id.
        if (!res.ok) streamDeck.logger.warn(`[mc] HA webhook -> HTTP ${res.status}`);
      })
      .catch(() => streamDeck.logger.warn(`[mc] HA webhook POST failed`));
  }

  /** Self-rescheduling redraw loop; cadence depends on the current state. */
  private scheduleNext(ev: Ctx, delay: number): void {
    const id = ev.action.id;
    const existing = this.timers.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      const cadence = this.redraw(ev);
      this.scheduleNext(ev, cadence);
    }, delay);
    this.timers.set(id, t);
  }

  /** Paint one frame; return the delay until the next. */
  private redraw(ev: Ctx): number {
    const id = ev.action.id;
    const settings = ev.payload.settings ?? {};
    const url = (settings.icalUrl ?? "").trim();
    // Stored value is never trusted: parse MM:SS, fall back to the default if invalid.
    const thresholdMs =
      (parseThresholdSeconds(settings.thresholdMmss ?? "") ?? DEFAULT_THRESHOLD_SECONDS) * 1000;

    const meetingOn = this.meetingOn.get(id) ?? false;

    if (url === "") {
      void ev.action.setImage(
        toDataUri(renderCountdown({ state: "idle", title: "", big: "SET URL", glow: glowColor("idle", meetingOn) })),
      );
      return CRUISE_MS;
    }

    const snap = getCalendarAdapter(url).latest();
    const now = Date.now();

    if (snap.status === "no-config") {
      void ev.action.setImage(
        toDataUri(renderCountdown({ state: "idle", title: "", big: "SET URL", glow: glowColor("idle", meetingOn) })),
      );
      return CRUISE_MS;
    }
    if (snap.status === "unavailable" && snap.value === null) {
      const big = snap.fetchedAt === 0 ? "SYNC" : "NO LINK";
      void ev.action.setImage(
        toDataUri(renderCountdown({ state: "idle", title: "", big, glow: glowColor("idle", meetingOn) })),
      );
      return CRUISE_MS;
    }

    // thresholdMs also lets an imminent next meeting override an ongoing meeting's NOW.
    const meeting = selectNextMeeting(snap.value ?? [], filtersFrom(settings), now, thresholdMs);
    const state = pickState(now, meeting, thresholdMs);

    // Forensic breadcrumb (kept intentionally): log whenever the key sits on NOW.
    if (state === "liftoff" && meeting) {
      streamDeck.logger.info(
        `[mc] NOW "${meeting.title}" ${new Date(meeting.start).toISOString()}..${new Date(meeting.end).toISOString()}`,
      );
    }

    let pulsePhase: 0 | 1 | undefined;
    if (state === "terminal") {
      pulsePhase = this.pulse.get(id) === 1 ? 0 : 1;
      this.pulse.set(id, pulsePhase);
    } else {
      this.pulse.delete(id);
    }

    const view: CountdownView = {
      state,
      title: state === "idle" ? "" : (meeting?.title ?? ""),
      big: buildBig(state, now, meeting),
      pulsePhase,
      ringFraction: state === "cruise" && meeting ? ringFraction(now, meeting) : undefined,
      glow: glowColor(state, meetingOn),
    };
    void ev.action.setImage(toDataUri(renderCountdown(view)));
    // terminal counts down and liftoff counts up — both need a 1s tick.
    return state === "terminal" || state === "liftoff" ? TERMINAL_MS : CRUISE_MS;
  }
}
