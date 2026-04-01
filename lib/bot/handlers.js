import QRCode from 'qrcode';
import { env, isAdminTelegramId } from '@/lib/config';
import {
  isUserApproved,
  getAvailableInventoryByProductCode,
  getUserByUsername,
takeInventoryForManualSend,
  removeUserByUsernameOrTelegramId,
  removeAllInventoryByProductCode,
  approveUserByTelegramId,
  rejectUserByTelegramId,
  getProductByCode,
  migrateInventoryByProductCode,
  removeInventoryByEmail,
  getBroadcastRecipients,
  adjustBalanceByUsername,
  bulkInsertInventory,
  clearUserState,
  completeOrderPayment,
  confirmDeposit,
  createDeposit,
  createOrderPayment,
  createWarrantyRequest,
  ensureTelegramUser,
  findPendingOrderPaymentByUserAndProduct,
  getActiveProductsWithStock,
  getDashboardKpis,
  getDepositByReference,
  getOrderPaymentByReference,
  getProductById,
  getProductPriceTiers,
  getProductStockSummaryById,
  getSettings,
  getUserByTelegramId,
  getUserState,
  listDeposits,
  logActivity,
  purchaseProduct,
  setUserState,
  updateDepositByReference,
  updateOrderPaymentByReference
} from '@/lib/db';
import { createPaymentIntent, getPaymentTransactionDetail } from '@/lib/payment';
import {
  answerCallbackQuery,
  deleteMessage,
  notifyAdminGroup,
  sendMessage,
  sendPhotoBuffer
} from '@/lib/telegram';
import {
  adminKeyboard,
  depositKeyboard,
  mainMenuKeyboard,
  productListInlineKeyboard
} from '@/lib/bot/keyboards';
import { BUTTON_TEXT } from '@/lib/bot/button-text';
import { escapeHtml, formatDateTime, formatRupiah, splitText } from '@/lib/utils';

const STATE_WAITING_DEPOSIT = 'waiting_deposit_amount';
const STATE_WAITING_QTY = 'waiting_buy_qty';
const STATE_WAITING_WARRANTY = 'waiting_warranty_email';
const STATE_WAITING_UPLOAD_LINES = 'waiting_upload_lines';

function parseCommand(text = '') {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  return { command, args: rest };
}
function approvalKeyboard(tgUserId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Acc', callback_data: `approve_user:${tgUserId}` },
        { text: '❌ Tolak', callback_data: `reject_user:${tgUserId}` }
      ]
    ]
  };
}

async function sendApprovalRequired(chatId) {
  return sendMessage(
    chatId,
    '/reqacc dulu, Silakan hubungi http://wa.me/62858171868131 jika slow resp ke http://wa.me/6281298163085 untuk meminta acc. Setelah di-ACC admin, kamu baru bisa memakai bot ini.'
  );
}

const RESTOCK_NOTIFY_MIN_STOCK = 20;

async function canUseUpload(from, chat) {
  if (isAdminTelegramId(from.id)) {
    return true;
  }

  const adminGroupId = Number(env.adminGroupChatId || 0);
  if (!adminGroupId) {
    return false;
  }

  if (!chat || Number(chat.id) !== adminGroupId) {
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/getChatMember`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminGroupId,
          user_id: from.id
        })
      }
    );

    const result = await response.json();
    const status = result?.result?.status;

    return result?.ok && (status === 'administrator' || status === 'creator');
  } catch (error) {
    console.error('canUseUpload error:', error);
    return false;
  }
}

async function canUserBuyProduct(user, productId, isAdmin = false) {
  if (isAdmin) {
    return { ok: true };
  }

  const product = await getProductById(productId);
  if (!product) {
    return { ok: false, reason: 'product_not_found' };
  }

  // kalau field belum ada / false = publik
  if (!product.requires_approval) {
    return { ok: true, product };
  }

  const approved = await isUserApproved(user.tg_user_id);
  if (!approved) {
    return { ok: false, reason: 'approval_required', product };
  }

  return { ok: true, product };
}

async function notifyUsersProductRestock(productName, addedCount, availableStock) {
  const currentStock = Number(availableStock || 0);

  if (currentStock < RESTOCK_NOTIFY_MIN_STOCK) {
    return null;
  }

  let afterTgUserId = 0;

  while (true) {
    const batch = await getBroadcastRecipients(afterTgUserId, 200);
    if (!batch?.length) break;

    for (const row of batch) {
      const tgUserId = Number(row.tg_user_id);
      if (!tgUserId) continue;

      await sendMessage(
        tgUserId,
        [
          '📦 <b>Produk Restok</b>',
          `Produk: <b>${escapeHtml(productName || '-')}</b>`,
          `Ditambahkan: <b>${addedCount}</b> item`,
          `Stok sekarang: <b>${currentStock}</b>`,
          '',
          'Silakan buka bot untuk cek dan beli.'
        ].join('\n'),
        { parse_mode: 'HTML' }
      ).catch(() => null);
    }

    afterTgUserId = Number(batch[batch.length - 1].tg_user_id || 0);
  }

  return true;
}

async function sendMainMenu(chatId, settings, isAdmin, extraText = '') {
  const text = [
    `<b>${escapeHtml(settings.shop_name)}</b>`,
    '',
    escapeHtml(extraText || settings.welcome_text),
    '',
    'Saldo dan pembelian otomatis tersedia 24/7, silahkan /reqacc sebelum membeli item.'
  ].join('\n');

  return sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(settings, isAdmin)
  });
}

async function sendBalance(chatId, user, settings, isAdmin) {
  return sendMessage(
    chatId,
    [
      '<b>Saldo kamu</b>',
      `Nama: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `Saldo: <b>${formatRupiah(user.balance)}</b>`
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(settings, isAdmin)
    }
  );
}

async function sendProductList(chatId) {
  const products = await getActiveProductsWithStock();
  if (!products.length) {
    return sendMessage(chatId, 'Belum ada produk aktif.', {});
  }

 const text = [
  '<b>✨ LIST PRODUCT</b>',
  '',
  ...products.flatMap((product, index) => {
    const lines = [
      `<b>${index + 1}. ${escapeHtml(product.name)}</b>`,
      `💳 Kode: <code>${escapeHtml(product.product_code)}</code>`,
      `📦 Stok: <b>${product.available_stock}</b> ready`,
      product.description ? `📝 ${escapeHtml(product.description)}` : null
    ].filter(Boolean);

    if (index < products.length - 1) {
      lines.push('', '━━━━━━━━━━', '');
    }

    return lines;
  }),
  'Pilih produk lewat tombol di bawah.'
].join('\n');

  return sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: productListInlineKeyboard(products)
  });
}

