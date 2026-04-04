import { getFileIcon, getFileType, formatBytes } from '../utils';

export function StatusBadge({ status }) {
  const configs = {
    pending:   { color: '#4a6080', bg: 'rgba(74,96,128,0.15)',  label: 'Pending'    },
    uploading: { color: '#00d4ff', bg: 'rgba(0,212,255,0.12)',  label: 'Uploading'  },
    receiving: { color: '#ffb800', bg: 'rgba(255,184,0,0.12)',  label: 'Receiving'  },
    completed: { color: '#00ffb3', bg: 'rgba(0,255,179,0.12)',  label: 'Complete'   },
    error:     { color: '#ff4466', bg: 'rgba(255,68,102,0.12)', label: 'Error'      },
    ready:     { color: '#00ffb3', bg: 'rgba(0,255,179,0.12)',  label: 'Ready'      },
  };
  const cfg = configs[status] || configs.pending;

  return (
    <span style={{
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      fontFamily: 'Syne, sans-serif',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {status === 'uploading' || status === 'receiving' ? (
        <span className="flex items-center gap-1">
          <span style={{
            display: 'inline-block',
            width: 6, height: 6,
            borderRadius: '50%',
            background: cfg.color,
            animation: 'pulse 1s ease-in-out infinite',
            boxShadow: `0 0 6px ${cfg.color}`,
          }} />
          {cfg.label}
        </span>
      ) : cfg.label}
    </span>
  );
}

export default function FileRow({ file, progress = 0, status = 'pending', onDownload, isReceiver = false }) {
  const icon = file.isFolder ? '📁' : getFileIcon(file.name);
  const type = file.isFolder ? 'Folder' : getFileType(file.name);
  const isDone = status === 'completed' || status === 'ready';

  return (
    <tr style={{
      borderBottom: '1px solid #1e2d45',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <td style={{ padding: '14px 16px' }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 38, height: 38,
            borderRadius: 10,
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ color: '#c8ddf5', fontWeight: 500, fontSize: 14, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>
              {type}
              {file.relativePath && file.relativePath !== file.name && (
                <span style={{ marginLeft: 6, color: '#2a3d55', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  {file.relativePath.replace(file.name, '').replace(/\/$/, '')}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td style={{ padding: '14px 16px', color: '#8ca0bc', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
        {file.size ? formatBytes(file.size) : '—'}
      </td>

      <td style={{ padding: '14px 16px', minWidth: 140 }}>
        <div>
          <div className="progress-track" style={{ marginBottom: 4 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span style={{ color: '#4a6080', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            {progress}%
          </span>
        </div>
      </td>

      <td style={{ padding: '14px 16px' }}>
        <StatusBadge status={status} />
      </td>

      {isReceiver && (
        <td style={{ padding: '14px 16px' }}>
          <button
            disabled={!isDone || !onDownload}
            onClick={onDownload}
            style={{
              background: isDone ? 'rgba(0,255,179,0.12)' : 'rgba(74,96,128,0.1)',
              color: isDone ? '#00ffb3' : '#4a6080',
              border: `1px solid ${isDone ? 'rgba(0,255,179,0.3)' : '#1e2d45'}`,
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 12,
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              cursor: isDone ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.2s',
              boxShadow: isDone ? '0 0 12px rgba(0,255,179,0.2)' : 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </td>
      )}
    </tr>
  );
}
