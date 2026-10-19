'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const GROUPS: { label: string; items: { href: string; label: string; icon: string; superOnly?: boolean }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: 'grid' },
      { href: '/dashboard/chat', label: 'Chat', icon: 'chat' },
      { href: '/dashboard/crm/leads', label: 'Leads', icon: 'target' },
      { href: '/dashboard/crm/contacts', label: 'Contacts', icon: 'users' },
      { href: '/dashboard/crm/deals', label: 'Deals', icon: 'case' },
      { href: '/dashboard/crm/tasks', label: 'Tasks', icon: 'check' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard/website', label: 'Website', icon: 'globe', superOnly: true },
      { href: '/dashboard/users', label: 'People', icon: 'sliders', superOnly: true },
    ],
  },
];

export default function Sidebar({ role, email }: { role: string; email: string }) {
  const pathname = usePathname();
  const supabase = createClient();
  const isSuper = role === 'super_admin';

  useEffect(() => { document.body.style.overflow = ''; }, [pathname]);

  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };

  const isActive = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-1 pb-6">
        <span className="chamfer grid h-8 w-8 place-items-center bg-fg">
          <img src="/logo.png" alt="" className="h-8 w-8 object-cover" />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-semibold tracking-tightest">OCTA DEVS</span>
          <span className="eyebrow block pt-0.5">Portal</span>
        </span>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto">
        {GROUPS.map((g) => {
          const items = g.items.filter((i) => !i.superOnly || isSuper);
          if (!items.length) return null;
          return (
            <section key={g.label}>
              <p className="eyebrow px-3 pb-2.5">{g.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={'nav-item ' + (isActive(item.href) ? 'active' : '')}>
                      <Glyph name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-line pt-4">
        <p className="truncate px-3 font-mono text-[11px] text-dim" title={email}>{email}</p>
        <button onClick={logout} className="nav-item mt-2 w-full text-left hover:text-danger">
          <Glyph name="exit" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Glyph({ name }: { name: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, JSX.Element> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" {...p} /><rect x="14" y="3" width="7" height="7" rx="1.5" {...p} /><rect x="3" y="14" width="7" height="7" rx="1.5" {...p} /><rect x="14" y="14" width="7" height="7" rx="1.5" {...p} /></>,
    target: <><circle cx="12" cy="12" r="8.5" {...p} /><circle cx="12" cy="12" r="3.5" {...p} /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>,
    users: <><circle cx="9" cy="8" r="3.2" {...p} /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" {...p} /><path d="M16 5.3a3.2 3.2 0 0 1 0 5.9M17 14.4a5.5 5.5 0 0 1 3.5 5.1" {...p} /></>,
    case: <><rect x="3" y="7.5" width="18" height="12" rx="2" {...p} /><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" {...p} /><path d="M3 12.5h18" {...p} /></>,
    check: <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" {...p} /><path d="m8.5 12 2.5 2.5 4.5-5" {...p} /></>,
    chat: <><path d="M20.5 12c0 4-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.35L5 20l.7-3.2A6.7 6.7 0 0 1 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z" {...p} /><path d="M9 10.5h6M9 13.5h3.5" {...p} /></>,
    globe: <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M3.5 12h17" {...p} /><path d="M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5S14.4 17.9 12 20.5c-2.4-2.6-3.6-5.5-3.6-8.5S9.6 6.1 12 3.5Z" {...p} /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...p} /><circle cx="16" cy="7" r="2" {...p} /><circle cx="10" cy="17" r="2" {...p} /></>,
    exit: <><path d="M14 4.5h3.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H14" {...p} /><path d="M10 8.5 6 12l4 3.5M6 12h9" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      {paths[name] || paths.grid}
    </svg>
  );
}
