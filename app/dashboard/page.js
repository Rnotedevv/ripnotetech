import { Card } from '@/components/card';
import { FlashBanner } from '@/components/flash-banner';
import { StatCard } from '@/components/stat-card';
import {
  getDashboardKpis,
  getProductsForDashboard,
  getSettings,
  listRecentActivities,
  listRecentOrders
} from '@/lib/db';
import { formatDateTime, formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardHomePage({ searchParams }) {
  const params = searchParams || {};

  const [settings, stats, products, orders, activities] = await Promise.all([
    getSettings(),
    getDashboardKpis(),
    getProductsForDashboard(),
    listRecentOrders(8),
    listRecentActivities(12)
  ]);

  return (
    <div className="space-y-6">
      <FlashBanner
        type={params?.error ? 'error' : 'success'}
        message={params?.error || params?.ok}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total User" value={stats.total_users} hint="Semua akun Telegram yang pernah memakai bot" />
        <StatCard label="Total Order" value={stats.total_paid_orders} hint="Order sukses dibayar dari saldo / QRIS" />
        <StatCard label="Revenue" value={formatRupiah(stats.total_revenue)} hint="Total transaksi pembelian produk" />
        <StatCard label="Total Deposit" value={formatRupiah(stats.total_deposit_amount)} hint="Akumulasi deposit yang sudah paid" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Pengaturan Menu Utama" description="Edit tampilan menu utama bot dan teks welcome dari dashboard.">
          <form action="/api/settings" method="POST" className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="redirectTo" value="/dashboard" />

            <div className="md:col-span-2">
              <label htmlFor="shop_name">Nama Toko</label>
              <input id="shop_name" name="shop_name" defaultValue={settings.shop_name} className="mt-2" />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="welcome_text">Welcome Text</label>
              <textarea
                id="welcome_text"
                name="welcome_text"
                defaultValue={settings.welcome_text}
                className="mt-2 min-h-28"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="support_text">Support Text</label>
              <textarea
                id="support_text"
                name="support_text"
                defaultValue={settings.support_text}
                className="mt-2 min-h-24"
              />
            </div>

            <div>
              <label htmlFor="menu_buy_label">Label Buy</label>
              <input id="menu_buy_label" name="menu_buy_label" defaultValue={settings.menu_buy_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="menu_deposit_label">Label Deposit</label>
              <input id="menu_deposit_label" name="menu_deposit_label" defaultValue={settings.menu_deposit_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="menu_products_label">Label List Product</label>
              <input id="menu_products_label" name="menu_products_label" defaultValue={settings.menu_products_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="menu_stock_label">Label Cek Stok</label>
              <input id="menu_stock_label" name="menu_stock_label" defaultValue={settings.menu_stock_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="menu_warranty_label">Label Garansi</label>
              <input id="menu_warranty_label" name="menu_warranty_label" defaultValue={settings.menu_warranty_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="menu_balance_label">Label Saldo</label>
              <input id="menu_balance_label" name="menu_balance_label" defaultValue={settings.menu_balance_label} className="mt-2" />
            </div>

            <div>
              <label htmlFor="min_deposit">Minimal Deposit</label>
              <input id="min_deposit" name="min_deposit" defaultValue={settings.min_deposit} className="mt-2" />
            </div>

            <div className="flex items-end">
              <button type="submit" className="primary-btn w-full">Simpan Setting</button>
            </div>
          </form>
        </Card>

        <Card title="Aksi Cepat" description="Shortcut paling sering dipakai admin.">
          <div className="grid gap-3">
            <form action="/api/telegram/set-webhook" method="POST">
              <button type="submit" className="primary-btn w-full">Set Telegram Webhook</button>
            </form>

            <a href="/dashboard/products" className="secondary-btn">Kelola Produk & Harga</a>
            <a href="/dashboard/inventory" className="secondary-btn">Bulk Upload Stok</a>
            <a href="/dashboard/broadcast" className="secondary-btn">Mode Broadcast</a>
            <a href="/dashboard/deposits" className="secondary-btn">Lihat Deposit Pending</a>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Ringkasan produk aktif</p>
            <div className="mt-3 space-y-2">
              {products.slice(0, 6).map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span>{product.name}</span>
                  <span className="badge">stok {product.available_stock}</span>
                </div>
              ))}
              {!products.length ? <p className="text-slate-400">Belum ada produk.</p> : null}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Order Terbaru">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>User</th>
                  <th>Total</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_code}</td>
                    <td>{order.users?.username ? `@${order.users.username}` : order.users?.full_name || '-'}</td>
                    <td>{formatRupiah(order.total_amount)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
                {!orders.length ? (
                  <tr>
                    <td colSpan="4" className="text-slate-400">Belum ada order.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Aktivitas Terbaru">
          <div className="space-y-3">
            {activities.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{item.message}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.users?.username ? `@${item.users.username}` : item.users?.full_name || 'System'} · {item.activity_type}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                </div>
              </div>
            ))}
            {!activities.length ? <p className="text-sm text-slate-400">Belum ada aktivitas.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
