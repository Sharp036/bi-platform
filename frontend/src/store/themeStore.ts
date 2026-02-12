import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggle: () => void
}

const getInitial = () => {
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = create<ThemeState>((set) => {
  const isDark = getInitial()
  document.documentElement.classList.toggle('dark', isDark)
  return {
    isDark,
    toggle: () =>
      set((state) => {
        const next = !state.isDark
        document.documentElement.classList.toggle('dark', next)
        localStorage.setItem('theme', next ? 'dark' : 'light')
        return { isDark: next }
      }),
  }
})
