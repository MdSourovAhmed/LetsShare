import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Logo from '../components/Logo';
import RadialProgress from '../components/RadialProgress';
import SpeedChart from '../components/SpeedChart';
import FileRow from '../components/FileRow';
import { formatBytes, formatSpeed } from '../utils';

export default function ReceivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('id');

  const [phase, setPhase] = useState('connecting');
  const [statusMsg, setStatusMsg] = useState('Connecting to signaling server...');
  const [filesMeta, setFilesMeta] = useState([]);
  const [fileProgress, setFileProgress] = useState([]);
  const [fileStatus, setFileStatus] = useState([]);
  const [fileUrls, setFileUrls] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [totalPercent, setTotalPercent] = useState(0);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [folderName, setFolderName] = useState('');

  const socketRef = useRef();
  const pcRef = useRef();
  const fileBuffersRef = useRef([]);
  const fileReceivedRef = useRef([]);
  const filesMetaRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const totalSizeRef = useRef(0);
  const totalReceivedRef = useRef(0);
  const lastSpeedCheckRef = useRef({ time: Date.now(), bytes: 0 });

  useEffect(() => {
    if (!linkId) {
      setPhase('error');
      setStatusMsg('No share ID in URL. Ask the sender for the correct link.');
      return;
    }

    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatusMsg('Connected! Waiting for sender...');
      setPhase('waiting');
      socket.emit('join', { linkId, role: 'receiver' });
    });

    socket.on('connect_error', (err) => {
      setPhase('error');
      setStatusMsg(`Cannot reach server: ${err.message}. Make sure the backend is running.`);
    });

    socket.on('signal', async (payload) => {
      if (payload.type === 'offer') {
        await ensurePc(socket);
        const pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { linkId, payload: { type: 'answer', sdp: pc.localDescription } });
      } else if (payload.type === 'ice' && payload.candidate) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      }
    });

    const timeout = setTimeout(() => {
      if (phase === 'waiting') {
        setPhase('error');
        setStatusMsg('Timed out — sender may be offline or the link has expired.');
      }
    }, 60000);

    return () => {
      clearTimeout(timeout);
      socket.disconnect();
      pcRef.current?.close();
    };
  }, [linkId]);

  const ensurePc = async (socket) => {
    if (pcRef.current) return;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { linkId, payload: { type: 'ice', candidate: e.candidate.toJSON() } });
      }
    };

    pc.ondatachannel = (e) => {
      const dc = e.channel;
      dc.binaryType = 'arraybuffer';
      dc.onopen = () => { setPhase('receiving'); setStatusMsg('Connection established! Receiving files...'); };
      dc.onmessage = onData;
      dc.onclose = () => { if (phase !== 'done') setStatusMsg('Connection closed by sender.'); };
    };
  };

  const onData = (e) => {
    const data = e.data;

    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'manifest') {
          const mfiles = msg.files || [];
          const total = mfiles.reduce((s, f) => s + (f.size || 0), 0);
          totalSizeRef.current = total;
          filesMetaRef.current = mfiles;
          fileBuffersRef.current = mfiles.map(() => []);
          fileReceivedRef.current = mfiles.map(() => 0);
          setTotalSize(total);
          setFilesMeta(mfiles);
          setFileProgress(mfiles.map(() => 0));
          setFileStatus(mfiles.map(() => 'pending'));
          setFileUrls(mfiles.map(() => null));
          if (msg.folderName) setFolderName(msg.folderName);
          return;
        }
        if (msg.type === 'start') {
          currentIndexRef.current = msg.index;
          setFileStatus(s => s.map((v, i) => i === msg.index ? 'receiving' : v));
          return;
        }
        if (msg.type === 'end') {
          const i = msg.index;
          const meta = filesMetaRef.current[i] || {};
          const blob = new Blob(fileBuffersRef.current[i], { type: meta.type || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          setFileUrls(prev => prev.map((v, idx) => idx === i ? url : v));
          setFileProgress(prev => prev.map((v, idx) => idx === i ? 100 : v));
          setFileStatus(s => s.map((v, idx) => idx === i ? 'ready' : v));
          return;
        }
        if (msg.type === 'all_done') {
          setPhase('done');
          setStatusMsg('All files received! Click Download to save.');
          setCurrentSpeed(0);
          return;
        }
      } catch {}
      return;
    }

    // Binary chunk
    const ab = data instanceof ArrayBuffer ? Promise.resolve(data) : data?.arrayBuffer?.();
    if (!ab || currentIndexRef.current < 0) return;

    ab.then(buf => {
      const i = currentIndexRef.current;
      fileBuffersRef.current[i].push(new Uint8Array(buf));
      fileReceivedRef.current[i] += buf.byteLength;

      const size = filesMetaRef.current[i]?.size || 0;
      const pct = size ? Math.floor((fileReceivedRef.current[i] / size) * 100) : 0;
      setFileProgress(prev => prev.map((v, idx) => idx === i ? pct : v));

      totalReceivedRef.current = fileReceivedRef.current.reduce((s, x) => s + x, 0);
      setTotalReceived(totalReceivedRef.current);
      setTotalPercent(totalSizeRef.current ? Math.floor((totalReceivedRef.current / totalSizeRef.current) * 100) : 0);

      const now = Date.now();
      const elapsed = (now - lastSpeedCheckRef.current.time) / 1000;
      if (elapsed >= 0.5) {
        const spd = (totalReceivedRef.current - lastSpeedCheckRef.current.bytes) / elapsed;
        setCurrentSpeed(spd);
        setSpeedHistory(prev => [...prev.slice(-29), spd]);
        lastSpeedCheckRef.current = { time: now, bytes: totalReceivedRef.current };
      }
    });
  };

  const downloadFile = (index) => {
    const url = fileUrls[index];
    const meta = filesMeta[index];
    if (!url || !meta) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name || `file_${index}`;
    a.click();
  };

  const downloadAll = () => fileUrls.forEach((url, i) => url && setTimeout(() => downloadFile(i), i * 200));

  const phaseColor = { connecting: '#4a6080', waiting: '#ffb800', receiving: '#00d4ff', done: '#00ffb3', error: '#ff4466' };
  const allReady = fileUrls.length > 0 && fileUrls.every(Boolean);

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Logo size="md" />
        <button onClick={() => navigate('/')} className="btn-secondary" style={{ fontSize: 13 }}>← Send Files</button>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 32, animation: 'slideUp 0.4s ease-out' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, color: '#c8ddf5', lineHeight: 1.1, marginBottom: 8 }}>
          Receive <span style={{ color: '#00ffb3' }}>Files</span>
          {folderName && <span style={{ color: '#4a6080', fontSize: '0.5em', fontWeight: 400, marginLeft: 12 }}>📁 {folderName}</span>}
        </h1>
        <p style={{ color: '#4a6080', fontSize: 16 }}>
          {linkId
            ? <><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2a3d55' }}>ID: </span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00d4ff', fontSize: 14 }}>{linkId}</span></>
            : 'Direct peer-to-peer file transfer'}
        </p>
      </div>

      {/* Status card */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: (phase === 'receiving' || phase === 'done') ? 24 : 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${phaseColor[phase]}18`, border: `1px solid ${phaseColor[phase]}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: phaseColor[phase], fontSize: 14, flexShrink: 0,
          }}>
            {phase === 'connecting' || phase === 'waiting'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1.5s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              : phase === 'done' ? '✓' : phase === 'error' ? '✕' : '↓'}
          </div>
          <div>
            <p style={{ color: phaseColor[phase], fontWeight: 500, fontSize: 15 }}>{statusMsg}</p>
            {phase === 'waiting' && <p style={{ color: '#4a6080', fontSize: 12, marginTop: 3 }}>Keep this tab open — transfer starts automatically</p>}
          </div>
        </div>

        {(phase === 'receiving' || phase === 'done') && filesMeta.length > 0 && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <RadialProgress percent={totalPercent} size={100} label={phase === 'done' ? 'Complete' : 'Received'} sublabel={formatBytes(totalReceived)} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#4a6080', fontSize: 13 }}>Transfer speed</span>
                <span style={{ color: '#00ffb3', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{currentSpeed > 0 ? formatSpeed(currentSpeed) : '—'}</span>
              </div>
              <SpeedChart data={speedHistory} width={220} height={44} color="#00ffb3" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{formatBytes(totalReceived)} / {formatBytes(totalSize)}</span>
                <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{fileUrls.filter(Boolean).length} / {filesMeta.length} ready</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download All */}
      {allReady && (
        <button className="btn-primary" onClick={downloadAll} style={{ width: '100%', marginBottom: 24, fontSize: 15, background: '#00ffb3', color: '#080b12', boxShadow: '0 0 20px rgba(0,255,179,0.3)' }}>
          ⬇ Download All Files ({filesMeta.length})
        </button>
      )}

      {/* Files table */}
      {filesMeta.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 24, animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#c8ddf5' }}>Incoming Files</h3>
            <p style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>{filesMeta.length} item{filesMeta.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#080b12' }}>
                  {['File', 'Size', 'Progress', 'Status', 'Download'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a6080', fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2d45' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filesMeta.map((f, i) => (
                  <FileRow key={i} file={f} progress={fileProgress[i] || 0} status={fileStatus[i] || 'pending'} onDownload={() => downloadFile(i)} isReceiver={true} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: '#ff4466', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Connection Failed</p>
          <p style={{ color: '#4a6080', fontSize: 14, marginBottom: 20 }}>{statusMsg}</p>
          <button className="btn-secondary" onClick={() => navigate('/')}>Go to Send Page</button>
        </div>
      )}

      <div style={{ textAlign: 'center', color: '#2a3d55', fontSize: 13, paddingBottom: 24 }}>
        🔒 End-to-end encrypted via WebRTC · No data touches our servers
      </div>
    </div>
  );
}
