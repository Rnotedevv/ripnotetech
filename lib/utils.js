export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta'
  }).format(date);
}

export function parseMoney(value) {
  const normalized = String(value || '')
    .replace(/[^0-9-]/g, '')
    .trim();
  return Number(normalized || 0);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function splitText(text = '', limit = 3500) {
  const lines = String(text).split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > limit) {
      if (current) chunks.push(current.trim());
      current = line;
      continue;
    }
    current += `${current ? '\n' : ''}${line}`;
  }

  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [''];
}

export function toSlug(input = '') {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function absoluteUrl(pathname = '') {
  const url = new URL(pathname, process.env.APP_URL || 'http://localhost:3000');
  return url.toString();
}

export function buildRedirect(basePath, params = {}) {
  const url = new URL(basePath, 'http://localhost');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname}${url.search}`;
}
