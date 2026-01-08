# zhue - Philips Hue Control for Zepp OS Smartwatches

[![License: ISC](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/mit)
[![Zepp OS](https://img.shields.io/badge/Platform-Zepp%20OS-blue.svg)](https://docs.zepp.com/)
[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)](#)

A powerful and intuitive smartwatch application that brings comprehensive control of your Philips Hue smart lighting system directly to your wrist. Manage individual lights, control groups, adjust brightness, and fine-tune colors—all from your Zepp OS smartwatch.

## Features

✨ **Complete Light Control**
- Toggle individual lights and groups on/off with single tap
- Adjust brightness levels with precision
- Control all lights simultaneously
- Full support for Rooms and Zones organization

🎨 **Advanced Color Management**
- Interactive RGB color picker with gradient selector
- Color temperature adjustment for supported bulbs
- Multiple color modes support (XY, hue/saturation, color temperature)
- Live color preview while adjusting

📱 **Smart Bridge Connectivity**
- Automatic Hue Bridge discovery

## Installation

### Prerequisites

- Zepp OS development environment
- A Zepp OS-compatible smartwatch
- Philips Hue Bridge

## Configuration

### Demo Mode

To test the app without a physical Hue Bridge:

1. Go to Settings
2. Enable Demo Mode
3. Use pre-configured demo lights for testing

## Architecture

```
zhue/
├── app.js                  # Main app entry point
├── app.json               # App configuration and permissions
├── app-side/              # Side Service (background worker)
│   └── index.js           # Bridge communication & API calls
├── page/                  # UI Pages
│   ├── index/             # Main lights view
│   ├── groups/            # Groups (Rooms & Zones) view
│   ├── group-detail/      # Group detail and control
│   ├── light-detail/      # Individual light control
│   └── color-picker/      # Advanced color selection
├── setting/               # Settings page
├── app-widget/            # Quick-access widget
├── secondary-widget/      # Lock screen widget
├── assets/                # Images, fonts, icons
├── i18n/                  # Internationalization files
└── utils/                 # Utility functions and constants
```

## Project Structure Details

### app-side/index.js
Handles all Philips Hue Bridge communication:
- Light and group discovery
- State management and updates
- Color control in multiple color spaces
- Error handling and fallback mechanisms

### page/*/index.page.js & index.layout.js
Implements the UI for each screen:
- `index`: Main dashboard with light listings
- `groups`: View rooms and zones
- `group-detail`: Control grouped lights
- `light-detail`: Individual light control panel
- `color-picker`: Advanced color selection interface

### setting/index.js
Settings and configuration interface:
- Bridge pairing and discovery
- Credential management
- App version display

## Usage

### Main Dashboard
- Displays all lights grouped by room/zone
- Quick toggle on/off for each light
- Tap for detailed control options

### Light Control
- **Brightness**: Slide to adjust intensity (0-254)
- **Color**: Tap to open color picker
- **Toggle**: Quick on/off switch

### Color Picker
- **Gradient Mode**: Tap to select hue
- **Saturation**: Horizontal swipe to adjust
- **Brightness**: Vertical swipe to adjust
- **CT Mode**: Available for color temperature adjustment

### Groups
- View all your Rooms and Zones
- Toggle entire groups on/off
- Manage group settings

## Icons Attribution

This application uses icons from the **Hass Hue Icons** project:

- **Source**: [hass-hue-icons](https://github.com/arallsopp/hass-hue-icons)
- **License**: Follows the license terms of the hass-hue-icons project
- **Usage**: Icons have been adapted for smartwatch display

We acknowledge and thank the hass-hue-icons project for providing high-quality Hue-compatible icons.

## Security Notes

- Credentials are stored locally on your device
- No data is sent to external servers

## Limitations & Known Issues

- Some advanced Hue features (entertainment, schedules) not yet supported
- Hue API v2 support

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Philips Hue](https://www.philips-hue.com/) for the amazing lighting platform
- [Zepp](https://www.zepp.com/) for the Zepp OS platform and SDK
- [hass-hue-icons](https://github.com/arallsopp/hass-hue-icons) for icon resources
- All contributors and users who help improve zhue

## Disclaimer

zhue is an independent project and is not officially affiliated with Philips Hue or Zepp. Use at your own discretion. Ensure compatibility with your specific devices before deployment.

---

**Made with ❤️ for smartwatch enthusiasts**

For more information about Zepp OS development, visit the [official documentation](https://docs.zepp.com/).
