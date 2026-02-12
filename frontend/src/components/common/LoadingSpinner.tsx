import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
    </div>
  )
}
