import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ThemeContext } from './themeContext'

// Theme = 'light' | 'dark' | 'system'. Applied as a .dark class on <html> so
// the semantic tokens in index.css flip; also keeps the PWA chrome color in sync.
const STORAGE_KEY = 'theme'
const META_COLORS = { light: '#f4f6f9', dark: '#0b0e14' }

function subscribeSystem(cb) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system')
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false)
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback((next) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', META_COLORS[resolved])
  }, [resolved])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: resolved === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}
