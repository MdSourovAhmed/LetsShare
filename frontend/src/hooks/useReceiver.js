// import { useState, useRef, useEffect, useCallback } from 'react'
// import { io } from 'socket.io-client'
// import { RTC_CONFIG, CONNECT_TIMEOUT_MS } from '../lib/webrtc'
// import { formatBytes } from '../lib/utils'

// /** @typedef {'idle'|'connecting'|'connected'|'receiving'|'done'|'error'} ReceiverPhase */

// /**
//  * @typedef {Object} ReceiverState
//  * @property {ReceiverPhase} phase
//  * @property {string} statusText
//  * @property {string|null} linkId
//  * @property {Array<{name:string,size:number,type:string,progress:number,url:string|null}>} fileRows
//  * @property {number} totalSize
//  * @property {number} totalReceived
//  */

// /** @returns {{ state: ReceiverState }} */
// export function useReceiver(linkId) {
//   const [state, setState] = useState({
//     phase: 'idle',
//     statusText: 'Initializing…',
//     fileRows: [],
//     totalSize: 0,
//     totalReceived: 0,
//   })

//   const socketRef = useRef(null)
//   const pcRef = useRef(null)
//   const dcRef = useRef(null)

//   // Per-file accumulation refs (not state — no re-renders needed per chunk)
//   const buffers = useRef([])          // Array<Uint8Array[]>
//   const fileReceived = useRef([])     // Array<number>
//   const currentIndex = useRef(-1)
//   const filesMeta = useRef([])        // Array<{name,size,type}>
//   const totalSizeRef = useRef(0)

//   const patch = useCallback(
//     (partial) => setState((s) => ({ ...s, ...partial })),
//     []
//   )

//   useEffect(() => {
//     if (!linkId) {
//       patch({ phase: 'error', statusText: 'No link ID provided in URL' })
//       return
//     }

//     patch({ phase: 'connecting', statusText: 'Connecting to peer…' })

//     const socket = io()
//     socketRef.current = socket

//     socket.on('connect_error', () =>
//       patch({ phase: 'error', statusText: 'Failed to connect to signaling server' })
//     )

//     socket.on('signal', async (payload) => {
//       try {
//         if (payload.type === 'offer') {
//           if (pcRef.current) pcRef.current.close()
//           await ensurePc(socket, linkId)
//           const pc = pcRef.current
//           await pc.setRemoteDescription(payload.sdp)
//           const answer = await pc.createAnswer()
//           await pc.setLocalDescription(answer)
//           socket.emit('signal', { linkId, payload: { type: 'answer', sdp: answer } })
//         } else if (payload.type === 'ice' && pcRef.current) {
//           await pcRef.current.addIceCandidate(payload.candidate)
//         }
//       } catch (err) {
//         console.error('Signal error:', err)
//         patch({ phase: 'error', statusText: 'Error establishing connection' })
//       }
//     })

//     socket.emit('join', { linkId, role: 'receiver' })

//     const timeout = setTimeout(() => {
//       if (!dcRef.current || dcRef.current.readyState !== 'open') {
//         patch({ phase: 'error', statusText: 'Connection timeout — no sender connected' })
//       }
//     }, CONNECT_TIMEOUT_MS)

//     return () => {
//       clearTimeout(timeout)
//       if (dcRef.current) dcRef.current.close()
//       if (pcRef.current) pcRef.current.close()
//       socket.disconnect()
//     }
//   }, [linkId])   // eslint-disable-line react-hooks/exhaustive-deps

//   function ensurePc(socket, linkId) {
//     return new Promise((resolve) => {
//       if (pcRef.current) { resolve(); return }
//       const pc = new RTCPeerConnection(RTC_CONFIG)
//       pcRef.current = pc

//       pc.onicecandidate = (e) => {
//         if (e.candidate) {
//           socket.emit('signal', { linkId, payload: { type: 'ice', candidate: e.candidate } })
//         }
//       }

