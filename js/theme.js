// Manual theme override on top of system preference.
// auto (follow system) → light → dark, persisted in localStorage.
const ORDER = ['auto', 'light', 'dark']
export const LABELS = { auto: 'Auto', light: 'Claro', dark: 'Escuro' }
export const ICONS = { auto: 'auto', light: 'sun', dark: 'moon' }

export const currentTheme = () => localStorage.getItem('theme') || 'auto'

export function applyTheme() {
  const t = currentTheme()
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function cycleTheme() {
  const next = ORDER[(ORDER.indexOf(currentTheme()) + 1) % ORDER.length]
  localStorage.setItem('theme', next)
  applyTheme()
  return next
}
