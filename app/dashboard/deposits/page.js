import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { listDeposits } from '@/lib/db';
import { formatDateTime, formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DepositsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const deposits = await listDeposits(100);

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <Card title="Daftar Deposit" description="Deposit yang status pending bisa kamu tandai paid secara manual selama payment gateway belum live.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>User</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id}>
                  <td>{deposit.reference}</td>
                  <td>{deposit.users?.username ? '@' + deposit.users.username : deposit.users?.full_name || '-'}</td>
                  <td>{formatRupiah(deposit.amount)}</td>
                  <td>{deposit.status}</td>
                  <td>{formatDateTime(deposit.created_at)}</td>
                  <td>
                    {deposit.status === 'pending' ? (
                      <form action="/api/deposits" method="POST">
                        <input type="hidden" name="redirectTo" value="/dashboard/deposits" />
                        <input type="hidden" name="action" value="mark-paid" />
                        <input type="hidden" name="reference" value={deposit.reference} />
                        <button type="submit" className="primary-btn">Mark Paid</button>
                      </form>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!deposits.length ? (
                <tr>
                  <td colSpan="6" className="text-slate-400">Belum ada deposit.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