async function sendStockSummary(chatId, user) {
  const products = await getActiveProductsWithStock();
 const text = [
  '<b>📦 STOK SAAT INI</b>',
  '',
  ...(products.length
    ? products.flatMap((product, index) => {
        const lines = [
          `<b>${index + 1}. ${escapeHtml(product.name)}</b>`,
          `• Ready: <b>${product.available_stock}</b>`,
          product.description ? `• ${escapeHtml(product.description)}` : null
        ].filter(Boolean);

        if (index < products.length - 1) {
          lines.push('', '━━━━━━━━━━', '');
        }

        return lines;
      })
    : ['Belum ada produk aktif.']),
  '',
  '<b>ℹ️ Catatan:</b>',
  'Paypal Diatas Bekas Alibaba & Chat Gpt, Jadi Jangan Nanya lagi.',
  'Admin: @ripnotee'
].join('\n');

  await logActivity({
    userId: user.id,
    type: 'stock_check',
    message: 'User cek stok',
    payload: {}
  });

  await notifyAdminGroup(
    [
      '📦 <b>User cek stok</b>',
      `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `ID: <code>${user.tg_user_id}</code>`
    ].join('\n')
  );

  return sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function startDeposit(chatId, user, amount, settings, isAdmin) {
  if (!Number.isFinite(amount) || amount < Number(settings.min_deposit || env.defaultMinDeposit)) {
    return sendMessage(
      chatId,
      `Minimal deposit adalah ${formatRupiah(settings.min_deposit || env.defaultMinDeposit)}. Masukkan nominal yang valid.`,
      {
        reply_markup: mainMenuKeyboard(settings, isAdmin)
      }
    );
  }

  const reference = `DEP-${Date.now()}-${user.tg_user_id}`;
  const payment = await createPaymentIntent({
    reference,
    amount,
    user,
    description: `Deposit saldo untuk @${user.username || user.tg_user_id}`
    expiryMinutes: 5
  });

  await createDeposit({
    reference,
    user_id: user.id,
    amount,
    status: 'pending',
    provider: env.paymentProvider,
    provider_ref: payment.providerReference,
    qr_string: payment.qrString,
    qr_url: payment.qrUrl,
    pay_url: payment.payUrl,
    raw_response: payment.raw,
    expires_at: payment.expiresAt
  });

  await clearUserState(user.id);

  const baseMessage = [
    '<b>Deposit dibuat</b>',
    `Ref: <code>${escapeHtml(reference)}</code>`,
    `Nominal deposit: <b>${formatRupiah(amount)}</b>`,
    payment.totalPayment ? `Total bayar: <b>${formatRupiah(payment.totalPayment)}</b>` : null,
    payment.fee ? `Fee gateway: <b>${formatRupiah(payment.fee)}</b>` : null,
    payment.expiresAt ? `Expired: ${escapeHtml(formatDateTime(payment.expiresAt))}` : null,
    payment.payUrl
      ? 'Gunakan tombol bayar untuk menyelesaikan pembayaran.'
      : 'Silakan scan QRIS atau selesaikan pembayaran sesuai instruksi gateway.'
  ]
    .filter(Boolean)
    .join('\n');

  let sentMessage = null;

  if (payment.qrString) {
    try {
      const buffer = await QRCode.toBuffer(payment.qrString, { width: 512, margin: 1 });
      sentMessage = await sendPhotoBuffer(chatId, buffer, 'qris.png', {
        caption: baseMessage,
        parse_mode: 'HTML',
        reply_markup: depositKeyboard(reference, payment.payUrl)
      });
    } catch {
      sentMessage = await sendMessage(
        chatId,
        `${baseMessage}\n\nQR String:\n<code>${escapeHtml(payment.qrString)}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: depositKeyboard(reference, payment.payUrl)
        }
      );
    }
  } else {
    sentMessage = await sendMessage(chatId, baseMessage, {
      parse_mode: 'HTML',
      reply_markup: depositKeyboard(reference, payment.payUrl)
    });
  }

  await updateDepositByReference(reference, {
    telegram_chat_id: chatId,
    telegram_message_id: sentMessage?.message_id || null
  });

  await logActivity({
    userId: user.id,
    type: 'deposit_created',
    message: 'User membuat deposit',
    payload: { reference, amount }
  });

  await notifyAdminGroup(
    [
      '💳 <b>Deposit baru</b>',
      `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `Nominal deposit: <b>${formatRupiah(amount)}</b>`,
      payment.totalPayment ? `Total bayar: <b>${formatRupiah(payment.totalPayment)}</b>` : null,
      payment.fee ? `Fee gateway: <b>${formatRupiah(payment.fee)}</b>` : null,
      `Ref: <code>${escapeHtml(reference)}</code>`
    ]
      .filter(Boolean)
      .join('\n')
  );
}

async function askForQty(chatId, userId, productId) {
  const product = await getProductById(productId);
  if (!product || !product.is_active) {
    return sendMessage(chatId, 'Produk tidak ditemukan atau sedang nonaktif.');
  }

  await clearUserState(userId);
  await setUserState(userId, STATE_WAITING_QTY, { productId }, 15);

  return sendMessage(
    chatId,
    `Masukkan qty untuk <b>${escapeHtml(product.name)}</b>. Contoh: <code>3</code>`,
    { parse_mode: 'HTML' }
  );
}

async function showBuyConfirmation(chatId, user, qty, productId) {
  const product = await getProductById(productId);
  if (!product) {
    return sendMessage(chatId, 'Produk tidak ditemukan.');
  }

  const stockInfo = await getProductStockSummaryById(productId);
  const availableStock = Number(stockInfo?.available_stock || 0);

  if (availableStock < qty) {
    return sendMessage(
      chatId,
      `Stok tidak cukup. Stok tersedia hanya ${availableStock}, sedangkan kamu meminta ${qty}.`
    );
  }

  const tiers = await getProductPriceTiers(productId);

  const matchedTier = [...tiers]
    .sort((a, b) => b.min_qty - a.min_qty)
    .find((tier) => qty >= tier.min_qty && (!tier.max_qty || qty <= tier.max_qty));

  if (!matchedTier) {
    return sendMessage(chatId, 'Harga untuk qty tersebut belum diatur admin.');
  }

  const total = Number(matchedTier.unit_price) * Number(qty);

  return sendMessage(
    chatId,
    [
      '<b>Konfirmasi Pembelian</b>',
      `Produk: ${escapeHtml(product.name)}`,
      `Qty: <b>${qty}</b>`,
      `Harga/qty: <b>${formatRupiah(matchedTier.unit_price)}</b>`,
      `Total: <b>${formatRupiah(total)}</b>`,
      `Saldo sekarang: <b>${formatRupiah(user.balance)}</b>`,
      '',
      'Pilih metode pembayaran:'
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: BUTTON_TEXT.payBalance, callback_data: `buy_balance:${productId}:${qty}` },
            { text: BUTTON_TEXT.payQris, callback_data: `buy_qris:${productId}:${qty}` }
          ],
          [{ text: BUTTON_TEXT.cancel, callback_data: 'buy_cancel' }]
        ]
      }
    }
  );
}

async function finalizePurchase(chatId, tgUserId, productId, qty) {
  const user = await getUserByTelegramId(tgUserId);
  const product = await getProductById(productId);

  try {
    const result = await purchaseProduct(tgUserId, productId, qty);
    const latestUser = await getUserByTelegramId(tgUserId);

    await sendMessage(
      chatId,
      [
        '<b>Pembelian berhasil</b> ✅',
        `Order: <code>${escapeHtml(result.order_code)}</code>`,
        `Produk: ${escapeHtml(product?.name || '-')}`,
        `Qty: <b>${qty}</b>`,
        `Total: <b>${formatRupiah(result.total)}</b>`,
        `Sisa saldo: <b>${formatRupiah(latestUser?.balance || 0)}</b>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );

    const items = Array.isArray(result.items) ? result.items : [];
    const deliveryText = [
      result.delivery_note || '',
      result.delivery_note ? '' : null,
      `Data ${product?.name || 'produk'}:`,
      ...items.map((item, index) => `${index + 1}. ${item}`)
    ]
      .filter((value) => value !== null)
      .join('\n');

    for (const chunk of splitText(deliveryText, 3200)) {
      await sendMessage(chatId, chunk);
    }

    await clearUserState(user.id);

    await notifyAdminGroup(
      [
        '🛒 <b>Pembelian sukses</b>',
        `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
        `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
        `Produk: ${escapeHtml(product?.name || '-')}`,
        `Qty: <b>${qty}</b>`,
        `Total: <b>${formatRupiah(result.total)}</b>`,
        `Order: <code>${escapeHtml(result.order_code)}</code>`
      ].join('\n')
    );

    return result;
  } catch (error) {
    console.error('finalizePurchase error', error);
    await sendMessage(chatId, `Gagal memproses pembelian: ${error.message}`);
    throw error;
  }
}

