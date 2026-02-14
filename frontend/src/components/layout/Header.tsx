import { Sun, Moon, LogOut, User, Globe } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { authApi } from '@/api/auth'
import GlobalSearchBar from '@/components/search/GlobalSearchBar'
import clsx from 'clsx'

export default function Header() {
  const { user, logout } = useAuthStore()
  const { isDark, toggle } = useThemeStore()
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLanguageChange = async (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('language', code)
    setLangOpen(false)
    try {
      await authApi.updateLanguage(code)
    } catch {
      // Language is already set locally
    }
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white dark:bg-dark-surface-50
                        border-b border-surface-200 dark:border-dark-surface-100 flex-shrink-0">
      <GlobalSearchBar />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={toggle} className="btn-ghost p-2 rounded-lg">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button onClick={() => setLangOpen(!langOpen)} className="btn-ghost p-2 rounded-lg" title={t('header.language')}>
            <Globe className="w-5 h-5" />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-surface-50 rounded-xl shadow-xl border border-surface-200 dark:border-dark-surface-100 p-1 z-50 max-h-80 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={clsx(
                    'flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg',
                    i18n.language === lang.code
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                      : 'hover:bg-surface-100 dark:hover:bg-dark-surface-100 text-slate-700 dark:text-slate-300'
                  )}
                >
                  <span>{lang.nativeName}</span>
                  <span className="text-xs text-slate-400">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
              {user?.username || t('common.user')}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 card p-1 z-50 shadow-lg">
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-surface-200 dark:border-dark-surface-100">
                {user?.roles?.join(', ') || t('common.no_roles')}
              </div>
              <button
                onClick={() => { logout(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-1"
              >
                <LogOut className="w-4 h-4" /> {t('auth.sign_out')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
