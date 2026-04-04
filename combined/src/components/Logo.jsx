export default function Logo({ size = 'md' }) {
  const sizes = {
    sm: { icon: 28, text: 'text-lg' },
    md: { icon: 36, text: 'text-2xl' },
    lg: { icon: 48, text: 'text-3xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <svg width={s.icon} height={s.icon} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="10" fill="rgba(0,212,255,0.12)" />
        <path d="M18 8 L28 14 L28 22 L18 28 L8 22 L8 14 Z" stroke="#00d4ff" strokeWidth="1.5" fill="none" />
        <path d="M18 8 L28 14 L18 20 L8 14 Z" fill="rgba(0,212,255,0.2)" />
        <circle cx="18" cy="20" r="3" fill="#00d4ff" />
        <line x1="18" y1="20" x2="18" y2="28" stroke="#00d4ff" strokeWidth="1.5" />
      </svg>
      <span className={`font-display font-bold ${s.text} tracking-tight`} style={{ fontFamily: 'Syne, sans-serif' }}>
        Drop<span style={{ color: '#00d4ff' }}>Link</span>
      </span>
    </div>
  );
}
