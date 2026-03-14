import { bulkInsertInventory } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/inventory');

  try {
    const productId = String(formData.get('product_id') || '');
    const items = String(formData.get('items') || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const count = await bulkInsertInventory(productId, items);
    return redirectWithMessage(request, redirectTo, 'ok', `${count} item stok berhasil diupload.`);
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
