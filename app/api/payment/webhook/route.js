import { NextResponse } from 'next/server';
import { normalizePaymentWebhook } from '@/lib/payment';
import { processPaymentWebhookEvent } from '@/lib/bot/handlers';

export async function POST(request) {
  try {
    const event = await normalizePaymentWebhook(request);
    const result = await processPaymentWebhookEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
