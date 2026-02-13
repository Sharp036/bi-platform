import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileBarChart, Database, Code2, Braces, CalendarClock, ChevronLeft, ChevronRight, Bell } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboards' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/queries', icon: Code2, label: 'Queries' },
  { to: '/scripts', icon: Braces, label: 'Scripts' },
  { to: '/datasources', icon: Database, label: 'Data Sources' },
  { to: '/schedules', icon: CalendarClock, label: 'Schedules' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={clsx(
      'flex flex-col h-screen bg-white dark:bg-dark-surface-50 border-r border-surface-200 dark:border-dark-surface-100 transition-all duration-200',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-surface-200 dark:border-dark-surface-100">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">DL</span>
        </div>
        {!collapsed && <span className="ml-3 font-semibold text-slate-800 dark:text-slate-100">DataLens</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-surface-100 dark:hover:bg-dark-surface-100'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-surface-200 dark:border-dark-surface-100
                   text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
