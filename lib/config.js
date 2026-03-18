function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value)),
  adminGroupChatId: Number(process.env.ADMIN_GROUP_CHAT_ID || 0),
  dashboardEmail: process.env.DASHBOARD_EMAIL || 'admin@example.com',
  dashboardPassword: process.env.DASHBOARD_PASSWORD || 'changeme',
  dashboardSecret: process.env.DASHBOARD_SECRET || 'please-change-this-secret',
  fakerEmailApiKey: process.env.FAKER_EMAIL_API_KEY || process.env.DASHBOARD_SECRET || 'please-change-this-secret',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'dummy',
  paymentApiBaseUrl: process.env.PAYMENT_API_BASE_URL || '',
  paymentProjectSlug: process.env.PAYMENT_PROJECT_SLUG || '',
  pakasirProjectSlug: process.env.PAKASIR_PROJECT_SLUG || '',
  pakasirApiKey: process.env.PAKASIR_API_KEY || process.env.PAYMENT_API_KEY || '',
  pakasirPaymentMethod: process.env.PAKASIR_PAYMENT_METHOD || 'qris',
  pakasirRedirectUrl: process.env.PAKASIR_REDIRECT_URL || '',
  pakasirQrisOnly: process.env.PAKASIR_QRIS_ONLY || '1',
  paymentApiKey: process.env.PAYMENT_API_KEY || '',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'IDR',
  defaultMinDeposit: Number(process.env.DEFAULT_MIN_DEPOSIT || 10000),
  nodeEnv: process.env.NODE_ENV || 'development'
};

export function assertServerEnv() {
  required('SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY');
  required('TELEGRAM_BOT_TOKEN');
}

export function isAdminTelegramId(tgId) {
  return env.adminTelegramIds.includes(Number(tgId));
}
