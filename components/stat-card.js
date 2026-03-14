export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 to-white/3 p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-400">{hint}</p> : null}
    </div>
  );
}
