import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { listUsedFakerEmails } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FakerEmailsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const rows = await listUsedFakerEmails(200);

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card title="Reserve Faker Email" description="Simpan email yang sudah dipakai agar tidak double. Form ini opsional untuk input manual dari dashboard.">
          <form action="/api/faker-emails" method="POST" className="space-y-4">
            <input type="hidden" name="redirectTo" value="/dashboard/faker-emails" />
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="faker123@example.com" className="mt-2" required />
            </div>
            <div>
              <label htmlFor="source">Source</label>
              <input id="source" name="source" placeholder="extension" className="mt-2" defaultValue="dashboard" />
            </div>
            <div>
              <label htmlFor="licenseKey">License Key</label>
              <input id="licenseKey" name="licenseKey" placeholder="opsional" className="mt-2" />
            </div>
            <div>
              <label htmlFor="siteHost">Site Host</label>
              <input id="siteHost" name="siteHost" placeholder="linkedin.com" className="mt-2" />
            </div>
            <div>
              <label htmlFor="notes">Catatan</label>
              <textarea id="notes" name="notes" className="mt-2 min-h-24" placeholder="opsional" />
            </div>
            <button type="submit" className="primary-btn w-full">Simpan Email</button>
          </form>
        </Card>

        <Card title="Riwayat Email Terpakai" description="Email disimpan lowercase dan unik. Kalau email yang sama dikirim lagi, backend akan menolak.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source</th>
                  <th>License</th>
                  <th>Host</th>
                  <th>Dipakai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>
                        <p className="text-white">{row.email}</p>
                        <p className="text-xs text-slate-400">{row.notes || '-'}</p>
                      </div>
                    </td>
                    <td>{row.source || '-'}</td>
                    <td>{row.license_key || '-'}</td>
                    <td>{row.site_host || '-'}</td>
                    <td>{formatDateTime(row.used_at)}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan="5" className="text-slate-400">Belum ada email faker yang disimpan.</td>
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
