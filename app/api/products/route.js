import { NextResponse } from 'next/server';
import {
  createPriceTier,
  createProduct,
  deletePriceTier,
  deleteProduct,
  saveSettings,
  toggleProduct,
  updateProduct
} from '@/lib/db';

function redirectTo(url, message, isError = false) {
  const nextUrl = new URL(url, 'http://localhost');
  if (isError) {
    nextUrl.searchParams.set('error', message);
  } else {
    nextUrl.searchParams.set('ok', message);
  }
  return NextResponse.redirect(nextUrl.pathname + nextUrl.search);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Products API endpoint is active. Use POST for form actions.'
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const action = String(formData.get('action') || '').trim();
    const redirectTarget = String(formData.get('redirectTo') || '/dashboard/products');

    if (!action) {
      return redirectTo(redirectTarget, 'Action tidak ditemukan.', true);
    }

    if (action === 'create-product') {
      const product_code = String(formData.get('product_code') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const delivery_note = String(formData.get('delivery_note') || '').trim();

      if (!product_code || !name) {
        return redirectTo(redirectTarget, 'Kode produk dan nama produk wajib diisi.', true);
      }

      await createProduct({
        product_code,
        name,
        description: description || null,
        delivery_note: delivery_note || null,
        is_active: true
      });

      return redirectTo(redirectTarget, 'Produk berhasil ditambahkan.');
    }

    if (action === 'update-product') {
      const productId = Number(formData.get('product_id'));
      const product_code = String(formData.get('product_code') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const delivery_note = String(formData.get('delivery_note') || '').trim();

      if (!Number.isFinite(productId)) {
        return redirectTo(redirectTarget, 'Product ID tidak valid.', true);
      }

      if (!product_code || !name) {
        return redirectTo(redirectTarget, 'Kode produk dan nama produk wajib diisi.', true);
      }

      await updateProduct(productId, {
        product_code,
        name,
        description: description || null,
        delivery_note: delivery_note || null
      });

      return redirectTo('/dashboard/products', 'Produk berhasil diperbarui.');
    }

    if (action === 'delete-product') {
      const productId = Number(formData.get('product_id'));

      if (!Number.isFinite(productId)) {
        return redirectTo(redirectTarget, 'Product ID tidak valid.', true);
      }

      await deleteProduct(productId);
      return redirectTo('/dashboard/products', 'Produk berhasil dihapus.');
    }

    if (action === 'toggle-product') {
      const productId = Number(formData.get('product_id'));
      const isActiveRaw = String(formData.get('is_active') || '').trim();
      const is_active = isActiveRaw === 'true';

      if (!Number.isFinite(productId)) {
        return redirectTo(redirectTarget, 'Product ID tidak valid.', true);
      }

      await toggleProduct(productId, is_active);
      return redirectTo(
        '/dashboard/products',
        is_active ? 'Produk berhasil diaktifkan.' : 'Produk berhasil dinonaktifkan.'
      );
    }

    if (action === 'create-tier') {
      const product_id = Number(formData.get('product_id'));
      const min_qty = Number(formData.get('min_qty'));
      const maxQtyRaw = String(formData.get('max_qty') || '').trim();
      const unit_price = Number(String(formData.get('unit_price') || '').replace(/[^0-9]/g, ''));
      const max_qty = maxQtyRaw ? Number(maxQtyRaw) : null;

      if (!Number.isFinite(product_id) || !Number.isFinite(min_qty) || !Number.isFinite(unit_price)) {
        return redirectTo(redirectTarget, 'Data tier harga tidak valid.', true);
      }

      await createPriceTier({
        product_id,
        min_qty,
        max_qty: Number.isFinite(max_qty) ? max_qty : null,
        unit_price
      });

      return redirectTo('/dashboard/products', 'Tier harga berhasil ditambahkan.');
    }

    if (action === 'delete-tier') {
      const tierId = Number(formData.get('tier_id'));

      if (!Number.isFinite(tierId)) {
        return redirectTo(redirectTarget, 'Tier ID tidak valid.', true);
      }

      await deletePriceTier(tierId);
      return redirectTo('/dashboard/products', 'Tier harga berhasil dihapus.');
    }

    if (action === 'save-settings') {
      const payload = {
        shop_name: String(formData.get('shop_name') || '').trim(),
        welcome_text: String(formData.get('welcome_text') || '').trim(),
        support_text: String(formData.get('support_text') || '').trim(),
        menu_buy_label: String(formData.get('menu_buy_label') || '').trim(),
        menu_deposit_label: String(formData.get('menu_deposit_label') || '').trim(),
        menu_stock_label: String(formData.get('menu_stock_label') || '').trim(),
        menu_products_label: String(formData.get('menu_products_label') || '').trim(),
        menu_warranty_label: String(formData.get('menu_warranty_label') || '').trim(),
        menu_balance_label: String(formData.get('menu_balance_label') || '').trim(),
        min_deposit: Number(formData.get('min_deposit') || 10000)
      };

      await saveSettings(payload);
      return redirectTo('/dashboard', 'Setting berhasil disimpan.');
    }

    return redirectTo(redirectTarget, `Action tidak dikenali: ${action}`, true);
  } catch (error) {
    console.error('POST /api/products error:', error);
    const fallbackUrl = '/dashboard/products';
    return redirectTo(fallbackUrl, error.message || 'Terjadi error pada products API.', true);
  }
}
