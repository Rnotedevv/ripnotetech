import { NextResponse } from 'next/server';
import { normalizePaymentWebhook } from '@/lib/payment';
import {
  completeOrderPayment,
  getDepositByReference,
  getOrderPaymentByReference,
  updateOrderPaymentByReference
} from '@/lib/db';
import { processPaymentWebhookEvent } from '@/lib/bot/handlers';
import { deleteMessage, notifyAdminGroup, sendMessage } from '@/lib/telegram';
import { escapeHtml, formatRupiah, splitText } from '@/lib/utils';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Payment webhook endpoint is active'
  });
}

export async function POST(request) {
  try {
    const event = await normalizePaymentWebhook(request);
    const reference = event?.reference || event?.order_id || '';
    const status = String(event?.status || '').toLowerCase();

    if (!reference) {
      return NextResponse.json({ ok: false, error: 'Missing reference' }, { status: 400 });
    }

    const isPaid = ['paid', 'completed', 'success'].includes(status);

    if (reference.startsWith('DEP-')) {
      const result = await processPaymentWebhookEvent({
        ...event,
        status: isPaid ? 'paid' : status
      });
      return NextResponse.json({ ok: true, type: 'deposit', result });
    }

    if (reference.startsWith('ORDPAY-')) {
      if (!isPaid) {
        await updateOrderPaymentByReference(reference, {
          status: ['expired', 'failed', 'cancelled'].includes(status) ? status : 'pending',
          raw_response: event.raw || event
        });

        return NextResponse.json({
          ok: true,
          type: 'order_qris',
          skipped: true,
          status
        });
      }

      const result = await completeOrderPayment(
        reference,
        event.providerReference || null,
        event.raw || event
      );

      if (result?.telegram_chat_id && result?.telegram_message_id) {
        await deleteMessage(result.telegram_chat_id, result.telegram_message_id).catch(() => null);
      }

      if (result?.tg_user_id && !result?.already_paid) {
        await sendMessage(
          result.tg_user_id,
          [
            '<b>Pembelian berhasil</b> ✅',
            `Order: <code>${escapeHtml(result.order_code)}</code>`,
            `Produk: ${escapeHtml(result.product_name || '-')}`,
            `Qty: <b>${result.qty}</b>`,
            `Total: <b>${formatRupiah(result.amount)}</b>`
          ].join('\n'),
          { parse_mode: 'HTML' }
        ).catch(() => null);

        const deliveryText = [
          result.delivery_note || '',
          result.delivery_note ? '' : null,
          `Data ${result.product_name || 'produk'}:`,
          ...(Array.isArray(result.items) ? result.items.map((item, index) => `${index + 1}. ${item}`) : [])
        ]
          .filter((v) => v !== null && v !== '')
          .join('\n');

        for (const chunk of splitText(deliveryText, 3200)) {
          await sendMessage(result.tg_user_id, chunk).catch(() => null);
        }
      }

      await notifyAdminGroup(
        [
          '🧾 <b>Order QRIS sukses</b>',
          `Ref: <code>${escapeHtml(result.reference)}</code>`,
          `Order: <code>${escapeHtml(result.order_code || '-')}</code>`,
          `Produk: ${escapeHtml(result.product_name || '-')}`,
          `Qty: <b>${result.qty || 0}</b>`,
          `Total: <b>${formatRupiah(result.amount || 0)}</b>`
        ].join('\n')
      ).catch(() => null);

      return NextResponse.json({ ok: true, type: 'order_qris', result });
    }

    return NextResponse.json({ ok: true, skipped: true, reason: 'unknown_reference' });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
