'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Shell({ role, email, sidebar, children }: { role: string; email: string; sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);

  return (
    <div className="flex min-h-screen">
      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex lg:w-[256px]">
        {sidebar}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 fade" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[300px] border-r border-line bg-surface px-4 py-6 pop">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile topbar */}
        <header className="glass sticky top-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="icon-btn -ml-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
          <span className="font-display text-[15px] font-semibold tracking-tightest">OCTA DEVS</span>
          <span className="ml-auto"><ThemeToggle /></span>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 pb-24 md:px-8 md:py-10">
          <div className="mb-6 hidden justify-end md:flex"><ThemeToggle /></div>
          {children}
        </main>
      </div>
    </div>
  );
}
