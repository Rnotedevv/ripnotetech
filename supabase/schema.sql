create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists app_settings (
  singleton boolean primary key default true check (singleton),
  shop_name text not null default 'Auto Store Telegram',
  welcome_text text not null default 'Selamat datang di Auto Store. Pilih menu di bawah untuk mulai beli produk, cek stok, atau top up saldo.',
  support_text text not null default 'Butuh bantuan? Hubungi admin.',
  currency text not null default 'IDR',
  min_deposit bigint not null default 10000,
  menu_buy_label text not null default '🛒 Beli Qty',
  menu_deposit_label text not null default '💳 Deposit',
  menu_stock_label text not null default '📦 Cek Stok',
  menu_products_label text not null default '📋 List Produk',
  menu_warranty_label text not null default '🛡 Garansi',
  menu_balance_label text not null default '👤 Saldo Saya',
  updated_at timestamptz not null default now()
);

insert into app_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tg_user_id bigint unique not null,
  username text,
  full_name text,
  first_name text,
  last_name text,
  balance bigint not null default 0 check (balance >= 0),
  is_banned boolean not null default false,
  total_orders bigint not null default 0,
  total_spent bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null,
  name text not null,
  description text,
  delivery_note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  min_qty integer not null check (min_qty > 0),
  max_qty integer check (max_qty is null or max_qty >= min_qty),
  unit_price bigint not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  user_id uuid not null references users(id) on delete restrict,
  total_amount bigint not null,
  status text not null default 'paid' check (status in ('paid', 'cancelled', 'refunded')),
  payment_source text not null default 'balance',
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  total bigint not null check (total >= 0),
  delivery_note text not null default ''
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  content text not null,
  status text not null default 'available' check (status in ('available', 'sold', 'warranty_hold', 'replaced')),
  sold_order_item_id uuid references order_items(id) on delete set null,
  sold_to_user_id uuid references users(id) on delete set null,
  sold_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inventory_status_idx on inventory_items(product_id, status, created_at);

create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id uuid not null references users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed', 'cancelled')),
  provider text not null default 'dummy',
  provider_ref text,
  qr_string text,
  qr_url text,
  pay_url text,
  raw_response jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deposits_status_idx on deposits(status, created_at desc);

