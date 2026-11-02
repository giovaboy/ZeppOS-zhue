// The Logs box: storage key, size, and the scrubber every line goes through
// (phone lines and the watch's [w] lines alike). Plain JS, no @zos imports: the
// settings page imports LOG_KEY from here.
// Shared rule: ../_shared/zeppos-ai-doc/logging.md
import { logsPrivate } from '../config.js'

export const LOG_KEY = 'app_log'
export const LOG_MAX = 200

// "a local address" / "a remote address" for a URL or a bare host, by its host
export function addressForLog(url) {
  const m = /^(?:https?:\/\/)?(?:[^@/\s]*@)?(\[[^\]]*\]|[^:/\s?#]+)/i.exec(String(url))
  const host = m ? m[1].toLowerCase() : ''
  if (!host) return 'an address'
  const local =
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host) ||
    host === 'localhost' ||
    /\.(local|lan|home|internal|localdomain)$/.test(host) ||
    /^[a-z0-9-]+$/.test(host) || // a bare host name: on the home network
    /^\[(fc|fd|fe80|::1)/.test(host)
  return local ? 'a local address' : 'a remote address'
}

// A request for a log line: its path with the bridge key left out, and what
// kind of address it went to. The Hue v1 API carries the key in the path
// (/api/<key>/lights/3/state), not in a header or a query value.
//   'GET /api/…/lights (a local address)'
export function requestForLog(method, url) {
  const text = String(url || '')
  const path = (text.replace(/^https?:\/\/[^/\s]+/i, '') || '/')
    .replace(/^\/api\/[^/?#\s]+/, '/api/…')
    .replace(/([?&][^=&\s#]+=)[^&\s#]*/g, '$1…')
  const where = logsPrivate() ? text.replace(/^(https?:\/\/[^/\s]+).*$/i, '$1') : addressForLog(text)
  return `${method || 'GET'} ${path} (${where})`
}

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

// A line for the Logs box, whatever wrote it: never one of `secrets` (the
// bridge key; longest first); in other than developer builds no address
// either (whole URLs and bare IPs: the bridge's address is the user's)
export function scrubLog(line, secrets = []) {
  let text = String(line)
    // every query parameter's value
    .replace(/([?&][^=&\s"')|#]+=)[^&\s"')|#]*/g, '$1…')
    // a v1 path carrying the key, written by anyone
    .replace(/(\/api\/)[A-Za-z0-9_-]{20,}/g, '$1…')
    // "username":"…" in a JSON text (the pairing answer)
    .replace(/("(?:username|clientkey|hue-application-key)"\s*:\s*")[^"]*"/gi, '$1…"')
  if (!logsPrivate()) {
    text = text
      .replace(/https?:\/\/[^\s"')|]+/g, (url) => `(${addressForLog(url)})`)
      .replace(IPV4, (ip) => `(${addressForLog(ip)})`)
  }
  for (const s of secrets) text = replaceWord(text, s)
  return text
}

const WORD_CHAR = /[A-Za-z0-9]/
// Every `secret` in `text` that stands alone (not inside a longer word)
// becomes "…"
function replaceWord(text, secret) {
  if (!secret) return text
  let out = ''
  let from = 0
  let at = text.indexOf(secret)
  while (at !== -1) {
    const end = at + secret.length
    const before = at > 0 ? text[at - 1] : ''
    const after = end < text.length ? text[end] : ''
    const alone = !(before && WORD_CHAR.test(before) && WORD_CHAR.test(secret[0])) &&
      !(after && WORD_CHAR.test(after) && WORD_CHAR.test(secret[secret.length - 1]))
    if (alone) { out += text.slice(from, at) + '…'; from = end }
    at = text.indexOf(secret, alone ? end : at + 1)
  }
  return from ? out + text.slice(from) : text
}
