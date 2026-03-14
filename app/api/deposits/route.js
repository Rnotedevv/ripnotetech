import { confirmDeposit, getDepositByReference } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';
import { notifyAdminGroup, sendMessage } from '@/lib/telegram';
import { escapeHtml, formatRupiah } from '@/lib/utils';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/deposits');
  const action = String(formData.get('action') || '');

  try {
    if (action === 'mark-paid') {
      const reference = String(formData.get('reference') || '');
      const deposit = await getDepositByReference(reference);
      if (!deposit) throw new Error('Deposit tidak ditemukan.');

      const result = await confirmDeposit(reference, deposit.provider_ref || `MANUAL-${reference}`, deposit.amount, {
        manual: true,
        actor: 'dashboard'
      });

      if (result.tg_user_id) {
        await sendMessage(
          result.tg_user_id,
          [
            '<b>Deposit berhasil</b> ✅',
            `Ref: <code>${escapeHtml(result.reference)}</code>`,
            `Nominal masuk: <b>${formatRupiah(result.amount)}</b>`
          ].join('\n'),
          { parse_mode: 'HTML' }
        ).catch(() => null);
      }

      await notifyAdminGroup(
        [
          '✅ <b>Deposit dikonfirmasi manual</b>',
          `Ref: <code>${escapeHtml(result.reference)}</code>`,
          `Nominal: <b>${formatRupiah(result.amount)}</b>`
        ].join('\n')
      );

      return redirectWithMessage(request, redirectTo, 'ok', 'Deposit berhasil ditandai paid.');
    }

    return redirectWithMessage(request, redirectTo, 'error', 'Aksi deposit tidak dikenal.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
