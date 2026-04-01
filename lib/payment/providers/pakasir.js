import { env } from '@/lib/config';

const API_BASE = 'https://app.pakasir.com/api';
const APP_BASE = 'https://app.pakasir.com';
const VALID_METHODS = new Set([
  'cimb_niaga_va',
  'bni_va',
  'qris',
  'sampoerna_va',
  'bnc_va',
  'maybank_va',
  'permata_va',
  'atm_bersama_va',
  'artha_graha_va',
  'bri_va',
  'paypal'
]);

function getProjectSlug() {
  const slug = env.pakasirProjectSlug || env.paymentProjectSlug;
  if (!slug) {
    throw new Error('PAKASIR_PROJECT_SLUG belum diisi.');
  }
  return slug;
}

function getApiKey() {
  const apiKey = env.pakasirApiKey || env.paymentApiKey;
  if (!apiKey) {
    throw new Error('PAKASIR_API_KEY belum diisi.');
  }
  return apiKey;
}

function getMethod() {
  const method = (env.pakasirPaymentMethod || 'qris').trim();
  if (!VALID_METHODS.has(method)) {
    throw new Error(`Payment method Pakasir tidak didukung: ${method}`);
  }
  return method;
}

function getRedirectUrl(reference) {
  if (!env.pakasirRedirectUrl) return '';
  const url = new URL(env.pakasirRedirectUrl);
  url.searchParams.set('reference', reference);
  return url.toString();
}

function buildPayUrl({ project, amount, orderId, method }) {
  const path = method === 'paypal' ? 'paypal' : 'pay';
  const url = new URL(`${APP_BASE}/${path}/${project}/${amount}`);
  url.searchParams.set('order_id', orderId);
  if (method === 'qris' && env.pakasirQrisOnly !== '0') {
    url.searchParams.set('qris_only', '1');
  }
  const redirectUrl = getRedirectUrl(orderId);
  if (redirectUrl) {
    url.searchParams.set('redirect', redirectUrl);
  }
  return url.toString();
}

async function pakasirFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request Pakasir gagal.');
  }
  return data;
}

export async function createPayment({ reference, amount, expiryMinutes = 60 }) {
  const project = getProjectSlug();
  const apiKey = getApiKey();
  const method = getMethod();

  const payload = {
    project,
    order_id: reference,
    amount: Number(amount),
    api_key: apiKey
  };

  const data = await pakasirFetch(`/transactioncreate/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const payment = data.payment || {};
  const localExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  return {
    providerReference: payment.order_id || reference,
    qrString: method === 'qris' ? payment.payment_number || '' : '',
    qrUrl: '',
    payUrl: buildPayUrl({ project, amount: Number(amount), orderId: reference, method }),
    expiresAt: localExpiresAt,
    gatewayExpiresAt: payment.expired_at || null,
    totalPayment: Number(payment.total_payment || payment.amount || amount || 0),
    fee: Number(payment.fee || 0),
    paymentMethod: payment.payment_method || method,
    paymentNumber: payment.payment_number || '',
    raw: data
  };
}

export async function getTransactionDetail({ reference, amount }) {
  const project = getProjectSlug();
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    project,
    amount: String(Number(amount)),
    order_id: reference,
    api_key: apiKey
  });
  const data = await pakasirFetch(`/transactiondetail?${params.toString()}`, {
    method: 'GET'
  });

  return data.transaction || null;
}

export async function cancelTransaction({ reference, amount }) {
  const data = await pakasirFetch('/transactioncancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: getProjectSlug(),
      order_id: reference,
      amount: Number(amount),
      api_key: getApiKey()
    })
  });
  return data;
}

export async function simulatePayment({ reference, amount }) {
  const data = await pakasirFetch('/paymentsimulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: getProjectSlug(),
      order_id: reference,
      amount: Number(amount),
      api_key: getApiKey()
    })
  });
  return data;
}

export async function normalizeWebhook(request) {
  const body = await request.json().catch(() => ({}));
  const rawStatus = String(body.status || '').toLowerCase();
  const reference = String(body.order_id || '');
  const amount = Number(body.amount || 0);

  let verified = null;
  if (reference && amount > 0) {
    try {
      verified = await getTransactionDetail({ reference, amount });
    } catch {
      verified = null;
    }
  }

  const verifiedStatus = String(verified?.status || rawStatus || '').toLowerCase();
  return {
    reference,
    providerReference: reference,
    amount,
    status: verifiedStatus === 'completed' ? 'paid' : verifiedStatus || rawStatus || 'pending',
    raw: {
      webhook: body,
      transaction_detail: verified
    }
  };
}
