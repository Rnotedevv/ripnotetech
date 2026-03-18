create table if not exists used_faker_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'extension',
  license_key text,
  site_host text,
  notes text,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_used_faker_emails_used_at
  on used_faker_emails (used_at desc);

create index if not exists idx_used_faker_emails_source
  on used_faker_emails (source);
