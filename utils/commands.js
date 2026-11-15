// The commands sent to the bridge, counted across the app's pages: a quiet
// refresh (a page drawn from the cache, read again behind it) drops its answer
// when a command left meanwhile, from any page, since that read may predate it
// and would show the light, or the group, as before the command.
//   Page(loggedPage('groups', countCommands(BasePage({ ... }))))
//   const n = commandCount()  ...  if (commandCount() !== n) drop
// The count lives in the app's globalData: each page is its own bundle, a
// module variable here would be one per page.
function store() {
  const a = getApp()
  return a && a.globalData
}

export function commandCount() {
  const g = store()
  return (g && g.commandsSent) || 0
}

// Every request but a read (GET_*) counts as a command
export function countCommands(options) {
  const request = options.request
  if (typeof request !== 'function') return options
  options.request = function (data, opts) {
    const method = (data && data.method) || ''
    if (!method.startsWith('GET_')) {
      const g = store()
      if (g) g.commandsSent = (g.commandsSent || 0) + 1
    }
    return request.call(this, data, opts)
  }
  return options
}
