import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Type, Minus, Plus, Trash2, Move, Link2, Square } from 'lucide-react'
import type { OverlayItem, OverlayRequest } from '@/types'
import { interactiveApi } from '@/api/interactive'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  reportId: number
  overlays: OverlayItem[]
  onRefresh: () => void
}

type OverlayType = 'IMAGE' | 'TEXT' | 'SHAPE' | 'DIVIDER'

export default function OverlayEditorPanel({ reportId, overlays, onRefresh }: Props) {
  const { t } = useTranslation()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<OverlayRequest>>({
    overlayType: 'IMAGE', content: '', positionX: 20, positionY: 20,
    width: 120, height: 60, opacity: 1.0, zIndex: 100, linkUrl: '',
  })

  const overlayTypes: { type: OverlayType; icon: React.ElementType; label: string }[] = [
    { type: 'IMAGE', icon: Image, label: t('interactive.overlay.image_logo') },
    { type: 'TEXT', icon: Type, label: t('interactive.overlay.text') },
    { type: 'SHAPE', icon: Square, label: t('interactive.overlay.shape') },
    { type: 'DIVIDER', icon: Minus, label: t('interactive.overlay.divider') },
  ]

  const handleSave = async () => {
    if (!form.content && form.overlayType !== 'DIVIDER') {
      toast.error('Content is required'); return
    }
    try {
      const req: OverlayRequest = {
        reportId,
        overlayType: form.overlayType || 'IMAGE',
        content: form.content || null,
        positionX: form.positionX || 0,
        positionY: form.positionY || 0,
        width: form.width || 100,
        height: form.height || 50,
        opacity: form.opacity || 1.0,
        zIndex: form.zIndex || 100,
        linkUrl: form.linkUrl || null,
        isVisible: true,
        style: {},
      }

      if (editId) {
        await interactiveApi.updateOverlay(editId, req)
        toast.success(t('interactive.overlay.updated'))
      } else {
        await interactiveApi.createOverlay(req)
        toast.success(t('interactive.overlay.added'))
      }
      setShowAdd(false); setEditId(null)
      onRefresh()
    } catch { toast.error(t('interactive.overlay.failed_save')) }
  }

  const handleEdit = (overlay: OverlayItem) => {
    setForm({
      overlayType: overlay.overlayType as OverlayType,
      content: overlay.content || '',
      positionX: overlay.positionX,
      positionY: overlay.positionY,
      width: overlay.width,
      height: overlay.height,
      opacity: overlay.opacity,
      zIndex: overlay.zIndex,
      linkUrl: overlay.linkUrl || '',
    })
    setEditId(overlay.id)
    setShowAdd(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('interactive.overlay.delete_confirm'))) return
    try {
      await interactiveApi.deleteOverlay(id)
      toast.success(t('interactive.overlay.deleted'))
      onRefresh()
    } catch { toast.error(t('interactive.overlay.failed_delete')) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('interactive.overlays')}
        </h3>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ overlayType: 'IMAGE', content: '', positionX: 20, positionY: 20, width: 120, height: 60, opacity: 1.0, zIndex: 100 }) }}
          className="btn-ghost p-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Existing overlays list */}
      {overlays.map(o => (
        <div key={o.id} className="flex items-center gap-2 p-2 bg-surface-50 dark:bg-dark-surface-100 rounded-lg text-xs">
          <Move className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex-1 truncate">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {o.overlayType}
            </span>
            {o.content && (
              <span className="ml-1 text-slate-400 truncate">
                {o.overlayType === 'IMAGE' ? '🖼️' : ''} {o.content.substring(0, 30)}...
              </span>
            )}
          </div>
          <span className="text-slate-400">{o.positionX},{o.positionY}</span>
          <button onClick={() => handleEdit(o)} className="text-brand-500 hover:text-brand-600">{t('common.edit')}</button>
          <button onClick={() => handleDelete(o.id)} className="text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Add/Edit form */}
      {showAdd && (
        <div className="bg-surface-50 dark:bg-dark-surface-100 rounded-lg p-3 space-y-3 border border-surface-200 dark:border-dark-surface-100">
          <h4 className="text-xs font-semibold text-slate-500">
            {editId ? t('interactive.overlay.edit_title') : t('interactive.overlay.add_title')}
          </h4>

          {/* Type selector */}
          <div className="flex gap-2">
            {overlayTypes.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, overlayType: type }))}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded border text-xs',
                  form.overlayType === type
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    : 'border-surface-200 dark:border-dark-surface-100 text-slate-500 hover:border-brand-300'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          {form.overlayType !== 'DIVIDER' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                {form.overlayType === 'IMAGE' ? t('interactive.overlay.image_url') : form.overlayType === 'TEXT' ? t('interactive.overlay.html_content') : t('interactive.overlay.svg_content')}
              </label>
              <textarea
                value={form.content || ''}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={form.overlayType === 'IMAGE' ? t('interactive.overlay.image_placeholder') : t('interactive.overlay.content_placeholder')}
                className="input text-xs font-mono h-16 resize-none w-full"
              />
            </div>
          )}

          {/* Position & size */}
          <div className="grid grid-cols-4 gap-2">
            <Field label={t('interactive.overlay.x')} value={form.positionX || 0} onChange={v => setForm(f => ({ ...f, positionX: v }))} />
            <Field label={t('interactive.overlay.y')} value={form.positionY || 0} onChange={v => setForm(f => ({ ...f, positionY: v }))} />
            <Field label={t('interactive.overlay.w')} value={form.width || 100} onChange={v => setForm(f => ({ ...f, width: v }))} />
            <Field label={t('interactive.overlay.h')} value={form.height || 50} onChange={v => setForm(f => ({ ...f, height: v }))} />
          </div>

          {/* Opacity & z-index */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">{t('interactive.overlay.opacity')}</label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={form.opacity || 1}
                onChange={e => setForm(f => ({ ...f, opacity: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="text-[10px] text-slate-400">{((form.opacity || 1) * 100).toFixed(0)}{t('interactive.overlay.percent')}</span>
            </div>
            <Field label={t('interactive.overlay.z_index')} value={form.zIndex || 100} onChange={v => setForm(f => ({ ...f, zIndex: v }))} />
          </div>

          {/* Link URL */}
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> {t('interactive.overlay.click_url')}
            </label>
            <input
              value={form.linkUrl || ''}
              onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
              placeholder={t('interactive.overlay.url_placeholder')}
              className="input text-xs w-full"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditId(null) }} className="btn-secondary text-xs">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="btn-primary text-xs">
              {editId ? t('common.update') : t('common.add')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500">{label}</label>
      <input
        type="number" value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="input text-xs w-full"
      />
    </div>
  )
}
