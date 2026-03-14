import { env } from '@/lib/config';

function apiUrl(method) {
  return `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;
}

async function telegramCall(method, payload, isFormData = false) {
  const response = await fetch(apiUrl(method), {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? payload : JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error: ${method}`);
  }
  return data.result;
}

export async function setTelegramWebhook(url) {
  return telegramCall('setWebhook', {
    url,
    secret_token: env.telegramWebhookSecret,
    allowed_updates: ['message', 'callback_query']
  });
}

export async function sendMessage(chatId, text, extra = {}) {
  return telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    ...extra
  });
}

export async function editMessageText(chatId, messageId, text, extra = {}) {
  return telegramCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...extra
  });
}

export async function answerCallbackQuery(callbackQueryId, text = '') {
  return telegramCall('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false
  });
}

export async function sendPhotoBuffer(chatId, buffer, filename = 'qris.png', extra = {}) {
  const formData = new FormData();
  formData.set('chat_id', String(chatId));
  formData.set('photo', new Blob([buffer]), filename);

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  return telegramCall('sendPhoto', formData, true);
}

export async function notifyAdminGroup(text, extra = {}) {
  if (!env.adminGroupChatId) return null;
  return sendMessage(env.adminGroupChatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra
  }).catch(() => null);
}