//       pc.ondatachannel = (e) => {
//         const dc = e.channel
//         dcRef.current = dc
//         dc.binaryType = 'arraybuffer'
//         dc.onopen = () => patch({ phase: 'connected', statusText: 'Connected! Receiving files…' })
//         dc.onmessage = onData
//         dc.onclose = () => patch({ statusText: 'Connection closed' })
//       }

//       resolve()
//     })
//   }

//   function onData(e) {
//     const data = e.data

//     if (typeof data === 'string') {
//       try {
//         const msg = JSON.parse(data)

//         if (msg?.type === 'manifest') {
//           const meta = msg.files || []
//           filesMeta.current = meta
//           totalSizeRef.current = meta.reduce((s, f) => s + (f.size || 0), 0)
//           buffers.current = meta.map(() => [])
//           fileReceived.current = meta.map(() => 0)
//           currentIndex.current = -1

//           patch({
//             phase: 'receiving',
//             totalSize: totalSizeRef.current,
//             fileRows: meta.map((f) => ({
//               name: f.name,
//               size: f.size,
//               type: f.type,
//               progress: 0,
//               url: null,
//             })),
//           })
//           return
//         }

//         if (msg?.type === 'start') {
//           currentIndex.current = msg.index
//           return
//         }

//         if (msg?.type === 'end') {
//           const i = msg.index
//           const blob = new Blob(buffers.current[i], {
//             type: filesMeta.current[i]?.type || 'application/octet-stream',
//           })
//           const url = URL.createObjectURL(blob)
//           setState((s) => {
//             const fileRows = s.fileRows.map((r, idx) =>
//               idx === i ? { ...r, progress: 100, url } : r
//             )
//             return { ...s, fileRows }
//           })
//           return
//         }

//         if (msg?.type === 'all_done') {
//           patch({ phase: 'done', statusText: 'All files received successfully!' })
//           return
//         }
//       } catch {
//         // not a control message; ignore
//       }
//     }

//     // Binary chunk
//     const ab =
//       data instanceof ArrayBuffer
//         ? data
//         : data?.arrayBuffer
//         ? data.arrayBuffer()
//         : null
//     if (!ab || currentIndex.current < 0) return

//     Promise.resolve(ab).then((buf) => {
//       const i = currentIndex.current
//       buffers.current[i].push(new Uint8Array(buf))
//       fileReceived.current[i] += buf.byteLength

//       const size = filesMeta.current[i]?.size || 0
//       const progress = size ? Math.floor((fileReceived.current[i] / size) * 100) : 0
//       const totalReceived = fileReceived.current.reduce((s, x) => s + x, 0)

//       setState((s) => {
//         const fileRows = s.fileRows.map((r, idx) =>
//           idx === i ? { ...r, progress } : r
//         )
//         return { ...s, fileRows, totalReceived }
//       })
//     })
//   }

//   return { state }
// }


import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createSocket } from '../lib/socket'
import { RTC_CONFIG, CONNECT_TIMEOUT_MS } from '../lib/webrtc'

