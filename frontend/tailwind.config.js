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
          base: '#0d1117',
          card: '#161b22',
          hover: '#1c2128',
          elevated: '#21262d',
        },
        border: {
          DEFAULT: '#30363d',
          subtle: '#21262d',
          emphasis: '#484f58',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#6e7681',
          link: '#58a6ff',
        },
        accent: {
          blue: '#1f6feb',
          'blue-light': '#388bfd',
          green: '#238636',
          'green-light': '#3fb950',
          orange: '#d29922',
          'orange-light': '#e3b341',
          red: '#da3633',
          'red-light': '#f85149',
          purple: '#8250df',
          'purple-light': '#a371f7',
        },
        chart: {
          1: '#58a6ff',
          2: '#3fb950',
          3: '#e3b341',
          4: '#f85149',
          5: '#a371f7',
          6: '#39d353',
          7: '#ffa657',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        glow: '0 0 20px rgba(88,166,255,0.15)',
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
