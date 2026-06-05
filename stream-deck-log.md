# Stream Deck (Mission Control)

**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Overview
This repo (git root `/Users/sb/claude/stream-deck/`) holds **Mission Control**, an Elgato Stream Deck + plugin that surfaces workplace signals blocked by an org's API lockdown, reading each from a source reachable *without* that API. First action: **Meeting Countdown**, a space-themed mission clock to the next meeting, read from a secret iCal (`.ics`) feed. Planned sibling: **Slack Comms**, an unread readout from the Slack Dock badge. Actions are independent and share only a visual theme. The repo directory is named `stream-deck`; the plugin's name is Mission Control.

---

## Session Log

### 2026-06-04 (session 2) - Action wired into the plugin + Property Inspector (Task 5.3 + Phase 6)

**Status:** The Meeting Countdown action is wired in, runs on the device, and Phase 7 device verification is DONE (Shane confirmed live: URL masking, terminal state, fault/stale recovery, and the page-switch lifecycle). Two on-device refinements then landed: a two-line title with a larger font, and a validated MM:SS threshold field replacing the slider. Branch `meeting-countdown`: 64 tests passing, `tsc --noEmit` clean, working tree clean. Commits this session: `759e57a` (Task 5.3), `d971477` (Phase 6), `2d259d7` (security-claim precision), `21ccb64` (title wrap), `1d2649a` (MM:SS threshold).