create table if not exists warranty_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  email text not null,
  issue_note text,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_states (
  user_id uuid primary key references users(id) on delete cascade,
  state_key text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id bigint generated by default as identity primary key,
  user_id uuid references users(id) on delete set null,
  activity_type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  admin_tg_user_id bigint,
  amount_delta bigint not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists broadcast_jobs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  parse_mode text not null default 'HTML',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_user_cursor bigint,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

drop trigger if exists app_settings_updated_at on app_settings;
create trigger app_settings_updated_at
before update on app_settings
for each row execute function set_updated_at();

drop trigger if exists users_updated_at on users;
create trigger users_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
before update on products
for each row execute function set_updated_at();

drop trigger if exists deposits_updated_at on deposits;
create trigger deposits_updated_at
before update on deposits
for each row execute function set_updated_at();

drop trigger if exists warranty_requests_updated_at on warranty_requests;
create trigger warranty_requests_updated_at
before update on warranty_requests
for each row execute function set_updated_at();

drop trigger if exists user_states_updated_at on user_states;
create trigger user_states_updated_at
before update on user_states
for each row execute function set_updated_at();

create or replace view product_stock_summary as
select
  p.id,
  p.product_code,
  p.name,
  p.description,
  p.delivery_note,
  p.is_active,
  p.created_at,
  count(i.*) filter (where i.status = 'available')::int as available_stock
from products p
left join inventory_items i on i.product_id = p.id
group by p.id;

create or replace view dashboard_kpis as
select
  (select count(*)::bigint from users) as total_users,
  (select count(*)::bigint from orders where status = 'paid') as total_paid_orders,
  (select coalesce(sum(total_amount), 0)::bigint from orders where status = 'paid') as total_revenue,
  (select count(*)::bigint from deposits where status = 'paid') as total_paid_deposits,
  (select coalesce(sum(amount), 0)::bigint from deposits where status = 'paid') as total_deposit_amount;

create or replace function get_unit_price(p_product_id uuid, p_qty integer)
returns bigint
language plpgsql
stable
as $$
declare
  v_price bigint;
begin
  select unit_price
  into v_price
  from product_price_tiers
  where product_id = p_product_id
    and p_qty >= min_qty
    and (max_qty is null or p_qty <= max_qty)
  order by min_qty desc
  limit 1;

  if v_price is null then
    raise exception 'Tier harga tidak ditemukan untuk qty %', p_qty;
  end if;

  return v_price;
end;
$$;

create or replace function purchase_product(
  p_user_tg_id bigint,
  p_product_id uuid,
  p_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_product products%rowtype;
  v_unit_price bigint;
  v_total bigint;
  v_available integer;
  v_order_id uuid;
  v_order_item_id uuid;
  v_order_code text;
  v_items text[];
begin
  if p_qty <= 0 then
    raise exception 'Qty harus lebih dari 0';
  end if;

  select * into v_user from users where tg_user_id = p_user_tg_id for update;
  if not found then
    raise exception 'User tidak ditemukan';
  end if;

  select * into v_product from products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Produk tidak ditemukan atau nonaktif';
  end if;

  select count(*)::int into v_available
  from inventory_items
  where product_id = p_product_id and status = 'available';

  if v_available < p_qty then
    raise exception 'Stok tidak cukup';
  end if;

  v_unit_price := get_unit_price(p_product_id, p_qty);
  v_total := v_unit_price * p_qty;

  if v_user.balance < v_total then
    raise exception 'Saldo tidak cukup';
  end if;

  update users
  set
    balance = balance - v_total,
    total_orders = total_orders + 1,
    total_spent = total_spent + v_total,
    updated_at = now()
  where id = v_user.id;

  v_order_code := 'ORD-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into orders (order_code, user_id, total_amount, status, payment_source)
  values (v_order_code, v_user.id, v_total, 'paid', 'balance')
  returning id into v_order_id;

  insert into order_items (order_id, product_id, qty, unit_price, total, delivery_note)
  values (v_order_id, p_product_id, p_qty, v_unit_price, v_total, coalesce(v_product.delivery_note, ''))
  returning id into v_order_item_id;

  with picked as (
    select id, content
    from inventory_items
    where product_id = p_product_id and status = 'available'
    order by created_at asc
    for update skip locked
    limit p_qty
  ), updated as (
    update inventory_items i
    set
      status = 'sold',
      sold_order_item_id = v_order_item_id,
      sold_to_user_id = v_user.id,
      sold_at = now()
    from picked
    where i.id = picked.id
    returning picked.content
  )
  select array_agg(content) into v_items from updated;

  if v_items is null or array_length(v_items, 1) <> p_qty then
    raise exception 'Gagal mengambil stok';
  end if;

  insert into activity_logs (user_id, activity_type, message, payload)
  values (
    v_user.id,
    'purchase',
    'User membeli produk',
    jsonb_build_object(
      'order_code', v_order_code,
      'product_id', p_product_id,
      'qty', p_qty,
      'total', v_total
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_code', v_order_code,
    'total', v_total,
    'unit_price', v_unit_price,
    'delivery_note', coalesce(v_product.delivery_note, ''),
    'items', to_jsonb(v_items)
  );
end;
$$;

create or replace function confirm_deposit(
  p_reference text,
  p_provider_ref text,
  p_amount bigint,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit deposits%rowtype;
  v_tg_user_id bigint;
begin
  select * into v_deposit from deposits where reference = p_reference for update;
  if not found then
    raise exception 'Deposit tidak ditemukan';
  end if;

  if v_deposit.amount <> p_amount then
    raise exception 'Nominal deposit tidak cocok';
  end if;

  select tg_user_id into v_tg_user_id from users where id = v_deposit.user_id;

  if v_deposit.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'reference', v_deposit.reference,
      'amount', v_deposit.amount,
      'tg_user_id', v_tg_user_id
    );
  end if;

  update deposits
  set
    status = 'paid',
    provider_ref = coalesce(p_provider_ref, provider_ref),
    raw_response = coalesce(p_raw, raw_response),
    paid_at = now(),
    updated_at = now()
  where id = v_deposit.id;

  update users
  set
    balance = balance + v_deposit.amount,
    updated_at = now()
  where id = v_deposit.user_id;

  insert into activity_logs (user_id, activity_type, message, payload)
  values (
    v_deposit.user_id,
    'deposit_paid',
    'Deposit dibayar',
    jsonb_build_object(
      'reference', v_deposit.reference,
      'amount', v_deposit.amount,
      'provider_ref', p_provider_ref
    )
  );

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'reference', v_deposit.reference,
    'amount', v_deposit.amount,
    'tg_user_id', v_tg_user_id
  );
end;
$$;

create or replace function adjust_balance_by_username(
  p_username text,
  p_delta bigint,
  p_reason text default null,
  p_admin_tg_user_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_lookup text;
begin
  v_lookup := replace(lower(coalesce(p_username, '')), '@', '');

  select * into v_user
  from users
  where lower(coalesce(username, '')) = v_lookup
  for update;

  if not found then
    raise exception 'User tidak ditemukan';
  end if;

  if v_user.balance + p_delta < 0 then
    raise exception 'Saldo user tidak boleh minus';
  end if;

  update users
  set balance = balance + p_delta, updated_at = now()
  where id = v_user.id
  returning * into v_user;

  insert into balance_adjustments (user_id, admin_tg_user_id, amount_delta, reason)
  values (v_user.id, p_admin_tg_user_id, p_delta, p_reason);

  insert into activity_logs (user_id, activity_type, message, payload)
  values (
    v_user.id,
    'balance_adjustment',
    'Admin mengubah saldo',
    jsonb_build_object('delta', p_delta, 'reason', coalesce(p_reason, ''))
  );

  return jsonb_build_object(
    'ok', true,
    'username', v_user.username,
    'balance', v_user.balance,
    'tg_user_id', v_user.tg_user_id
  );
end;
$$;

alter table app_settings enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table product_price_tiers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_items enable row level security;
alter table deposits enable row level security;
alter table warranty_requests enable row level security;
alter table user_states enable row level security;
alter table activity_logs enable row level security;
alter table balance_adjustments enable row level security;
alter table broadcast_jobs enable row level security;
