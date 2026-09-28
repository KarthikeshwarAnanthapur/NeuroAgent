/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neuro: {
          bg: '#050811',
          card: '#0a1322',
          surface: 'rgba(10, 19, 34, 0.75)',
          surfaceHover: 'rgba(15, 27, 48, 0.85)',
          border: 'rgba(0, 212, 255, 0.16)',
          borderHover: 'rgba(0, 212, 255, 0.4)',
          cyan: '#00d4ff',
          cyanGlow: 'rgba(0, 212, 255, 0.35)',
          teal: '#00f5a0',
          blue: '#1e66f5',
          purple: '#b057f5',
          red: '#ff3b5c',
          amber: '#f59e0b',
          muted: '#627d98',
          text: '#f0f6fc',
          textMuted: '#8b9bb4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -3px rgba(0, 212, 255, 0.45)',
        'glow-cyan-sm': '0 0 10px -2px rgba(0, 212, 255, 0.35)',
        'glow-red': '0 0 20px -3px rgba(255, 59, 92, 0.45)',
        'glow-green': '0 0 20px -3px rgba(0, 245, 160, 0.4)',
        'glow-amber': '0 0 20px -3px rgba(245, 158, 11, 0.4)',
        'panel': '0 10px 30px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.8, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.08)' },
        },
        wave: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '100' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
