import React from 'react'
import clsx from 'clsx'
import { formatBytes } from '../../lib/utils'
import ProgressBar from '../ui/ProgressBar'

const phaseStyles = {
  connecting:  { dot: 'bg-status-connecting animate-pulse-dot', label: 'Connecting…',  text: 'text-status-connecting' },
  transferring:{ dot: 'bg-brand-400',                          label: 'Sending…',      text: 'text-brand-400' },
  done:        { dot: 'bg-status-connected',                   label: 'Complete',      text: 'text-status-connected' },
  error:       { dot: 'bg-status-error',                       label: 'Error',         text: 'text-status-error' },
}

/**
 * @param {{
 *   receiver: import('../../hooks/useSender').ReceiverEntry,
 *   fileList: Array<{path:string,name:string,size:number}>,
 *   totalSize: number,
 * }} props
 */
export default function ReceiverCard({ receiver, fileList, totalSize }) {
  const ps  = phaseStyles[receiver.phase] ?? phaseStyles.connecting
  const pct = totalSize > 0 ? Math.floor((receiver.totalSent / totalSize) * 100) : 0

  return (
    <div className={clsx(
      'card p-4 space-y-3 transition-all duration-300',
      receiver.phase === 'done'  && 'border-status-connected/30',
      receiver.phase === 'error' && 'border-status-error/30',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={clsx('status-dot', ps.dot)} />
          <span className="font-semibold text-sm text-ink">{receiver.label}</span>
        </div>
        <span className={clsx('text-xs font-medium', ps.text)}>{ps.label}</span>
      </div>

      {/* Overall bar */}
      {(receiver.phase === 'transferring' || receiver.phase === 'done') && (
        <div className="space-y-1">
          <ProgressBar
            value={pct}
            variant={receiver.phase === 'done' ? 'success' : 'brand'}
            size="sm"
          />
          <div className="flex justify-between text-xs text-ink-faint font-mono">
            <span>{formatBytes(receiver.totalSent)}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* Per-file mini-bars — only shown while actively transferring */}
      {receiver.phase === 'transferring' && fileList.length > 1 && (
        <div className="space-y-1.5 pt-1 border-t border-surface-border">
          {fileList.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-ink-faint truncate flex-1 min-w-0" title={f.path}>
                {f.path}
              </span>
              <span className="text-xs font-mono text-ink-faint w-8 text-right flex-shrink-0">
                {receiver.fileProgress[i] ?? 0}%
              </span>
              <div className="w-16 flex-shrink-0">
                <ProgressBar value={receiver.fileProgress[i] ?? 0} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {receiver.phase === 'error' && receiver.error && (
        <p className="text-xs text-status-error">{receiver.error}</p>
      )}
    </div>
  )
}