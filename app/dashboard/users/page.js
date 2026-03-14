import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { listUsers } from '@/lib/db';
import { formatDateTime, formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }) {
  const params = (await searchParams) || {};
  const users = await listUsers(100);

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card title="Adjust Saldo User" description="Bisa dipakai selain command /addsaldo dan /hapussaldo di bot.">
          <form action="/api/users" method="POST" className="space-y-4">
            <input type="hidden" name="redirectTo" value="/dashboard/users" />
            <div>
              <label htmlFor="username">Username Telegram</label>
              <input id="username" name="username" placeholder="@username" className="mt-2" required />
            </div>
            <div>
              <label htmlFor="amount">Nominal</label>
              <input id="amount" name="amount" placeholder="50000" className="mt-2" required />
            </div>
            <div>
              <label htmlFor="mode">Mode</label>
              <select id="mode" name="mode" className="mt-2">
                <option value="add">Tambah Saldo</option>
                <option value="sub">Kurangi Saldo</option>
              </select>
            </div>
            <div>
              <label htmlFor="reason">Keterangan</label>
              <textarea id="reason" name="reason" className="mt-2 min-h-24" placeholder="Contoh: bonus, kompensasi, koreksi saldo" />
            </div>
            <button type="submit" className="primary-btn w-full">Proses Saldo</button>
          </form>
        </Card>

        <Card title="Daftar User Terbaru">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>ID Telegram</th>
                  <th>Saldo</th>
                  <th>Total Belanja</th>
                  <th>Bergabung</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <p className="text-white">{user.full_name || '-'}</p>
                        <p className="text-xs text-slate-400">{user.username ? '@' + user.username : '-'}</p>
                      </div>
                    </td>
                    <td>{user.tg_user_id}</td>
                    <td>{formatRupiah(user.balance)}</td>
                    <td>{formatRupiah(user.total_spent)}</td>
                    <td>{formatDateTime(user.created_at)}</td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td colSpan="5" className="text-slate-400">Belum ada user.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
