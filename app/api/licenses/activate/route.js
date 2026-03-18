import { activateLicenseOnline } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const licenseKey = String(body?.licenseKey || '').trim();
    const deviceId = String(body?.deviceId || '').trim();
    const activatedBy = String(body?.activatedBy || '').trim();

    if (!licenseKey) {
      return Response.json({ ok: false, reason: 'empty_key' }, { status: 400 });
    }

    const result = await activateLicenseOnline({ licenseKey, deviceId, activatedBy });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return Response.json({ ok: false, reason: 'server_error', message: error.message || 'Server error' }, { status: 500 });
  }
}
