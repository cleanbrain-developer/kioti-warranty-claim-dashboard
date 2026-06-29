/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        bg: {
          base: 'var(--bg-base)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
          elevated: 'var(--bg-elevated)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          emphasis: 'var(--border-emphasis)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          link: 'var(--text-link)',
        },
        accent: {
          blue: '#2563eb',
          'blue-light': '#3b82f6',
          green: '#16a34a',
          'green-light': '#22c55e',
          orange: '#d97706',
          'orange-light': '#f59e0b',
          red: '#dc2626',
          'red-light': '#ef4444',
          purple: '#7c3aed',
          'purple-light': '#8b5cf6',
        },
        chart: {
          1: '#60a5fa',
          2: '#34d399',
          3: '#fbbf24',
          4: '#f87171',
          5: '#a78bfa',
          6: '#4ade80',
          7: '#fb923c',
        },
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(30,60,100,0.3)',
        'card-light': '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        glow: '0 0 20px rgba(96,165,250,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
