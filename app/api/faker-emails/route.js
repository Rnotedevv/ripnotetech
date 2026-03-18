import { NextResponse } from 'next/server';
import { reserveFakerEmail } from '@/lib/db';
import { env } from '@/lib/config';
import { ensureDashboardRequest, redirectWithMessage } from '@/lib/dashboard-route';

function normalizePayload(input = {}) {
  return {
    email: String(input.email || '').trim().toLowerCase(),
    source: String(input.source || 'extension').trim() || 'extension',
    licenseKey: String(input.licenseKey || '').trim() || null,
    siteHost: String(input.siteHost || '').trim() || null,
    notes: String(input.notes || '').trim() || null
  };
}

function isApiKeyAllowed(request) {
  const token = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(token) && token === env.fakerEmailApiKey;
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    if (!isApiKeyAllowed(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = normalizePayload(await request.json());
      const row = await reserveFakerEmail(body);
      return NextResponse.json({ ok: true, data: row });
    } catch (error) {
      const status = /sudah pernah dipakai/i.test(error.message) ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
  }

  const auth = ensureDashboardRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirectTo') || '/dashboard/faker-emails');

  try {
    const payload = normalizePayload({
      email: formData.get('email'),
      source: formData.get('source'),
      licenseKey: formData.get('licenseKey'),
      siteHost: formData.get('siteHost'),
      notes: formData.get('notes')
    });

    await reserveFakerEmail(payload);
    return redirectWithMessage(request, redirectTo, 'ok', 'Email faker berhasil disimpan dan dikunci agar tidak double.');
  } catch (error) {
    return redirectWithMessage(request, redirectTo, 'error', error.message);
  }
}
