// import { useState, useRef, useCallback } from 'react'
// import { io } from 'socket.io-client'
// import { generateId, formatBytes } from '../lib/utils'
// import { RTC_CONFIG, CHUNK_SIZE, BUFFER_LOW } from '../lib/webrtc'

// /** @typedef {'idle'|'linking'|'waiting'|'connecting'|'transferring'|'done'|'error'} SenderPhase */

// const initialState = {
//   /** @type {SenderPhase} */
//   phase: 'idle',
//   linkId: null,
//   shareLink: null,
//   statusText: 'Ready to share files',
//   /** @type {Array<{name:string,size:number,progress:number,status:string}>} */
//   fileRows: [],
//   totalSize: 0,
//   totalSent: 0,
// }

// export function useSender() {
//   const [state, setState] = useState(initialState)
//   const [selectedFiles, setSelectedFiles] = useState([])

//   const socketRef = useRef(null)
//   const pcRef = useRef(null)
//   const dcRef = useRef(null)

//   const patch = useCallback((partial) => setState((s) => ({ ...s, ...partial })), [])

//   // ── File selection ────────────────────────────────────────────────────────
//   const handleFilesSelected = useCallback((files) => {
//     const arr = Array.from(files)
//     setSelectedFiles(arr)
//     const totalSize = arr.reduce((s, f) => s + f.size, 0)
//     const fileRows = arr.map((f) => ({
//       name: f.name,
//       size: f.size,
//       progress: 0,
//       status: 'pending',
//     }))
//     patch({ fileRows, totalSize, totalSent: 0 })
//   }, [patch])

//   // ── Create share link & start signaling ──────────────────────────────────
//   const createLink = useCallback(() => {
//     if (!selectedFiles.length) return

//     const linkId = generateId()
//     const shareLink = `${window.location.origin}/receive?id=${linkId}`
//     patch({ phase: 'waiting', linkId, shareLink, statusText: 'Waiting for receiver…' })

//     const socket = io()
//     socketRef.current = socket

//     socket.on('peer-joined', ({ role }) => {
//       if (role === 'receiver') {
//         patch({ phase: 'connecting', statusText: 'Receiver connected! Establishing connection…' })
//         startConnection(socket, linkId)
//       }
//     })

//     socket.on('signal', async (payload) => {
//       const pc = pcRef.current
//       if (!pc) return
//       if (payload.type === 'answer') {
//         await pc.setRemoteDescription(payload.sdp)
//       } else if (payload.type === 'ice') {
//         try { await pc.addIceCandidate(payload.candidate) } catch {}
//       }
//     })

//     socket.emit('join', { linkId, role: 'sender' })
//   }, [selectedFiles, patch])

//   // ── WebRTC ────────────────────────────────────────────────────────────────
//   async function startConnection(socket, linkId) {
//     const pc = new RTCPeerConnection(RTC_CONFIG)
//     pcRef.current = pc

//     pc.onicecandidate = (e) => {
//       if (e.candidate) {
//         socket.emit('signal', { linkId, payload: { type: 'ice', candidate: e.candidate } })
//       }
//     }

//     const dc = pc.createDataChannel('file', { ordered: true })
//     dcRef.current = dc
//     dc.binaryType = 'arraybuffer'

//     dc.onopen = () => {
//       patch({ phase: 'transferring', statusText: 'Connected! Transferring files…' })
//       sendFiles(dc)
//     }
//     dc.onclose = () => patch({ statusText: 'Connection closed' })
//     dc.onerror = () => patch({ phase: 'error', statusText: 'Connection error' })

//     const offer = await pc.createOffer()
//     await pc.setLocalDescription(offer)
//     socket.emit('signal', { linkId, payload: { type: 'offer', sdp: offer } })
//   }

//   async function sendFiles(dc) {
//     const files = selectedFiles
//     const perFileSent = Array(files.length).fill(0)

//     // Manifest
//     const manifest = {
//       type: 'manifest',
//       version: 1,
//       files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
//     }
//     dc.send(JSON.stringify(manifest))

//     dc.bufferedAmountLowThreshold = BUFFER_LOW

//     for (let i = 0; i < files.length; i++) {
//       const f = files[i]
//       updateFileRow(i, 0, 'uploading')

//       dc.send(JSON.stringify({ type: 'start', index: i, name: f.name, size: f.size, fileType: f.type || 'application/octet-stream' }))

//       let offset = 0
//       while (offset < f.size) {
//         const slice = await f.slice(offset, offset + CHUNK_SIZE).arrayBuffer()
//         dc.send(slice)
//         offset += slice.byteLength

//         perFileSent[i] = offset
//         const totalSent = perFileSent.reduce((s, x) => s + x, 0)
//         const fileProgress = f.size ? Math.floor((offset / f.size) * 100) : 0
//         updateFileRow(i, fileProgress, 'uploading')
//         patch({ totalSent })

//         if (dc.bufferedAmount > BUFFER_LOW) await waitForBufferLow(dc)
//       }

