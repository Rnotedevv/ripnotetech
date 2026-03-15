import { NextResponse } from 'next/server';
import { deleteProduct, updateProduct } from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json();

    const updated = await updateProduct(id, {
      product_code: body.product_code,
      name: body.name,
      description: body.description,
      delivery_note: body.delivery_note,
      is_active: body.is_active
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('PATCH /api/products/[id] error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const id = Number(params.id);
    const result = await deleteProduct(id);

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal hapus product' },
      { status: 500 }
    );
  }
}
