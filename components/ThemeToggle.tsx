'use client';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const light = mode === 'paper';
  return (
    <button
      onClick={toggle}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      title={light ? 'Dark' : 'Light'}
      className="relative h-9 w-[62px] shrink-0 rounded-full border border-line bg-panel p-1 transition-colors hover:border-dim/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    >
      <span
        className="absolute top-1 left-1 h-7 w-7 rounded-full bg-fg transition-transform duration-200 ease-out"
        style={{ transform: light ? 'translateX(28px)' : 'translateX(0)' }}
      />
      <span className="pointer-events-none relative flex h-7 w-full items-center justify-between px-[7px]">
        <MoonGlyph className={'h-3.5 w-3.5 ' + (light ? 'text-canvas' : 'text-dim')} />
        <SunGlyph className={'h-3.5 w-3.5 ' + (light ? 'text-dim' : 'text-canvas')} />
      </span>
    </button>
  );
}

function MoonGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function SunGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
