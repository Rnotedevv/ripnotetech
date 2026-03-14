import { adjustBalanceByUsername } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/users');

  try {
    const username = String(formData.get('username') || '');
    const mode = String(formData.get('mode') || 'add');
    const rawAmount = Number(String(formData.get('amount') || '').replace(/[^0-9]/g, ''));
    const delta = mode === 'sub' ? rawAmount * -1 : rawAmount;
    const reason = String(formData.get('reason') || '') || `Dashboard ${mode === 'sub' ? 'hapus saldo' : 'add saldo'}`;

    await adjustBalanceByUsername(username, delta, reason, null);
    return redirectWithMessage(request, redirectTo, 'ok', 'Saldo user berhasil diperbarui.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
