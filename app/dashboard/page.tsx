'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/Session';

const TILES = [
  { key: 'leads', label: 'Leads', href: '/dashboard/crm/leads', hint: 'Inbound conversations to work' },
  { key: 'contacts', label: 'Contacts', href: '/dashboard/crm/contacts', hint: 'People you have spoken with' },
  { key: 'deals', label: 'Deals', href: '/dashboard/crm/deals', hint: 'Proposals and negotiations' },
  { key: 'tasks', label: 'Tasks', href: '/dashboard/crm/tasks', hint: 'Work assigned to the team' },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const { email } = useSession();

  useEffect(() => {
    fetch('/api/crm/stats').then((r) => r.json()).then(setStats).catch(() => setStats({}));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = email ? email.split('@')[0].replace(/[._-]+/g, ' ') : '';

  return (
    <div className="space-y-10">
      <header className="rise">
        <p className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-3 font-display text-[30px] font-semibold tracking-tightest leading-[1.1] md:text-[38px]">
          {greeting}{name ? <span className="text-dim">, {name}</span> : null}
        </h1>
      </header>

      <section>
        <p className="eyebrow px-1 pb-3">Pipeline</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TILES.map((t, i) => (
            <Link
              key={t.key}
              href={t.href}
              className="card group flex flex-col justify-between p-4 transition-colors hover:border-dim/50 md:p-5 rise"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <span className="eyebrow">{t.label}</span>
                <Arrow />
              </div>
              <div>
                <p className="num mt-6 text-[34px] font-medium leading-none tracking-tightest md:text-[40px]">
                  {stats ? String(stats[t.key] ?? 0).padStart(2, '0') : '—'}
                </p>
                <p className="mt-2.5 text-[12px] leading-snug text-dim">{t.hint}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card-flat overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <p className="eyebrow">Getting around</p>
        </div>
        <ul className="divide-y divide-line">
          {[
            ['Leads, contacts, deals, tasks', 'Every record lives in its own list. Search filters as you type.'],
            ['Website', 'Super users can edit the projects, team and launch banner shown on octadevs.fun.'],
            ['People', 'Super users can create accounts and change anyone\'s email, password or role.'],
          ].map(([k, v]) => (
            <li key={k} className="grid gap-1 px-5 py-4 md:grid-cols-[240px_1fr] md:gap-6">
              <span className="font-medium text-[14px]">{k}</span>
              <span className="text-[13px] leading-relaxed text-mid">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" aria-hidden>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </svg>
  );
}
