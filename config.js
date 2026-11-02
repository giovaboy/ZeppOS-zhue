// Build switches for the whole app: watch, side service, settings page.
// Shared rule for every ZeppOS project: ../_shared/zeppos-ai-doc/logging.md

// Developer build: the Logs box may show the bridge's address and the phone's
// console gets the side service's lines. The bridge key is scrubbed in every
// build. Never in a build given to others
export const DEV = false

// How much goes to the phone's Logs box (settings page):
//   'trace' everything, the diagnostic lines too (devLog / vlog): test builds
//   'info'  the main events (a tap and its outcome) and the problems: builds
//           given to someone helping with a problem
//   'warn'  only the problems
//   'off'   PUBLIC RELEASES: nothing is logged, no line goes to the phone, and
//           the settings page has no Logs box. A user with a problem reports
//           it; one willing to help gets a test build with the logs on
export const LOG_LEVEL = 'trace'

const LEVELS = { trace: 0, info: 1, warn: 2, off: 3 }

// Lines of `level` are logged in this build (none with 'off', warn included)
export const logs = (level) => LEVELS[level] >= LEVELS[LOG_LEVEL]

// The Logs box and the watch → phone lines exist in this build
export const logsEnabled = () => LOG_LEVEL !== 'off'

// The bridge's address in the Logs box, and the phone's console: developer
// builds with trace only. The bridge key (hue_username): never, in any build
// (see app-side/log.js scrubLog)
export const logsPrivate = () => DEV && logs('trace')
