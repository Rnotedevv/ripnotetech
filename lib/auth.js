import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/config';

const COOKIE_NAME = 'autostore_dashboard_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function sign(payload) {
  return crypto
    .createHmac('sha256', env.dashboardSecret)
    .update(payload)
    .digest('base64url');
}

export function createSessionToken(email) {
  const payload = JSON.stringify({
    email,
    exp: Date.now() + SESSION_MAX_AGE * 1000
  });
  const encoded = base64url(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    const expected = sign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const decoded = JSON.parse(decodeBase64url(payload));
    if (!decoded?.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getDashboardCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE
  };
}

export async function getDashboardSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export function getSessionFromRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getCookieName() {
  return COOKIE_NAME;
}
