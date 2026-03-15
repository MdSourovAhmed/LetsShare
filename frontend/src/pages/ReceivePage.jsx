// import { useSearchParams } from 'react-router-dom'
// import { useReceiver } from '../hooks/useReceiver'
// import ReceiverFileTable from '../components/receive/ReceiverFileTable'
// import OverallProgress from '../components/ui/OverallProgress'
// import StatusBadge from '../components/ui/StatusBadge'

// function phaseToStatus(phase) {
//   if (phase === 'done') return 'connected'
//   if (phase === 'error') return 'error'
//   if (phase === 'idle') return 'idle'
//   if (phase === 'connecting') return 'connecting'
//   return 'connected' // connected / receiving
// }

// export default function ReceivePage() {
//   const [params] = useSearchParams()
//   const linkId = params.get('id') ?? ''

//   const { state } = useReceiver(linkId)
//   const { phase, statusText, fileRows, totalSize, totalReceived } = state

//   const showProgress = (phase === 'receiving' || phase === 'done') && totalSize > 0

//   return (
//     <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
//       {/* Page header */}
//       <div>
//         <h1 className="font-heading font-bold text-3xl text-ink tracking-tight">Receive Files</h1>
//         <p className="text-ink-muted mt-1 text-sm">
//           Waiting for the sender to connect and start the transfer.
//         </p>
//       </div>

//       {/* Connection info card */}
//       <div className="card p-6 space-y-5">
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
//           {/* Connection ID */}
//           <div className="space-y-1.5">
//             <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
//               Connection ID
//             </label>
//             <div className="bg-surface-muted border border-surface-border rounded-xl px-4 py-2.5">
//               <code className="font-mono text-sm text-brand-400 break-all">
//                 {linkId || '(missing)'}
//               </code>
//             </div>
//           </div>

//           {/* Status */}
//           <div className="space-y-1.5">
//             <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
//               Status
//             </label>
//             <div className="bg-surface-muted border border-surface-border rounded-xl px-4 py-2.5 flex items-center h-[42px]">
//               <StatusBadge type={phaseToStatus(phase)} label={statusText} />
//             </div>
//           </div>
//         </div>

//         {/* No link id warning */}
//         {!linkId && (
//           <div className="flex gap-3 p-4 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-sm">
//             <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
//                 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
//             </svg>
//             <span>No link ID found in URL. Ask the sender to share the correct link with you.</span>
//           </div>
//         )}

//         {/* Connecting animation */}
//         {(phase === 'connecting' || phase === 'idle') && linkId && (
//           <div className="flex flex-col items-center py-6 gap-4 text-ink-muted">
//             <div className="relative">
//               <div className="w-12 h-12 rounded-full border-2 border-brand-500/20" />
//               <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
//             </div>
//             <p className="text-sm">Waiting for sender…</p>
//           </div>
//         )}
//       </div>

//       {/* Overall progress */}
//       {showProgress && (
//         <div className="card p-5 animate-slide-up">
//           <OverallProgress
//             totalSize={totalSize}
//             totalTransferred={totalReceived}
//             label="Receiving"
//           />
//         </div>
//       )}

//       {/* Done banner */}
//       {phase === 'done' && (
//         <div className="flex gap-3 p-4 rounded-xl bg-status-connected/10 border border-status-connected/20 text-status-connected text-sm animate-slide-up">
//           <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//           </svg>
//           <span>All files received successfully! Click the download buttons below to save them.</span>
//         </div>
//       )}

//       {/* File table */}
//       {fileRows.length > 0 && <ReceiverFileTable rows={fileRows} />}
//     </div>
//   )
// }


import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReceiver } from '../hooks/useReceiver'
import ReceiverFileTable from '../components/receive/ReceiverFileTable'
import OverallProgress from '../components/ui/OverallProgress'
import StatusBadge from '../components/ui/StatusBadge'

function phaseToStatus(phase) {
  if (phase === 'done')       return 'connected'
  if (phase === 'error')      return 'error'
  if (phase === 'connecting') return 'connecting'
  if (phase === 'receiving')  return 'connected'
  return 'idle'
}

export default function ReceivePage() {
  const [params] = useSearchParams()
  const linkId = params.get('id') ?? ''
  const { state } = useReceiver(linkId)
  const { phase, statusText, fileRows, totalSize, totalReceived } = state
  const showProgress = (phase === 'receiving' || phase === 'done') && totalSize > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="font-heading font-bold text-3xl text-ink tracking-tight">Receive Files</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Connected to sender's session. Files transfer directly to your browser.
        </p>
      </div>

      {/* Connection info */}
      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
              Session ID
            </label>
            <div className="bg-surface-muted border border-surface-border rounded-xl px-4 py-2.5">
              <code className="font-mono text-sm text-brand-400 break-all">
                {linkId || '(missing)'}
              </code>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
              Status
            </label>
            <div className="bg-surface-muted border border-surface-border rounded-xl px-4 py-2.5 flex items-center h-[42px]">
              <StatusBadge type={phaseToStatus(phase)} label={statusText} />
            </div>
          </div>
        </div>

        {/* No link ID */}
        {!linkId && (
          <div className="flex gap-3 p-4 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-sm">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>No link ID in URL. Ask the sender for the correct share link.</span>
          </div>
        )}

        {/* Waiting spinner */}
        {(phase === 'connecting' || phase === 'idle') && linkId && (
          <div className="flex flex-col items-center py-6 gap-4 text-ink-muted">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm">Waiting for sender to connect…</p>
          </div>
        )}
      </div>

      {/* Overall progress */}
      {showProgress && (
        <div className="card p-5 animate-slide-up">
          <OverallProgress totalSize={totalSize} totalTransferred={totalReceived} label="Receiving" />
        </div>
      )}

      {/* Success banner */}
      {phase === 'done' && (
        <div className="flex gap-3 p-4 rounded-xl bg-status-connected/10 border border-status-connected/20 text-status-connected text-sm animate-slide-up">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          <span>All files received! Download them below.</span>
        </div>
      )}

      {/* File table */}
      {fileRows.length > 0 && <ReceiverFileTable rows={fileRows} />}
    </div>
  )
}