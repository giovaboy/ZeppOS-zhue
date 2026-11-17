# Changelog

## 1.1.1

### Fixed
- The shortcut card kept the demo's shortcuts after the demo was turned off
  (a tap could switch a real light with the same number): the card is now
  emptied when the demo is turned on or off.

## 1.1.0

### New
- **Color picker with two wheels**, as in the Hue app: a color wheel (hue
  around, saturation from the center) and a white wheel (warm at the top, cool
  at the bottom). The light follows the finger.
- **Icons as in the Hue app**: a light shows its model's icon, or the icon of
  the lamp type set for it in the Hue app (a bulb in a pendant shows the
  pendant, one in a table lamp the table lamp).
- **Scenes show their own color**, in a dot next to their name.
- **Shortcut card**: rooms and zones too, besides lights; round tiles with
  each one's state (green ring on, grey off, none when not seen for
  10 minutes); a tap does the opposite of what the tile shows. Tiles darken
  when pressed.
- **Physical buttons**: up / down between items, select to act, held select
  for the second action, back; select or back close the color picker.
- A clear message when the bridge can't be reached from the shortcut card,
  or when the phone doesn't answer.

### Better
- Pages seen before open at once and refresh in the background, with no
  loading screen.
- The screen stays on while the app is in use.
- New start screens: searching for the bridge, pairing, errors.
- A light or room that is off is dark grey, clearly apart from a white light
  that is on.
- Rooms' last rows scroll up to the middle of the round screen.
- A swipe back that starts on the brightness slider no longer changes the
  brightness.
- Clearing the configuration on the phone empties the shortcut card too.
- Settings page: pairing steps one per line, no clear button or empty
  address before pairing.

### Fixed
- A light switched off while its brightness was changing could turn back on.
- A light opened while it was switching from its room showed its old state,
  or a black screen.
- The light page showed "Loading" again after the color picker.
- Taps during a refresh could act on a state newer than what was on screen.

## 1.0.1

First public release.
