// The app's memory, for trace lines (getPerformance, API 4.0; this app is
// compatible down to 3.0, where the export is missing: '' then). The limit an
// app meets is the system's memory, not a share per app (field-notes.md,
// "Memory").
import { getPerformance } from '@zos/app'
import { errorText } from './log-text.js'

// app.json appId: the app's entry in the list of running apps
const APP_ID = 1102239
const KB = (n) => Math.round((n || 0) / 1024)

// "mem 312 KB (peak 480), system 3100/5120 KB", or '' when not available
export function memoryUsage() {
  try {
    if (typeof getPerformance !== 'function') return ''
    const memory = getPerformance('memory')
    const m = memory && memory.memory
    if (!m) return ''
    const apps = m.app || []
    const app = apps.find((a) => Number(a.appid) === APP_ID) || (apps.length === 1 ? apps[0] : null)
    let line = app ? `mem ${KB(app.used)} KB (peak ${KB(app.peak)})` : 'mem: app not listed'
    if (m.system) line += `, system ${KB(m.system.used)}/${KB(m.system.total)} KB`
    return line
  } catch (e) {
    return `mem: ${errorText(e)}`
  }
}
