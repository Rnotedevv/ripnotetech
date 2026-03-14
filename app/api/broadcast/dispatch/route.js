import { queueBroadcastJob } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';
import { processNextBroadcastBatch } from '@/lib/broadcast';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const action = String(formData.get('action') || '');
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/broadcast');

  try {
    if (action === 'queue') {
      const message = String(formData.get('message') || '').trim();
      if (!message) throw new Error('Pesan broadcast kosong.');
      await queueBroadcastJob(message, 'HTML');
      return redirectWithMessage(request, redirectTo, 'ok', 'Broadcast berhasil dimasukkan ke queue.');
    }

    if (action === 'run-batch') {
      const result = await processNextBroadcastBatch(200);
      return redirectWithMessage(request, redirectTo, 'ok', `${result.message} Sent: ${result.sent}, Failed: ${result.failed}`);
    }

    return redirectWithMessage(request, redirectTo, 'error', 'Aksi broadcast tidak dikenali.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
