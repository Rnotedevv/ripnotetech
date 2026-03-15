import { NextResponse } from 'next/server';
import { normalizePaymentWebhook } from '@/lib/payment';
import { processPaymentWebhookEvent } from '@/lib/bot/handlers';
import {
  getDepositByReference,
  getOrderPaymentByReference,
  updateOrderPaymentByReference
} from '@/lib/db';
import { deleteMessage, sendMessage } from '@/lib/telegram';
import { escapeHtml, formatRupiah } from '@/lib/utils';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Payment webhook endpoint is active'
  });
}

async function handleDepositSuccess(event) {
  const reference = event.reference;
  const deposit = await getDepositByReference(reference);

  if (!deposit) {
    console.warn('Deposit tidak ditemukan:', reference);
    return { ok: true, skipped: 'deposit_not_found' };
  }

  const result = await processPaymentWebhookEvent(event);
  const freshDeposit = await getDepositByReference(reference);

  if (freshDeposit?.telegram_chat_id && freshDeposit?.telegram_message_id) {
    try {
      await deleteMessage(
        freshDeposit.telegram_chat_id,
        freshDeposit.telegram_message_id
      );
    } catch (err) {
      console.error('Gagal hapus pesan QR deposit:', err);
    }
  }

  if (freshDeposit?.telegram_chat_id) {
    try {
      await sendMessage(
        freshDeposit.telegram_chat_id,
        [
          '✅ <b>Deposit berhasil</b>',
          `Ref: <code>${escapeHtml(freshDeposit.reference)}</code>`,
          `Nominal masuk: <b>${formatRupiah(freshDeposit.amount)}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('Gagal kirim notif deposit sukses:', err);
    }
  }

  return result;
}

export async function POST(request) {
  try {
    const event = await normalizePaymentWebhook(request);

    const reference = event?.reference || event?.order_id || '';
    const status = String(event?.status || '').toLowerCase();

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: 'Missing payment reference' },
        { status: 400 }
      );
    }

    if (status !== 'paid' && status !== 'completed' && status !== 'success') {
      if (reference.startsWith('ORDPAY-')) {
        await updateOrderPaymentByReference(reference, {
          status: ['expired', 'failed', 'cancelled'].includes(status) ? status : 'pending',
          raw_response: event.raw || event
        }).catch(console.error);
      }

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `status_${status || 'unknown'}`
      });
    }

    if (reference.startsWith('DEP-')) {
      const result = await handleDepositSuccess(event);
      return NextResponse.json({ ok: true, type: 'deposit', result });
    }

    if (reference.startsWith('ORDPAY-')) {
      const orderPay = await getOrderPaymentByReference(reference);

      if (!orderPay) {
        return NextResponse.json({ ok: true, skipped: 'order_not_found' });
      }

      const result = await processPaymentWebhookEvent(event);
      const freshOrder = await getOrderPaymentByReference(reference);

      if (freshOrder?.telegram_chat_id && freshOrder?.telegram_message_id) {
        try {
          await deleteMessage(
            freshOrder.telegram_chat_id,
            freshOrder.telegram_message_id
          );
        } catch (err) {
          console.error('Gagal hapus pesan QR order:', err);
        }
      }

      return NextResponse.json({ ok: true, type: 'order_qris', result });
    }

    const result = await processPaymentWebhookEvent(event);
    return NextResponse.json({ ok: true, type: 'generic', result });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown webhook error' },
      { status: 500 }
    );
  }
}
