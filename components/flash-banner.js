export function FlashBanner({ type = 'success', message }) {
  if (!message) return null;

  const tone =
    type === 'error'
      ? 'border-rose-400/40 bg-rose-400/10 text-rose-100'
      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>{message}</div>;
}
