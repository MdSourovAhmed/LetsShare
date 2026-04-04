export default function SpeedChart({ data = [], width = 200, height = 48, color = '#00d4ff' }) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke="#1e2d45" strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);

  const points = data.map((v, i) => [
    i * step,
    height - (v / max) * (height - 8) - 4,
  ]);

  const pathD = points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `${d} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1][0]} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      {/* Latest point dot */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="3" fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}
