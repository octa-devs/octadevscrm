'use client';
import { createContext, useContext } from 'react';

export type SessionInfo = { email: string; role: string; username: string };
const SessionCtx = createContext<SessionInfo>({ email: '', role: 'employee', username: '' });

export function SessionProvider({ value, children }: { value: SessionInfo; children: React.ReactNode }) {
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
