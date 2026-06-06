import {
  action,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { getCalendarAdapter } from "../adapters/calendar-registry";
import { DEFAULT_FILTERS, selectNextMeeting, type MeetingFilters } from "../domain/meeting";
import { pickState } from "../domain/countdown-state";
import { parseThresholdSeconds, DEFAULT_THRESHOLD_SECONDS } from "../domain/threshold";
import { buildBig, ringFraction } from "../domain/view-model";
import { renderCountdown, toDataUri, type CountdownView } from "../theme/render-countdown";
import { glowColor } from "../theme/glow";
import { isMeetingMode, nextOutputTarget } from "../domain/meeting-mode";
import { getAudioControl } from "../audio/audio-control-registry";
import {
  DEFAULT_MEETING_DEVICE,
  DEFAULT_NORMAL_DEVICE,
  type AudioControl,
  type AudioOutput,
} from "../audio/types";

interface CountdownSettings {
  [key: string]: JsonValue;
  icalUrl?: string;
  thresholdMmss?: string; // manual MM:SS terminal threshold; parsed defensively
  attendeesOnly?: boolean;
  hasLinkOnly?: boolean;
  hideAllDay?: boolean;
  excludeTitlePattern?: string;
  normalDevice?: string; // uid (from the PI dropdown) or provisional name
  meetingDevice?: string; // uid (from the PI dropdown) or provisional name
}

const CRUISE_MS = 60_000;
const TERMINAL_MS = 1_000;
const AUDIO_POLL_MS = 5_000; // catch audio changes made outside the plugin

function filtersFrom(s: CountdownSettings): MeetingFilters {
  return {
    attendeesOnly: s.attendeesOnly ?? DEFAULT_FILTERS.attendeesOnly,
    hasLinkOnly: s.hasLinkOnly ?? DEFAULT_FILTERS.hasLinkOnly,
    hideAllDay: s.hideAllDay ?? DEFAULT_FILTERS.hideAllDay,
    excludeTitlePattern: s.excludeTitlePattern ?? DEFAULT_FILTERS.excludeTitlePattern,
  };
}

function devicesFrom(s: CountdownSettings): { normal: string; meeting: string } {
  return {
    normal: (s.normalDevice ?? "").trim() || DEFAULT_NORMAL_DEVICE,
    meeting: (s.meetingDevice ?? "").trim() || DEFAULT_MEETING_DEVICE,
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
  private audio = new Map<string, AudioOutput | null>(); // last-known live output device
  private audioPolledAt = new Map<string, number>();
  private readonly audioControl: AudioControl = getAudioControl();

  override onWillAppear(ev: WillAppearEvent<CountdownSettings>): void {
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  override onWillDisappear(ev: WillDisappearEvent<CountdownSettings>): void {
    const id = ev.action.id;
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    this.pulse.delete(id);
    this.audio.delete(id);
    this.audioPolledAt.delete(id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<CountdownSettings>): void {
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  /** Press toggles the audio output, then repaints from the read-back truth. */
  override async onKeyDown(ev: KeyDownEvent<CountdownSettings>): Promise<void> {
    const id = ev.action.id;
    const { normal, meeting } = devicesFrom(ev.payload.settings ?? {});
    const current = this.audio.get(id) ?? (await this.audioControl.current());
    const target = nextOutputTarget(current ?? null, normal, meeting);
    const result = await this.audioControl.setOutput(target); // read-back: never assume the switch took
    this.audio.set(id, result);
    this.audioPolledAt.set(id, Date.now());
    this.scheduleNext(ev as unknown as Ctx, 0);
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

  /** Throttled, fire-and-forget refresh of the cached live output device. */
  private refreshAudio(ev: Ctx, id: string): void {
    const now = Date.now();
    if (now - (this.audioPolledAt.get(id) ?? 0) < AUDIO_POLL_MS) return;
    this.audioPolledAt.set(id, now);
    void this.audioControl
      .current()
      .then((out) => {
        const prev = this.audio.get(id);
        this.audio.set(id, out);
        // Repaint promptly only when the device actually changed (cheap; avoids
        // re-toggling pulse on every poll).
        if ((prev?.uid ?? null) !== (out?.uid ?? null)) this.scheduleNext(ev, 0);
      })
      .catch(() => this.audio.set(id, null));
  }

  /** Paint one frame; return the delay until the next. */
  private redraw(ev: Ctx): number {
    const id = ev.action.id;
    const settings = ev.payload.settings ?? {};
    const url = (settings.icalUrl ?? "").trim();
    // Stored value is never trusted: parse MM:SS, fall back to the default if invalid.
    const thresholdMs =
      (parseThresholdSeconds(settings.thresholdMmss ?? "") ?? DEFAULT_THRESHOLD_SECONDS) * 1000;

    this.refreshAudio(ev, id);
    const { meeting: meetingDevice } = devicesFrom(settings);
    const meetingOn = isMeetingMode(this.audio.get(id) ?? null, meetingDevice);

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
      // M3: on first load (fetchedAt === 0) no poll has completed yet — show a
      // neutral acquiring frame instead of the fault state so there's no flash.
      const big = snap.fetchedAt === 0 ? "SYNC" : "NO LINK";
      void ev.action.setImage(
        toDataUri(renderCountdown({ state: "idle", title: "", big, glow: glowColor("idle", meetingOn) })),
      );
      return CRUISE_MS;
    }

    const meeting = selectNextMeeting(snap.value ?? [], filtersFrom(settings), now);
    const state = pickState(now, meeting, thresholdMs);

    let pulsePhase: 0 | 1 | undefined;
    if (state === "terminal") {
      pulsePhase = this.pulse.get(id) === 1 ? 0 : 1;
      this.pulse.set(id, pulsePhase);
    } else {
      this.pulse.delete(id);
    }

    const view: CountdownView = {
      state,
      title: meeting?.title ?? "",
      big: buildBig(state, now, meeting),
      pulsePhase,
      ringFraction: state === "cruise" && meeting ? ringFraction(now, meeting) : undefined,
      glow: glowColor(state, meetingOn),
    };
    void ev.action.setImage(toDataUri(renderCountdown(view)));
    return state === "terminal" ? TERMINAL_MS : CRUISE_MS;
  }
}
