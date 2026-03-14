import Link from 'next/link';
import { Card } from '@/components/card';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Dashboard RipnoteTech</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
            Dashboard About RipnoteTech.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            RipnoteTech Id.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/login" className="primary-btn">
              Buka Dashboard
            </Link>
            <a href="https://core.telegram.org/bots/api" target="_blank" rel="noreferrer" className="secondary-btn">
              Telegram Bot API
            </a>
          </div>
        </div>

        <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-violet-500/10" title="Control Menu">
          <div className="grid gap-3 text-sm text-slate-200">
            <div className="badge">Menu user</div>
            <div className="badge">Menu admin + dashboard web</div>
            <div className="badge">Bulk upload inventory digital</div>
            <div className="badge">Price</div>
            <div className="badge">Broadcast</div>
            <div className="badge">Log</div>
            <div className="badge">Payment gateway mapping API</div>
          </div>
        </Card>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card title="Welcome">Hi</Card>
      </div>
    </main>
  );
}
