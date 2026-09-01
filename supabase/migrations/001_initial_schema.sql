create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'INDIVIDUAL'
    check (role in ('INDIVIDUAL','CHAMA_MEMBER','CHAMA_ADMIN','BUSINESS_OWNER','PLATFORM_ADMIN')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('INCOME','EXPENSE','TRANSFER')),
  color text default '#10B981',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null default 'M-Pesa',
  category text not null default 'Other',
  amount numeric(12,2) not null check (amount >= 0),
  direction text not null check (direction in ('INCOME','EXPENSE','TRANSFER')),
  source text not null default 'MANUAL' check (source in ('MPESA','CASH','BANK','SALARY','BUSINESS','CHAMA','OTHER','MANUAL','IMPORT')),
  description text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  business_type text,
  location text,
  currency text not null default 'KES',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  unit text,
  buying_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  min_stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sold_by uuid references public.profiles(id),
  total_amount numeric(12,2) not null default 0,
  payment_method text not null default 'CASH' check (payment_method in ('CASH','MPESA','BANK','CREDIT','OTHER')),
  sale_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.business_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.business_sales(id) on delete cascade,
  product_id uuid not null references public.business_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.chamas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  contribution_amount numeric(12,2) not null default 0,
  contribution_frequency text not null default 'MONTHLY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chama_members (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('CHAIRPERSON','TREASURER','SECRETARY','MEMBER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PENDING','LEFT')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (chama_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'GENERAL',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger if not exists set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger if not exists set_businesses_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create trigger if not exists set_business_products_updated_at
before update on public.business_products
for each row execute function public.set_updated_at();

create trigger if not exists set_chamas_updated_at
before update on public.chamas
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.businesses enable row level security;
alter table public.business_products enable row level security;
alter table public.business_sales enable row level security;
alter table public.business_sale_items enable row level security;
alter table public.chamas enable row level security;
alter table public.chama_members enable row level security;
alter table public.notifications enable row level security;

create policy if not exists "profiles_select_own_record" on public.profiles
for select using (auth.uid() = id);
create policy if not exists "profiles_insert_own_record" on public.profiles
for insert with check (auth.uid() = id);
create policy if not exists "profiles_update_own_record" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);
create policy if not exists "profiles_delete_own_record" on public.profiles
for delete using (auth.uid() = id);

create policy if not exists "transactions_own_record" on public.transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "categories_own_record" on public.categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "businesses_own_record" on public.businesses
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy if not exists "business_products_own_record" on public.business_products
for all using (
  exists (select 1 from public.businesses where businesses.id = business_products.business_id and businesses.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses where businesses.id = business_products.business_id and businesses.owner_id = auth.uid())
);

create policy if not exists "business_sales_own_record" on public.business_sales
for all using (
  exists (select 1 from public.businesses where businesses.id = business_sales.business_id and businesses.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses where businesses.id = business_sales.business_id and businesses.owner_id = auth.uid())
);

create policy if not exists "business_sale_items_own_record" on public.business_sale_items
for all using (
  exists (
    select 1
    from public.business_sales
    join public.businesses on businesses.id = business_sales.business_id
    where business_sales.id = business_sale_items.sale_id and businesses.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.business_sales
    join public.businesses on businesses.id = business_sales.business_id
    where business_sales.id = business_sale_items.sale_id and businesses.owner_id = auth.uid()
  )
);

create policy if not exists "chamas_own_record" on public.chamas
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy if not exists "chama_members_own_record" on public.chama_members
for all using (
  exists (
    select 1 from public.chamas where chamas.id = chama_members.chama_id and chamas.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.chamas where chamas.id = chama_members.chama_id and chamas.owner_id = auth.uid()
  )
);

create policy if not exists "notifications_own_record" on public.notifications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'INDIVIDUAL')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind)
  values
    (new.id, 'Salary', 'INCOME'),
    (new.id, 'Business', 'INCOME'),
    (new.id, 'Freelance', 'INCOME'),
    (new.id, 'Other Income', 'INCOME'),
    (new.id, 'Food', 'EXPENSE'),
    (new.id, 'Transport', 'EXPENSE'),
    (new.id, 'Rent', 'EXPENSE'),
    (new.id, 'Utilities', 'EXPENSE'),
    (new.id, 'Shopping', 'EXPENSE'),
    (new.id, 'Other', 'EXPENSE')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
