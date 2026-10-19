import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        hair: 'rgb(var(--hair) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        mid: 'rgb(var(--mid) / <alpha-value>)',
        dim: 'rgb(var(--dim) / <alpha-value>)',
        signal: 'rgb(var(--signal) / <alpha-value>)',
        signalink: 'rgb(var(--signal-ink) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        btnbg: 'rgb(var(--btn-bg) / <alpha-value>)',
        btnfg: 'rgb(var(--btn-fg) / <alpha-value>)'
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular']
      },
      letterSpacing: { tightest: '-0.045em' },
      borderRadius: { card: '14px', ctl: '10px' }
    }
  },
  plugins: []
};
export default config;
