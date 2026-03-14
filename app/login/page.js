export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  const params = (await searchParams) || {};
  const error = params.error;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Admin Login</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Masuk ke Dashboard</h1>
        <p className="mt-3 text-sm text-slate-400">Gunakan email dan password admin yang kamu isi di file environment.</p>

        {error ? <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <form action="/api/auth/login" method="POST" className="mt-8 space-y-4">
          <div>
            <label htmlFor="email">Email Admin</label>
            <input id="email" name="email" type="email" placeholder="admin@example.com" required className="mt-2" />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="••••••••" required className="mt-2" />
          </div>
          <button type="submit" className="primary-btn w-full">
            Masuk
          </button>
        </form>
      </div>
    </main>
  );
}
