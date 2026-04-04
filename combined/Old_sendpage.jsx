import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import RadialProgress from '../components/RadialProgress';
import SpeedChart from '../components/SpeedChart';
import FileRow from '../components/FileRow';
import { formatBytes, formatSpeed, generateId, getFileIcon } from '../utils';

const CHUNK = 64 * 1024;

export default function SendPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [linkId, setLinkId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | waiting | connecting | transferring | done
  const [statusMsg, setStatusMsg] = useState('');
  const [fileProgress, setFileProgress] = useState([]);
  const [fileStatus, setFileStatus] = useState([]);
  const [totalPercent, setTotalPercent] = useState(0);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [uploadMode, setUploadMode] = useState('files'); // files | folder

  const fileInputRef = useRef();
  const folderInputRef = useRef();
  const socketRef = useRef();
  const pcRef = useRef();
  const dcRef = useRef();
  const totalSizeRef = useRef(0);
  const totalSentRef = useRef(0);
  const lastSpeedCheckRef = useRef({ time: Date.now(), bytes: 0 });

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);

  const handleFileSelect = useCallback((newFiles) => {
    if (!newFiles.length) return;
    const arr = Array.from(newFiles).map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      relativePath: f.webkitRelativePath || f.name,
    }));

    // Detect folder
    if (arr[0].relativePath && arr[0].relativePath.includes('/')) {
      const topFolder = arr[0].relativePath.split('/')[0];
      setFolderName(topFolder);
    } else {
      setFolderName('');
    }

    setFiles(arr);
    setFileProgress(arr.map(() => 0));
    setFileStatus(arr.map(() => 'pending'));
    setPhase('idle');
    setShareLink('');
    setLinkId('');
  }, []);

  const onFileChange = (e) => handleFileSelect(e.target.files);
  const onFolderChange = (e) => handleFileSelect(e.target.files);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    if (items) {
      const fileArr = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          fileArr.push(item.getAsFile());
        }
      }
      if (fileArr.length) handleFileSelect(fileArr);
    } else {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const removeFile = (idx) => {
    setFiles(f => f.filter((_, i) => i !== idx));
    setFileProgress(p => p.filter((_, i) => i !== idx));
    setFileStatus(s => s.filter((_, i) => i !== idx));
  };

  const createLink = () => {
    const id = generateId();
    setLinkId(id);
    const link = `${window.location.origin}/receive?id=${id}`;
    setShareLink(link);
    setPhase('waiting');
    setStatusMsg('Waiting for receiver to open the link...');

    // Connect socket
    const io = window.io;
    if (!io) {
      setStatusMsg('Socket.io not available — backend not connected');
      return;
    }

    const socket = io();
    socketRef.current = socket;

    socket.on('peer-joined', ({ role }) => {
      if (role === 'receiver') {
        setStatusMsg('Receiver connected! Establishing secure connection...');
        setPhase('connecting');
        startConnection(id);
      }
    });

    socket.on('signal', async (payload) => {
      if (payload.type === 'answer') {
        await pcRef.current?.setRemoteDescription(payload.sdp);
      } else if (payload.type === 'ice') {
        try { await pcRef.current?.addIceCandidate(payload.candidate); } catch {}
      }
    });

    socket.emit('join', { linkId: id, role: 'sender' });
  };

  const startConnection = async (id) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('signal', { linkId: id, payload: { type: 'ice', candidate: e.candidate } });
      }
    };

    const dc = pc.createDataChannel('files');
    dcRef.current = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = CHUNK;

    dc.onopen = () => {
      setPhase('transferring');
      setStatusMsg('Connection open! Sending files...');
      sendFiles();
    };

    dc.onclose = () => setStatusMsg('Connection closed');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit('signal', { linkId: id, payload: { type: 'offer', sdp: pc.localDescription } });
  };

  const sendFiles = async () => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    totalSizeRef.current = files.reduce((s, f) => s + (f.file?.size || 0), 0);
    totalSentRef.current = 0;

    const manifest = {
      type: 'manifest',
      files: files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        relativePath: f.relativePath,
      })),
      folderName: folderName || null,
    };
    dc.send(JSON.stringify(manifest));

    const perFileSent = files.map(() => 0);
    const startTime = Date.now();

    const waitBuffer = () => new Promise(resolve => {
      const check = () => {
        if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    for (let i = 0; i < files.length; i++) {
      const f = files[i].file;
      if (!f) continue;

      setFileStatus(s => s.map((v, idx) => idx === i ? 'uploading' : v));
      dc.send(JSON.stringify({ type: 'start', index: i, name: f.name, size: f.size }));

      let offset = 0;
      while (offset < f.size) {
        const slice = f.slice(offset, offset + CHUNK);
        const buf = await slice.arrayBuffer();
        dc.send(buf);

        offset += buf.byteLength;
        perFileSent[i] = offset;
        totalSentRef.current = perFileSent.reduce((s, x) => s + x, 0);

        // Update progress
        const pct = f.size ? Math.floor((offset / f.size) * 100) : 0;
        setFileProgress(prev => prev.map((v, idx) => idx === i ? pct : v));

        const overall = totalSizeRef.current
          ? Math.floor((totalSentRef.current / totalSizeRef.current) * 100)
          : 0;
        setTotalPercent(overall);

        // Speed calc
        const now = Date.now();
        const elapsed = (now - lastSpeedCheckRef.current.time) / 1000;
        if (elapsed >= 0.5) {
          const bytesDiff = totalSentRef.current - lastSpeedCheckRef.current.bytes;
          const spd = bytesDiff / elapsed;
          setCurrentSpeed(spd);
          setSpeedHistory(prev => [...prev.slice(-29), spd]);
          lastSpeedCheckRef.current = { time: now, bytes: totalSentRef.current };
        }

        if (dc.bufferedAmount > CHUNK * 4) await waitBuffer();
      }

      setFileProgress(prev => prev.map((v, idx) => idx === i ? 100 : v));
      setFileStatus(s => s.map((v, idx) => idx === i ? 'completed' : v));
      dc.send(JSON.stringify({ type: 'end', index: i }));
    }

    dc.send(JSON.stringify({ type: 'all_done' }));
    setPhase('done');
    setStatusMsg('All files sent successfully!');
    setCurrentSpeed(0);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const reset = () => {
    dcRef.current?.close();
    pcRef.current?.close();
    socketRef.current?.disconnect();
    setFiles([]);
    setFileProgress([]);
    setFileStatus([]);
    setPhase('idle');
    setShareLink('');
    setLinkId('');
    setStatusMsg('');
    setTotalPercent(0);
    setSpeedHistory([]);
    setCurrentSpeed(0);
    setFolderName('');
  };

  const phaseColor = {
    idle: '#4a6080',
    waiting: '#ffb800',
    connecting: '#00d4ff',
    transferring: '#00d4ff',
    done: '#00ffb3',
  };

  const phaseIcon = {
    idle: null,
    waiting: (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffb800', boxShadow: '0 0 10px #ffb800', animation: 'pulse 1.5s ease-in-out infinite' }} />
    ),
    connecting: (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 10px #00d4ff', animation: 'pulse 1s ease-in-out infinite' }} />
    ),
    transferring: (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 10px #00d4ff', animation: 'pulse 0.8s ease-in-out infinite' }} />
    ),
    done: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00ffb3" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Logo size="md" />
        <button
          onClick={() => navigate('/receive')}
          className="btn-secondary"
          style={{ fontSize: 13 }}
        >
          Receive Files →
        </button>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 32, animation: 'slideUp 0.4s ease-out' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 800,
          color: '#c8ddf5',
          lineHeight: 1.1,
          marginBottom: 8,
        }}>
          Send Files <span style={{ color: '#00d4ff' }}>Instantly</span>
        </h1>
        <p style={{ color: '#4a6080', fontSize: 16 }}>
          P2P transfer — no cloud, no limits, no waiting.
        </p>
      </div>

      {/* Upload mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['files', 'folder'].map(mode => (
          <button
            key={mode}
            onClick={() => { setUploadMode(mode); reset(); }}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: `1px solid ${uploadMode === mode ? 'rgba(0,212,255,0.5)' : '#1e2d45'}`,
              background: uploadMode === mode ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: uploadMode === mode ? '#00d4ff' : '#4a6080',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {mode === 'files' ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Files</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Folder</>
            )}
          </button>
        ))}
      </div>

      {/* Drop Zone */}
      <div
        className={isDragging ? 'drop-active' : ''}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => uploadMode === 'folder' ? folderInputRef.current?.click() : fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${files.length > 0 ? 'rgba(0,212,255,0.4)' : '#1e2d45'}`,
          borderRadius: 16,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 24,
          transition: 'all 0.3s ease',
          background: files.length > 0 ? 'rgba(0,212,255,0.03)' : 'rgba(14,20,32,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated background lines */}
        {isDragging && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,212,255,0.03) 10px, rgba(0,212,255,0.03) 20px)',
          }} />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory="true"
          mozdirectory="true"
          directory="true"
          style={{ display: 'none' }}
          onChange={onFolderChange}
        />

        {files.length === 0 ? (
          <div>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 28,
            }}>
              {uploadMode === 'folder' ? '📁' : '📤'}
            </div>
            <p style={{ color: '#c8ddf5', fontWeight: 500, fontSize: 16, marginBottom: 6 }}>
              {uploadMode === 'folder'
                ? 'Click to select a folder'
                : 'Drop files here or click to browse'}
            </p>
            <p style={{ color: '#4a6080', fontSize: 13 }}>
              {uploadMode === 'folder'
                ? 'Entire folder structure will be preserved'
                : 'Multiple files supported · Any format · No size limit'}
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{folderName ? '📁' : '📦'}</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#c8ddf5', fontWeight: 600, fontSize: 15 }}>
                  {folderName ? `📁 ${folderName}` : `${files.length} file${files.length !== 1 ? 's' : ''} selected`}
                </p>
                <p style={{ color: '#4a6080', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatBytes(totalSize)} total
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              style={{ color: '#4a6080', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Create Link Button */}
      {phase === 'idle' && files.length > 0 && (
        <button
          className="btn-primary"
          onClick={createLink}
          style={{ width: '100%', marginBottom: 24, fontSize: 15 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          Generate Share Link
        </button>
      )}

      {/* Share Link */}
      {shareLink && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span style={{ color: '#8ca0bc', fontSize: 13, fontWeight: 500 }}>Share this link with the receiver</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1,
              background: '#080b12',
              border: '1px solid #1e2d45',
              borderRadius: 10,
              padding: '10px 14px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#00d4ff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {shareLink}
            </div>
            <button
              className="btn-secondary"
              onClick={copyLink}
              style={{
                background: copied ? 'rgba(0,255,179,0.12)' : undefined,
                color: copied ? '#00ffb3' : undefined,
                border: copied ? '1px solid rgba(0,255,179,0.3)' : undefined,
                flexShrink: 0,
                fontSize: 13,
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Status bar */}
      {phase !== 'idle' && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: phase === 'transferring' ? 20 : 0 }}>
            {phaseIcon[phase]}
            <span style={{ color: phaseColor[phase], fontWeight: 500, fontSize: 14 }}>
              {statusMsg}
            </span>
          </div>

          {/* Transfer stats */}
          {(phase === 'transferring' || phase === 'done') && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <RadialProgress
                percent={totalPercent}
                size={100}
                label={phase === 'done' ? 'Done' : 'Sent'}
                sublabel={formatBytes(totalSentRef.current)}
              />

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#4a6080', fontSize: 13 }}>Transfer speed</span>
                  <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                    {currentSpeed > 0 ? formatSpeed(currentSpeed) : '—'}
                  </span>
                </div>
                <SpeedChart data={speedHistory} width={220} height={44} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatBytes(totalSentRef.current)} / {formatBytes(totalSizeRef.current)}
                  </span>
                  <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                    {files.filter((_, i) => fileStatus[i] === 'completed').length} / {files.length} files
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Files table */}
      {files.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#c8ddf5' }}>
                Files
              </h3>
              <p style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>
                {files.length} item{files.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
              </p>
            </div>
            {phase === 'done' && (
              <button className="btn-secondary" onClick={reset} style={{ fontSize: 13 }}>
                Send More
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#080b12' }}>
                  {['File', 'Size', 'Progress', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      color: '#4a6080', fontSize: 11,
                      fontFamily: 'Syne, sans-serif', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      borderBottom: '1px solid #1e2d45',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <FileRow
                    key={i}
                    file={f}
                    progress={fileProgress[i] || 0}
                    status={fileStatus[i] || 'pending'}
                    isReceiver={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#2a3d55', fontSize: 13, paddingBottom: 24 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: 6 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        End-to-end encrypted via WebRTC · No data touches our servers
      </div>
    </div>
  );
}
