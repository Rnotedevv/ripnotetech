import { createLicensesForDashboard, revokeLicenseById } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const action = String(formData.get('action') || '');
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/licenses');

  try {
    if (action === 'generate') {
      const quantity = Math.min(100, Math.max(1, Number(formData.get('quantity') || 1)));
      const durationDays = Math.min(365, Math.max(1, Number(formData.get('duration_days') || 1)));
      const notes = String(formData.get('notes') || '').trim();

      const created = await createLicensesForDashboard({
        quantity,
        durationDays,
        notes
      });

      const copied = created
        .map((item) => item.license_key)
        .filter(Boolean)
        .join(',');

      const url = new URL(redirectTo, request.url);
      url.searchParams.set('ok', `${created.length} license berhasil dibuat.`);
      if (copied) {
        url.searchParams.set('copied', copied);
      }

      return Response.redirect(url, 303);
    }

    if (action === 'revoke') {
      const licenseId = String(formData.get('license_id') || '');
      if (!licenseId) throw new Error('License tidak ditemukan.');

      await revokeLicenseById(licenseId);
      return redirectWithMessage(request, redirectTo, 'ok', 'License berhasil direvoke.');
    }

    throw new Error('Action license tidak valid.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message || 'Gagal memproses license.');
  }
}
