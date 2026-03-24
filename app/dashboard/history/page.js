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
        description="Cari email yang sudah terjual dan lihat siapa pembelinya."
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
            <div className="text-sm text-slate-400">Email tidak ditemukan atau belum pernah terjual.</div>
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              <div><span className="text-slate-400">Email:</span> {result.content}</div>
              <div><span className="text-slate-400">Sold at:</span> {result.sold_at ? formatDateTime(result.sold_at) : '-'}</div>
              <div><span className="text-slate-400">Order Code:</span> {result.order_items?.orders?.order_code || '-'}</div>
              <div><span className="text-slate-400">Buyer Username:</span> {result.order_items?.orders?.users?.username ? `@${result.order_items.orders.users.username}` : '-'}</div>
              <div><span className="text-slate-400">Buyer Name:</span> {result.order_items?.orders?.users?.full_name || '-'}</div>
              <div><span className="text-slate-400">Telegram ID:</span> {result.order_items?.orders?.users?.tg_user_id || '-'}</div>
              <div><span className="text-slate-400">Order Date:</span> {result.order_items?.orders?.created_at ? formatDateTime(result.order_items.orders.created_at) : '-'}</div>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}