**What we accomplished:**
- **Task 5.3:** Registered `MeetingCountdownAction` in `src/plugin.ts`; swapped the manifest `Actions` entry from the scaffold Counter to Meeting Countdown (`Controllers: ["Keypad"]`, `PropertyInspectorPath: "ui/meeting-countdown.html"`, `imgs/actions/meeting/...`); deleted the scaffold sample (`increment-counter.ts`, its PI, its icons); added placeholder meeting icons by copying the counter PNGs (dimensions already manifest-valid). Built and restarted on the device clean.
- **Security fix (not in the plan, grounded in SDK source):** dropped the scaffold's `streamDeck.logger.setLevel("trace")`. The SDK logs raw WebSocket frames (which carry the settings payload, i.e. the secret iCal URL) only at `trace` (`connection.js:74,137`); the default level is `info`, so removing that line keeps the credential off the on-disk plugin log.
- **Phase 6:** Vendored `sdpi-components` **v4.0.1** locally into `ui/lib/` (sha256 recorded in `sdpi-components.js.sha256`), wrote `ui/meeting-countdown.html` with the six settings controls, themed to the mission-console palette (the header echoes the key face's own readout and hazard-chevron motifs). Verified by inspection that the bundle issues no runtime network requests and the panel loads no remote scripts or fonts (air-gap requirement satisfied).

**Grounded deviations from the plan (verified against the vendored library, not guessed):**
- The masked URL field uses the dedicated `<sdpi-password>` element. A bare `password` attribute on `<sdpi-textfield>` is NOT honored in v4.0.1 (the bundle registers `sdpi-password` as a textfield subclass that forces `type="password"`), so the plan's markup would have left the credential field visible.
- The credential note is plain themed HTML; `<sdpi-item-value>` (used in the plan) is not a registered element in v4.0.1.

**Files created/changed this session:**
- `mission-control/src/plugin.ts` - registers MeetingCountdownAction; no trace logging.
- `mission-control/com.static74.mission-control.sdPlugin/manifest.json` - Meeting Countdown action entry.
- `mission-control/.../imgs/actions/meeting/{icon,icon@2x,key,key@2x}.png` - PLACEHOLDER icons (copied from counter; replace with themed art later).
- `mission-control/.../ui/meeting-countdown.html` - Property Inspector.
- `mission-control/.../ui/lib/sdpi-components.js` (+ `.sha256`) - locally vendored v4.0.1.
- Deleted: `src/actions/increment-counter.ts`, `ui/increment-counter.html`, `imgs/actions/counter/`.

**What I verified here vs. what only Shane can verify on the device:**
- Verified here: `npm run build` succeeds and regenerates `bin/plugin.js`; `tsc --noEmit` clean; 46 tests pass; manifest is valid JSON with a PI path that resolves; the PI loads only the local script (no remote refs).
- Runtime (not just the CLI ack): the plugin log `logs/com.static74.mission-control.0.log` shows a clean startup — registration parameters received, both "Stream Deck +" devices enumerated, NO ERROR/exception entries. The action registered without throwing.
- Credential-off-disk (airtight): across the whole SDK `dist/`, the settings payload is serialized only at the two `trace` calls in `connection.js` (74, 137); nothing logs settings at info/debug/warn/error. The plugin runs at `debug` (manifest `Nodejs.Debug` enabled), and `trace` is suppressed at `debug`, so the secret URL never reaches the log.
- Air-gap (scoped): the sdpi bundle loads no remote scripts/fonts/resources and makes no external requests; its only socket is `ws://localhost` (the Stream Deck PI connection, inherent to the model).
- NOT verified here (needs the physical Stream Deck + Shane's real feed): the key actually rendering each state, and the PI rendering and URL-masking visually on the device.

**On-device refinements this session (TDD, then verified on the deck):**
- **Two-line title (`21ccb64`):** `render-countdown.ts` now wraps the title via a pure, code-point-aware `wrapTitle()` (greedy word wrap, max two lines, hard-break over-long words, ellipsis on overflow) at 22px (was a hard 14-char single line at 18px). Code-point slicing keeps emoji in titles from splitting.
- **MM:SS threshold (`1d2649a`):** the slider is replaced by a validated `<sdpi-textfield>` (`pattern="[0-9]{1,2}:[0-5][0-9]"`, default `05:00`). New pure `domain/threshold.ts#parseThresholdSeconds` validates and the action parses defensively (falls back to `DEFAULT_THRESHOLD_SECONDS` when empty/invalid; the stored string is never trusted). `pickState` now takes `thresholdMs` (precise) instead of whole minutes.

**Threshold cap (decided + done, `ae37c78`):** Shane chose to cap at 30:00. `parseThresholdSeconds` clamps to `MAX_THRESHOLD_SECONDS` (1800s); the PI `pattern` was tightened to `(0?[0-9]|1[0-9]|2[0-9]):[0-5][0-9]|30:00` so the field shows invalid above the ceiling (regex verified against boundary cases in node). 69 tests passing.

**Next steps (resume HERE, in order):**
- [ ] **Quick device re-check of the two refinements:** confirm a long meeting title wraps to two readable lines (ellipsis only when it overflows), and that the MM:SS field shows invalid styling on bad input (e.g. `9:99`) while a valid value like `02:30` drives the terminal flip at the right time.
- [ ] **Polish (non-blocking):** replace the placeholder meeting icons with space-themed art; optionally `streamdeck pack com.static74.mission-control.sdPlugin` for distribution.
- [ ] **Later milestone:** the Slack Comms action (its own adapter reading the Slack Dock badge; `AXStatusLabel` on macOS 26 is UNPROVEN, treat as a fresh feasibility check). Fully independent of the calendar action.

---

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
- [x] **Task 5.3 (mechanical, no device needed) — DONE in session 2:** register `MeetingCountdownAction` in `mission-control/src/plugin.ts`; add its `Actions` entry to the manifest (`Controllers: ["Keypad"]`, `PropertyInspectorPath: "ui/meeting-countdown.html"`, icon paths); delete the scaffold sample `src/actions/increment-counter.ts`. Then `npm run build` and `streamdeck restart com.static74.mission-control`.
- [x] **Phase 6 (Property Inspector) — DONE in session 2:** create `com.static74.mission-control.sdPlugin/ui/meeting-countdown.html` with the iCal URL field (use `password`), threshold, and filter toggles. Vendor `sdpi-components.js` LOCALLY into `ui/lib/` (NO CDN, air-gap + supply-chain). Style with the frontend-design skill.
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
