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

export function productListInlineKeyboard(products) {
  const buttons = products.map((product, index) => ({
    text: String(index + 1),
    callback_data: `select_product:${product.id}`
  }));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }

  rows.push([{ text: 'Batal', callback_data: 'buy_cancel' }]);

  return {
    inline_keyboard: rows
  };
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

export function depositKeyboard(reference, payUrl) {
  return {
    inline_keyboard: [
      [{ text: BUTTON_TEXT.checkStatus, callback_data: `check_deposit:${reference}` }],
      [{ text: BUTTON_TEXT.cancel, callback_data: `cancel_action:${reference}` }]
    ].filter((row) => row.length > 0)
  };
}
export function adminKeyboard() {
  return {
    inline_keyboard: []
  };
}
