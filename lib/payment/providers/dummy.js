export async function createPayment({ reference, amount }) {
  return {
    providerReference: `DUMMY-${reference}`,
    qrString: `DUMMY|${reference}|${amount}`,
    qrUrl: '',
    payUrl: '',
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    raw: {
      mode: 'dummy',
      reference,
      amount
    }
  };
}

export async function normalizeWebhook(request) {
  const body = await request.json().catch(() => ({}));
  return {
    reference: body.reference,
    providerReference: body.provider_reference || body.reference,
    amount: Number(body.amount || 0),
    status: body.status || 'pending',
    raw: body
  };
}
