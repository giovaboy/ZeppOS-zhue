// Right swipe goes back, except while a finger drags a control (a slider,
// the color picker) or just after.
//
// Replaces a lock / unlock of the swipe at each drag that couldn't work:
// onGesture returns nothing (its result was called as if it removed the
// listener), and a page takes one onGesture registration (a second makes the
// first fail, per the docs), while the drags registered one at every touch
// and release. A drag to the right was taken for the back swipe.
//
// One registration per page, in build. A drag tells the guard when it starts
// (start), moves (move) and ends (end). The system may report the swipe on
// release, after the drag's end: a swipe within GRACE_MS of it is ignored
// too. A drag whose release never came (the finger left the control) stops
// counting STALE_MS after its last move, so the back swipe can't stay off.
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { back } from '@zos/router'
import { devLog, LOG_TRACE } from './remote-log.js'

const GRACE_MS = 500
const STALE_MS = 1500

export function createDragGuard(label, onBack = back) {
  let dragging = false
  let lastMoveAt = 0
  let endedAt = 0

  onGesture({
    callback: (event) => {
      if (event !== GESTURE_RIGHT) return false
      const now = Date.now()
      const active = dragging && now - lastMoveAt < STALE_MS
      const sinceEnd = now - endedAt
      if (active || sinceEnd < GRACE_MS) {
        if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe ignored, ${active ? `drag under way (last move ${now - lastMoveAt}ms ago)` : `drag ended ${sinceEnd}ms ago`}`)
        return true
      }
      if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe, back${endedAt ? ` (last drag ended ${sinceEnd}ms ago)` : ''}`)
      onBack()
      return true
    }
  })

  return {
    start() { dragging = true; lastMoveAt = Date.now() },
    move() { lastMoveAt = Date.now() },
    end() { dragging = false; endedAt = Date.now() }
  }
}
