import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { listLicensesForDashboard } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function statusClass(status) {
  switch (status) {
    case 'activated':
      return 'badge bg-emerald-400/10 text-emerald-200 border border-emerald-400/20';
    case 'expired':
      return 'badge bg-amber-400/10 text-amber-200 border border-amber-400/20';
    case 'revoked':
      return 'badge bg-red-400/10 text-red-200 border border-red-400/20';
    default:
      return 'badge';
  }
}

export default async function LicensesPage({ searchParams }) {
  const params = (await searchParams) || {};
  const licenses = await listLicensesForDashboard(100);

  const counts = licenses.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { total: 0, unused: 0, activated: 0, expired: 0, revoked: 0 }
  );

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-sm text-slate-400">Total License</p>
          <p className="mt-2 text-3xl font-semibold text-white">{counts.total}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-sm text-slate-400">Unused</p>
          <p className="mt-2 text-3xl font-semibold text-white">{counts.unused}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-sm text-slate-400">Activated</p>
          <p className="mt-2 text-3xl font-semibold text-white">{counts.activated}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-sm text-slate-400">Expired</p>
          <p className="mt-2 text-3xl font-semibold text-white">{counts.expired}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-sm text-slate-400">Revoked</p>
          <p className="mt-2 text-3xl font-semibold text-white">{counts.revoked}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card title="Generate License" description="Buat key lisensi baru langsung dari dashboard. Secara default 1 key aktif sekali dan berlaku 1 hari setelah aktivasi.">
          <form action="/api/licenses" method="POST" className="space-y-4">
            <input type="hidden" name="action" value="generate" />
            <input type="hidden" name="redirectTo" value="/dashboard/licenses" />

            <div>
              <label htmlFor="quantity">Jumlah Key</label>
              <input id="quantity" name="quantity" type="number" min="1" max="100" defaultValue="1" className="mt-2" required />
            </div>

            <div>
              <label htmlFor="duration_days">Durasi Aktif (hari)</label>
              <input id="duration_days" name="duration_days" type="number" min="1" max="365" defaultValue="1" className="mt-2" required />
            </div>

            <div>
              <label htmlFor="notes">Catatan</label>
              <textarea id="notes" name="notes" className="mt-2 min-h-24" placeholder="Contoh: client A, promo, trial, dll" />
            </div>

            <button type="submit" className="primary-btn w-full">Generate License</button>
          </form>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Status key</p>
            <ul className="mt-3 space-y-2 text-slate-400">
              <li>unused: belum pernah diaktivasi</li>
              <li>activated: sedang aktif dan belum expired</li>
              <li>expired: masa aktif habis</li>
              <li>revoked: dinonaktifkan manual oleh admin</li>
            </ul>
          </div>
        </Card>

        <Card title="Daftar License" description="Semua key yang dibuat dari dashboard. Data expired akan diperbarui otomatis saat halaman dibuka.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>License Key</th>
                  <th>Status</th>
                  <th>Durasi</th>
                  <th>Dibuat</th>
                  <th>Aktif</th>
                  <th>Expired</th>
                  <th>Device</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-mono text-xs text-white">{item.license_key}</div>
                      {item.notes ? <div className="mt-1 text-xs text-slate-400">{item.notes}</div> : null}
                    </td>
                    <td>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </td>
                    <td>{item.duration_days} hari</td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{item.activated_at ? formatDateTime(item.activated_at) : '-'}</td>
                    <td>{item.expires_at ? formatDateTime(item.expires_at) : '-'}</td>
                    <td>{item.activated_device_id || '-'}</td>
                    <td>
                      {item.status !== 'revoked' ? (
                        <form action="/api/licenses" method="POST">
                          <input type="hidden" name="action" value="revoke" />
                          <input type="hidden" name="redirectTo" value="/dashboard/licenses" />
                          <input type="hidden" name="license_id" value={item.id} />
                          <button type="submit" className="danger-btn">Revoke</button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-500">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!licenses.length ? (
                  <tr>
                    <td colSpan="8" className="text-slate-400">Belum ada license.</td>
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
