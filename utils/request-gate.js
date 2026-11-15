// One request at a time per control (a light's toggle, a group's toggle, the
// brightness slider...). Taps used to fire at once: each ZML request in flight
// holds ~10 KB on the watch, and a burst slowed answers to 7 s and failed on
// ZML's handshake (field-notes.md, "Memory" and "Messaging").
//
//   run(key, fn)          a toggle: a tap on a busy control waits for the one
//                         running (one waiting at most, more are dropped), so
//                         two quick taps still give on → off
//   run(key, fn, true)    a value (slider, color): only the latest waits,
//                         earlier ones are replaced
//   drop(key)             the value waiting is dropped (a command that
//                         overrides it, e.g. power off over a brightness)
//
// `fn` starts the request and returns its promise; it runs when its turn comes,
// so it reads the state of that moment. One gate per page, made in onInit
// (BasePage shares the page definition's fields between instances), closed in
// onDestroy: what was waiting is dropped with the page.
import { devLog, warnLog, LOG_TRACE } from './remote-log.js'
import { errorText } from './log-text.js'

export function createGate(label) {
  const slots = {}
  let open = true

  function run(key, fn, latest = false) {
    if (!open) return
    const slot = slots[key] || (slots[key] = { busy: false, next: null })
    if (slot.busy) {
      if (slot.next && !latest) {
        warnLog(`[${label}] ${key}: tap dropped, one already waiting`)
        return
      }
      // One line when something starts waiting; a live drag replaces the
      // waiting value at every move, silently
      if (LOG_TRACE && !slot.next) devLog(`[${label}] ${key}: waits for the request in flight`)
      slot.next = fn
      return
    }
    slot.busy = true
    start(slot, key, fn)
  }

  function start(slot, key, fn) {
    const done = () => {
      if (!open) return
      const next = slot.next
      slot.next = null
      if (next) start(slot, key, next)
      else slot.busy = false
    }
    let sent
    try {
      sent = fn()
    } catch (e) {
      warnLog(`[${label}] ${key}: request failed to start: ${errorText(e)}`)
      sent = null
    }
    Promise.resolve(sent).then(done, done)
  }

  // The value waiting behind the request in flight is dropped (the one in
  // flight can't be): true if there was one
  function drop(key) {
    const slot = slots[key]
    if (!slot || !slot.next) return false
    slot.next = null
    return true
  }

  return {
    run,
    drop,
    close() { open = false },
  }
}
