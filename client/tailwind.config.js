/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', '"Source Code Pro"', 'ui-monospace', 'monospace'],
    },
    extend: {
      colors: {
        void: 'var(--c-void)',
        abyss: 'var(--c-abyss)',
        crypt: 'var(--c-crypt)',
        glyph: 'var(--c-glyph)',
        shade: 'var(--c-shade)',
        bone: 'var(--c-bone)',
        skull: 'var(--c-skull)',
        terminal: {
          DEFAULT: 'var(--c-terminal)',
          dim: 'var(--c-terminal-dim)',
          glow: 'var(--c-terminal-glow)',
        },
        blood: {
          DEFAULT: '#dc2626',
          dim: '#991b1b',
        },
        ember: '#f97316',
        hex: {
          DEFAULT: '#a855f7',
          dim: '#7c3aed',
        },
        brand: {
          DEFAULT: 'var(--c-terminal)',
          light: 'var(--c-terminal)',
          dark: 'var(--c-terminal-dim)',
        },
      },
      boxShadow: {
        'terminal': '0 0 15px var(--c-terminal-glow)',
        'terminal-sm': '0 0 8px var(--c-terminal-glow)',
        'blood': '0 0 15px rgba(220, 38, 38, 0.2)',
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'flicker': 'flicker 0.15s ease-in-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        flicker: {
          '0%': { opacity: '0.8' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.95' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px var(--c-terminal-glow)' },
          '50%': { boxShadow: '0 0 20px var(--c-terminal-glow)' },
        },
      },
    },
  },
  plugins: [],
}
