import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { requireDashboardSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
  const session = await requireDashboardSession();

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Dashboard Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Auto Store Control Center</h1>
          <p className="mt-2 text-sm text-slate-400">Login sebagai {session.email}. Semua action dashboard berjalan di server dan langsung tersimpan ke Supabase.</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="secondary-btn">Logout</button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <DashboardSidebar />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