//       updateFileRow(i, 100, 'completed')
//       dc.send(JSON.stringify({ type: 'end', index: i }))
//     }

//     dc.send(JSON.stringify({ type: 'all_done' }))
//     patch({ phase: 'done', statusText: 'All files sent successfully!' })
//   }

//   function updateFileRow(index, progress, status) {
//     setState((s) => {
//       const fileRows = s.fileRows.map((r, i) =>
//         i === index ? { ...r, progress, status } : r
//       )
//       return { ...s, fileRows }
//     })
//   }

//   function waitForBufferLow(dc) {
//     return new Promise((resolve) => {
//       const check = () => {
//         if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) resolve()
//         else setTimeout(check, 10)
//       }
//       check()
//     })
//   }

//   // ── Copy link ─────────────────────────────────────────────────────────────
//   const copyLink = useCallback(async () => {
//     if (!state.shareLink) return false
//     try {
//       await navigator.clipboard.writeText(state.shareLink)
//       return true
//     } catch {
//       return false
//     }
//   }, [state.shareLink])

//   // ── Reset ─────────────────────────────────────────────────────────────────
//   const reset = useCallback(() => {
//     if (dcRef.current) dcRef.current.close()
//     if (pcRef.current) pcRef.current.close()
//     if (socketRef.current) socketRef.current.disconnect()
//     dcRef.current = null
//     pcRef.current = null
//     socketRef.current = null
//     setSelectedFiles([])
//     setState(initialState)
//   }, [])

//   return {
//     state,
//     selectedFiles,
//     handleFilesSelected,
//     createLink,
//     copyLink,
//     reset,
//   }
// }



import React, { useState, useRef, useCallback } from 'react'
import { createSocket } from '../lib/socket'
import { generateId, getFilePath } from '../lib/utils'
import { RTC_CONFIG, CHUNK_SIZE, BUFFER_LOW } from '../lib/webrtc'

/**
 * Receiver entry stored per connected peer
 * @typedef {{
 *   socketId: string,
 *   label: string,
 *   phase: 'connecting'|'transferring'|'done'|'error',
 *   fileProgress: number[],   // 0-100 per file index
 *   totalSent: number,
 *   error: string|null,
 * }} ReceiverEntry
 */

const initialState = {
  phase: 'idle',           // 'idle' | 'waiting' | 'active' | 'done'
  linkId: null,
  shareLink: null,
  statusText: 'Ready to share',
  /** @type {ReceiverEntry[]} */
  receivers: [],
  /** @type {Array<{path:string, name:string, size:number, type:string}>} */
  fileList: [],
  totalSize: 0,
  selectionMode: null,     // 'files' | 'folder'
}

