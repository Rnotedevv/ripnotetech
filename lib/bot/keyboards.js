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
    callback_data: `buy_${product.id}`
  }));

  const inline_keyboard = [];
  for (let i = 0; i < buttons.length; i += 4) {
    inline_keyboard.push(buttons.slice(i, i + 4));
  }

  inline_keyboard.push([
    { text: 'Batal', callback_data: 'cancel' }
  ]);

  return { inline_keyboard };
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
