import { requireUser } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Shell from '@/components/Shell';
import { SessionProvider } from '@/components/Session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const session = { email: user.email, role: user.role, username: user.username };
  return (
    <SessionProvider value={session}>
      <Shell role={user.role} email={user.email} sidebar={<Sidebar role={user.role} email={user.email} />}>
        {children}
      </Shell>
    </SessionProvider>
  );
}
