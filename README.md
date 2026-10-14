# Mission Control

A custom Elgato Stream Deck plugin for macOS that counts down to your next meeting and
switches your audio output when you enter or leave meeting mode.

## Meeting Countdown

The key shows a space-themed mission clock counting down to your next meeting. The plugin
reads the meeting from a secret iCal (`.ics`) feed, so it needs no calendar API access or
macOS calendar permission. The clock cruises while the meeting is far off, enters a
terminal countdown inside a threshold you set (`MM:SS`, up to `30:00`), and shows `CLEAR`
when nothing is scheduled in the next 36 hours.

Pressing the key toggles meeting mode:

- A **short press** runs a macOS Shortcut of your choice, passing `meeting` or `normal` as
  its text input. The key flips its glow only when the Shortcut exits successfully.
- A **long press** (600 ms or longer) sends `reset meeting` or `reset normal`, which lets
  the bundled Shortcut ask you to pick a new audio configuration.
- Optionally, the plugin fires a Home Assistant webhook when meeting mode turns on or off.

## Audio output switching

The plugin contains no audio code. The Shortcut does the switching. The bundled generator
`mission-control/scripts/gen-meeting-mode-shortcut.py` builds a `Meeting Mode v2` Shortcut
that applies a [SoundSource](https://rogueamoeba.com/soundsource/) Quick Config for each
mode. On first use it shows a menu of your Quick Configs and remembers your choice. A long
press, or a saved Quick Config that no longer exists, brings the menu back.

You can point the key at any other Shortcut instead. The Shortcut receives the mode as text
input.

## Requirements

- macOS 12 or later, with the Stream Deck app 7.1 or later
- Node.js 20 or later and npm, to build
- SoundSource 6, for the bundled Quick Config Shortcut
- Shortcuts → Settings → Advanced → **Allow Running Scripts** turned on, for the bundled
  Shortcut

## Build and install

```sh
cd mission-control
npm install
npm test
npm run build
npx streamdeck link com.static74.mission-control.sdPlugin
streamdeck restart com.static74.mission-control
```

To generate the Shortcut, run the generator with an output directory and open the
`.shortcut` file it writes:

```sh
python3 -I scripts/gen-meeting-mode-shortcut.py ~/Desktop
```

## Configure

Drag **Meeting Countdown** onto a key, then fill in the Property Inspector:

- **iCal feed URL**: your calendar's secret iCal address (for Google Calendar, Settings →
  your calendar → *Secret address in iCal format*). The field is masked.
- **Terminal threshold**: when the terminal countdown starts, as `MM:SS`.
- **Filters** (optional): count only meetings with attendees or a join link, hide all-day
  events, or exclude titles containing a word such as `Focus Time`.
- **Shortcut name**: the exact name of the macOS Shortcut to run, for example
  `Meeting Mode v2`.
- **HA webhook URLs** (optional): one URL for meeting on, one for meeting off. The Home
  Assistant automations need webhook triggers that allow `POST`.

## Security notes

- The secret iCal URL can read your whole calendar, and a webhook URL contains its secret
  ID. The plugin keeps both only in Stream Deck's plugin settings and never logs them. Do
  not raise the plugin's log level to `trace`: trace logging writes the settings,
  including both URLs, to the log files on disk.
- Home Assistant returns HTTP 200 for unknown webhook IDs, so a mistyped webhook URL fails
  silently. Confirm on the Home Assistant side that the automation ran.
- The Property Inspector loads no remote scripts or fonts. Its UI components are vendored
  in `ui/lib/` with a recorded SHA-256 hash.

## License

[MIT](LICENSE)
