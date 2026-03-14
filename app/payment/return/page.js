export default function PaymentReturnPage({ searchParams }) {
  const reference = searchParams?.reference || '';
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold mb-3">Pembayaran Diproses</h1>
        <p className="text-white/80 leading-7">
          Setelah pembayaran berhasil, saldo akan otomatis masuk lewat webhook Pakasir.
          Kembali ke bot Telegram lalu tekan tombol <b>Cek Status</b> jika saldo belum bertambah.
        </p>
        {reference ? (
          <p className="mt-4 text-sm text-white/70">
            Reference: <span className="font-mono">{reference}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
