import { Card } from '@/components/card';
import { listUsedFakerEmails } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FakerEmailsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const page = Math.max(1, Number(params.page || 1));
  const result = await listUsedFakerEmails(page, 25);
  const emails = result.items;

  const prevPage = result.page > 1 ? result.page - 1 : null;
  const nextPage = result.page < result.totalPages ? result.page + 1 : null;

  function pageUrl(targetPage) {
    const query = new URLSearchParams();
    query.set('page', String(targetPage));
    return `/dashboard/faker-emails?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Used Faker Emails"
        description="Daftar email faker yang sudah pernah dipakai."
      >
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Source</th>
                <th>License</th>
                <th>Site Host</th>
                <th>Used At</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs text-white">{item.email}</td>
                  <td>{item.source || '-'}</td>
                  <td>{item.license_key || '-'}</td>
                  <td>{item.site_host || '-'}</td>
                  <td>{item.used_at ? formatDateTime(item.used_at) : '-'}</td>
                </tr>
              ))}

              {!emails.length ? (
                <tr>
                  <td colSpan="5" className="text-slate-400">
                    Belum ada data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Halaman {result.page} dari {result.totalPages} • Total {result.total} data
          </div>

          <div className="flex gap-2">
            {prevPage ? (
              <a
                href={pageUrl(prevPage)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                Prev
              </a>
            ) : (
              <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-500">
                Prev
              </span>
            )}

            {nextPage ? (
              <a
                href={pageUrl(nextPage)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                Next
              </a>
            ) : (
              <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-500">
                Next
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
