// Lines for the phone's Logs box, written from pages and their modules. They go
// through the app (app.js "Remote log"): its queue outlives the page, and the
// phone scrubs every line (app-side/log.js) before storing it.
// Shared rule: ../_shared/zeppos-ai-doc/logging.md
//
// Never put in a line: the bridge key or the bridge's address. Say what
// happened with numbers (time, size, count, memory). Guard costly lines
// (memory, sizes) with LOG_TRACE so they cost nothing in other builds.
import { logs } from '../config.js'
import { getLogger } from './logger.js'
import { errorText } from './log-text.js'
import { memoryUsage } from './memory.js'

const logger = getLogger('zhue')

export const LOG_TRACE = logs('trace')
export const LOG_INFO = logs('info')

function app() {
  try { return getApp() } catch (e) { return null }
}

// Diagnostics (trace builds)
export function devLog(msg) {
  const a = app()
  if (a && a.devLog) a.devLog(msg)
  else logger.debug(msg)
}

// The main events (info and trace builds)
export function infoLog(msg) {
  const a = app()
  if (a && a.remoteLog) a.remoteLog(msg)
  else logger.info(msg)
}

// A problem: in every build but public releases
export function warnLog(msg) {
  const a = app()
  if (a && a.warnLog) a.warnLog(msg)
  else logger.warn(msg)
}

// A page whose opening, build time, requests to the phone and closing reach
// the Logs box: Page(loggedPage('groups', BasePage({ ... }))).
// ZML's BasePage puts `request` on the object it returns, so it is wrapped
// here once instead of at each call: every request gets a line with its time
// (trace), every failure one in every build. With LOG_LEVEL 'off' the page is
// returned untouched.
export function loggedPage(name, options) {
  if (!logs('warn')) return options

  const request = options.request
  if (typeof request === 'function') {
    options.request = function (data, opts) {
      const method = (data && data.method) || '?'
      const t0 = Date.now()
      let sent
      try { sent = request.call(this, data, opts) } catch (e) {
        warnLog(`[${name}] ${method} not sent: ${errorText(e)}`)
        throw e
      }
      return Promise.resolve(sent).then(
        (result) => {
          if (result && result.success === false) {
            warnLog(`[${name}] ${method} answered without success in ${Date.now() - t0}ms: ${errorText(result)}`)
          } else if (LOG_TRACE) {
            devLog(`[${name}] ${method} ok in ${Date.now() - t0}ms`)
          }
          return result
        },
        (e) => {
          warnLog(`[${name}] ${method} failed after ${Date.now() - t0}ms: ${errorText(e)}`)
          throw e
        }
      )
    }
  }

  const build = options.build
  options.build = function (...args) {
    this._logOpenedAt = Date.now()
    // Answers to the log batches sent before this page are lost (app.js
    // pageChanged): they go again with this page's first line
    const a = app()
    if (a && a.pageChanged) a.pageChanged()
    const t0 = Date.now()
    const out = build && build.apply(this, args)
    if (LOG_TRACE) {
      const mem = memoryUsage()
      devLog(`[${name}] built in ${Date.now() - t0}ms${mem ? `: ${mem}` : ''}`)
    }
    return out
  }

  const onDestroy = options.onDestroy
  options.onDestroy = function (...args) {
    const out = onDestroy && onDestroy.apply(this, args)
    if (LOG_TRACE) {
      const shown = this._logOpenedAt ? ` after ${((Date.now() - this._logOpenedAt) / 1000).toFixed(1)}s` : ''
      devLog(`[${name}] closed${shown}`)
    }
    return out
  }

  return options
}
