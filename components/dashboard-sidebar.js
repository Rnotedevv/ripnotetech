'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/products', label: 'Produk & Harga' },
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/users', label: 'Users & Saldo' },
  { href: '/dashboard/deposits', label: 'Deposits' },
  { href: '/dashboard/broadcast', label: 'Broadcast' },
  { href: '/dashboard/licenses', label: 'Licenses' },
  { href: '/dashboard/faker-emails', label: 'Used Faker Emails' }
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Auto Store</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Admin Dashboard</h2>
        <p className="mt-2 text-sm text-slate-400">Kelola bot, produk, stok, deposit, broadcast, lisensi, dan faker email dari satu tempat.</p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-2xl border px-4 py-3 text-sm transition',
                active
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-white shadow-glow'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
