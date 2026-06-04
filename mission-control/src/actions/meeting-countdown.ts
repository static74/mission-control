import {
  action,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { getCalendarAdapter } from "../adapters/calendar-registry";
import { DEFAULT_FILTERS, selectNextMeeting, type MeetingFilters } from "../domain/meeting";
import { pickState } from "../domain/countdown-state";
import { buildBig, ringFraction } from "../domain/view-model";
import { renderCountdown, toDataUri, type CountdownView } from "../theme/render-countdown";

interface CountdownSettings {
  [key: string]: JsonValue;
  icalUrl?: string;
  thresholdMinutes?: number;
  attendeesOnly?: boolean;
  hasLinkOnly?: boolean;
  hideAllDay?: boolean;
  excludeTitlePattern?: string;
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

  override onWillAppear(ev: WillAppearEvent<CountdownSettings>): void {
    this.scheduleNext(ev as unknown as Ctx, 0);
  }

  override onWillDisappear(ev: WillDisappearEvent<CountdownSettings>): void {
    const id = ev.action.id;
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    this.pulse.delete(id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<CountdownSettings>): void {
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

  /** Paint one frame; return the delay until the next. */
  private redraw(ev: Ctx): number {
    const id = ev.action.id;
    const settings = ev.payload.settings ?? {};
    const url = (settings.icalUrl ?? "").trim();
    const threshold = settings.thresholdMinutes ?? 5;

    if (url === "") {
      void ev.action.setImage(toDataUri(renderCountdown({ state: "idle", title: "", big: "SET URL" })));
      return CRUISE_MS;
    }

    const snap = getCalendarAdapter(url).latest();
    const now = Date.now();

    if (snap.status === "no-config") {
      void ev.action.setImage(toDataUri(renderCountdown({ state: "idle", title: "", big: "SET URL" })));
      return CRUISE_MS;
    }
    if (snap.status === "unavailable" && snap.value === null) {
      void ev.action.setImage(toDataUri(renderCountdown({ state: "idle", title: "", big: "NO LINK" })));
      return CRUISE_MS;
    }

    const meeting = selectNextMeeting(snap.value ?? [], filtersFrom(settings), now);
    const state = pickState(now, meeting, threshold);

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
    };
    void ev.action.setImage(toDataUri(renderCountdown(view)));
    return state === "terminal" ? TERMINAL_MS : CRUISE_MS;
  }
}
