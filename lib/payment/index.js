import * as dummyProvider from '@/lib/payment/providers/dummy';
import * as pakasirProvider from '@/lib/payment/providers/pakasir';
import { env } from '@/lib/config';

function getProvider() {
  switch (env.paymentProvider) {
    case 'pakasir':
      return pakasirProvider;
    case 'dummy':
    default:
      return dummyProvider;
  }
}

export async function createPaymentIntent(payload) {
  return getProvider().createPayment(payload);
}

export async function normalizePaymentWebhook(request) {
  return getProvider().normalizeWebhook(request);
}

export async function getPaymentTransactionDetail(payload) {
  const provider = getProvider();
  if (!provider.getTransactionDetail) {
    throw new Error('Provider payment ini tidak mendukung pengecekan detail transaksi.');
  }
  return provider.getTransactionDetail(payload);
}
