import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { getProductsForDashboard } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }) {
  const params = (await searchParams) || {};
  const products = await getProductsForDashboard();

  return (
    <div className="space-y-6">
      <FlashBanner type={params.error ? 'error' : 'success'} message={params.error || params.ok} />

      <Card title="Bulk Upload Inventory" description="Paste item satu per baris. Cocok untuk email, akun, lisensi, atau data digital lain.">
        <form action="/api/inventory" method="POST" className="space-y-4">
          <input type="hidden" name="redirectTo" value="/dashboard/inventory" />
          <div>
            <label htmlFor="product_id">Produk</label>
            <select id="product_id" name="product_id" className="mt-2" required>
              <option value="">Pilih produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="items">Data Stok</label>
            <textarea
              id="items"
              name="items"
              className="mt-2 min-h-[300px]"
              placeholder={['email1@domain.com', 'email2@domain.com', 'email3@domain.com'].join('\n')}
              required
            />
          </div>
          <button type="submit" className="primary-btn">Upload Inventory</button>
        </form>
      </Card>

      <Card title="Ringkasan Stok Produk">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{product.product_code}</p>
                </div>
                <span className="badge">stok {product.available_stock}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
