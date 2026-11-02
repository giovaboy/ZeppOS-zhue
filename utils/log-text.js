// Pieces of log lines shared by the watch and the side service. Plain JS, no
// @zos imports (the side service and the settings page load it too).

// An error's text for a log line. QuickJS throws null when it can't even make
// the error (out of memory); the side service answers failures as
// { error: '...' }, which ZML hands to the page as is.
export function errorText(e) {
  if (e === null) return 'null (the JS ran out of memory)'
  if (e === undefined) return 'undefined'
  if (typeof e === 'string') return e
  const parts = []
  if (e.code !== undefined) parts.push(`code ${e.code}`)
  if (e.message) parts.push(e.message)
  else if (typeof e.error === 'string') parts.push(e.error)
  else if (e.error && e.error.message) parts.push(e.error.message)
  if (e.status) parts.push(`HTTP ${e.status}`)
  if (parts.length) return parts.join(' ')
  try { return JSON.stringify(e).slice(0, 200) } catch (x) { return String(e) }
}

// Size of a text for a log line: "812 B", "3.2 KB"
export function sizeText(chars) {
  if (!(chars >= 0)) return '? B'
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`
}
