// The screen stays on 60 s on every page of the app.
//
// setPageBrightTime alone didn't hold it: the screen went off ~5 s after the
// last touch on every page (log 18:39:01, 18:39:31, 18:39:58; 13:48:23 just
// after a page change). The sibling apps that keep it on (spark_controller,
// zeppamp, HTTP Buttons) also pause the screen-off of a lowered wrist and of
// a covering palm, as here, for the same 60 s; app.js onDestroy resets them.
// "This setting will follow the page destruction to do reset" (the docs): a
// closing page's reset can land after the next page set its own, so it is
// set at the build and once more when the page change has settled.
import { setPageBrightTime, pauseDropWristScreenOff, pausePalmScreenOff } from '@zos/display'
import { devLog, warnLog, LOG_TRACE } from './remote-log.js'

const ON_MS = 60000
const AGAIN_AFTER_MS = 800

function set(label, when) {
  const r = {}
  for (const [name, fn] of [
    ['bright', () => setPageBrightTime({ brightTime: ON_MS })],
    ['wrist', () => pauseDropWristScreenOff({ duration: ON_MS })],
    ['palm', () => pausePalmScreenOff({ duration: ON_MS })]
  ]) {
    try { r[name] = fn() } catch (e) { r[name] = `failed: ${e && e.message ? e.message : e}` }
  }
  const bad = Object.entries(r).filter(([, v]) => v !== undefined && v !== 0)
  if (bad.length) warnLog(`[screen] ${label} ${when}: ${bad.map(([k, v]) => `${k} ${v}`).join(', ')}`)
  else if (LOG_TRACE && !loggedThisRun()) {
    devLog(`[screen] kept on ${ON_MS / 1000} s (bright, wrist, palm: ${r.bright}, ${r.wrist}, ${r.palm})`)
  }
}

// Each page is its own bundle (a module variable is one per page): the flag
// lives in the app
function loggedThisRun() {
  const g = getApp() && getApp().globalData
  if (!g || g.screenKeptLogged) return true
  g.screenKeptLogged = true
  return false
}

// In build. The second call runs even if the page closed meanwhile: it then
// sets the same on the next page
export function keepScreenOn(label) {
  set(label, 'at the build')
  setTimeout(() => set(label, `${AGAIN_AFTER_MS}ms later`), AGAIN_AFTER_MS)
}