export function useReceiver(linkId) {
  const [state, setState] = useState({
    phase: 'idle',         // idle | connecting | receiving | done | error
    statusText: 'Initializing…',
    /** @type {Array<{path:string,name:string,size:number,type:string,progress:number,url:string|null}>} */
    fileRows: [],
    totalSize: 0,
    totalReceived: 0,
  })

  const socketRef  = useRef(null)
  const pcRef      = useRef(null)
  const dcRef      = useRef(null)

  // Accumulation refs — no re-render per chunk
  const buffers       = useRef([])   // Uint8Array[][]
  const fileReceived  = useRef([])   // number[]
  const currentIndex  = useRef(-1)
  const filesMeta     = useRef([])   // {path,name,size,type}[]
  const totalSizeRef  = useRef(0)

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), [])

  useEffect(() => {
    if (!linkId) {
      patch({ phase: 'error', statusText: 'No link ID in URL.' })
      return
    }

    patch({ phase: 'connecting', statusText: 'Connecting to sender…' })

    const socket = createSocket()
    socketRef.current = socket

    socket.on('connect_error', () =>
      patch({ phase: 'error', statusText: 'Could not reach signaling server.' })
    )

    // Signals now carry fromSocketId (the sender's socket id)
    socket.on('signal', async ({ fromSocketId, payload }) => {
      try {
        if (payload.type === 'offer') {
          if (pcRef.current) pcRef.current.close()
          pcRef.current = null
          buildPeerConnection(socket, linkId, fromSocketId)
          const pc = pcRef.current
          await pc.setRemoteDescription(payload.sdp)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('signal', {
            linkId,
            toSocketId: fromSocketId,
            payload: { type: 'answer', sdp: answer },
          })
        } else if (payload.type === 'ice' && pcRef.current) {
          await pcRef.current.addIceCandidate(payload.candidate)
        }
      } catch (e) {
        console.error('receiver signal error', e)
        patch({ phase: 'error', statusText: 'Connection error.' })
      }
    })

    socket.emit('join', { linkId, role: 'receiver' })

    const timeout = setTimeout(() => {
      if (!dcRef.current || dcRef.current.readyState !== 'open') {
        patch({ phase: 'error', statusText: 'Timeout — no sender connected.' })
      }
    }, CONNECT_TIMEOUT_MS)

    return () => {
      clearTimeout(timeout)
      try { dcRef.current?.close() } catch {}
      try { pcRef.current?.close() } catch {}
      socket.disconnect()
    }
  }, [linkId]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildPeerConnection(socket, linkId, senderSocketId) {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    pcRef.current = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', {
          linkId,
          toSocketId: senderSocketId,
          payload: { type: 'ice', candidate: e.candidate },
        })
      }
    }

    pc.ondatachannel = (e) => {
      const dc = e.channel
      dcRef.current = dc
      dc.binaryType = 'arraybuffer'
      dc.onopen    = () => patch({ phase: 'receiving', statusText: 'Receiving files…' })
      dc.onmessage = onData
      dc.onclose   = () => patch({ statusText: 'Connection closed.' })
    }
  }

  function onData(e) {
    const data = e.data

    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data)

        if (msg?.type === 'manifest') {
          const meta = msg.files || []
          filesMeta.current    = meta
          totalSizeRef.current = meta.reduce((s, f) => s + (f.size || 0), 0)
          buffers.current      = meta.map(() => [])
          fileReceived.current = meta.map(() => 0)
          currentIndex.current = -1
          patch({
            totalSize: totalSizeRef.current,
            fileRows: meta.map((f) => ({
              path: f.path || f.name,
              name: f.name,
              size: f.size,
              type: f.type,
              progress: 0,
              url: null,
            })),
          })
          return
        }

        if (msg?.type === 'start') {
          currentIndex.current = msg.index
          return
        }

        if (msg?.type === 'end') {
          const i = msg.index
          const blob = new Blob(buffers.current[i], {
            type: filesMeta.current[i]?.type || 'application/octet-stream',
          })
          const url = URL.createObjectURL(blob)
          setState((s) => ({
            ...s,
            fileRows: s.fileRows.map((r, idx) =>
              idx === i ? { ...r, progress: 100, url } : r
            ),
          }))
          return
        }

        if (msg?.type === 'all_done') {
          patch({ phase: 'done', statusText: 'All files received!' })
          return
        }
      } catch {}
    }

    // Binary chunk
    const ab = data instanceof ArrayBuffer ? data : null
    if (!ab || currentIndex.current < 0) return

    const i = currentIndex.current
    buffers.current[i].push(new Uint8Array(ab))
    fileReceived.current[i] += ab.byteLength

    const size     = filesMeta.current[i]?.size || 0
    const progress = size ? Math.floor((fileReceived.current[i] / size) * 100) : 0
    const totalReceived = fileReceived.current.reduce((s, x) => s + x, 0)

    setState((s) => ({
      ...s,
      totalReceived,
      fileRows: s.fileRows.map((r, idx) =>
        idx === i ? { ...r, progress } : r
      ),
    }))
  }

  return { state }
}