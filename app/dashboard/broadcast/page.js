import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { listBroadcastJobs } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage({ searchParams }) {
  const params = (await searchParams) || {};
  const jobs = await listBroadcastJobs(20);

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Buat Broadcast" description="Tulis pesan HTML Telegram. Contoh: <b>Promo</b> hari ini.">
          <form action="/api/broadcast/dispatch" method="POST" className="space-y-4">
            <input type="hidden" name="action" value="queue" />
            <input type="hidden" name="redirectTo" value="/dashboard/broadcast" />
            <div>
              <label htmlFor="message">Pesan Broadcast</label>
              <textarea id="message" name="message" className="mt-2 min-h-[280px]" placeholder="<b>Promo Hari Ini</b>\nDiskon 20% untuk semua order." required />
            </div>
            <button type="submit" className="primary-btn w-full">Queue Broadcast</button>
          </form>
        </Card>

        <Card title="Process Broadcast" description="Tekan proses batch untuk kirim ke 200 user berikutnya. Aman untuk dipakai manual di dashboard.">
          <form action="/api/broadcast/dispatch" method="POST" className="mb-5">
            <input type="hidden" name="action" value="run-batch" />
            <input type="hidden" name="redirectTo" value="/dashboard/broadcast" />
            <button type="submit" className="primary-btn">Proses Batch 200 User</button>
          </form>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Terkirim</th>
                  <th>Gagal</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.status}</td>
                    <td>{job.sent_count}</td>
                    <td>{job.failed_count}</td>
                    <td>{formatDateTime(job.created_at)}</td>
                  </tr>
                ))}
                {!jobs.length ? (
                  <tr>
                    <td colSpan="4" className="text-slate-400">Belum ada job broadcast.</td>
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
