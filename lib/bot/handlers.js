import QRCode from 'qrcode';
import { env, isAdminTelegramId } from '@/lib/config';
import {
  adjustBalanceByUsername,
  clearUserState,
  confirmDeposit,
  createDeposit,
  createOrderPayment,
  createWarrantyRequest,
  ensureTelegramUser,
  getActiveProductsWithStock,
  getDashboardKpis,
  getDepositByReference,
  getOrderPaymentByReference,
  getProductById,
  bulkInsertInventory,
  getProductPriceTiers,
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
const STATE_WAITING_UPLOAD_PRODUCT = 'waiting_upload_product';
const STATE_WAITING_UPLOAD_LINES = 'waiting_upload_lines';

function parseCommand(text = '') {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  return { command, args: rest };
}

async function sendMainMenu(chatId, settings, isAdmin, extraText = '') {
  const text = [
    `<b>${escapeHtml(settings.shop_name)}</b>`,
    '',
    escapeHtml(extraText || settings.welcome_text),
    '',
    'Saldo dan pembelian otomatis tersedia 24/7.'
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
    '<b>List Product</b>',
    '',
    ...products.map(
      (product, index) =>
        `${index + 1}. <b>${escapeHtml(product.name)}</b>\n   Kode: <code>${escapeHtml(product.product_code)}</code>\n   Stok: <b>${product.available_stock}</b>`
    ),
    '',
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
    '<b>Stok Saat Ini</b>',
    '',
    ...(products.length
      ? products.map((product, index) => `${index + 1}. ${escapeHtml(product.name)} — <b>${product.available_stock}</b> ready`)
      : ['Belum ada produk aktif.'])
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
  const tiers = await getProductPriceTiers(productId);

  if (!product) {
    return sendMessage(chatId, 'Produk tidak ditemukan.');
  }

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
          [
            { text: BUTTON_TEXT.cancel, callback_data: 'buy_cancel' }
          ]
        ]
      }
    }
  );
}

