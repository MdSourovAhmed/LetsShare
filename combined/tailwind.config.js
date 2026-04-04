/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: '#080b12',
        surface: '#0e1420',
        card: '#131929',
        border: '#1e2d45',
        neon: '#00d4ff',
        neonDim: '#0099bb',
        emerald: '#00ffb3',
        amber: '#ffb800',
        rose: '#ff4466',
        muted: '#4a6080',
        dim: '#8ca0bc',
        bright: '#c8ddf5',
      },
      boxShadow: {
        neon: '0 0 20px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.1)',
        emerald: '0 0 20px rgba(0,255,179,0.3)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,212,255,0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(0,212,255,0.8), 0 0 60px rgba(0,212,255,0.3)' },
        },
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
