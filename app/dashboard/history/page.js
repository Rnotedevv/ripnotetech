import { Card } from '@/components/card';
import { findSoldEmailHistory } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }) {
  const params = (await searchParams) || {};
  const email = String(params.email || '').trim();
  const result = email ? await findSoldEmailHistory(email) : null;

  return (
    <div className="space-y-6">
      <Card
        title="History Email"
        description="Cari email di inventory untuk cek data yang tersimpan."
      >
        <form action="/dashboard/history" method="GET" className="space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="text"
              defaultValue={email}
              placeholder="contoh: email@gmail.com"
              className="mt-2"
            />
          </div>

          <button type="submit" className="primary-btn">Cari</button>
        </form>
      </Card>

      {email ? (
        <Card title="Hasil Pencarian" description={`Hasil untuk ${email}`}>
          {!result ? (
            <div className="text-sm text-slate-400">
              Email tidak ditemukan di inventory.
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
  <div><span className="text-slate-400">Email:</span> {result.content || '-'}</div>
  <div><span className="text-slate-400">Sold at:</span> {result.sold_at ? formatDateTime(result.sold_at) : '-'}</div>
  <div><span className="text-slate-400">Order Code:</span> {result.sold_order_code || '-'}</div>
  <div><span className="text-slate-400">Buyer Username:</span> {result.buyer?.username ? `@${result.buyer.username}` : '-'}</div>
  <div><span className="text-slate-400">Buyer Name:</span> {result.buyer?.full_name || '-'}</div>
  <div><span className="text-slate-400">Telegram ID:</span> {result.buyer?.tg_user_id || '-'}</div>
  <div><span className="text-slate-400">Product ID:</span> {result.product_id || '-'}</div>
</div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
