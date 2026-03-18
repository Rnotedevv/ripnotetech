create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  status text not null default 'unused' check (status in ('unused', 'activated', 'expired', 'revoked')),
  duration_days integer not null default 1 check (duration_days > 0),
  activated_device_id text,
  activated_by text,
  notes text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists licenses_status_idx on licenses(status, created_at desc);
create index if not exists licenses_expires_idx on licenses(expires_at);

create or replace function activate_license_once(
  p_license_key text,
  p_device_id text default null,
  p_activated_by text default null
)
returns licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license licenses%rowtype;
begin
  update licenses
  set status = 'expired', updated_at = now()
  where status = 'activated'
    and expires_at is not null
    and expires_at < now();

  select *
  into v_license
  from licenses
  where license_key = trim(p_license_key)
  limit 1;

  if not found then
    raise exception 'License tidak ditemukan';
  end if;

  if v_license.status = 'revoked' then
    raise exception 'License sudah direvoke';
  end if;

  if v_license.status = 'expired' then
    raise exception 'License sudah expired';
  end if;

  if v_license.status = 'activated' then
    raise exception 'License sudah pernah dipakai';
  end if;

  update licenses
  set status = 'activated',
      activated_at = now(),
      expires_at = now() + make_interval(days => greatest(v_license.duration_days, 1)),
      activated_device_id = nullif(trim(p_device_id), ''),
      activated_by = nullif(trim(p_activated_by), ''),
      updated_at = now()
  where id = v_license.id
  returning * into v_license;

  return v_license;
end;
$$;

drop trigger if exists licenses_updated_at on licenses;
create trigger licenses_updated_at
before update on licenses
for each row execute function set_updated_at();
