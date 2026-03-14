import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export function ensureDashboardRequest(request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.redirect(new URL('/login', request.url))
    };
  }

  return { ok: true, session };
}

export function redirectWithMessage(request, redirectTo, key, message) {
  const url = new URL(redirectTo || '/dashboard', request.url);
  if (message) {
    url.searchParams.set(key, message);
  }
  return NextResponse.redirect(url);
}
