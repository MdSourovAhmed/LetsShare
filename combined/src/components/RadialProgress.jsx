export default function RadialProgress({ percent = 0, size = 120, label = '', sublabel = '' }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color = percent === 100 ? '#00ffb3' : '#00d4ff';
  const glowColor = percent === 100 ? 'rgba(0,255,179,0.4)' : 'rgba(0,212,255,0.4)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="#1e2d45"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: size * 0.18,
          color,
          lineHeight: 1,
        }}>
          {Math.round(percent)}%
        </span>
        {label && (
          <span style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: size * 0.1,
            color: '#8ca0bc',
            marginTop: 2,
          }}>
            {label}
          </span>
        )}
        {sublabel && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: size * 0.085,
            color: '#4a6080',
            marginTop: 1,
          }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