export function useSender() {
  const [state, setState] = useState(initialState)
  const [selectedFiles, setSelectedFiles] = useState([])

  const socketRef = useRef(null)

  // Map<socketId, { pc: RTCPeerConnection, dc: RTCDataChannel }>
  const peersRef = useRef(new Map())

  // Stable ref so async sendFiles() always reads latest files
  const filesRef = useRef([])

  const patch = useCallback(
    (partial) => setState((s) => ({ ...s, ...partial })),
    []
  )

  // ── File / folder selection ───────────────────────────────────────────────
  const handleFilesSelected = useCallback((files, mode = 'files') => {
    const arr = Array.from(files)
    filesRef.current = arr
    setSelectedFiles(arr)
    const totalSize = arr.reduce((s, f) => s + f.size, 0)
    const fileList = arr.map((f) => ({
      path: getFilePath(f),
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
    }))
    patch({ fileList, totalSize, totalSent: 0, selectionMode: mode })
  }, [patch])

  // ── Create share session ──────────────────────────────────────────────────
  const createSession = useCallback(() => {
    if (!selectedFiles.length) return

    const linkId = generateId()
    const shareLink = `${window.location.origin}/receive?id=${linkId}`
    patch({
      phase: 'waiting',
      linkId,
      shareLink,
      statusText: 'Waiting for receivers… Share the link on your LAN.',
      receivers: [],
    })

    const socket = createSocket()
    socketRef.current = socket

    socket.on('connect_error', () =>
      patch({ phase: 'idle', statusText: 'Could not reach signaling server.' })
    )

    // A new receiver joined the room
    socket.on('peer-joined', ({ socketId, role }) => {
      if (role !== 'receiver') return
      addReceiver(socket, linkId, socketId)
    })

    // Incoming WebRTC signal from a specific receiver
    socket.on('signal', async ({ fromSocketId, payload }) => {
      const peer = peersRef.current.get(fromSocketId)
      if (!peer) return
      try {
        if (payload.type === 'answer') {
          await peer.pc.setRemoteDescription(payload.sdp)
        } else if (payload.type === 'ice') {
          await peer.pc.addIceCandidate(payload.candidate)
        }
      } catch (e) {
        console.error('signal error', e)
      }
    })

    socket.emit('join', { linkId, role: 'sender' })
  }, [selectedFiles, patch])

  // ── Add a receiver & establish its RTCPeerConnection ─────────────────────
  function addReceiver(socket, linkId, socketId) {
    const label = `Receiver ${peersRef.current.size + 1}`

    // Optimistically add to UI
    setState((s) => ({
      ...s,
      phase: 'active',
      statusText: 'Receivers connected — transfers running',
      receivers: [
        ...s.receivers,
        {
          socketId,
          label,
          phase: 'connecting',
          fileProgress: filesRef.current.map(() => 0),
          totalSent: 0,
          error: null,
        },
      ],
    }))

    const pc = new RTCPeerConnection(RTC_CONFIG)

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', {
          linkId,
          toSocketId: socketId,
          payload: { type: 'ice', candidate: e.candidate },
        })
      }
    }

    const dc = pc.createDataChannel('file', { ordered: true })
    dc.binaryType = 'arraybuffer'

    dc.onopen = () => {
      patchReceiver(socketId, { phase: 'transferring' })
      sendFilesToPeer(socketId, dc)
    }

    dc.onclose = () => patchReceiver(socketId, { phase: 'error', error: 'Connection closed' })
    dc.onerror = () => patchReceiver(socketId, { phase: 'error', error: 'Connection error' })

    peersRef.current.set(socketId, { pc, dc })

    // Create offer
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('signal', {
          linkId,
          toSocketId: socketId,
          payload: { type: 'offer', sdp: pc.localDescription },
        })
      })
      .catch((e) => patchReceiver(socketId, { phase: 'error', error: e.message }))
  }

  // ── Send all files to one peer's DataChannel ──────────────────────────────
  async function sendFilesToPeer(socketId, dc) {
    const files = filesRef.current
    const perFileSent = files.map(() => 0)

    // Send manifest with full relative paths (preserves folder structure)
    dc.send(JSON.stringify({
      type: 'manifest',
      version: 2,
      files: files.map((f) => ({
        path: getFilePath(f),
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
      })),
    }))

    dc.bufferedAmountLowThreshold = BUFFER_LOW

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      dc.send(JSON.stringify({ type: 'start', index: i }))

      let offset = 0
      while (offset < f.size) {
        if (dc.readyState !== 'open') {
          patchReceiver(socketId, { phase: 'error', error: 'Channel closed mid-transfer' })
          return
        }
        const slice = await f.slice(offset, offset + CHUNK_SIZE).arrayBuffer()
        dc.send(slice)
        offset += slice.byteLength

        perFileSent[i] = offset
        const totalSent = perFileSent.reduce((s, x) => s + x, 0)
        const fp = f.size ? Math.floor((offset / f.size) * 100) : 100

        patchReceiverProgress(socketId, i, fp, totalSent)

        if (dc.bufferedAmount > BUFFER_LOW) await waitForBufferLow(dc)
      }

      dc.send(JSON.stringify({ type: 'end', index: i }))
    }

    dc.send(JSON.stringify({ type: 'all_done' }))
    patchReceiver(socketId, { phase: 'done' })

    // If ALL receivers are done, update top-level phase
    setState((s) => {
      const allDone = s.receivers.every(
        (r) => r.socketId === socketId ? true : r.phase === 'done'
      )
      return allDone ? { ...s, phase: 'done', statusText: 'All receivers received everything!' } : s
    })
  }

  // ── Patch helpers ─────────────────────────────────────────────────────────
  function patchReceiver(socketId, partial) {
    setState((s) => ({
      ...s,
      receivers: s.receivers.map((r) =>
        r.socketId === socketId ? { ...r, ...partial } : r
      ),
    }))
  }

  function patchReceiverProgress(socketId, fileIndex, fileProgress, totalSent) {
    setState((s) => ({
      ...s,
      receivers: s.receivers.map((r) => {
        if (r.socketId !== socketId) return r
        const fp = [...r.fileProgress]
        fp[fileIndex] = fileProgress
        return { ...r, fileProgress: fp, totalSent }
      }),
    }))
  }

  function waitForBufferLow(dc) {
    return new Promise((resolve) => {
      const check = () => {
        if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) resolve()
        else setTimeout(check, 10)
      }
      check()
    })
  }

  // ── Copy link ─────────────────────────────────────────────────────────────
  const copyLink = useCallback(async () => {
    if (!state.shareLink) return false
    try {
      await navigator.clipboard.writeText(state.shareLink)
      return true
    } catch { return false }
  }, [state.shareLink])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    peersRef.current.forEach(({ pc, dc }) => {
      try { dc.close() } catch {}
      try { pc.close() } catch {}
    })
    peersRef.current.clear()
    if (socketRef.current) socketRef.current.disconnect()
    socketRef.current = null
    filesRef.current = []
    setSelectedFiles([])
    setState(initialState)
  }, [])

  return {
    state,
    selectedFiles,
    handleFilesSelected,
    createSession,
    copyLink,
    reset,
  }
}