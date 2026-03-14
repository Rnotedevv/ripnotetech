import { absoluteUrl } from '@/lib/utils';

export function mainMenuKeyboard(settings, isAdmin = false) {
  const keyboard = [
    [settings.menu_buy_label, settings.menu_deposit_label],
    [settings.menu_products_label, settings.menu_stock_label],
    [settings.menu_warranty_label, settings.menu_balance_label]
  ];

  if (isAdmin) {
    keyboard.push(['🧰 Admin']);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true
  };
}

export function productListInlineKeyboard(products = []) {
  const rows = [];
  for (let index = 0; index < products.length; index += 2) {
    const chunk = products.slice(index, index + 2).map((product, offset) => ({
      text: `${index + offset + 1}. ${product.name}`,
      callback_data: `select_product:${product.id}`
    }));
    rows.push(chunk);
  }

  rows.push([{ text: 'Batal', callback_data: 'cancel_action' }]);
  return { inline_keyboard: rows };
}

export function confirmPurchaseKeyboard(productId, qty) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Konfirmasi', callback_data: `confirm_buy:${productId}:${qty}` },
        { text: '❌ Batal', callback_data: 'cancel_action' }
      ]
    ]
  };
}

export function depositKeyboard(reference, payUrl = '') {
  const rows = [];
  if (payUrl) {
    rows.push([{ text: 'Bayar Sekarang', url: payUrl }]);
  }
  rows.push([{ text: 'Cek Status', callback_data: `check_deposit:${reference}` }]);
  return { inline_keyboard: rows };
}

export function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Buka Dashboard Web', url: absoluteUrl('/dashboard') }],
      [{ text: 'Set Webhook Telegram', url: absoluteUrl('/dashboard?setWebhook=1') }]
    ]
  };
}
