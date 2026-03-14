import { createPriceTier, createProduct, deletePriceTier, toggleProduct } from '@/lib/db';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';
import { toSlug } from '@/lib/utils';

export async function POST(request) {
  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const action = String(formData.get('action') || '');
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/products');

  try {
    if (action === 'create-product') {
      await createProduct({
        product_code: toSlug(String(formData.get('product_code') || '')),
        name: String(formData.get('name') || ''),
        description: String(formData.get('description') || ''),
        delivery_note: String(formData.get('delivery_note') || '')
      });
      return redirectWithMessage(request, redirectTo, 'ok', 'Produk berhasil ditambahkan.');
    }

    if (action === 'create-tier') {
      const maxQtyRaw = String(formData.get('max_qty') || '').trim();
      await createPriceTier({
        product_id: String(formData.get('product_id') || ''),
        min_qty: Number(formData.get('min_qty') || 0),
        max_qty: maxQtyRaw ? Number(maxQtyRaw) : null,
        unit_price: Number(String(formData.get('unit_price') || '').replace(/[^0-9]/g, ''))
      });
      return redirectWithMessage(request, redirectTo, 'ok', 'Tier harga berhasil ditambahkan.');
    }

    if (action === 'delete-tier') {
      await deletePriceTier(String(formData.get('tier_id') || ''));
      return redirectWithMessage(request, redirectTo, 'ok', 'Tier harga berhasil dihapus.');
    }

    if (action === 'toggle-product') {
      await toggleProduct(String(formData.get('product_id') || ''), String(formData.get('is_active') || '') === 'true');
      return redirectWithMessage(request, redirectTo, 'ok', 'Status produk berhasil diubah.');
    }

    return redirectWithMessage(request, redirectTo, 'error', 'Aksi produk tidak dikenali.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
