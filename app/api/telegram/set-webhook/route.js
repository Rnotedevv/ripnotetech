import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';
import { setTelegramWebhook } from '@/lib/telegram';
import { env } from '@/lib/config';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  try {
    await setTelegramWebhook(`${env.appUrl}/api/telegram/webhook`);
    return redirectWithMessage(request, '/dashboard', 'ok', 'Telegram webhook berhasil di-set.');
  } catch (error) {
    return redirectWithMessage(request, '/dashboard', 'error', error.message);
  }
}
