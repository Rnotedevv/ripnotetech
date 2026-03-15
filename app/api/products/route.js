import { NextResponse } from 'next/server';
import {
  createPriceTier,
  createProduct,
  deletePriceTier,
  deleteProduct,
  toggleProduct,
  updateProduct
} from '@/lib/db';

function parsePositiveInt(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildRedirectUrl(request, targetPath, message, isError = false) {
  const url = new URL(targetPath || '/dashboard/products', request.url);
  if (isError) {
    url.searchParams.set('error', message);
  } else {
    url.searchParams.set('ok', message);
  }
  return url;
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
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTarget, 'Action tidak ditemukan.', true)
      );
    }

    if (action === 'create-product') {
      const product_code = String(formData.get('product_code') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const delivery_note = String(formData.get('delivery_note') || '').trim();

      if (!product_code || !name) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Kode produk dan nama produk wajib diisi.', true)
        );
      }

      await createProduct({
        product_code,
        name,
        description: description || null,
        delivery_note: delivery_note || null,
        is_active: true
      });

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Produk berhasil ditambahkan.')
      );
    }

    if (action === 'update-product') {
      const productId = parsePositiveInt(formData.get('product_id'));
      const product_code = String(formData.get('product_code') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const delivery_note = String(formData.get('delivery_note') || '').trim();

      if (!productId) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Product ID tidak valid.', true)
        );
      }

      if (!product_code || !name) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Kode produk dan nama produk wajib diisi.', true)
        );
      }

      await updateProduct(productId, {
        product_code,
        name,
        description: description || null,
        delivery_note: delivery_note || null
      });

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Produk berhasil diperbarui.')
      );
    }

    if (action === 'delete-product') {
      const productId = parsePositiveInt(formData.get('product_id'));

      if (!productId) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Product ID tidak valid.', true)
        );
      }

      await deleteProduct(productId);

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Produk berhasil dihapus.')
      );
    }

    if (action === 'toggle-product') {
      const productId = parsePositiveInt(formData.get('product_id'));
      const isActiveRaw = String(formData.get('is_active') || '').trim();
      const is_active = isActiveRaw === 'true';

      if (!productId) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Product ID tidak valid.', true)
        );
      }

      await toggleProduct(productId, is_active);

      return NextResponse.redirect(
        buildRedirectUrl(
          request,
          '/dashboard/products',
          is_active ? 'Produk berhasil diaktifkan.' : 'Produk berhasil dinonaktifkan.'
        )
      );
    }

    if (action === 'create-tier') {
      const product_id = parsePositiveInt(formData.get('product_id'));
      const min_qty = parsePositiveInt(formData.get('min_qty'));
      const maxQtyRaw = String(formData.get('max_qty') || '').trim();
      const unit_price = parseInt(
        String(formData.get('unit_price') || '').replace(/[^0-9]/g, ''),
        10
      );
      const max_qty = maxQtyRaw ? parsePositiveInt(maxQtyRaw) : null;

      if (!product_id || !min_qty || !Number.isFinite(unit_price) || unit_price <= 0) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Data tier harga tidak valid.', true)
        );
      }

      await createPriceTier({
        product_id,
        min_qty,
        max_qty,
        unit_price
      });

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Tier harga berhasil ditambahkan.')
      );
    }

    if (action === 'delete-tier') {
      const tierId = parsePositiveInt(formData.get('tier_id'));

      if (!tierId) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Tier ID tidak valid.', true)
        );
      }

      await deletePriceTier(tierId);

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Tier harga berhasil dihapus.')
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTarget, `Action tidak dikenali: ${action}`, true)
    );
  } catch (error) {
    console.error('POST /api/products error:', error);

    return NextResponse.redirect(
      buildRedirectUrl(
        request,
        '/dashboard/products',
        error.message || 'Terjadi error pada products API.',
        true
      )
    );
  }
}