async function finalizePurchase(chatId, tgUserId, productId, qty) {
  console.log('finalizePurchase', {
    tgUserId,
    productId,
    qty,
    productIdType: typeof productId
  });

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

    await notifyGroup(
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

  const matchedTier = [...tiers]
    .sort((a, b) => b.min_qty - a.min_qty)
    .find((tier) => qty >= tier.min_qty && (!tier.max_qty || qty <= tier.max_qty));

  if (!matchedTier) {
    return sendMessage(chatId, 'Harga untuk qty tersebut belum diatur .');
  }

  const total = Number(matchedTier.unit_price) * Number(qty);
  const reference = `ORDPAY-${Date.now()}-${user.tg_user_id}`;

  const payment = await createPaymentIntent({
    reference,
    amount: total,
    user,
    description: `Pembayaran order ${product.name} x${qty}`
  });

  // order payment record
  await createOrderPayment({
    reference,
    user_id: user.id,
    product_id: productId,
    qty,
    amount: total,
    status: 'pending',
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

  // shadow deposit agar saat paid bisa confirmDeposit -> tambah saldo -> auto purchase
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
            [{ text: BUTTON_TEXT.cancel, callback_data: 'buy_cancel' }]
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
            [{ text: BUTTON_TEXT.cancel, callback_data: 'buy_cancel' }]
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
          [{ text: BUTTON_TEXT.cancel, callback_data: 'buy_cancel' }]
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

  await notifyGroup(
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

async function submitWarranty(chatId, user, email, settings, is) {
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

  await notifyGroup(
    [
      '🛡 <b>Request garansi baru</b>',
      `User: ${escapeHtml(user.full_name || user.username || 'User')}`,
      `Username: ${escapeHtml(user.username ? `@${user.username}` : '-')}`,
      `Email bermasalah: <code>${escapeHtml(email)}</code>`
    ].join('\n')
  );

  return sendMessage(
    chatId,
    'Request garansi sudah diteruskan ke . Mohon tunggu proses pengecekan.',
    {
      reply_markup: mainMenuKeyboard(settings, isAdmin)
    }
  );
}

async function handleAdminCommand({ command, args, from, chatId }) {
  if (!isAdminTelegramId(from.id)) {
    return { handled: false };
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
    {
      parse_mode: 'HTML'
    }
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
    const qty = Number(text.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(qty) || qty <= 0) {
      return sendMessage(chatId, 'Masukkan qty yang valid, misalnya 1, 2, atau 10.');
    }

    await clearUserState(user.id);
    return showBuyConfirmation(chatId, user, qty, state.payload.productId);
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

  if (data.startsWith('select_product:')) {
    const productId = data.split(':')[1];
    await answerCallbackQuery(callbackQuery.id, 'Masukkan qty pembelian');
    return askForQty(chatId, user.id, productId);
  }

  // legacy support
  if (data.startsWith('confirm_buy:')) {
    const [, productId, qty] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, 'Pembelian diproses');
    return finalizePurchase(chatId, from.id, Number(productId), Number(qty));
  }

if (data.startsWith('buy_balance:')) {
  const [, productId, qty] = data.split(':');
  await answerCallbackQuery(callbackQuery.id, 'Pembelian diproses');
  return finalizePurchase(chatId, from.id, productId, Number(qty));
}

if (data.startsWith('buy_qris:')) {
  const [, productId, qty] = data.split(':');
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
  
  if (data === 'buy_cancel' || data === 'cancel_action') {
    await clearUserState(user.id);
    await answerCallbackQuery(callbackQuery.id, 'Aksi dibatalkan');
    return sendMessage(chatId, 'Aksi dibatalkan.', {
      reply_markup: mainMenuKeyboard(await getSettings(), isAdminTelegramId(from.id))
    });
  }

  return answerCallbackQuery(callbackQuery.id, 'Aksi tidak dikenal');
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
  const isAdmin = isAdminTelegramId(from.id);
  const user = await ensureTelegramUser(from);
  const text = String(message.text || '').trim();

  if (text.startsWith('/')) {
    const { command, args } = parseCommand(text);

     if (text === '/upload' && isAdmin) {
  await clearUserState(user.id);
  await setUserState(user.id, STATE_WAITING_UPLOAD_PRODUCT, {}, 30);
  return sendMessage(
    chatId,
    'Masukkan Product ID yang ingin diupload stoknya.',
    { reply_markup: mainMenuKeyboard(settings, isAdmin) }
  );
}

    if (command === '/start' || command === '/menu') {
      await clearUserState(user.id);
      return sendMainMenu(message.chat.id, settings, isAdmin);
    }

    if (command === '/saldo') {
      return sendBalance(message.chat.id, user, settings, isAdmin);
    }

    const adminHandled = await handleAdminCommand({ command, args, from, chatId: message.chat.id });
    if (adminHandled?.handled) {
      return null;
    }
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
    // ORDER QRIS
    if (reference.startsWith('ORDPAY-')) {
      const orderPay = await getOrderPaymentByReference(reference);
      if (!orderPay) {
        throw new Error(`Order payment ${reference} tidak ditemukan.`);
      }

      if (String(orderPay.status).toLowerCase() === 'paid') {
        return { already_paid: true, reference };
      }

      // confirm shadow deposit -> saldo user bertambah
      const confirmed = await confirmDeposit(
        reference,
        event.providerReference,
        event.amount,
        event.raw
      );

      const tgUserId = orderPay.raw_response?.user?.tg_user_id;
      const productName = orderPay.raw_response?.product?.name || `Product #${orderPay.product_id}`;

      // lalu langsung potong untuk beli produk
      const result = await purchaseProduct(tgUserId, orderPay.product_id, orderPay.qty);
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

    // DEPOSIT NORMAL
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


if (state?.state_key === STATE_WAITING_UPLOAD_PRODUCT && isAdmin) {
  const productId = text.trim();

  if (!productId) {
    return sendMessage(chatId, 'Product ID tidak valid.');
  }

  const product = await getProductById(productId);
  if (!product) {
    return sendMessage(chatId, 'Product tidak ditemukan. Masukkan Product ID yang valid.');
  }

  await setUserState(
    user.id,
    STATE_WAITING_UPLOAD_LINES,
    { productId },
    30
  );

  return sendMessage(
    chatId,
    `Kirim stok untuk product <b>${product.name}</b>.\n\nSatu item per baris.`,
    { parse_mode: 'HTML' }
  );
}

if (state?.state_key === STATE_WAITING_UPLOAD_LINES && isAdmin) {
  const productId = state.payload?.productId;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return sendMessage(chatId, 'Tidak ada data stok yang dikirim.');
  }

  const count = await bulkInsertInventory(productId, lines);
  await clearUserState(user.id);

  return sendMessage(
    chatId,
    `Berhasil upload ${count} item stok.`,
    { reply_markup: mainMenuKeyboard(settings, isAdmin) }
  );
}
  
  if (reference.startsWith('ORDPAY-')) {
    await updateOrderPaymentByReference(reference, {
      status: ['expired', 'failed', 'cancelled'].includes(event.status) ? event.status : 'pending',
      raw_response: {
        ...(await getOrderPaymentByReference(reference))?.raw_response,
        payment_status: event.status,
        payment_raw: event.raw,
        provider_ref: event.providerReference
      }
    });
  }

  await updateDepositByReference(reference, {
    status: ['expired', 'failed', 'cancelled'].includes(event.status) ? event.status : 'pending',
    provider_ref: event.providerReference,
    raw_response: event.raw
  });

  return { ok: true, reference, status: event.status };
}
