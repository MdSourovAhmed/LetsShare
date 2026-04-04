import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import RadialProgress from '../components/RadialProgress';
import SpeedChart from '../components/SpeedChart';
import FileRow from '../components/FileRow';
import { formatBytes, formatSpeed } from '../utils';

export default function ReceivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('id');

  const [phase, setPhase] = useState('connecting'); // connecting | waiting | receiving | done | error
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
  const currentIndexRef = useRef(-1);
  const totalSizeRef = useRef(0);
  const totalReceivedRef = useRef(0);
  const lastSpeedCheckRef = useRef({ time: Date.now(), bytes: 0 });

  useEffect(() => {
    if (!linkId) {
      setPhase('error');
      setStatusMsg('No share ID found in URL. Ask the sender to share the link again.');
      return;
    }

    const io = window.io;
    if (!io) {
      setPhase('error');
      setStatusMsg('Cannot connect — backend not running. Start the server first.');
      return;
    }

    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatusMsg('Connected! Waiting for sender...');
      setPhase('waiting');
      socket.emit('join', { linkId, role: 'receiver' });
    });

    socket.on('signal', async (payload) => {
      if (payload.type === 'offer') {
        await ensurePc();
        await pcRef.current.setRemoteDescription(payload.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('signal', { linkId, payload: { type: 'answer', sdp: pcRef.current.localDescription } });
      } else if (payload.type === 'ice') {
        try { await pcRef.current?.addIceCandidate(payload.candidate); } catch {}
      }
    });

    socket.on('disconnect', () => {
      if (phase !== 'done') setStatusMsg('Disconnected from signaling server');
    });

    // Timeout
    const timeout = setTimeout(() => {
      if (phase === 'waiting') {
        setPhase('error');
        setStatusMsg('Connection timeout — sender may have gone offline or the link expired.');
      }
    }, 60000);

    return () => {
      socket.disconnect();
      pcRef.current?.close();
      clearTimeout(timeout);
    };
  }, [linkId]);

  const ensurePc = async () => {
    if (pcRef.current) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('signal', { linkId, payload: { type: 'ice', candidate: e.candidate } });
      }
    };

    pc.ondatachannel = (e) => {
      const dc = e.channel;
      dc.binaryType = 'arraybuffer';
      dc.onopen = () => {
        setPhase('receiving');
        setStatusMsg('Connection established! Receiving files...');
      };
      dc.onmessage = onData;
      dc.onclose = () => {
        if (phase !== 'done') setStatusMsg('Data channel closed');
      };
    };
  };

  const onData = (e) => {
    const data = e.data;

    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'manifest') {
          const files = msg.files || [];
          const total = files.reduce((s, f) => s + (f.size || 0), 0);
          totalSizeRef.current = total;
          setTotalSize(total);
          setFilesMeta(files);
          setFileProgress(files.map(() => 0));
          setFileStatus(files.map(() => 'pending'));
          setFileUrls(files.map(() => null));
          fileBuffersRef.current = files.map(() => []);
          fileReceivedRef.current = files.map(() => 0);
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
          const meta = filesMeta[i] || {};
          const blob = new Blob(fileBuffersRef.current[i], { type: meta.type || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          setFileUrls(prev => prev.map((v, idx) => idx === i ? url : v));
          setFileProgress(prev => prev.map((v, idx) => idx === i ? 100 : v));
          setFileStatus(s => s.map((v, idx) => idx === i ? 'ready' : v));
          return;
        }

        if (msg.type === 'all_done') {
          setPhase('done');
          setStatusMsg('All files received! Click Download to save each file.');
          setCurrentSpeed(0);
          return;
        }
      } catch {}
      return;
    }

    // Binary chunk
    const ab = data instanceof ArrayBuffer ? Promise.resolve(data) : (data?.arrayBuffer ? data.arrayBuffer() : null);
    if (!ab || currentIndexRef.current < 0) return;

    ab.then(buf => {
      const i = currentIndexRef.current;
      fileBuffersRef.current[i].push(new Uint8Array(buf));
      fileReceivedRef.current[i] += buf.byteLength;

      const size = (filesMeta[i] || {}).size || 0;
      const pct = size ? Math.floor((fileReceivedRef.current[i] / size) * 100) : 0;
      setFileProgress(prev => prev.map((v, idx) => idx === i ? pct : v));

      totalReceivedRef.current = fileReceivedRef.current.reduce((s, x) => s + x, 0);
      setTotalReceived(totalReceivedRef.current);

      const overall = totalSizeRef.current
        ? Math.floor((totalReceivedRef.current / totalSizeRef.current) * 100)
        : 0;
      setTotalPercent(overall);

      // Speed
      const now = Date.now();
      const elapsed = (now - lastSpeedCheckRef.current.time) / 1000;
      if (elapsed >= 0.5) {
        const diff = totalReceivedRef.current - lastSpeedCheckRef.current.bytes;
        const spd = diff / elapsed;
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

  const downloadAll = () => {
    fileUrls.forEach((url, i) => {
      if (url) {
        setTimeout(() => downloadFile(i), i * 200);
      }
    });
  };

  const phaseConfig = {
    connecting: { color: '#4a6080', icon: '⟳', pulse: true },
    waiting:    { color: '#ffb800', icon: '⏳', pulse: true },
    receiving:  { color: '#00d4ff', icon: '↓',  pulse: true },
    done:       { color: '#00ffb3', icon: '✓',  pulse: false },
    error:      { color: '#ff4466', icon: '✕',  pulse: false },
  };
  const cfg = phaseConfig[phase] || phaseConfig.connecting;
  const allDone = fileUrls.every(u => u !== null) && fileUrls.length > 0;

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Logo size="md" />
        <button
          onClick={() => navigate('/')}
          className="btn-secondary"
          style={{ fontSize: 13 }}
        >
          ← Send Files
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
          Receive <span style={{ color: '#00ffb3' }}>Files</span>
          {folderName && (
            <span style={{ color: '#4a6080', fontSize: '0.55em', fontWeight: 400, marginLeft: 12 }}>
              📁 {folderName}
            </span>
          )}
        </h1>
        <p style={{ color: '#4a6080', fontSize: 16 }}>
          {linkId
            ? <><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2a3d55' }}>ID: </span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00d4ff', fontSize: 14 }}>{linkId}</span></>
            : 'Direct peer-to-peer file transfer'
          }
        </p>
      </div>

      {/* Status card */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24, animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: (phase === 'receiving' || phase === 'done') ? 24 : 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${cfg.color}18`,
            border: `1px solid ${cfg.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color, fontSize: 16,
            animation: cfg.pulse ? 'pulseNeon 2s ease-in-out infinite' : 'none',
          }}>
            {phase === 'connecting' || phase === 'waiting' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: 'spin 1.5s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
              </svg>
            ) : cfg.icon}
          </div>
          <div>
            <p style={{ color: cfg.color, fontWeight: 500, fontSize: 15 }}>{statusMsg}</p>
            {phase === 'waiting' && (
              <p style={{ color: '#4a6080', fontSize: 12, marginTop: 3 }}>
                Make sure the sender has the same link open
              </p>
            )}
          </div>
        </div>

        {/* Transfer stats */}
        {(phase === 'receiving' || phase === 'done') && filesMeta.length > 0 && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <RadialProgress
              percent={totalPercent}
              size={100}
              label={phase === 'done' ? 'Complete' : 'Received'}
              sublabel={formatBytes(totalReceived)}
            />

            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#4a6080', fontSize: 13 }}>Transfer speed</span>
                <span style={{ color: '#00ffb3', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {currentSpeed > 0 ? formatSpeed(currentSpeed) : '—'}
                </span>
              </div>
              <SpeedChart data={speedHistory} width={220} height={44} color="#00ffb3" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatBytes(totalReceived)} / {formatBytes(totalSize)}
                </span>
                <span style={{ color: '#4a6080', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                  {fileUrls.filter(Boolean).length} / {filesMeta.length} ready
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download All */}
      {allDone && (
        <button
          className="btn-primary"
          onClick={downloadAll}
          style={{
            width: '100%',
            marginBottom: 24,
            fontSize: 15,
            background: '#00ffb3',
            color: '#080b12',
            boxShadow: '0 0 20px rgba(0,255,179,0.3)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download All Files ({filesMeta.length})
        </button>
      )}

      {/* Files table */}
      {filesMeta.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 24, animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#c8ddf5' }}>
              Incoming Files
            </h3>
            <p style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>
              {filesMeta.length} item{filesMeta.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#080b12' }}>
                  {['File', 'Size', 'Progress', 'Status', 'Download'].map(h => (
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
                {filesMeta.map((f, i) => (
                  <FileRow
                    key={i}
                    file={f}
                    progress={fileProgress[i] || 0}
                    status={fileStatus[i] || 'pending'}
                    onDownload={() => downloadFile(i)}
                    isReceiver={true}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {phase === 'error' && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: '#ff4466', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Connection Failed</p>
          <p style={{ color: '#4a6080', fontSize: 14, marginBottom: 20 }}>{statusMsg}</p>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            Go to Send Page
          </button>
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
