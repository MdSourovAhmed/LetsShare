import clsx from 'clsx'
import { formatBytes } from '../../lib/utils.js'
import ProgressBar from '../ui/ProgressBar.jsx'
import FileIcon from '../ui/FileIcon.jsx'

const statusMeta = {
  pending:    { label: 'Pending',    color: 'text-ink-faint' },
  uploading:  { label: 'Sending…',  color: 'text-brand-400' },
  completed:  { label: 'Sent',       color: 'text-status-connected' },
  error:      { label: 'Error',      color: 'text-status-error' },
}

/**
 * @param {{ rows: Array<{name:string,size:number,progress:number,status:string}> }} props
 */
export default function SenderFileTable({ rows }) {
  if (!rows.length) return null

  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
        <span className="font-heading font-semibold text-sm text-ink">Files</span>
        <span className="text-xs text-ink-muted">{rows.length} file{rows.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted/50">
              <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-wider">File</th>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-wider w-24">Size</th>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-wider w-40">Progress</th>
              <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-muted uppercase tracking-wider w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {rows.map((row, i) => {
              const meta = statusMeta[row.status] ?? statusMeta.pending
              const isDone = row.status === 'completed'
              return (
                <tr key={i} className="hover:bg-surface-muted/30 transition-colors">
                  {/* File name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
                        <FileIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="truncate max-w-[200px] text-ink font-medium" title={row.name}>
                        {row.name}
                      </span>
                    </div>
                  </td>
                  {/* Size */}
                  <td className="px-5 py-3.5 font-mono text-ink-muted text-xs">
                    {formatBytes(row.size)}
                  </td>
                  {/* Progress bar */}
                  <td className="px-5 py-3.5">
                    <div className="space-y-1">
                      <ProgressBar value={row.progress} variant={isDone ? 'success' : 'brand'} size="sm" />
                      <span className="text-xs text-ink-faint font-mono">{row.progress}%</span>
                    </div>
                  </td>
                  {/* Status */}
                  <td className={clsx('px-5 py-3.5 text-xs font-medium', meta.color)}>
                    {meta.label}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}