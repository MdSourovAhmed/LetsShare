// import { useSender } from '../hooks/useSender'
// import { formatBytes } from '../lib/utils'
// import DropZone from '../components/send/DropZone'
// import ShareLinkBox from '../components/send/ShareLinkBox'
// import SenderFileTable from '../components/send/SenderFileTable'
// import OverallProgress from '../components/ui/OverallProgress'
// import StatusBadge from '../components/ui/StatusBadge'

// /** Map app phase → StatusBadge type */
// function phaseToStatus(phase) {
//   if (phase === 'done') return 'connected'
//   if (phase === 'error') return 'error'
//   if (phase === 'idle' || phase === 'linking') return 'idle'
//   if (phase === 'waiting' || phase === 'connecting') return 'connecting'
//   return 'connected' // transferring
// }

// export default function SendPage() {
//   const { state, selectedFiles, handleFilesSelected, createLink, copyLink, reset } = useSender()
//   const { phase, shareLink, statusText, fileRows, totalSize, totalSent } = state

//   const isLocked = phase !== 'idle' && phase !== 'done' && phase !== 'error'
//   const showProgress = phase === 'transferring' || phase === 'done'
//   const showReset = phase === 'done' || phase === 'error'

//   return (
//     <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
//       {/* Page header */}
//       <div>
//         <h1 className="font-heading font-bold text-3xl text-ink tracking-tight">Send Files</h1>
//         <p className="text-ink-muted mt-1 text-sm">Select files and share the generated link with the receiver.</p>
//       </div>

//       {/* Main card */}
//       <div className="card p-6 space-y-5">
//         {/* Drop zone */}
//         <div className="space-y-2">
//           <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
//             Select Files
//           </label>
//           <DropZone
//             onFilesSelected={handleFilesSelected}
//             selectedFiles={selectedFiles}
//             disabled={isLocked}
//           />
//         </div>

//         {/* Create link button */}
//         <button
//           onClick={createLink}
//           disabled={!selectedFiles.length || isLocked}
//           className="btn-primary w-full py-3.5"
//         >
//           {phase === 'waiting' || phase === 'connecting' ? (
//             <>
//               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
//               </svg>
//               Waiting for receiver…
//             </>
//           ) : phase === 'transferring' ? (
//             <>
//               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
//               </svg>
//               Transferring…
//             </>
//           ) : phase === 'done' ? (
//             <>
//               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
//               </svg>
//               Transfer Complete
//             </>
//           ) : (
//             <>
//               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
//                   d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
//               </svg>
//               Create Share Link
//             </>
//           )}
//         </button>

//         {/* Status row */}
//         <div className="flex items-center justify-between">
//           <StatusBadge type={phaseToStatus(phase)} label={statusText} />
//           {showReset && (
//             <button onClick={reset} className="btn-secondary text-xs py-1.5 px-3">
//               Start Over
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Share link */}
//       {shareLink && (
//         <ShareLinkBox link={shareLink} onCopy={copyLink} />
//       )}

//       {/* Overall progress */}
//       {showProgress && totalSize > 0 && (
//         <div className="card p-5 animate-slide-up">
//           <OverallProgress
//             totalSize={totalSize}
//             totalTransferred={totalSent}
//             label="Sending"
//           />
//         </div>
//       )}

//       {/* File table */}
//       {fileRows.length > 0 && <SenderFileTable rows={fileRows} />}
//     </div>
//   )
// }



import React from 'react'
import { useSender } from '../hooks/useSender'
import DropZone from '../components/send/DropZone'
import ShareLinkBox from '../components/send/ShareLinkBox'
import ReceiverCard from '../components/send/ReceiverCard'
import StatusBadge from '../components/ui/StatusBadge'

function phaseToStatus(phase) {
  if (phase === 'done')    return 'connected'
  if (phase === 'idle')    return 'idle'
  if (phase === 'waiting') return 'connecting'
  if (phase === 'active')  return 'connected'
  return 'idle'
}

export default function SendPage() {
  const { state, selectedFiles, handleFilesSelected, createSession, copyLink, reset } = useSender()
  const { phase, shareLink, statusText, receivers, fileList, totalSize } = state

  const isLocked  = phase === 'waiting' || phase === 'active'
  const showReset = phase === 'done' || phase === 'error'
  const activeReceivers = receivers.filter((r) => r.phase !== 'error')

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-3xl text-ink tracking-tight">Send Files</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Select files or a folder — multiple receivers can connect to the same link simultaneously.
        </p>
      </div>

      {/* Selection + session card */}
      <div className="card p-6 space-y-5">
        <DropZone
          onFilesSelected={handleFilesSelected}
          selectedFiles={selectedFiles}
          disabled={isLocked}
        />

        {/* Start session button */}
        <button
          onClick={createSession}
          disabled={!selectedFiles.length || isLocked}
          className="btn-primary w-full py-3.5"
        >
          {phase === 'waiting' ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Waiting for receivers…
            </>
          ) : phase === 'active' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              {activeReceivers.length} receiver{activeReceivers.length !== 1 ? 's' : ''} connected
            </>
          ) : phase === 'done' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              All done!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              Create Share Link
            </>
          )}
        </button>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <StatusBadge type={phaseToStatus(phase)} label={statusText} />
          {showReset && (
            <button onClick={reset} className="btn-secondary text-xs py-1.5 px-3">
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Share link */}
      {shareLink && <ShareLinkBox link={shareLink} onCopy={copyLink} />}

      {/* Receivers section */}
      {receivers.length > 0 && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-sm text-ink-muted uppercase tracking-wider">
              Receivers
            </h2>
            <span className="text-xs text-ink-faint">
              {receivers.filter((r) => r.phase === 'done').length} / {receivers.length} complete
            </span>
          </div>
          <div className="space-y-3">
            {receivers.map((r) => (
              <ReceiverCard
                key={r.socketId}
                receiver={r}
                fileList={fileList}
                totalSize={totalSize}
              />
            ))}
          </div>
        </div>
      )}

      {/* File list summary */}
      {fileList.length > 0 && phase !== 'idle' && (
        <div className="card overflow-hidden animate-slide-up">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <span className="font-semibold text-sm text-ink">
              {state.selectionMode === 'folder' ? 'Folder Contents' : 'Files to Share'}
            </span>
            <span className="text-xs text-ink-muted">{fileList.length} files</span>
          </div>
          <div className="divide-y divide-surface-border max-h-52 overflow-y-auto">
            {fileList.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <svg className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span className="text-xs text-ink truncate flex-1" title={f.path}>{f.path}</span>
                <span className="text-xs text-ink-faint font-mono flex-shrink-0">
                  {`${(f.size / 1024).toFixed(1)} KB`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}