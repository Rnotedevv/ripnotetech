import { NextResponse } from 'next/server';
import { createSessionToken, getDashboardCookieOptions } from '@/lib/auth';
import { env } from '@/lib/config';

export async function POST(request) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (email !== env.dashboardEmail.toLowerCase() || password !== env.dashboardPassword) {
    return NextResponse.redirect(new URL('/login?error=Email%20atau%20password%20salah', request.url));
  }

  const token = createSessionToken(email);
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set({
    ...getDashboardCookieOptions(),
    value: token
  });
  return response;
}
