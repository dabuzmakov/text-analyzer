const BROWSER_ID_STORAGE_KEY = 'text-analyzer-browser-id'

function generateBrowserId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateBrowserId() {
  const existing = window.localStorage.getItem(BROWSER_ID_STORAGE_KEY)

  if (existing) {
    return existing
  }

  const nextId = generateBrowserId()
  window.localStorage.setItem(BROWSER_ID_STORAGE_KEY, nextId)
  return nextId
}
