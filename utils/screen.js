// The screen stays on 60 s on every page of the app (setPageBrightTime).
//
// "This setting will follow the page destruction to do reset" (the docs): a
// page's time is reset when it closes, and that reset can land after the
// next page set its own. The screen went off 5 s after it was woken
// (13:48:18 on, 13:48:23 off), 1.6 s into the groups page just after the
// index page closed: the system's own time, back. So it is set at the build
// and once more when the page change has settled.
import { setPageBrightTime } from '@zos/display'
import { warnLog } from './remote-log.js'

const BRIGHT_MS = 60000
const AGAIN_AFTER_MS = 800

function set(label, when) {
  try {
    const r = setPageBrightTime({ brightTime: BRIGHT_MS })
    if (r !== undefined && r !== 0) warnLog(`[screen] ${label}: setPageBrightTime ${when} gave ${r}`)
  } catch (e) {
    warnLog(`[screen] ${label}: setPageBrightTime ${when} failed: ${e && e.message ? e.message : e}`)
  }
}

// In build. The second call runs even if the page closed meanwhile: it then
// sets the same time on the next page
export function keepScreenOn(label) {
  set(label, 'at the build')
  setTimeout(() => set(label, `${AGAIN_AFTER_MS}ms later`), AGAIN_AFTER_MS)
}
