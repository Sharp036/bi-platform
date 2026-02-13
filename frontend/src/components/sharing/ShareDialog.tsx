import { useState, useEffect } from 'react'
import { sharingApi, ShareEntry } from '@/api/sharing'
import { adminUserApi, adminRoleApi, AdminUser, RoleListItem } from '@/api/admin'
import { X, UserPlus, Shield, Trash2, Share2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

interface ShareDialogProps {
  objectType: string;
  objectId: number;
  objectName: string;
  onClose: () => void;
}

const ACCESS_LEVELS = [
  { value: 'VIEW', label: 'Viewer', desc: 'Can view' },
  { value: 'EDIT', label: 'Editor', desc: 'Can view and edit' },
  { value: 'ADMIN', label: 'Admin', desc: 'Full access + manage sharing' },
]

const accessBadgeColor: Record<string, string> = {
  VIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  EDIT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function ShareDialog({ objectType, objectId, objectName, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [loading, setLoading] = useState(true)

  // Add share form
  const [shareType, setShareType] = useState<'user' | 'role'>('user')
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [accessLevel, setAccessLevel] = useState('VIEW')

  useEffect(() => {
    Promise.all([
      sharingApi.getShares(objectType, objectId),
      adminUserApi.list(0, 100),
      adminRoleApi.list(),
    ]).then(([sharesData, usersData, rolesData]) => {
      setShares(sharesData)
      setUsers(usersData.content)
      setRoles(rolesData)
    }).catch(() => toast.error('Failed to load sharing info'))
      .finally(() => setLoading(false))
  }, [objectType, objectId])

  const handleGrant = async () => {
    if (!selectedId) return
    try {
      const entry = await sharingApi.grant({
        objectType,
        objectId,
        userId: shareType === 'user' ? Number(selectedId) : undefined,
        roleId: shareType === 'role' ? Number(selectedId) : undefined,
        accessLevel,
      })
      setShares(prev => {
        const filtered = prev.filter(s =>
          !(s.userId === entry.userId && s.roleId === entry.roleId)
        )
        return [...filtered, entry]
      })
      setSelectedId('')
      toast.success('Access granted')
    } catch {
      toast.error('Failed to grant access')
    }
  }

  const handleRevoke = async (share: ShareEntry) => {
    try {
      await sharingApi.revoke({
        objectType,
        objectId,
        userId: share.userId ?? undefined,
        roleId: share.roleId ?? undefined,
      })
      setShares(prev => prev.filter(s => s.id !== share.id))
      toast.success('Access revoked')
    } catch {
      toast.error('Failed to revoke access')
    }
  }

  const handleLevelChange = async (share: ShareEntry, newLevel: string) => {
    try {
      const updated = await sharingApi.grant({
        objectType,
        objectId,
        userId: share.userId ?? undefined,
        roleId: share.roleId ?? undefined,
        accessLevel: newLevel,
      })
      setShares(prev => prev.map(s => s.id === share.id ? updated : s))
    } catch {
      toast.error('Failed to update access level')
    }
  }

  // Filter out already-shared users/roles from the dropdown
  const availableUsers = users.filter(u =>
    !shares.some(s => s.userId === u.id)
  )
  const availableRoles = roles.filter(r =>
    !shares.some(s => s.roleId === r.id)
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-lg mx-4"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-dark-surface-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Share: {objectName}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Add share */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-dark-surface-100">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setShareType('user'); setSelectedId('') }}
              className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium',
                shareType === 'user'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-slate-500 hover:bg-surface-100 dark:hover:bg-dark-surface-100'
              )}
            >
              <UserPlus className="w-4 h-4" /> User
            </button>
            <button
              onClick={() => { setShareType('role'); setSelectedId('') }}
              className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium',
                shareType === 'role'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-slate-500 hover:bg-surface-100 dark:hover:bg-dark-surface-100'
              )}
            >
              <Shield className="w-4 h-4" /> Role
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')}
              className="input flex-1"
            >
              <option value="">Select {shareType}...</option>
              {shareType === 'user'
                ? availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.username} ({u.email})
                    </option>
                  ))
                : availableRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))
              }
            </select>
            <select value={accessLevel} onChange={e => setAccessLevel(e.target.value)} className="input w-28">
              {ACCESS_LEVELS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <button
              onClick={handleGrant}
              disabled={!selectedId}
              className="btn-primary px-4 disabled:opacity-50"
            >
              Share
            </button>
          </div>
        </div>

        {/* Current shares */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
            People & roles with access
          </h3>

          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-slate-400">Not shared with anyone yet</p>
          ) : (
            <div className="space-y-2">
              {shares.map(share => (
                <div key={share.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 dark:hover:bg-dark-surface-100">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      share.userId
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                    )}>
                      {share.userId
                        ? (share.userDisplayName || share.username || '?')[0].toUpperCase()
                        : (share.roleName || 'R')[0]
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {share.userId
                          ? (share.userDisplayName || share.username)
                          : share.roleName
                        }
                      </p>
                      <p className="text-xs text-slate-400">
                        {share.userId ? 'User' : 'Role'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={share.accessLevel}
                      onChange={e => handleLevelChange(share, e.target.value)}
                      className={clsx('text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer',
                        accessBadgeColor[share.accessLevel] || accessBadgeColor.VIEW
                      )}
                    >
                      {ACCESS_LEVELS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRevoke(share)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-200 dark:border-dark-surface-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Done</button>
        </div>
      </div>
    </div>
  )
}
