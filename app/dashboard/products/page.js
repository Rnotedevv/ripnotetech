import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { getProductsForDashboard } from '@/lib/db';
import { formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const products = await getProductsForDashboard();

  const editingId = params.edit ? Number(params.edit) : null;
  const editingProduct =
    editingId && Number.isFinite(editingId)
      ? products.find((item) => Number(item.id) === editingId) || null
      : null;

  return (
    <div className="space-y-6">
      <FlashBanner
        type={params.error ? 'error' : 'success'}
        message={params.error || params.ok}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card
          title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
          description={
            editingProduct
              ? 'Perbarui detail produk yang sudah ada.'
              : 'Buat produk baru yang nanti akan muncul di menu List Product dan Beli Qty.'
          }
        >
          <form action="/api/products" method="POST" className="space-y-4">
            <input
              type="hidden"
              name="action"
              value={editingProduct ? 'update-product' : 'create-product'}
            />
            <input
              type="hidden"
              name="redirectTo"
              value="/dashboard/products"
            />
            {editingProduct ? (
              <input type="hidden" name="product_id" value={editingProduct.id} />
            ) : null}

            <div>
              <label htmlFor="product_code">Kode Produk</label>
              <input
                id="product_code"
                name="product_code"
                placeholder="mail-domain"
                className="mt-2"
                defaultValue={editingProduct?.product_code || ''}
                required
              />
            </div>

            <div>
              <label htmlFor="name">Nama Produk</label>
              <input
                id="name"
                name="name"
                placeholder="Email Domain Pribadi"
                className="mt-2"
                defaultValue={editingProduct?.name || ''}
                required
              />
            </div>

            <div>
              <label htmlFor="description">Deskripsi</label>
              <textarea
                id="description"
                name="description"
                placeholder="Isi singkat produk"
                className="mt-2 min-h-24"
                defaultValue={editingProduct?.description || ''}
              />
            </div>

            <div>
              <label htmlFor="delivery_note">Note Delivery</label>
              <textarea
                id="delivery_note"
                name="delivery_note"
                placeholder="Contoh: Password panel, akses domain, catatan penting lain."
                className="mt-2 min-h-32"
                defaultValue={editingProduct?.delivery_note || ''}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="primary-btn w-full">
                {editingProduct ? 'Update Produk' : 'Tambah Produk'}
              </button>

              {editingProduct ? (
                <a href="/dashboard/products" className="secondary-btn w-full text-center">
                  Batal Edit
                </a>
              ) : null}
            </div>
          </form>
        </Card>

        <Card
          title="Set Harga Per Qty"
          description="Gunakan tier harga agar harga menyesuaikan jumlah qty pembelian."
        >
          <form action="/api/products" method="POST" className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="action" value="create-tier" />
            <input type="hidden" name="redirectTo" value="/dashboard/products" />

            <div className="md:col-span-2">
              <label htmlFor="product_id">Pilih Produk</label>
              <select id="product_id" name="product_id" className="mt-2" required>
                <option value="">Pilih produk</option>
                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                    selected={editingProduct?.id === product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="min_qty">Min Qty</label>
              <input
                id="min_qty"
                name="min_qty"
                type="number"
                min="1"
                className="mt-2"
                required
              />
            </div>

            <div>
              <label htmlFor="max_qty">Max Qty</label>
              <input
                id="max_qty"
                name="max_qty"
                type="number"
                min="1"
                className="mt-2"
                placeholder="Kosongkan untuk tanpa batas"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="unit_price">Harga per Qty</label>
              <input
                id="unit_price"
                name="unit_price"
                className="mt-2"
                placeholder="5000"
                required
              />
            </div>

            <button type="submit" className="primary-btn md:col-span-2">
              Tambah Tier Harga
            </button>
          </form>
        </Card>
      </div>

      <Card
        title="Daftar Produk"
        description="Toggle aktif/nonaktif, edit, hapus, lihat stok, dan review tier harga setiap produk."
      >
        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-3xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">
                      {product.name}
                    </h3>
                    <span className="badge">{product.product_code}</span>
                    <span className="badge">stok {product.available_stock}</span>
                    <span className="badge">
                      {product.is_active ? 'aktif' : 'nonaktif'}
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    {product.description || 'Tanpa deskripsi.'}
                  </p>

                  {product.delivery_note ? (
                    <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      {product.delivery_note}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:min-w-44">
                  <a
                    href={`/dashboard/products?edit=${product.id}`}
                    className="secondary-btn text-center"
                  >
                    Edit
                  </a>

                  <form action="/api/products" method="POST">
                    <input type="hidden" name="action" value="delete-product" />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value="/dashboard/products"
                    />
                    <input type="hidden" name="product_id" value={product.id} />
                    <button
                      type="submit"
                      className="danger-btn w-full"
                      onClick={(event) => {
                        const ok = window.confirm(
                          'Yakin ingin menghapus produk ini? Tier harga dan stok terkait juga akan ikut terhapus.'
                        );
                        if (!ok) event.preventDefault();
                      }}
                    >
                      Hapus
                    </button>
                  </form>

                  <form action="/api/products" method="POST">
                    <input type="hidden" name="action" value="toggle-product" />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value="/dashboard/products"
                    />
                    <input type="hidden" name="product_id" value={product.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={product.is_active ? 'false' : 'true'}
                    />
                    <button
                      type="submit"
                      className={product.is_active ? 'secondary-btn' : 'primary-btn'}
                    >
                      {product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-5 table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Min Qty</th>
                      <th>Max Qty</th>
                      <th>Harga / Qty</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.price_tiers.map((tier) => (
                      <tr key={tier.id}>
                        <td>{tier.min_qty}</td>
                        <td>{tier.max_qty || '∞'}</td>
                        <td>{formatRupiah(tier.unit_price)}</td>
                        <td>
                          <form action="/api/products" method="POST">
                            <input type="hidden" name="action" value="delete-tier" />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value="/dashboard/products"
                            />
                            <input type="hidden" name="tier_id" value={tier.id} />
                            <button type="submit" className="danger-btn">
                              Hapus
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}

                    {!product.price_tiers.length ? (
                      <tr>
                        <td colSpan="4" className="text-slate-400">
                          Belum ada tier harga.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!products.length ? (
            <p className="text-sm text-slate-400">Belum ada produk.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
