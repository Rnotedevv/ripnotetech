import { NextResponse } from 'next/server';
import {
  createPriceTier,
  createProduct,
  deletePriceTier,
  deleteProduct,
  toggleProduct,
  updateProduct
} from '@/lib/db';

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
      const productId = Number(formData.get('product_id'));
      const product_code = String(formData.get('product_code') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const delivery_note = String(formData.get('delivery_note') || '').trim();

      if (!Number.isFinite(productId) || productId <= 0) {
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
      const productId = Number(formData.get('product_id'));

      if (!Number.isFinite(productId) || productId <= 0) {
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
      const productId = Number(formData.get('product_id'));
      const isActiveRaw = String(formData.get('is_active') || '').trim();
      const is_active = isActiveRaw === 'true';

      if (!Number.isFinite(productId) || productId <= 0) {
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
      const product_id = Number(formData.get('product_id'));
      const min_qty = Number(formData.get('min_qty'));
      const maxQtyRaw = String(formData.get('max_qty') || '').trim();
      const unit_price = Number(String(formData.get('unit_price') || '').replace(/[^0-9]/g, ''));
      const max_qty = maxQtyRaw ? Number(maxQtyRaw) : null;

      if (
        !Number.isFinite(product_id) ||
        product_id <= 0 ||
        !Number.isFinite(min_qty) ||
        min_qty <= 0 ||
        !Number.isFinite(unit_price) ||
        unit_price <= 0
      ) {
        return NextResponse.redirect(
          buildRedirectUrl(request, redirectTarget, 'Data tier harga tidak valid.', true)
        );
      }

      await createPriceTier({
        product_id,
        min_qty,
        max_qty: Number.isFinite(max_qty) ? max_qty : null,
        unit_price
      });

      return NextResponse.redirect(
        buildRedirectUrl(request, '/dashboard/products', 'Tier harga berhasil ditambahkan.')
      );
    }

    if (action === 'delete-tier') {
      const tierId = Number(formData.get('tier_id'));

      if (!Number.isFinite(tierId) || tierId <= 0) {
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