async function startOrderQrisPayment(chatId, user, productId, qty) {
  const product = await getProductById(productId);
  const tiers = await getProductPriceTiers(productId);

  if (!product || !product.is_active) {
    return sendMessage(chatId, 'Produk tidak ditemukan atau sedang nonaktif.');
  }

  const stockInfo = await getProductStockSummaryById(productId);
  const availableStock = Number(stockInfo?.available_stock || 0);

  if (availableStock < qty) {
    return sendMessage(
      chatId,
      `Stok tidak cukup. Stok tersedia hanya ${availableStock}, sedangkan kamu meminta ${qty}.`
    );
  }

  const matchedTier = [...tiers]
    .sort((a, b) => b.min_qty - a.min_qty)
    .find((tier) => qty >= tier.min_qty && (!tier.max_qty || qty <= tier.max_qty));

  if (!matchedTier) {
    return sendMessage(chatId, 'Harga untuk qty tersebut belum diatur.');
  }

  const total = Number(matchedTier.unit_price) * Number(qty);
  const reference = `ORDPAY-${Date.now()}-${user.tg_user_id}`;

  const payment = await createPaymentIntent({
    reference,
    amount: total,
    user,
    description: `Pembayaran order ${product.name} x${qty}`
    expiryMinutes: 5
  });

  await createOrderPayment({
    reference,
    user_id: user.id,
    product_id: productId,
    qty,
    amount: total,
    status: 'pending',
    expires_at: payment.expiresAt,
    raw_response: {
      user: {
        tg_user_id: user.tg_user_id,
        username: user.username || null,
        full_name: user.full_name || null
      },
      product: {
        id: product.id,
        name: product.name
      },
      price: {
        unit_price: Number(matchedTier.unit_price),
        total
      },
      payment_init: payment.raw || null
    },
    telegram_chat_id: chatId
  });

  await createDeposit({
    reference,
    user_id: user.id,
    amount: total,
    status: 'pending',
    provider: env.paymentProvider,
    provider_ref: payment.providerReference,
    qr_string: payment.qrString,
    qr_url: payment.qrUrl,
    pay_url: payment.payUrl,
    raw_response: payment.raw,
    expires_at: payment.expiresAt
  });

  const caption = [
    '<b>Pembayaran Order Dibuat</b>',
    `Ref: <code>${escapeHtml(reference)}</code>`,
    `Produk: <b>${escapeHtml(product.name)}</b>`,
    `Qty: <b>${qty}</b>`,
    `Total bayar: <b>${formatRupiah(payment.totalPayment || total)}</b>`,
    payment.fee ? `Fee gateway: <b>${formatRupiah(payment.fee)}</b>` : null,
    payment.expiresAt ? `Expired: ${escapeHtml(formatDateTime(payment.expiresAt))}` : null,
    payment.payUrl
      ? 'Gunakan tombol bayar untuk menyelesaikan pembelian.'
      : 'Silakan scan QRIS untuk menyelesaikan pembayaran.'
  ]
    .filter(Boolean)
    .join('\n');

  let sentMessage = null;

  if (payment.qrString) {
    try {
      const buffer = await QRCode.toBuffer(payment.qrString, { width: 512, margin: 1 });
      sentMessage = await sendPhotoBuffer(chatId, buffer, 'order-qris.png', {
        caption,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: BUTTON_TEXT.payNow, url: payment.payUrl }],
            [{ text: BUTTON_TEXT.checkStatus, callback_data: `check_orderpay:${reference}` }],
            [{ text: BUTTON_TEXT.cancel, callback_data: `buy_cancel:${reference}` }]
          ]
        }
      });
    } catch {
      sentMessage = await sendMessage(chatId, `${caption}\n\nQR String:\n<code>${escapeHtml(payment.qrString)}</code>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: BUTTON_TEXT.payNow, url: payment.payUrl }],
            [{ text: BUTTON_TEXT.checkStatus, callback_data: `check_orderpay:${reference}` }],
            [{ text: BUTTON_TEXT.cancel, callback_data: `buy_cancel:${reference}` }]
          ]
        }
      });
    }
  } else {
    sentMessage = await sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: BUTTON_TEXT.payNow, url: payment.payUrl }],
          [{ text: BUTTON_TEXT.checkStatus, callback_data: `check_orderpay:${reference}` }],
          [{ text: BUTTON_TEXT.cancel, callback_data: `buy_cancel:${reference}` }]
        ]
      }
    });
  }

  await updateOrderPaymentByReference(reference, {
    telegram_chat_id: chatId,
    telegram_message_id: sentMessage?.message_id || null
  });

  await updateDepositByReference(reference, {
    telegram_chat_id: chatId,
    telegram_message_id: sentMessage?.message_id || null
  });

  await logActivity({
    userId: user.id,
    type: 'order_qris_created',
    message: 'User membuat pembayaran QRIS untuk order',
    payload: { reference, productId, qty, total }
  });

  await notifyAdminGroup(
    [
      '📷 <b>QRIS order baru</b>',
      `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `Produk: <b>${escapeHtml(product.name)}</b>`,
      `Qty: <b>${qty}</b>`,
      `Nominal: <b>${formatRupiah(total)}</b>`,
      `Ref: <code>${escapeHtml(reference)}</code>`
    ].join('\n')
  );
}

