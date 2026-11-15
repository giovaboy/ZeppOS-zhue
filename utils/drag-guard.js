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
//
// A swipe reported during a drag means the system took the touch: no move
// and no release come after it (log 01:57:50 and 01:58:05: the slider's own
// 1.5 s timeout ended those drags, and a second swipe 1.4 s later was
// ignored too). The swipe is still not a back (it may be the drag itself),
// but the drag ends there: onDragCut lets the page close it (send the
// value, unlock the scrolling), and the next swipe goes back.
//
// Unless the drag was short (under QUICK_MS, during it or just after its
// release): then it was the swipe itself, started on the control. The log
// had them at 125 and 399 ms, each leaving the brightness near its top.
// onQuickSwipe undoes the drag (it may return a promise: the undo sent),
// then the page goes back.
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { back } from '@zos/router'
import { devLog, LOG_TRACE } from './remote-log.js'

const GRACE_MS = 500
const STALE_MS = 1500
const QUICK_MS = 450

export function createDragGuard(label, onBack = back, onDragCut = null, onQuickSwipe = null) {
  let dragging = false
  let startedAt = 0
  let lastMoveAt = 0
  let endedAt = 0
  let leaving = false

  onGesture({
    callback: (event) => {
      if (event !== GESTURE_RIGHT) return false
      if (leaving) return true
      const now = Date.now()
      const active = dragging && now - lastMoveAt < STALE_MS
      const sinceEnd = now - endedAt
      const dragMs = active ? now - startedAt : sinceEnd < GRACE_MS ? endedAt - startedAt : null
      if (onQuickSwipe && dragMs !== null && dragMs < QUICK_MS) {
        if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe over a ${dragMs}ms drag (${active ? 'under way' : `ended ${sinceEnd}ms ago`}): taken as back, the drag undone`)
        leaving = true
        dragging = false
        endedAt = now
        Promise.resolve().then(onQuickSwipe).catch(() => {}).then(() => onBack())
        return true
      }
      if (active) {
        if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe ignored, drag under way (started ${now - startedAt}ms ago, last move ${now - lastMoveAt}ms ago): drag ended`)
        dragging = false
        endedAt = now
        if (onDragCut) onDragCut()
        return true
      }
      if (sinceEnd < GRACE_MS) {
        if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe ignored, drag ended ${sinceEnd}ms ago`)
        return true
      }
      if (LOG_TRACE) devLog(`[gesture] ${label}: right swipe, back${endedAt ? ` (last drag ended ${sinceEnd}ms ago)` : ''}`)
      onBack()
      return true
    }
  })

  return {
    start() { dragging = true; startedAt = lastMoveAt = Date.now() },
    move() { lastMoveAt = Date.now() },
    end() { dragging = false; endedAt = Date.now() }
  }
}
