# Stream Deck (Mission Control)

**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Overview
This repo (git root `/Users/sb/claude/stream-deck/`) holds **Mission Control**, an Elgato Stream Deck + plugin that surfaces workplace signals blocked by an org's API lockdown, reading each from a source reachable *without* that API. First action: **Meeting Countdown**, a space-themed mission clock to the next meeting, read from a secret iCal (`.ics`) feed. Planned sibling: **Slack Comms**, an unread readout from the Slack Dock badge. Actions are independent and share only a visual theme. The repo directory is named `stream-deck`; the plugin's name is Mission Control.

---

## Session Log

### 2026-06-04 - Brainstorm to verified pure-Node core (with EventKit to iCal pivot)

**Status:** Pure-Node core is COMPLETE and independently review-APPROVED. It is NOT yet wired into the plugin entry, has no Property Inspector, and has not run on the device. Branch `meeting-countdown`: 46 tests passing, `tsc --noEmit` clean, working tree clean.

**What we accomplished:**
- Brainstormed the design (superpowers): one plugin shell hosting independent themed actions, each reading a local-or-feed signal that mirrors a blocked workplace API. Wrote and approved a design spec and a test-first implementation plan.
- Ran a Phase 0 feasibility spike on calendar access. **Key finding:** a bare signed Swift/EventKit CLI cannot hold its own macOS calendar (TCC) grant; the grant attaches to the launching app (proved: it attached to iTerm), so it would fail when Stream Deck spawns the helper in production. Full record in `spike/RESULTS.md`.
- **PIVOTED** the calendar data source from EventKit to a secret iCal `.ics` feed after inspecting a working reference plugin on the same machine (`com.pedrofuentes.ical`) that fetches and parses ICS with ICAL.js, no permissions involved. Probed the real Google secret iCal URL: HTTP 200, 278 events, all needed fields present. This removed the Swift helper, code-signing, and the entire TCC problem.
- Built Phases 2 to 5.2 test-first via subagents (subagent-driven-development): domain logic, ICS parser, source adapter, theme/renderer, action class.
- Independent final review found and we fixed two real correctness bugs (recurrence-override events emitted twice; a single declined occurrence read the master event's status, so a declined standup would still count down) plus two spec-conforming fixes (filter `STATUS:CANCELLED`; escalate to `NO LINK` after 3 consecutive feed failures per spec section 10). Re-review verdict: APPROVED, with the reviewer empirically confirming the new tests fail if the fixes regress.

**Key technical decisions:**
- Calendar data source = secret iCal feed (Path A), not EventKit. Rationale: bare-CLI TCC attribution cannot hold a grant; ICS is the proven, permission-free path that works under Stream Deck's spawn model.
- Architecture: one plugin process; each action consumes a uniform `SourceAdapter<T>` (a cached `Snapshot`). Calendar = `CalendarAdapter` (fetch URL, ICAL.js parse, recurrence expand, cache). Slack later = its own independent adapter. The seam is why the EventKit-to-ICS swap touched only the adapter and nothing else.
- Pure, clock-injected domain logic (`pickState`, `selectNextMeeting`, view-model) so all boundary/state behavior is deterministically unit-tested.
- ICAL.js for parsing (recurrence + VTIMEZONE). Per-occurrence metadata is read from `occ.item.component`, not the master event. `ICAL.TimezoneService.register(new ICAL.Timezone({component, tzid}))` is the correct v2.2.1 signature.
- v1 = one iCal URL per key (multi-feed deferred). Declined/attendee detection is best-effort via the owner email parsed from a Google iCal URL.
- Stack: Node (Stream Deck's bundled runtime, has global `fetch`), TypeScript ESM, `moduleResolution: Bundler` (relative imports are EXTENSIONLESS), SDK `@elgato/streamdeck` v2 (settings type needs `[key: string]: JsonValue` from `@elgato/utils`), `ical.js`, Vitest. Plugin UUID `com.static74.mission-control`; action UUID `com.static74.mission-control.meeting-countdown`.

**Repo / location facts:**
- Git root `/Users/sb/claude/stream-deck/` is this project's OWN repo (no remote yet). It was detached from the parent `static74/ai` repo, which now gitignores `stream-deck/`.
- Branch `meeting-countdown` (cut from `main`; `main` holds the planning baseline). All feature work is on `meeting-countdown`.
- Plugin project root: `/Users/sb/claude/stream-deck/mission-control/` (run all `npm`/build commands HERE). `docs/` and `spike/` live at the repo root one level up.
- Plugin bundle `mission-control/com.static74.mission-control.sdPlugin/` is linked to the Stream Deck app. Two Stream Deck + devices are connected.

**Files created (key):**
- `docs/superpowers/specs/2026-06-03-mission-control-streamdeck-design.md` - design spec (Path A / iCal).
- `docs/superpowers/plans/2026-06-03-mission-control-meeting-countdown.md` - **AUTHORITATIVE** test-first plan (Path A). Phase 1 marked complete; build done through Phase 5.2; Phases 5.3, 6, 7 remain with exact code/commands.
- `spike/RESULTS.md` - the EventKit-to-iCal pivot rationale and spike findings.
- `mission-control/src/domain/{meeting,countdown-state,view-model}.ts` (+ `.test.ts`) - pure logic.
- `mission-control/src/ics/{parse-ics,owner-email}.ts` (+ `.test.ts`) - ICS parsing.
- `mission-control/src/adapters/{types,calendar-adapter,calendar-registry}.ts` (+ adapter test).
- `mission-control/src/theme/{mission-theme,render-countdown}.ts` (+ render test).
- `mission-control/src/actions/meeting-countdown.ts` - action class (typechecks, NOT yet registered).
- `mission-control/test/fixtures/sample.ics` - synthetic fixture (never real data).

**Next steps (resume HERE, in order):**
- [ ] **Task 5.3 (mechanical, no device needed):** register `MeetingCountdownAction` in `mission-control/src/plugin.ts`; add its `Actions` entry to the manifest (`Controllers: ["Keypad"]`, `PropertyInspectorPath: "ui/meeting-countdown.html"`, icon paths); delete the scaffold sample `src/actions/increment-counter.ts`. Then `npm run build` and `streamdeck restart com.static74.mission-control`.
- [ ] **Phase 6 (Property Inspector):** create `com.static74.mission-control.sdPlugin/ui/meeting-countdown.html` with the iCal URL field (use `password`), threshold, and filter toggles. Vendor `sdpi-components.js` LOCALLY into `ui/lib/` (NO CDN, air-gap + supply-chain). Style with the frontend-design skill.
- [ ] **Phase 7 (on device, with Shane):** drop the action on a key, paste Shane's FRESH secret iCal URL, verify idle/cruise/terminal/liftoff, the `NO LINK`/`SET URL`/`SYNC` fault frames, and the `willAppear`/`willDisappear` redraw-timer lifecycle (no runaway CPU on a hidden page).
- [ ] **Later milestone:** the Slack Comms action (its own adapter reading the Slack Dock badge via Accessibility). Note: reading the badge via `AXStatusLabel` on macOS 26 is UNPROVEN; treat as a fresh feasibility check (see spec). Fully independent of the calendar action.

**Deferred / known (not defects):**
- Action SDK event types adapted via `as unknown as Ctx` casts (review item M2; runtime-safe, could be tightened to the `KeyAction | DialAction` union).
- 36h forward fetch window: meetings further out than 36h show `CLEAR` until they enter the window.
- Title truncation is a hard 14-char slice (no ellipsis).

**How to resume (fresh session):**
- Read this log, then the spec, the plan, and `spike/RESULTS.md`.
- Sanity check: `cd /Users/sb/claude/stream-deck/mission-control && npm test` (expect 46 passing) and `npx tsc --noEmit` (clean).
- Continue from the plan at Task 5.3; the plan has exact code and commands.
- The secret iCal URL is a calendar read-credential: it lives only in plugin settings, never in chat. Shane was asked to rotate the one tested this session.
- Working style is the superpowers workflow; Shane's preferences are in his CLAUDE.md (direct, no em-dashes, verify against the live system, pump the brakes on unverified assumptions).