async function submitWarranty(chatId, user, email, settings, isAdmin) {
  const warranty = await createWarrantyRequest({
    user_id: user.id,
    email,
    issue_note: null
  });

  await clearUserState(user.id);

  await logActivity({
    userId: user.id,
    type: 'warranty_created',
    message: 'User mengirim garansi',
    payload: { warranty_id: warranty.id, email }
  });

  await notifyAdminGroup(
    [
      '🛡 <b>Request garansi baru</b>',
      `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `Email bermasalah: <code>${escapeHtml(email)}</code>`
    ].join('\n')
  );

  return sendMessage(
    chatId,
    'Request garansi sudah diteruskan ke admin. Mohon tunggu proses pengecekan.',
    {
      reply_markup: mainMenuKeyboard(settings, isAdmin)
    }
  );
}

async function handleAdminCommand({ command, args, from, chatId }) {
  if (!isAdminTelegramId(from.id)) {
    return { handled: false };
  }

if (command === '/removeall') {
    const productCode = String(args[0] || '').trim();

    if (!productCode) {
      await sendMessage(chatId, 'Format: /removeall 2');
      return { handled: true };
    }

    try {
      const result = await removeAllInventoryByProductCode(productCode);

      await sendMessage(
        chatId,
        [
          '<b>Semua stok berhasil dihapus</b>',
          `Produk: <b>${escapeHtml(result.product.name)}</b>`,
          `Kode: <code>${escapeHtml(result.product.product_code)}</code>`,
          `Total dihapus: <b>${result.removed}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await notifyAdminGroup(
        [
          '🗑 <b>Remove All Stock</b>',
          `Admin: <code>${from.id}</code>`,
          `Produk: <b>${escapeHtml(result.product.name)}</b>`,
          `Kode: <code>${escapeHtml(result.product.product_code)}</code>`,
          `Total dihapus: <b>${result.removed}</b>`
        ].join('\n')
      ).catch(() => null);
    } catch (error) {
      await sendMessage(chatId, `Gagal hapus semua stok: ${error.message}`);
    }

    return { handled: true };
  }
  

if (command === '/migrasi') {
    const raw = args.join(' ').trim();
    const match = raw.match(/^(.+?)\s+to\s+(.+)$/i);

    if (!match) {
      await sendMessage(chatId, 'Format: /migrasi 1 to 2');
      return { handled: true };
    }

    const fromCode = match[1].trim();
    const toCode = match[2].trim();

    try {
      const result = await migrateInventoryByProductCode(fromCode, toCode);

      await sendMessage(
        chatId,
        [
          '<b>Migrasi stok berhasil</b>',
          `Dari: <b>${escapeHtml(result.fromProduct.product_code)} - ${escapeHtml(result.fromProduct.name)}</b>`,
          `Ke: <b>${escapeHtml(result.toProduct.product_code)} - ${escapeHtml(result.toProduct.name)}</b>`,
          `Total dipindahkan: <b>${result.moved}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await notifyAdminGroup(
        [
          '🔁 <b>Migrasi stok</b>',
          `Admin: <code>${from.id}</code>`,
          `Dari kode: <b>${escapeHtml(result.fromProduct.product_code)}</b>`,
          `Ke kode: <b>${escapeHtml(result.toProduct.product_code)}</b>`,
          `Jumlah: <b>${result.moved}</b>`
        ].join('\n')
      ).catch(() => null);
    } catch (error) {
      await sendMessage(chatId, `Gagal migrasi stok: ${error.message}`);
    }

    return { handled: true };
  }

  if (command === '/remove') {
    const email = String(args[0] || '').trim().toLowerCase();

    if (!email) {
      await sendMessage(chatId, 'Format: /remove email@domain.com');
      return { handled: true };
    }

    try {
      const result = await removeInventoryByEmail(email);

      if (!result.removed) {
        await sendMessage(chatId, `Tidak ditemukan stok dengan email ${email}.`);
        return { handled: true };
      }

      await sendMessage(
        chatId,
        [
          '<b>Stok berhasil dihapus</b>',
          `Email: <code>${escapeHtml(email)}</code>`,
          `Total dihapus: <b>${result.removed}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await notifyAdminGroup(
        [
          '🗑 <b>Remove stok</b>',
          `Admin: <code>${from.id}</code>`,
          `Email: <code>${escapeHtml(email)}</code>`,
          `Total dihapus: <b>${result.removed}</b>`
        ].join('\n')
      ).catch(() => null);
    } catch (error) {
      await sendMessage(chatId, `Gagal hapus stok: ${error.message}`);
    }

    return { handled: true };
  }

  if (command === '/send') {
    const username = String(args[0] || '').trim();
    const replacementEmail = String(args[1] || '').trim();

    if (!username || !replacementEmail) {
      await sendMessage(chatId, 'Format: /send @username email@baru.com');
      return { handled: true };
    }

    const cleanUsername = username.replace('@', '');

    try {
      const { data: targetUser, error } = await db()
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (error) throw error;

      if (!targetUser) {
        await sendMessage(chatId, `User @${cleanUsername} tidak ditemukan.`);
        return { handled: true };
      }

      await sendMessage(
        targetUser.tg_user_id,
        [
          '<b>Garansi Email</b>',
          'Berikut email pengganti kamu:',
          `<code>${escapeHtml(replacementEmail)}</code>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await sendMessage(
        chatId,
        [
          '<b>Email pengganti berhasil dikirim</b>',
          `User: @${escapeHtml(cleanUsername)}`,
          `Email: <code>${escapeHtml(replacementEmail)}</code>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await notifyAdminGroup(
        [
          '📨 <b>Kirim email garansi</b>',
          `Admin: <code>${from.id}</code>`,
          `User: @${escapeHtml(cleanUsername)}`,
          `Email: <code>${escapeHtml(replacementEmail)}</code>`
        ].join('\n')
      ).catch(() => null);
    } catch (error) {
      await sendMessage(chatId, `Gagal kirim email pengganti: ${error.message}`);
    }

    return { handled: true };
  }


  
  if (command === '/dashboard') {
    await sendMessage(
      chatId,
      [
        '<b>Admin Panel</b>',
        'Kelola produk, stok, harga, broadcast, dan deposit dari dashboard web.'
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: adminKeyboard()
      }
    );
    return { handled: true };
  }

  if (command === '/stats') {
    const stats = await getDashboardKpis();
    await sendMessage(
      chatId,
      [
        '<b>Statistik Bot</b>',
        `Total user: <b>${stats.total_users}</b>`,
        `Total transaksi order: <b>${stats.total_paid_orders}</b>`,
        `Total revenue: <b>${formatRupiah(stats.total_revenue)}</b>`,
        `Deposit sukses: <b>${stats.total_paid_deposits}</b>`,
        `Total deposit: <b>${formatRupiah(stats.total_deposit_amount)}</b>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
    return { handled: true };
  }

  if (command === '/pendingdeposits') {
    const deposits = (await listDeposits(10)).filter((item) => item.status === 'pending');
    if (!deposits.length) {
      await sendMessage(chatId, 'Tidak ada deposit pending saat ini.');
      return { handled: true };
    }

    const lines = deposits.map(
      (item, index) =>
        `${index + 1}. ${item.reference} — ${
          item.users?.username ? '@' + item.users.username : item.users?.full_name || 'User'
        } — ${formatRupiah(item.amount)}`
    );

    await sendMessage(chatId, ['<b>Pending Deposits</b>', '', ...lines].join('\n'), {
      parse_mode: 'HTML'
    });
    return { handled: true };
  }

  if (command === '/addsaldo' || command === '/hapussaldo') {
    const username = args[0];
    const amount = Number(String(args[1] || '').replace(/[^0-9-]/g, ''));
    const reason =
      args.slice(2).join(' ') || (command === '/addsaldo' ? 'Admin addsaldo' : 'Admin hapussaldo');

    if (!username || !Number.isFinite(amount) || amount <= 0) {
      await sendMessage(chatId, 'Format: /addsaldo @username 50000 atau /hapussaldo @username 50000');
      return { handled: true };
    }

    const delta = command === '/addsaldo' ? amount : amount * -1;

    try {
      const result = await adjustBalanceByUsername(username, delta, reason, Number(from.id));

      await sendMessage(
        chatId,
        [
          '<b>Saldo user diperbarui</b>',
          `User: @${escapeHtml(result.username || username.replace('@', ''))}`,
          `Perubahan: <b>${delta > 0 ? '+' : ''}${formatRupiah(delta)}</b>`,
          `Saldo baru: <b>${formatRupiah(result.balance)}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );

      await sendMessage(
        result.tg_user_id,
        [
          '<b>Saldo kamu berubah</b>',
          `Perubahan: <b>${delta > 0 ? '+' : ''}${formatRupiah(delta)}</b>`,
          `Saldo saat ini: <b>${formatRupiah(result.balance)}</b>`,
          `Keterangan: ${escapeHtml(reason)}`
        ].join('\n'),
        { parse_mode: 'HTML' }
      ).catch(() => null);
    } catch (error) {
      await sendMessage(chatId, `Gagal update saldo: ${error.message}`);
    }

    return { handled: true };
  }

  return { handled: false };
}

async function handleUserText(message, user, settings, isAdmin) {
  const chatId = message.chat.id;
  const text = String(message.text || '').trim();

  const resetAndMainMenu = async () => {
    await clearUserState(user.id);
    return sendMessage(chatId, 'Menu direset. Pilih lagi dari tombol di bawah.', {
      reply_markup: mainMenuKeyboard(settings, isAdmin)
    });
  };

  if (text === '/start' || text === '/menu') {
    await clearUserState(user.id);
    return sendMainMenu(chatId, settings, isAdmin);
  }

if (text === settings.menu_buy_label) {
  await clearUserState(user.id);
  return sendProductList(chatId);
}

  if (text === settings.menu_deposit_label) {
    await clearUserState(user.id);
    await setUserState(user.id, STATE_WAITING_DEPOSIT, {}, 15);
    return sendMessage(
      chatId,
      `Masukkan nominal deposit. Minimal ${formatRupiah(settings.min_deposit)}.`,
      { reply_markup: mainMenuKeyboard(settings, isAdmin) }
    );
  }

  if (text === settings.menu_products_label) {
    await clearUserState(user.id);
    return sendProductList(chatId);
  }

  if (text === settings.menu_stock_label) {
    await clearUserState(user.id);
    return sendStockSummary(chatId, user);
  }

  if (text === settings.menu_warranty_label) {
    await clearUserState(user.id);
    await setUserState(user.id, STATE_WAITING_WARRANTY, {}, 30);
    return sendMessage(chatId, 'Paste email yang bermasalah untuk diteruskan ke admin.', {
      reply_markup: mainMenuKeyboard(settings, isAdmin)
    });
  }

  if (text === settings.menu_balance_label) {
    await clearUserState(user.id);
    return sendBalance(chatId, user, settings, isAdmin);
  }

  if (text === '🧰 Admin' && isAdmin) {
    await clearUserState(user.id);
    return sendMessage(
      chatId,
      [
        '<b>Admin Menu</b>',
        'Command cepat: /stats, /addsaldo, /hapussaldo, /pendingdeposits, /upload'
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }

  if (text === '/reset' || text === 'reset') {
    return resetAndMainMenu();
  }

  const state = await getUserState(user.id);

  if (state?.state_key === STATE_WAITING_DEPOSIT) {
    const amount = Number(text.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(amount) || amount < settings.min_deposit) {
      return sendMessage(
        chatId,
        `Minimal deposit adalah ${formatRupiah(settings.min_deposit)}. Masukkan nominal yang valid.`,
        { reply_markup: mainMenuKeyboard(settings, isAdmin) }
      );
    }

    await clearUserState(user.id);
    return startDeposit(chatId, user, amount, settings, isAdmin);
  }

if (state?.state_key === STATE_WAITING_QTY) {
  const productId = state.payload?.productId;

  const access = await canUserBuyProduct(user, productId, isAdmin);
  if (!access.ok) {
    await clearUserState(user.id);
    return sendApprovalRequired(chatId);
  }

  const qty = Number(text.replace(/[^0-9]/g, ''));

  if (!Number.isFinite(qty) || qty <= 0) {
    return sendMessage(chatId, 'Masukkan qty yang valid, misalnya 1, 2, atau 10.');
  }

  const stockInfo = await getProductStockSummaryById(productId);
  const availableStock = Number(stockInfo?.available_stock || 0);

  if (availableStock < qty) {
    return sendMessage(
      chatId,
      `Stok tidak cukup. Stok tersedia hanya ${availableStock}, sedangkan kamu meminta ${qty}.`
    );
  }

  await clearUserState(user.id);
  return showBuyConfirmation(chatId, user, qty, productId);
}

  if (state?.state_key === STATE_WAITING_WARRANTY) {
    await clearUserState(user.id);
    return submitWarranty(chatId, user, text, settings, isAdmin);
  }

  await clearUserState(user.id);
  return sendMessage(chatId, 'Gunakan tombol menu agar alur bot tetap rapi.', {
    reply_markup: mainMenuKeyboard(settings, isAdmin)
  });
}

async function handleCallback(callbackQuery) {
  const from = callbackQuery.from;
  const chatId = callbackQuery.message?.chat?.id;
  const data = String(callbackQuery.data || '');
  const user = await ensureTelegramUser(from);

if (data.startsWith('approve_user:')) {
    if (!isAdminTelegramId(from.id)) {
      await answerCallbackQuery(callbackQuery.id, 'Tidak diizinkan');
      return null;
    }

    const tgUserId = Number(data.split(':')[1]);
    const approvedUser = await approveUserByTelegramId(tgUserId, from.id);

    await answerCallbackQuery(callbackQuery.id, 'User berhasil di-ACC');

    await sendMessage(
      tgUserId,
      '✅ Akun kamu sudah di-ACC admin. Sekarang kamu bisa menggunakan bot ini.'
    ).catch(() => null);

    return sendMessage(
      chatId,
      [
        '<b>User berhasil di-ACC</b>',
        `Nama: ${escapeHtml(approvedUser.full_name || approvedUser.username || 'User')}`,
        `Username: ${escapeHtml(approvedUser.username ? `@${approvedUser.username}` : '-')}`,
        `Telegram ID: <code>${approvedUser.tg_user_id}</code>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }

  if (data.startsWith('reject_user:')) {
    if (!isAdminTelegramId(from.id)) {
      await answerCallbackQuery(callbackQuery.id, 'Tidak diizinkan');
      return null;
    }

    const tgUserId = Number(data.split(':')[1]);
    const rejectedUser = await rejectUserByTelegramId(tgUserId);

    await answerCallbackQuery(callbackQuery.id, 'User ditolak');

    await sendMessage(
      tgUserId,
      '❌ Request ACC kamu ditolak. Silakan hubungi admin untuk info lebih lanjut.'
    ).catch(() => null);

    return sendMessage(
      chatId,
      [
        '<b>User ditolak</b>',
        `Nama: ${escapeHtml(rejectedUser.full_name || rejectedUser.username || 'User')}`,
        `Username: ${escapeHtml(rejectedUser.username ? `@${rejectedUser.username}` : '-')}`,
        `Telegram ID: <code>${rejectedUser.tg_user_id}</code>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }



if (data.startsWith('select_product:')) {
  const productId = data.split(':')[1];

  const access = await canUserBuyProduct(
    user,
    productId,
    isAdminTelegramId(from.id)
  );

  if (!access.ok) {
    await answerCallbackQuery(callbackQuery.id, 'Produk ini khusus user ACC');
    return sendApprovalRequired(chatId);
  }

  await answerCallbackQuery(callbackQuery.id, 'Masukkan qty pembelian');
  return askForQty(chatId, user.id, productId);
}

  if (data.startsWith('confirm_buy:')) {
    const [, productId, qty] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, 'Pembelian diproses');
    return finalizePurchase(chatId, from.id, productId, Number(qty));
  }

if (data.startsWith('buy_balance:')) {
  const [, productId, qty] = data.split(':');

  const access = await canUserBuyProduct(
    user,
    productId,
    isAdminTelegramId(from.id)
  );

  if (!access.ok) {
    await answerCallbackQuery(callbackQuery.id, 'Produk ini khusus user ACC');
    return sendApprovalRequired(chatId);
  }

  await answerCallbackQuery(callbackQuery.id, 'Pembelian diproses');
  return finalizePurchase(chatId, from.id, productId, Number(qty));
}

 if (data.startsWith('buy_qris:')) {
  const [, productId, qty] = data.split(':');

  const access = await canUserBuyProduct(
    user,
    productId,
    isAdminTelegramId(from.id)
  );

  if (!access.ok) {
    await answerCallbackQuery(callbackQuery.id, 'Produk ini khusus user ACC');
    return sendApprovalRequired(chatId);
  }

  const pendingOrder = await findPendingOrderPaymentByUserAndProduct(user.id, productId);

  if (pendingOrder) {
    await answerCallbackQuery(
      callbackQuery.id,
      `Masih ada pending: ${pendingOrder.reference}`
    );
    return null;
  }

  await answerCallbackQuery(callbackQuery.id, 'Membuat invoice QRIS...');
  return startOrderQrisPayment(chatId, user, productId, Number(qty));
}

  if (data.startsWith('check_deposit:')) {
    const reference = data.split(':')[1];
    let deposit = await getDepositByReference(reference);

    if (!deposit) {
      await answerCallbackQuery(callbackQuery.id, 'Deposit tidak ditemukan');
      return sendMessage(chatId, 'Deposit tidak ditemukan.');
    }

    try {
      const trx = await getPaymentTransactionDetail({
        reference: deposit.reference,
        amount: deposit.amount
      });

      const trxStatus = String(trx?.status || '').toLowerCase();

      if (trxStatus === 'completed') {
        await processPaymentWebhookEvent({
          reference: deposit.reference,
          providerReference: trx.order_id || deposit.provider_ref || deposit.reference,
          amount: Number(trx.amount || deposit.amount),
          status: 'paid',
          raw: { transaction_detail: trx, source: 'manual_check' }
        });

        deposit = await getDepositByReference(reference);
        await answerCallbackQuery(callbackQuery.id, 'Deposit sudah masuk');
      } else {
        await updateDepositByReference(deposit.reference, {
          status: ['expired', 'failed', 'cancelled'].includes(trxStatus) ? trxStatus : 'pending',
          raw_response: { transaction_detail: trx, source: 'manual_check' }
        });

        deposit = await getDepositByReference(reference);
        await answerCallbackQuery(
          callbackQuery.id,
          `Status deposit: ${deposit?.status || trxStatus || 'pending'}`
        );
      }
    } catch (error) {
      console.error('Check deposit error:', error);
      await answerCallbackQuery(callbackQuery.id, 'Gagal cek status gateway');
    }

    return sendMessage(
      chatId,
      [
        '<b>Status Deposit</b>',
        `Ref: <code>${escapeHtml(deposit.reference)}</code>`,
        `Status: <b>${escapeHtml(deposit.status)}</b>`,
        `Nominal: <b>${formatRupiah(deposit.amount)}</b>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }

  if (data.startsWith('check_orderpay:')) {
    const reference = data.split(':')[1];

    await answerCallbackQuery(callbackQuery.id, 'Mengecek status pembayaran...');

    let orderPay = await getOrderPaymentByReference(reference);
    if (!orderPay) {
      return sendMessage(chatId, 'Pembayaran order tidak ditemukan.');
    }

    try {
      const trx = await getPaymentTransactionDetail({
        reference: orderPay.reference,
        amount: orderPay.amount
      });

      const trxStatus = String(trx?.status || '').toLowerCase();

      if (trxStatus === 'completed') {
        const result = await completeOrderPayment(
          orderPay.reference,
          trx.order_id || null,
          { transaction_detail: trx, source: 'manual_check' }
        );

        if (result?.telegram_chat_id && result?.telegram_message_id) {
          await deleteMessage(result.telegram_chat_id, result.telegram_message_id).catch(() => null);
        }

        if (!result?.already_paid) {
          await sendMessage(
            chatId,
            [
              '<b>Pembelian berhasil</b> ✅',
              `Order: <code>${escapeHtml(result.order_code)}</code>`,
              `Produk: ${escapeHtml(result.product_name || '-')}`,
              `Qty: <b>${result.qty}</b>`,
              `Total: <b>${formatRupiah(result.amount)}</b>`
            ].join('\n'),
            { parse_mode: 'HTML' }
          );

          const deliveryText = [
            result.delivery_note || '',
            result.delivery_note ? '' : null,
            `Data ${result.product_name || 'produk'}:`,
            ...(Array.isArray(result.items) ? result.items.map((item, index) => `${index + 1}. ${item}`) : [])
          ]
            .filter((v) => v !== null && v !== '')
            .join('\n');

          for (const chunk of splitText(deliveryText, 3200)) {
            await sendMessage(chatId, chunk);
          }
        }

        return null;
      }

      await updateOrderPaymentByReference(orderPay.reference, {
        status: ['expired', 'failed', 'cancelled'].includes(trxStatus) ? trxStatus : 'pending',
        raw_response: { transaction_detail: trx, source: 'manual_check' }
      });

      orderPay = await getOrderPaymentByReference(reference);

      return sendMessage(
        chatId,
        [
          '<b>Status Pembayaran Order</b>',
          `Ref: <code>${escapeHtml(orderPay.reference)}</code>`,
          `Status: <b>${escapeHtml(orderPay.status)}</b>`,
          `Nominal: <b>${formatRupiah(orderPay.amount)}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Check order pay error:', error);
      return sendMessage(chatId, 'Gagal cek status pembayaran order.');
    }
  }
    if (data.startsWith('upload_product:')) {
  await answerCallbackQuery(callbackQuery.id, 'Upload sekarang pakai /upload kodeproduk');
  return sendMessage(chatId, 'Sekarang upload stok pakai format: /upload 1');
}

if (data.startsWith('buy_cancel') || data.startsWith('cancel_action')) {
  await clearUserState(user.id);

  const reference = data.includes(':') ? data.split(':')[1] : null;

  try {
    if (reference) {
      if (reference.startsWith('ORDPAY-')) {
        await updateOrderPaymentByReference(reference, { status: 'cancelled' }).catch(() => null);
        await updateDepositByReference(reference, { status: 'cancelled' }).catch(() => null);
      } else if (reference.startsWith('DEP-')) {
        await updateDepositByReference(reference, { status: 'cancelled' }).catch(() => null);
      }
    }
  } catch (error) {
    console.error('cancel action error:', error);
  }

  await answerCallbackQuery(callbackQuery.id, 'Aksi dibatalkan');

  if (chatId && callbackQuery.message?.message_id) {
    await deleteMessage(chatId, callbackQuery.message.message_id).catch(() => null);
  }

  return sendMessage(chatId, 'Aksi dibatalkan.', {
    reply_markup: mainMenuKeyboard(await getSettings(), isAdminTelegramId(from.id))
  });
}

export async function processTelegramUpdate(update) {
  const settings = await getSettings();

  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }

  if (!update.message || !update.message.from) {
    return null;
  }

  const message = update.message;
  const from = message.from;
  const chatId = message.chat.id;
  const text = String(message.text || '').trim();

  if (!text) {
    return null;
  }

  const isAdmin = isAdminTelegramId(from.id);
  const user = await ensureTelegramUser(from);
  const state = await getUserState(user.id);
  const approved = await isUserApproved(from.id);

  if (text.startsWith('/')) {
    const { command, args } = parseCommand(text);

if (command === '/reqacc') {
      const approved = await isUserApproved(from.id);

      if (approved) {
        return sendMessage(chatId, 'Akun kamu sudah di-ACC. Silakan gunakan menu bot.');
      }

      await sendApprovalRequired(chatId);

      await notifyAdminGroup(
        [
          '🆕 <b>Request ACC User</b>',
          `Nama: ${escapeHtml(user.full_name || user.username || 'User')}`,
          `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
          `Telegram ID: <code>${user.tg_user_id}</code>`,
          '',
          'Klik tombol di bawah untuk ACC atau Tolak.'
        ].join('\n'),
        {
          parse_mode: 'HTML',
          reply_markup: approvalKeyboard(user.tg_user_id)
        }
      ).catch(() => null);

      return null;
    }

if (command === '/removeuser') {
  const target = String(args[0] || '').trim();

  if (!target) {
    await sendMessage(chatId, 'Format: /removeuser @username atau /removeuser 123456789');
    return { handled: true };
  }

  try {
    const removed = await removeUserByUsernameOrTelegramId(target);

    if (!removed) {
      await sendMessage(chatId, 'User tidak ditemukan.');
      return { handled: true };
    }

    await sendMessage(
      chatId,
      [
        '<b>User berhasil dihapus</b>',
        `Username: ${removed.username ? `@${escapeHtml(removed.username)}` : '-'}`,
        `Nama: ${escapeHtml(removed.full_name || '-')}`,
        `Telegram ID: <code>${removed.tg_user_id}</code>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await sendMessage(chatId, `Gagal hapus user: ${error.message}`);
  }

  return { handled: true };
}

    if (command === '/sendstock') {
  const username = String(args[0] || '').trim();
  const productCode = String(args[1] || '').trim();
  const qty = Number(args[2] || 0);

  if (!username || !productCode || !Number.isFinite(qty) || qty <= 0) {
    await sendMessage(chatId, 'Format: /sendstock @username kodeproduk qty\nContoh: /sendstock @ripnote 2 3');
    return { handled: true };
  }

  try {
    const targetUser = await getUserByUsername(username);
    if (!targetUser) {
      await sendMessage(chatId, 'User tidak ditemukan.');
      return { handled: true };
    }

    const result = await takeInventoryForManualSend(productCode, qty, targetUser.id);

    const lines = result.items.map((item, index) => `${index + 1}. ${item.content}`);

    await sendMessage(
      targetUser.tg_user_id,
      [
        '<b>Garansi / Pengganti Stock</b>',
        `Produk: <b>${escapeHtml(result.product.name)}</b>`,
        `Qty: <b>${qty}</b>`,
        '',
        ...lines
      ].join('\n'),
      { parse_mode: 'HTML' }
    );

    await sendMessage(
      chatId,
      [
        '<b>Stock berhasil dikirim</b>',
        `User: ${escapeHtml(username)}`,
        `Produk: <b>${escapeHtml(result.product.name)}</b>`,
        `Qty: <b>${qty}</b>`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await sendMessage(chatId, `Gagal kirim stock: ${error.message}`);
  }

  return { handled: true };
}

    if (command === '/showstock') {
  const productCode = String(args[0] || '').trim();

  if (!productCode) {
    await sendMessage(chatId, 'Format: /showstock 1');
    return { handled: true };
  }

  try {
    const result = await getAvailableInventoryByProductCode(productCode, 100);

    if (!result.items.length) {
      await sendMessage(
        chatId,
        [
          '<b>Stock kosong</b>',
          `Produk: <b>${escapeHtml(result.product.name)}</b>`,
          `Kode: <code>${escapeHtml(result.product.product_code)}</code>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
      return { handled: true };
    }

    const lines = result.items.map((item, index) => `${index + 1}. ${item.content}`);

    const text = [
      `<b>Show Stock</b>`,
      `Produk: <b>${escapeHtml(result.product.name)}</b>`,
      `Kode: <code>${escapeHtml(result.product.product_code)}</code>`,
      `Total tampil: <b>${result.items.length}</b>`,
      '',
      ...lines
    ].join('\n');

    const chunks = splitText(text, 3500);
    for (const chunk of chunks) {
      await sendMessage(chatId, chunk, { parse_mode: 'HTML' });
    }
  } catch (error) {
    await sendMessage(chatId, `Gagal show stock: ${error.message}`);
  }

  return { handled: true };
}
if (command === '/upload') {
  const uploadAllowed = await canUseUpload(from, message.chat);

  if (!uploadAllowed) {
    return sendMessage(chatId, 'Kamu tidak diizinkan memakai /upload di sini.');
  }

  await clearUserState(user.id);

  const productCode = String(args[0] || '').trim();

  if (!productCode) {
    return sendMessage(
      chatId,
      [
        '<b>Format upload stok</b>',
        '<code>/upload 1</code>',
        '<code>/upload 2</code>',
        '<code>/upload 3</code>',
        '',
        'Atau langsung upload:',
        '<code>/upload 3 email1@gmail.com:pass1</code>',
        '',
        'Untuk banyak item sekaligus:',
        '<code>/upload 3</code>',
        'Lalu kirim stok di pesan berikutnya, 1 baris = 1 item.'
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }

  const product = await getProductByCode(productCode);

  if (!product) {
    return sendMessage(
      chatId,
      `Produk dengan kode <code>${escapeHtml(productCode)}</code> tidak ditemukan.`,
      { parse_mode: 'HTML' }
    );
  }

  const inlineStockText = text.replace(/^\/upload(?:@\w+)?\s+\S+\s*/i, '').trim();

  if (inlineStockText) {
    const lines = inlineStockText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const count = await bulkInsertInventory(product.id, lines);
    const stockInfo = await getProductStockSummaryById(product.id);
    const availableStock = Number(stockInfo?.available_stock || 0);

    await notifyUsersProductRestock(
      product?.name || '-',
      count,
      availableStock
    );

    return sendMessage(
      chatId,
      [
        `✅ Berhasil upload ${count} item stok untuk <b>${escapeHtml(product.name)}</b>.`,
        `Stok sekarang: ${availableStock}`,
        availableStock >= RESTOCK_NOTIFY_MIN_STOCK
          ? 'Notifikasi user: dikirim'
          : `Notifikasi user: tidak dikirim (minimal stok ${RESTOCK_NOTIFY_MIN_STOCK})`
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }

  await setUserState(user.id, STATE_WAITING_UPLOAD_LINES, { productId: product.id }, 30);

  return sendMessage(
    chatId,
    [
      `<b>Upload stok untuk ${escapeHtml(product.name)}</b>`,
      `Kode produk: <code>${escapeHtml(productCode)}</code>`,
      '',
      'Kirim stok sekarang.',
      '1 baris = 1 item.'
    ].join('\n'),
    { parse_mode: 'HTML' }
  );
}
  
    if (command === '/start' || command === '/menu') {
      await clearUserState(user.id);
      return sendMainMenu(chatId, settings, isAdmin);
    }

    if (command === '/saldo') {
      return sendBalance(chatId, user, settings, isAdmin);
    }

    const adminHandled = await handleAdminCommand({
      command,
      args,
      from,
      chatId
    });

    if (adminHandled?.handled) {
      return null;
    }
  }

if (state?.state_key === STATE_WAITING_UPLOAD_LINES) {
  const uploadAllowed = await canUseUpload(from, message.chat);

  if (!uploadAllowed) {
    await clearUserState(user.id);
    return sendMessage(chatId, 'Kamu tidak diizinkan melanjutkan upload stok.');
  }

  const productId = state.payload?.productId;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!productId) {
    await clearUserState(user.id);
    return sendMessage(chatId, 'State upload hilang. Ketik /upload lagi.');
  }

  if (!lines.length) {
    return sendMessage(chatId, 'Tidak ada data stok yang dikirim.');
  }

  const count = await bulkInsertInventory(productId, lines);
  const product = await getProductById(productId);
  const stockInfo = await getProductStockSummaryById(productId);
  const availableStock = Number(stockInfo?.available_stock || 0);

  await notifyUsersProductRestock(
    product?.name || '-',
    count,
    availableStock
  );

  await clearUserState(user.id);

  return sendMessage(
    chatId,
    [
      `✅ Berhasil upload ${count} item stok.`,
      `Stok sekarang: ${availableStock}`,
      availableStock >= RESTOCK_NOTIFY_MIN_STOCK
        ? 'Notifikasi user: dikirim'
        : `Notifikasi user: tidak dikirim (minimal stok ${RESTOCK_NOTIFY_MIN_STOCK})`
    ].join('\n'),
    { reply_markup: mainMenuKeyboard(settings, isAdmin) }
  );
}
  if (message.chat.type !== 'private') {
    return null;
  }

  return handleUserText(message, user, settings, isAdmin);
}

export async function processPaymentWebhookEvent(event) {
  if (!event.reference) {
    throw new Error('Reference payment tidak ditemukan.');
  }

  const reference = event.reference;

  if (event.status === 'paid') {
    if (reference.startsWith('ORDPAY-')) {
      const orderPay = await getOrderPaymentByReference(reference);
      if (!orderPay) {
        throw new Error(`Order payment ${reference} tidak ditemukan.`);
      }

      if (String(orderPay.status).toLowerCase() === 'paid') {
        return { already_paid: true, reference };
      }

      const confirmed = await confirmDeposit(
        reference,
        event.providerReference,
        event.amount,
        event.raw
      );

      const tgUserId = orderPay.raw_response?.user?.tg_user_id;
      const productName =
        orderPay.raw_response?.product?.name || `Product #${orderPay.product_id}`;

      const result = await purchaseProduct(
        tgUserId,
        orderPay.product_id,
        orderPay.qty
      );
      const latestUser = await getUserByTelegramId(tgUserId);

      await updateOrderPaymentByReference(reference, {
        status: 'paid',
        raw_response: {
          ...(orderPay.raw_response || {}),
          payment_confirm: {
            providerReference: event.providerReference,
            amount: event.amount,
            raw: event.raw
          }
        }
      });

      const freshOrderPay = await getOrderPaymentByReference(reference);

      if (freshOrderPay?.telegram_chat_id && freshOrderPay?.telegram_message_id) {
        try {
          await deleteMessage(
            freshOrderPay.telegram_chat_id,
            freshOrderPay.telegram_message_id
          );
        } catch (error) {
          console.error('Gagal hapus pesan QR order:', error);
        }
      }

      await sendMessage(
        tgUserId,
        [
          '<b>Pembelian berhasil</b> ✅',
          `Order: <code>${escapeHtml(result.order_code)}</code>`,
          `Produk: ${escapeHtml(productName)}`,
          `Qty: <b>${orderPay.qty}</b>`,
          `Total: <b>${formatRupiah(result.total)}</b>`,
          `Sisa saldo: <b>${formatRupiah(latestUser?.balance || 0)}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      ).catch(() => null);

      const items = Array.isArray(result.items) ? result.items : [];
      const deliveryText = [
        result.delivery_note || '',
        result.delivery_note ? '' : null,
        `Data ${productName}:`,
        ...items.map((item, index) => `${index + 1}. ${item}`)
      ]
        .filter((value) => value !== null)
        .join('\n');

      for (const chunk of splitText(deliveryText, 3200)) {
        await sendMessage(tgUserId, chunk).catch(() => null);
      }

      await notifyAdminGroup(
        [
          '📷 <b>Order QRIS sukses</b>',
          `Ref: <code>${escapeHtml(reference)}</code>`,
          `Produk: ${escapeHtml(productName)}`,
          `Qty: <b>${orderPay.qty}</b>`,
          `Nominal: <b>${formatRupiah(confirmed.amount)}</b>`
        ].join('\n')
      );

      return {
        ok: true,
        reference,
        type: 'order_qris_paid',
        order_code: result.order_code
      };
    }

    const confirmed = await confirmDeposit(
      reference,
      event.providerReference,
      event.amount,
      event.raw
    );

    const freshDeposit = await getDepositByReference(reference);

    if (freshDeposit?.telegram_chat_id && freshDeposit?.telegram_message_id) {
      try {
        await deleteMessage(
          freshDeposit.telegram_chat_id,
          freshDeposit.telegram_message_id
        );
      } catch (error) {
        console.error('Gagal hapus pesan QR deposit:', error);
      }
    }

    if (!confirmed.already_paid && confirmed.tg_user_id) {
      await sendMessage(
        confirmed.tg_user_id,
        [
          '<b>Deposit berhasil</b> ✅',
          `Ref: <code>${escapeHtml(confirmed.reference)}</code>`,
          `Nominal masuk: <b>${formatRupiah(confirmed.amount)}</b>`
        ].join('\n'),
        { parse_mode: 'HTML' }
      ).catch(() => null);
    }

    await notifyAdminGroup(
      [
        '✅ <b>Deposit lunas</b>',
        `Ref: <code>${escapeHtml(confirmed.reference)}</code>`,
        `Nominal: <b>${formatRupiah(confirmed.amount)}</b>`
      ].join('\n')
    );

    return confirmed;
  }

  if (reference.startsWith('ORDPAY-')) {
    await updateOrderPaymentByReference(reference, {
      status: ['expired', 'failed', 'cancelled'].includes(event.status)
        ? event.status
        : 'pending',
      raw_response: {
        ...(await getOrderPaymentByReference(reference))?.raw_response,
        payment_status: event.status,
        payment_raw: event.raw,
        provider_ref: event.providerReference
      }
    });
  }

  await updateDepositByReference(reference, {
    status: ['expired', 'failed', 'cancelled'].includes(event.status)
      ? event.status
      : 'pending',
    provider_ref: event.providerReference,
    raw_response: event.raw
  });

  return { ok: true, reference, status: event.status };
}
