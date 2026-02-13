import { Sun, Moon, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useState, useRef, useEffect } from 'react'
import GlobalSearchBar from '@/components/search/GlobalSearchBar'

export default function Header() {
  const { user, logout } = useAuthStore()
  const { isDark, toggle } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white dark:bg-dark-surface-50
                        border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
      <GlobalSearchBar />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={toggle} className="btn-ghost p-2 rounded-lg">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-dark-surface-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
              <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {user?.username || 'User'}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 card p-1 z-50 shadow-lg">
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100">
                {user?.roles?.join(', ') || 'No roles'}
              </div>
              <button
                onClick={() => { logout(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-1"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
