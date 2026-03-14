import { NextResponse } from 'next/server';
import { getCookieName } from '@/lib/auth';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set({
    name: getCookieName(),
    value: '',
    path: '/',
    maxAge: 0
  });
  return response;
}
