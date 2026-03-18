import { getAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/config';

function db() {
  return getAdminClient();
}

export async function getSettings() {
  const { data, error } = await db().from('app_settings').select('*').eq('singleton', true).maybeSingle();
  if (error) throw error;
  return (
    data || {
      shop_name: 'Auto Store Telegram',
      welcome_text:
        'Selamat datang di Auto Store. Pilih menu di bawah untuk mulai beli produk, cek stok, atau top up saldo.',
      support_text: 'Butuh bantuan? Hubungi admin.',
      currency: env.defaultCurrency,
      min_deposit: env.defaultMinDeposit,
      menu_buy_label: '🛒 Beli Qty',
      menu_deposit_label: '💳 Deposit',
      menu_stock_label: '📦 Cek Stok',
      menu_products_label: '📋 List Produk',
      menu_warranty_label: '🛡 Garansi',
      menu_balance_label: '👤 Saldo Saya'
    }
  );
}

export async function saveSettings(payload) {
  const { error } = await db().from('app_settings').upsert({ singleton: true, ...payload });
  if (error) throw error;
}

export async function ensureTelegramUser(from) {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim() || from.username || 'Telegram User';
  const payload = {
    tg_user_id: Number(from.id),
    username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    full_name: fullName
  };

  const { data, error } = await db()
    .from('users')
    .upsert(payload, { onConflict: 'tg_user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getUserByTelegramId(tgUserId) {
  const { data, error } = await db().from('users').select('*').eq('tg_user_id', Number(tgUserId)).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserState(userId) {
  const { data, error } = await db()
    .from('user_states')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await clearUserState(userId);
    return null;
  }

  return data;
}

export async function setUserState(userId, stateKey, payload = {}, ttlMinutes = 15) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { error } = await db().from('user_states').upsert({
    user_id: userId,
    state_key: stateKey,
    payload,
    expires_at: expiresAt
  });
  if (error) throw error;
}

export async function clearUserState(userId) {
  const { error } = await db().from('user_states').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function logActivity({ userId = null, type, message, payload = {} }) {
  const { error } = await db().from('activity_logs').insert({
    user_id: userId,
    activity_type: type,
    message,
    payload
  });
  if (error) throw error;
}

export async function getActiveProductsWithStock() {
  const { data, error } = await db()
    .from('product_stock_summary')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getProductById(productId) {
  const { data, error } = await db().from('products').select('*').eq('id', productId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProductPriceTiers(productId) {
  const { data, error } = await db()
    .from('product_price_tiers')
    .select('*')
    .eq('product_id', productId)
    .order('min_qty', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getProductsForDashboard() {
  const [productsRes, tiersRes, stockRes] = await Promise.all([
    db().from('products').select('*').order('created_at', { ascending: true }),
    db().from('product_price_tiers').select('*').order('min_qty', { ascending: true }),
    db().from('product_stock_summary').select('id, available_stock')
  ]);

  if (productsRes.error) throw productsRes.error;
  if (tiersRes.error) throw tiersRes.error;
  if (stockRes.error) throw stockRes.error;

  const tierMap = new Map();
  for (const tier of tiersRes.data || []) {
    const current = tierMap.get(tier.product_id) || [];
    current.push(tier);
    tierMap.set(tier.product_id, current);
  }

  const stockMap = new Map((stockRes.data || []).map((item) => [item.id, item.available_stock]));

  return (productsRes.data || []).map((product) => ({
    ...product,
    available_stock: stockMap.get(product.id) || 0,
    price_tiers: tierMap.get(product.id) || []
  }));
}

export async function createProduct(payload) {
  const { data, error } = await db().from('products').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function toggleProduct(productId, isActive) {
  const { error } = await db().from('products').update({ is_active: isActive }).eq('id', productId);
  if (error) throw error;
}

export async function createPriceTier(payload) {
  const { data, error } = await db().from('product_price_tiers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function deletePriceTier(tierId) {
  const { error } = await db().from('product_price_tiers').delete().eq('id', tierId);
  if (error) throw error;
}

export async function bulkInsertInventory(productId, lines) {
  const cleanLines = lines.map((line) => String(line).trim()).filter(Boolean);
  if (!cleanLines.length) {
    throw new Error('Data stok kosong.');
  }

  const rows = cleanLines.map((content) => ({
    product_id: productId,
    content
  }));

  const { error } = await db().from('inventory_items').insert(rows);
  if (error) throw error;
  return cleanLines.length;
}

export async function createDeposit(payload) {
  const { data, error } = await db().from('deposits').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function getDepositByReference(reference) {
  const { data, error } = await db().from('deposits').select('*, users(username, tg_user_id, full_name)').eq('reference', reference).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listDeposits(limit = 50) {
  const { data, error } = await db()
    .from('deposits')
    .select('*, users(username, tg_user_id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function updateDepositByReference(reference, payload) {
  const { error } = await db().from('deposits').update(payload).eq('reference', reference);
  if (error) throw error;
}

export async function confirmDeposit(reference, providerReference, amount, raw = {}) {
  const { data, error } = await db().rpc('confirm_deposit', {
    p_reference: reference,
    p_provider_ref: providerReference,
    p_amount: amount,
    p_raw: raw
  });
  if (error) throw error;
  return data;
}

export async function createWarrantyRequest(payload) {
  const { data, error } = await db().from('warranty_requests').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function purchaseProduct(tgUserId, productId, qty) {
  const { data, error } = await db().rpc('purchase_product', {
    p_user_tg_id: Number(tgUserId),
    p_product_id: productId,
    p_qty: Number(qty)
  });
  if (error) throw error;
  return data;
}

export async function adjustBalanceByUsername(username, delta, reason = '', adminTgUserId = null) {
  const { data, error } = await db().rpc('adjust_balance_by_username', {
    p_username: username,
    p_delta: Number(delta),
    p_reason: reason,
    p_admin_tg_user_id: adminTgUserId
  });
  if (error) throw error;
  return data;
}

export async function getDashboardKpis() {
  const { data, error } = await db().from('dashboard_kpis').select('*').maybeSingle();
  if (error) throw error;
  return data || {
    total_users: 0,
    total_paid_orders: 0,
    total_revenue: 0,
    total_paid_deposits: 0,
    total_deposit_amount: 0
  };
}

export async function listRecentOrders(limit = 20) {
  const { data, error } = await db()
    .from('orders')
    .select('*, users(username, full_name), order_items(qty, unit_price, total, products(name))')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listRecentActivities(limit = 30) {
  const { data, error } = await db()
    .from('activity_logs')
    .select('*, users(username, full_name, tg_user_id)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listUsers(limit = 100) {
  const { data, error } = await db()
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function queueBroadcastJob(message, parseMode = 'HTML') {
  const { data, error } = await db()
    .from('broadcast_jobs')
    .insert({ message, parse_mode: parseMode, status: 'queued' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listBroadcastJobs(limit = 20) {
  const { data, error } = await db()
    .from('broadcast_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getNextBroadcastJob() {
  const { data, error } = await db()
    .from('broadcast_jobs')
    .select('*')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateBroadcastJob(jobId, payload) {
  const { data, error } = await db().from('broadcast_jobs').update(payload).eq('id', jobId).select('*').single();
  if (error) throw error;
  return data;
}

export async function getBroadcastRecipients(afterTgUserId = 0, limit = 200) {
  const { data, error } = await db()
    .from('users')
    .select('tg_user_id')
    .gt('tg_user_id', Number(afterTgUserId))
    .order('tg_user_id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

function maskLicenseKey(key) {
  const raw = String(key || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.length <= 8) return raw;
  return `${raw.slice(0, 5)}-****-****-${raw.slice(-4)}`;
}

async function expireOldLicenses() {
  const { error } = await db()
    .from('licenses')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'activated')
    .lt('expires_at', new Date().toISOString());
  if (error) throw error;
}

export async function activateLicenseOnline({ licenseKey, deviceId = '', activatedBy = '' }) {
  const cleanKey = String(licenseKey || '').trim().toUpperCase();
  const cleanDeviceId = String(deviceId || '').trim();
  const cleanActivatedBy = String(activatedBy || '').trim();

  if (!cleanKey) return { ok: false, reason: 'empty_key' };

  await expireOldLicenses();

  const { data, error } = await db().rpc('activate_license_once', {
    p_license_key: cleanKey,
    p_device_id: cleanDeviceId || null,
    p_activated_by: cleanActivatedBy || null
  });

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('tidak ditemukan')) return { ok: false, reason: 'invalid_key' };
    if (msg.includes('direvoke')) return { ok: false, reason: 'revoked' };
    if (msg.includes('expired')) return { ok: false, reason: 'expired' };
    if (msg.includes('pernah dipakai')) return { ok: false, reason: 'already_used' };
    throw error;
  }

  return {
    ok: true,
    state: {
      keyMasked: maskLicenseKey(cleanKey),
      licenseId: data.id,
      status: data.status,
      activatedAt: data.activated_at,
      expiresAt: data.expires_at,
      deviceId: data.activated_device_id || cleanDeviceId || null
    }
  };
}


export async function listLicensesForDashboard(limit = 100) {
  await expireOldLicenses();

  const { data, error } = await db()
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function listUsedFakerEmails(limit = 200) {
  const { data, error } = await db()
    .from('used_faker_emails')
    .select('*')
    .order('used_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}


export async function getLicenseStatusOnline({ licenseKey, deviceId = '' }) {
  const cleanKey = String(licenseKey || '').trim().toUpperCase();
  const cleanDeviceId = String(deviceId || '').trim();

  if (!cleanKey) return { ok: false, reason: 'empty_key' };

  await expireOldLicenses();

  const { data, error } = await db()
    .from('licenses')
    .select('id, license_key, status, activated_at, expires_at, activated_device_id')
    .eq('license_key', cleanKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, reason: 'invalid_key' };
  if (data.status === 'revoked') return { ok: false, reason: 'revoked' };
  if (data.status === 'expired') return { ok: false, reason: 'expired' };
  if (data.status !== 'activated') return { ok: false, reason: 'not_activated' };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  if (data.activated_device_id && cleanDeviceId && data.activated_device_id !== cleanDeviceId) {
    return { ok: false, reason: 'device_mismatch' };
  }

  return {
    ok: true,
    state: {
      keyMasked: maskLicenseKey(cleanKey),
      licenseId: data.id,
      status: data.status,
      activatedAt: data.activated_at,
      expiresAt: data.expires_at,
      deviceId: data.activated_device_id || cleanDeviceId || null
    }
  };
}
