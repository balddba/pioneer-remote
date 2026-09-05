/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        receiver: {
          950: '#070a11',
          900: '#0d131f',
          800: '#172033',
          700: '#222f49',
          600: '#334466',
        },
        led: {
          cyan: '#00f0ff',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          blue: '#3b82f6',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -2px rgba(0, 240, 255, 0.4)',
        'glow-green': '0 0 20px -2px rgba(16, 185, 129, 0.4)',
        'glow-amber': '0 0 20px -2px rgba(245, 158, 11, 0.4)',
        'glow-red': '0 0 20px -2px rgba(239, 68, 68, 0.4)',
        'inner-metal': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.06), inset 0 -2px 4px 0 rgba(0, 0, 0, 0.6)',
        'tactile': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'tactile-pressed': 'inset 0 3px 6px 0 rgba(0, 0, 0, 0.6)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
