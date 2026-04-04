import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Logo from '../components/Logo';
import RadialProgress from '../components/RadialProgress';
import SpeedChart from '../components/SpeedChart';
import FileRow from '../components/FileRow';
import { formatBytes, formatSpeed, generateId } from '../utils';

const CHUNK = 64 * 1024;

export default function SendPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | waiting | connecting | transferring | done
  const [statusMsg, setStatusMsg] = useState('');
  const [fileProgress, setFileProgress] = useState([]);
  const [fileStatus, setFileStatus] = useState([]);
  const [totalPercent, setTotalPercent] = useState(0);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [uploadMode, setUploadMode] = useState('files');

  const fileInputRef = useRef();
  const folderInputRef = useRef();
  const socketRef = useRef();
  const pcRef = useRef();
  const dcRef = useRef();
  const linkIdRef = useRef('');
  const filesRef = useRef([]);
  const folderNameRef = useRef('');
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
    const folder = arr[0].relativePath?.includes('/') ? arr[0].relativePath.split('/')[0] : '';
    setFolderName(folder);
    folderNameRef.current = folder;
    setFiles(arr);
    filesRef.current = arr;
    setFileProgress(arr.map(() => 0));
    setFileStatus(arr.map(() => 'pending'));
    setPhase('idle');
    setShareLink('');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const fileArr = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file')
          fileArr.push(e.dataTransfer.items[i].getAsFile());
      }
    } else {
      fileArr.push(...Array.from(e.dataTransfer.files));
    }
    if (fileArr.length) handleFileSelect(fileArr);
  }, [handleFileSelect]);

  const createLink = () => {
    const id = generateId();
    linkIdRef.current = id;
    const link = `${window.location.origin}/receive?id=${id}`;
    setShareLink(link);
    setPhase('waiting');
    setStatusMsg('Waiting for receiver to open the link...');

    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { linkId: id, role: 'sender' });
    });

    socket.on('peer-joined', ({ role }) => {
      if (role === 'receiver') {
        setStatusMsg('Receiver connected! Establishing secure connection...');
        setPhase('connecting');
        startConnection(id, socket);
      }
    });

    socket.on('signal', async (payload) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (payload.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } else if (payload.type === 'ice' && payload.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      }
    });

    socket.on('connect_error', (err) => {
      setPhase('idle');
      setStatusMsg(`Cannot connect to server: ${err.message}`);
    });
  };

  const startConnection = async (id, socket) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { linkId: id, payload: { type: 'ice', candidate: e.candidate.toJSON() } });
      }
    };

    const dc = pc.createDataChannel('files');
    dcRef.current = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = CHUNK * 2;

    dc.onopen = () => {
      setPhase('transferring');
      setStatusMsg('Connected! Sending files...');
      sendFiles();
    };
    dc.onerror = (e) => setStatusMsg(`Data channel error: ${e.message}`);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { linkId: id, payload: { type: 'offer', sdp: pc.localDescription } });
  };

  const sendFiles = async () => {
    const dc = dcRef.current;
    const currentFiles = filesRef.current;
    if (!dc || dc.readyState !== 'open') return;

    totalSizeRef.current = currentFiles.reduce((s, f) => s + (f.file?.size || 0), 0);
    totalSentRef.current = 0;
    lastSpeedCheckRef.current = { time: Date.now(), bytes: 0 };

    dc.send(JSON.stringify({
      type: 'manifest',
      files: currentFiles.map(f => ({ name: f.name, size: f.size, type: f.type, relativePath: f.relativePath })),
      folderName: folderNameRef.current || null,
    }));

    const perFileSent = currentFiles.map(() => 0);

    const waitBuffer = () => new Promise(resolve => {
      const check = () => dc.bufferedAmount <= dc.bufferedAmountLowThreshold ? resolve() : setTimeout(check, 10);
      check();
    });

    for (let i = 0; i < currentFiles.length; i++) {
      const f = currentFiles[i].file;
      if (!f) continue;

      setFileStatus(s => s.map((v, idx) => idx === i ? 'uploading' : v));
      dc.send(JSON.stringify({ type: 'start', index: i }));

      let offset = 0;
      while (offset < f.size) {
        const buf = await f.slice(offset, offset + CHUNK).arrayBuffer();
        dc.send(buf);
        offset += buf.byteLength;
        perFileSent[i] = offset;
        totalSentRef.current = perFileSent.reduce((s, x) => s + x, 0);

        const pct = f.size ? Math.floor((offset / f.size) * 100) : 0;
        setFileProgress(prev => prev.map((v, idx) => idx === i ? pct : v));
        setTotalPercent(totalSizeRef.current ? Math.floor((totalSentRef.current / totalSizeRef.current) * 100) : 0);

        const now = Date.now();
        const elapsed = (now - lastSpeedCheckRef.current.time) / 1000;
        if (elapsed >= 0.5) {
          const spd = (totalSentRef.current - lastSpeedCheckRef.current.bytes) / elapsed;
          setCurrentSpeed(spd);
          setSpeedHistory(prev => [...prev.slice(-29), spd]);
          lastSpeedCheckRef.current = { time: now, bytes: totalSentRef.current };
        }

        if (dc.bufferedAmount > CHUNK * 8) await waitBuffer();
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
    setFiles([]); filesRef.current = [];
    setFileProgress([]); setFileStatus([]);
    setPhase('idle'); setShareLink(''); setStatusMsg('');
    setTotalPercent(0); setSpeedHistory([]); setCurrentSpeed(0);
    setFolderName(''); folderNameRef.current = '';
  };

  const phaseColor = { idle: '#4a6080', waiting: '#ffb800', connecting: '#00d4ff', transferring: '#00d4ff', done: '#00ffb3' };

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Logo size="md" />
        <button onClick={() => navigate('/receive')} className="btn-secondary" style={{ fontSize: 13 }}>
          Receive Files →
        </button>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 32, animation: 'slideUp 0.4s ease-out' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, color: '#c8ddf5', lineHeight: 1.1, marginBottom: 8 }}>
          Send Files <span style={{ color: '#00d4ff' }}>Instantly</span>
        </h1>
        <p style={{ color: '#4a6080', fontSize: 16 }}>P2P transfer — no cloud, no limits, no waiting.</p>
      </div>

      {/* Upload mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['files', 'folder'].map(mode => (
          <button key={mode} onClick={() => { setUploadMode(mode); reset(); }} style={{
            padding: '7px 18px', borderRadius: 8,
            border: `1px solid ${uploadMode === mode ? 'rgba(0,212,255,0.5)' : '#1e2d45'}`,
            background: uploadMode === mode ? 'rgba(0,212,255,0.1)' : 'transparent',
            color: uploadMode === mode ? '#00d4ff' : '#4a6080',
            fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {mode === 'files' ? '📄 Files' : '📁 Folder'}
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
          borderRadius: 16, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
          marginBottom: 24, transition: 'all 0.3s ease',
          background: files.length > 0 ? 'rgba(0,212,255,0.03)' : 'rgba(14,20,32,0.5)',
        }}
      >
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />
        <input ref={folderInputRef} type="file" webkitdirectory="" mozdirectory="" directory="" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />

        {files.length === 0 ? (
          <div>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
              {uploadMode === 'folder' ? '📁' : '📤'}
            </div>
            <p style={{ color: '#c8ddf5', fontWeight: 500, fontSize: 16, marginBottom: 6 }}>
              {uploadMode === 'folder' ? 'Click to select a folder' : 'Drop files here or click to browse'}
            </p>
            <p style={{ color: '#4a6080', fontSize: 13 }}>
              {uploadMode === 'folder' ? 'Entire folder structure will be preserved' : 'Multiple files supported · Any format · No size limit'}
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
                <p style={{ color: '#4a6080', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{formatBytes(totalSize)} total</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); reset(); }} style={{ color: '#4a6080', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Create Link Button */}
      {phase === 'idle' && files.length > 0 && (
        <button className="btn-primary" onClick={createLink} style={{ width: '100%', marginBottom: 24, fontSize: 15 }}>
          🔗 Generate Share Link
        </button>
      )}

      {/* Share Link */}
      {shareLink && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, animation: 'slideUp 0.4s ease-out' }}>
          <p style={{ color: '#8ca0bc', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>🔗 Share this link with the receiver</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#080b12', border: '1px solid #1e2d45', borderRadius: 10, padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#00d4ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shareLink}
            </div>
            <button className="btn-secondary" onClick={copyLink} style={{ background: copied ? 'rgba(0,255,179,0.12)' : undefined, color: copied ? '#00ffb3' : undefined, border: copied ? '1px solid rgba(0,255,179,0.3)' : undefined, flexShrink: 0, fontSize: 13 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      {phase !== 'idle' && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (phase === 'transferring' || phase === 'done') ? 20 : 0 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: phaseColor[phase], boxShadow: `0 0 10px ${phaseColor[phase]}`, flexShrink: 0, animation: phase !== 'done' ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span style={{ color: phaseColor[phase], fontWeight: 500, fontSize: 14 }}>{statusMsg}</span>
          </div>

          {(phase === 'transferring' || phase === 'done') && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <RadialProgress percent={totalPercent} size={100} label={phase === 'done' ? 'Done' : 'Sent'} sublabel={formatBytes(totalSentRef.current)} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#4a6080', fontSize: 13 }}>Transfer speed</span>
                  <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{currentSpeed > 0 ? formatSpeed(currentSpeed) : '—'}</span>
                </div>
                <SpeedChart data={speedHistory} width={220} height={44} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{formatBytes(totalSentRef.current)} / {formatBytes(totalSizeRef.current)}</span>
                  <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{files.filter((_, i) => fileStatus[i] === 'completed').length} / {files.length} files</span>
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
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#c8ddf5' }}>Files</h3>
              <p style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>{files.length} item{files.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}</p>
            </div>
            {phase === 'done' && <button className="btn-secondary" onClick={reset} style={{ fontSize: 13 }}>Send More</button>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#080b12' }}>
                  {['File', 'Size', 'Progress', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a6080', fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2d45' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <FileRow key={i} file={f} progress={fileProgress[i] || 0} status={fileStatus[i] || 'pending'} isReceiver={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', color: '#2a3d55', fontSize: 13, paddingBottom: 24 }}>
        🔒 End-to-end encrypted via WebRTC · No data touches our servers
      </div>
    </div>
  );
}
