import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { processTelegramUpdate } from '@/lib/bot/handlers';

export async function POST(request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (env.telegramWebhookSecret && secret !== env.telegramWebhookSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const update = await request.json();
    await processTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
