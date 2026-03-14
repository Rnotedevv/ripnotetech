import { saveSettings } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const redirectTo = String(formData.get('redirectTo') || '/dashboard');

    await saveSettings({
      shop_name: String(formData.get('shop_name') || ''),
      welcome_text: String(formData.get('welcome_text') || ''),
      support_text: String(formData.get('support_text') || ''),
      menu_buy_label: String(formData.get('menu_buy_label') || ''),
      menu_deposit_label: String(formData.get('menu_deposit_label') || ''),
      menu_products_label: String(formData.get('menu_products_label') || ''),
      menu_stock_label: String(formData.get('menu_stock_label') || ''),
      menu_warranty_label: String(formData.get('menu_warranty_label') || ''),
      menu_balance_label: String(formData.get('menu_balance_label') || ''),
      min_deposit: Number(String(formData.get('min_deposit') || '0').replace(/[^0-9]/g, '')) || 0
    });

    return redirectWithMessage(request, redirectTo, 'ok', 'Setting berhasil disimpan.');
  } catch (error) {
    return redirectWithMessage(request, '/dashboard', 'error', error.message);
  }
}
