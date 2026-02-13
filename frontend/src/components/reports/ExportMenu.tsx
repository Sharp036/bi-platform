import { useState, useRef, useEffect } from 'react'
import { exportApi } from '@/api/export'
import { Download, FileSpreadsheet, FileText, FileDown, Mail, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  reportId: number
  reportName: string
  parameters?: Record<string, unknown>
}

export default function ExportMenu({ reportId, reportName, parameters = {} }: Props) {
  const [open, setOpen] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailFormat, setEmailFormat] = useState('CSV')
  const [sending, setSending] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleDownload = async (format: string) => {
    setOpen(false)
    toast.loading(`Exporting as ${format}...`, { id: 'export' })
    try {
      const blob = await exportApi.download(reportId, format, parameters)
      const ext = format === 'EXCEL' ? 'xlsx' : format.toLowerCase()
      const filename = `${reportName.replace(/[^a-zA-Z0-9_\-.]/g, '_')}.${ext}`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Downloaded ${filename}`, { id: 'export' })
    } catch {
      toast.error('Export failed', { id: 'export' })
    }
  }

  const handleEmail = async () => {
    const recipients = emailRecipients.split(/[,;\s]+/).filter(Boolean)
    if (recipients.length === 0) { toast.error('Enter at least one email'); return }

    setSending(true)
    try {
      const result = await exportApi.emailReport(reportId, {
        recipients,
        format: emailFormat,
        parameters,
      })
      if (result.success) {
        toast.success(result.message)
        setShowEmail(false)
        setEmailRecipients('')
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary text-sm"
      >
        <Download className="w-4 h-4" /> Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-dark-surface-50 rounded-xl shadow-xl border border-surface-200 dark:border-dark-surface-100 py-1 z-50">
          <button
            onClick={() => handleDownload('CSV')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            CSV
          </button>
          <button
            onClick={() => handleDownload('EXCEL')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => handleDownload('PDF')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
          >
            <FileDown className="w-4 h-4 text-red-500" />
            PDF
          </button>

          <div className="border-t border-surface-200 dark:border-dark-surface-100 my-1" />

          <button
            onClick={() => { setOpen(false); setShowEmail(true) }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-dark-surface-100"
          >
            <Mail className="w-4 h-4 text-brand-500" />
            Email report...
          </button>
        </div>
      )}

      {/* Email modal */}
      {showEmail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowEmail(false)}>
          <div
            className="bg-white dark:bg-dark-surface-50 rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Email Report</h3>
              <button onClick={() => setShowEmail(false)} className="btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Recipients (comma-separated)</label>
                <textarea
                  value={emailRecipients}
                  onChange={e => setEmailRecipients(e.target.value)}
                  placeholder="user@example.com, team@company.com"
                  className="input text-sm h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Format</label>
                <select value={emailFormat} onChange={e => setEmailFormat(e.target.value)} className="input text-sm">
                  <option value="CSV">CSV</option>
                  <option value="EXCEL">Excel</option>
                  <option value="PDF">PDF</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowEmail(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleEmail} disabled={sending} className="btn-primary text-sm">
                <Mail className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
