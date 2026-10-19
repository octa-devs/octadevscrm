'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Mode = 'ink' | 'paper';
const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void; toggle: () => void }>({ mode: 'ink', setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('ink');

  useEffect(() => {
    const el = document.documentElement;
    setModeState(el.classList.contains('paper') ? 'paper' : 'ink');
  }, []);

  const setMode = useCallback((m: Mode) => {
    document.documentElement.classList.toggle('paper', m === 'paper');
    localStorage.setItem('octa-theme', m);
    setModeState(m);
  }, []);

  const toggle = useCallback(() => {
    setMode(document.documentElement.classList.contains('paper') ? 'ink' : 'paper');
  }, [setMode]);

  return <Ctx.Provider value={{ mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
