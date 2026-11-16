# zhue — Philips Hue on Zepp OS watches

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENCE)
[![Zepp OS](https://img.shields.io/badge/Platform-Zepp%20OS%203.0%2B-blue.svg)](https://docs.zepp.com/)
[![Version](https://img.shields.io/badge/Version-1.1.0-green.svg)](#)

Control your Philips Hue lights from a Zepp OS watch: rooms and zones, single
lights, brightness, colors and white temperature, scenes, and a shortcut card
for the lights you use most.

## Screenshots

| ![Screenshot 1](screenshots/1.png) | ![Screenshot 2](screenshots/2.png) | ![Screenshot 3](screenshots/3.png) |
|---|---|---|
| ![Screenshot 4](screenshots/4.png) | ![Screenshot 5](screenshots/5.png) | ![Screenshot 6](screenshots/6.png) |
| ![Screenshot 7](screenshots/7.png) | ![Screenshot 8](screenshots/8.png) | ![Screenshot 9](screenshots/9.png) |

## Features

- **Rooms and zones**: two tabs, each group with its icon and an ON/OFF badge
  that switches the whole group.
- **Lights of a group**: each light with its state and brightness; tap the
  icon to switch it, tap the name to open it. The group's scenes are listed
  too, each with a dot in its own color (before or after the lights, as set
  on the phone).
- **A light**: on/off, a brightness slider, favorite presets and a color
  picker with two wheels, as in the Hue app: color (hue around, saturation
  from the center) and white (warm at the top, cool at the bottom). The light
  follows the finger.
- **Icons as in the Hue app**: each light shows its model's icon, or the icon
  of the lamp type set for it in the Hue app (a bulb in a pendant shows the
  pendant).
- **Favorite colors**: add the light's current color from its page, delete one
  with a long press; reset them from the phone.
- **Shortcut card**: up to 9 lights, rooms or zones on a card in the watch's
  shortcuts; a tap switches one, and the card shows each as last seen (green
  ring on, grey off; no ring when not seen for 10 minutes). Add or remove
  them from a light's or a group's page.
- **Fast**: pages seen before open at once and refresh in the background.
- **Physical buttons**: up / down between items, select to act, held select
  for the second action, back.
- **Demo mode**: try the app without a bridge (sample rooms, zones, lights
  and scenes).
- **9 languages**: English, Italian, German, Spanish, French, Russian, Korean,
  Simplified and Traditional Chinese.
- Round and square screens.

## Getting started

You need a Philips Hue Bridge on the same network as your phone, and the Zepp
app on the phone (the watch talks to the bridge through it).

1. Open zhue on the watch: it looks for the bridge on your network.
2. When asked, press the round link button on top of the bridge.
3. The watch pairs and shows your rooms. Done: the bridge's address and key
   are kept by the Zepp app.

If the bridge isn't found, check that the phone is on the same network as the
bridge and that the bridge is online, then tap Retry on the watch.

### Settings on the phone

- **Bridge**: whether it's paired, its IP address, its key (shortened), and
  *Clear all configuration* (asks for confirmation) to pair again.
- **On the watch**: the tab the app opens on (Rooms or Zones), whether scenes
  come before or after the lights, whether scenes are shown.
- **Favorite colors**: the current presets, and going back to the defaults.
- **Demo mode**.

## Privacy

- The watch reaches the bridge through the Zepp app on the phone; lights are
  controlled on your local network (Hue API v1).
- To find the bridge, the app asks Philips' discovery service
  (`discovery.meethue.com`) for the bridge's local address. Nothing else
  leaves your network.
- The bridge's key stays in the Zepp app's storage for zhue. The settings page
  shows it shortened, and test builds' logs never contain it.

## Limitations

- Hue API v1 only (the bridge's local REST API); no entertainment areas,
  schedules or automations.
- The bridge is found through Philips' discovery service: the IP address
  field in the settings doesn't replace it for pairing yet.
- Lights of models zhue doesn't know show the icon of the lamp type set for them in the Hue app (a generic bulb without one).

## Development

Built with [Zeus CLI](https://docs.zepp.com/docs/guides/tools/cli/) and
[ZML](https://github.com/zepp-health/zml).

```
zhue/
├── app.js                 # app: caches shared by the pages, remote log queue
├── app.json               # targets (round / square), permissions, pages
├── config.js              # build switches: LOG_LEVEL, DEV
├── app-side/              # side service on the phone
│   ├── index.js           # Hue bridge: discovery, pairing, lights, groups, scenes
│   └── log.js             # Logs box store and scrubber
├── page/                  # watch pages (logic + one layout per screen shape)
│   ├── index.js           # start: Bluetooth, bridge search, pairing, first load
│   ├── groups.js          # rooms and zones
│   ├── group-detail.js    # lights and scenes of a group
│   ├── light-detail.js    # one light: switch, brightness, presets
│   ├── color-picker.js    # color and white temperature
│   ├── quick-toggle.js    # switches a light from the shortcut card
│   ├── *.r.layout.js      # round screens
│   ├── *.s.layout.js      # square screens
│   └── i18n/              # watch strings
├── app-widget/            # shortcut card
├── setting/               # settings page in the Zepp app (+ i18n, logo.js)
├── utils/                 # constants (colors, icons, light models), logging, request queue
├── tools/                 # Node scripts for development (.cjs: not bundled)
└── assets/                # images per target (default.r round, default.s square)
```

### Logs for testing

Test builds send the watch's and the phone's log lines to a **Logs** box at
the bottom of the settings page, to copy into a bug report (the bridge key and
addresses are removed). Set the level in `config.js`:

- `LOG_LEVEL = 'trace'` or `'info'` for builds given to testers;
- `LOG_LEVEL = 'off'` for store releases: nothing is logged and the box is
  not shown.

### Release checklist

1. The version in `app.json` (`version.name`, and `version.code` + 1), `package.json`,
   `setting/index.js` (`APP_VERSION`: the settings page can't read app.json) and
   the badge at the top of this file.
2. `LOG_LEVEL = 'off'` and `DEV = false` in `config.js`.
3. On a watch, with the release build: clear the configuration from the
   phone's settings and pair again (search, link button, rooms shown); a
   light, a group, a scene, the color picker, the shortcut card.
4. `zeus build`: the package to upload is in `dist/`. Tag the commit `vX.Y.Z`.

### Tools

- `node tools/check-icon-masks.cjs`: the light and room icons are masks drawn
  over the light's color; Zeus converts each PNG to a palette image, and for
  some icons the mask came out translucent (the color showed through as a
  square). This runs Zeus's own converter on every icon and fails on such a
  mask. Run it after adding or changing an icon.
- `node tools/gen-hue-icons.cjs`: makes the lamp-type icons (`hue-*.png`), one
  per type a light can be given in the Hue app (its archetype, which picks
  the icon of a light whose model zhue doesn't know, or of a bulb in a
  fixture), from hass-hue-icons' SVGs in `tools/hue-svgs/` (downloaded if
  missing). It converts each mask as Zeus will and fixes the ones that would
  come out translucent.
- `node tools/gen-card-press.cjs`: makes the images of the button over each
  tile of the shortcut card (clear, and a dark disc while pressed).
- `node tools/gen-settings-logo.cjs`: makes `setting/logo.js`, the app icon's
  wordmark for the settings page header. Run it after changing the icon.

Both need `npm install` (they use `@zeppos/zpm`, or Node's own modules).

## Icons attribution

The light and room icons are adapted from **[hass-hue-icons](https://github.com/arallsopp/hass-hue-icons)**
by [arallsopp](https://github.com/arallsopp), licensed under
[CC BY-NC-SA 4.0](https://github.com/arallsopp/hass-hue-icons/blob/main/LICENSE).
Those icons, and any changes to them, stay under that license.

## License

The code is under the MIT License: see [LICENCE](LICENCE). The icons are under
their own license (above).

## Disclaimer

zhue is an independent project, not affiliated with Signify (Philips Hue) or
Zepp Health.
