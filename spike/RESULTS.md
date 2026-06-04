# Spike results - 2026-06-04

## Environment
- macOS version (`sw_vers -productVersion`): 26.5.1  (>= 14, OK)
- Signed with identity: MissionControl (self-signed, created via Keychain Access Certificate Assistant)
- Binary: `spike/calendar-spike`, Identifier `com.shane.missioncontrol.calendar-helper`, Authority `MissionControl`, embedded Info.plist section confirmed present.

## Calendar (the gate)
- First run (from iTerm) prompted + read events: YES
- Second run (from iTerm) read with NO re-prompt (persistence): YES
- Which entry holds the grant in Privacy > Calendars: **iTerm.app** (NOT MissionControlCalendarHelper)
- launchd (non-terminal) run read events: **NO** - it hung on `requestFullAccessToEvents` (no GUI session under launchd to show the TCC prompt; the helper has no grant of its own), produced no stdout/stderr, and was killed via `launchctl remove`.
- DECISION: **NO-GO (provisional / blocked)** under the current "bare signed CLI" design.

### Root cause
macOS TCC attributes calendar access to the **responsible process**, which for a CLI launched from a terminal is the terminal app (here iTerm), not the binary. A bare signed Mach-O CLI does not get its own TCC identity, so it cannot hold its own grant. When run detached from a granted parent (launchd), it has no access and cannot prompt.

### Implication for production
In production the helper is spawned by Stream Deck (via the Node plugin), not a terminal. The responsible process would likely resolve to Stream Deck.app (or node). So either:
1. The helper must be restructured to hold its OWN TCC identity (e.g., a proper `.app` bundle with its own bundle id), or
2. The grant must attach to the responsible host (Stream Deck.app) and the helper inherits it, or
3. We test the actual Stream-Deck-spawned path (pull a minimal plugin spawn forward) to learn what TCC actually attributes to in production.

This must be resolved before building Phases 1-7. Do NOT treat the iTerm-based success as GO.

## BREAKTHROUGH: a working reference plugin sidesteps TCC entirely
- The Stream Deck app is running with TWO "Stream Deck +" devices, and bundles its own Node 20 runtime (`com.elgato.StreamDeck/NodeJS/20.20.0/node`); plugins run under that, not system Node.
- An existing, working calendar plugin is installed and running: `com.pedrofuentes.ical` (v2.4.4.0).
- Inspection: it has NO native module (`.node`), NO Swift helper, NO bundled binary. Just `bin/plugin.js` running under SD's Node. Its `plugin.js` contains `ical.js`, `fetch(`, and `VEVENT`; `setup.html` asks the user for "The secret iCal URL from your calendar provider."
- Conclusion: it reads calendars by **fetching a subscribed `.ics` URL over HTTP and parsing it with ICAL.js.** It never touches EventKit, so it needs no TCC grant, no signed helper, no responsible-process gymnastics.

### Strategic implication
This is a proven, far simpler path that eliminates the entire blocker above. The pivot hinges on ONE question: can Shane obtain a secret iCal (`.ics`) URL for his calendar (Google secret iCal address if the org allows it, a Reclaim.ai feed, or another sync). If yes, the EventKit/Swift-helper/signing/TCC architecture is unnecessary. Decision pending with Shane.

## Slack badge (informational, not a build blocker)
- Not yet tested (Task 0.4 pending the calendar resolution).

## Notes / surprises
- `launchctl submit` is deprecated on macOS 26 but ran; the job blocked rather than cleanly denying, consistent with "prompt cannot be shown under launchd."
- The signing identity itself is verified working (signed a throwaway binary, `Authority=MissionControl`, exit 0).
