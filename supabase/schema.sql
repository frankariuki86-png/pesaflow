-- PesaFlow MVP schema for Supabase
-- Run this in Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'INDIVIDUAL' check (role in ('INDIVIDUAL','CHAMA_MEMBER','CHAMA_ADMIN','BUSINESS_OWNER','PLATFORM_ADMIN')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null default 'M-Pesa',
  category text not null default 'Other',
  subcategory text,
  amount numeric(12,2) not null check (amount >= 0),
  direction text not null check (direction in ('INCOME','EXPENSE','TRANSFER')),
  source text not null default 'MANUAL' check (source in ('MPESA','BANK','MANUAL','IMPORT')),
  description text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
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

create table if not exists public.financial_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  period text not null check (period in ('MONTHLY','WEEKLY','YEARLY')),
  start_date date not null,
  end_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date date not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ACHIEVED','COMPLETED')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('DEPOSIT','WITHDRAWAL')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.goal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  kind text not null check (kind in ('CONTRIBUTION','WITHDRAWAL')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
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

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null default 'Other',
  amount numeric(12,2) not null check (amount >= 0),
  description text,
  payment_method text not null default 'CASH' check (payment_method in ('CASH','MPESA','BANK','OTHER')),
  incurred_at timestamptz not null default now(),
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

create table if not exists public.chama_contributions (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  member_id uuid not null references public.chama_members(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  contribution_type text not null default 'NORMAL' check (contribution_type in ('NORMAL','SPECIAL','EMERGENCY')),
  period text not null default 'MONTHLY',
  payment_method text not null default 'MPESA',
  reference text,
  contributed_at timestamptz not null default now(),
  status text not null default 'PAID' check (status in ('PAID','PARTIAL','PENDING','LATE')),
  created_at timestamptz not null default now()
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

create index if not exists idx_transactions_user_occurred on public.transactions (user_id, occurred_at desc);
create index if not exists idx_transactions_user_direction on public.transactions (user_id, direction);
create index if not exists idx_categories_user_kind on public.categories (user_id, kind);
create unique index if not exists idx_categories_user_name_kind on public.categories (user_id, name, kind);
create index if not exists idx_financial_sources_user on public.financial_sources (user_id);
create index if not exists idx_business_products_business on public.business_products (business_id);
create index if not exists idx_business_sales_business on public.business_sales (business_id, sale_date desc);
create index if not exists idx_chama_contributions_chama on public.chama_contributions (chama_id, contributed_at desc);

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

drop trigger if exists set_savings_goals_updated_at on public.savings_goals;
create trigger set_savings_goals_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

drop trigger if exists set_business_products_updated_at on public.business_products;
create trigger set_business_products_updated_at
before update on public.business_products
for each row execute function public.set_updated_at();

drop trigger if exists set_chamas_updated_at on public.chamas;
create trigger set_chamas_updated_at
before update on public.chamas
for each row execute function public.set_updated_at();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed by the client';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.financial_sources enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.goal_transactions enable row level security;
alter table public.businesses enable row level security;
alter table public.business_products enable row level security;
alter table public.business_sales enable row level security;
alter table public.business_sale_items enable row level security;
alter table public.business_expenses enable row level security;
alter table public.chamas enable row level security;
alter table public.chama_members enable row level security;
alter table public.chama_contributions enable row level security;
alter table public.notifications enable row level security;

-- Supabase exposes tables through the authenticated API role. RLS controls
-- which rows a user can access after these table privileges are granted.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.transactions,
  public.categories,
  public.financial_sources,
  public.budgets,
  public.savings_goals,
  public.savings_transactions,
  public.goal_transactions,
  public.businesses,
  public.business_products,
  public.business_sales,
  public.business_sale_items,
  public.business_expenses,
  public.chamas,
  public.chama_members,
  public.chama_contributions,
  public.notifications
to authenticated;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('MPESA','CASH','BANK','SALARY','BUSINESS','CHAMA','OTHER','MANUAL','IMPORT'));

drop policy if exists "profiles_own_record" on public.profiles;
drop policy if exists "profiles_select_own_record" on public.profiles;
drop policy if exists "profiles_insert_own_record" on public.profiles;
drop policy if exists "profiles_update_own_record" on public.profiles;
drop policy if exists "profiles_delete_own_record" on public.profiles;
create policy "profiles_select_own_record" on public.profiles
for select using (auth.uid() = id);
create policy "profiles_insert_own_record" on public.profiles
for insert with check (auth.uid() = id);
create policy "profiles_update_own_record" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own_record" on public.profiles
for delete using (auth.uid() = id);

drop policy if exists "transactions_own_record" on public.transactions;
create policy "transactions_own_record" on public.transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_own_record" on public.categories;
create policy "categories_own_record" on public.categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "financial_sources_own_record" on public.financial_sources;
create policy "financial_sources_own_record" on public.financial_sources
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_own_record" on public.budgets;
create policy "budgets_own_record" on public.budgets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "savings_goals_own_record" on public.savings_goals;
create policy "savings_goals_own_record" on public.savings_goals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "savings_transactions_own_record" on public.savings_transactions;
create policy "savings_transactions_own_record" on public.savings_transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goal_transactions_own_record" on public.goal_transactions;
create policy "goal_transactions_own_record" on public.goal_transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "businesses_own_record" on public.businesses;
create policy "businesses_own_record" on public.businesses
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "business_products_own_record" on public.business_products;
create policy "business_products_own_record" on public.business_products
for all using (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "business_sales_own_record" on public.business_sales;
create policy "business_sales_own_record" on public.business_sales
for all using (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "business_sale_items_own_record" on public.business_sale_items;
create policy "business_sale_items_own_record" on public.business_sale_items
for all using (
  exists (
    select 1
    from public.business_sales s
    join public.businesses b on b.id = s.business_id
    where s.id = sale_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.business_sales s
    join public.businesses b on b.id = s.business_id
    where s.id = sale_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "business_expenses_own_record" on public.business_expenses;
create policy "business_expenses_own_record" on public.business_expenses
for all using (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "chamas_own_record" on public.chamas;
drop policy if exists "chamas_insert_own_record" on public.chamas;
drop policy if exists "chamas_update_own_record" on public.chamas;
create policy "chamas_own_record" on public.chamas
for select using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chamas.id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy "chamas_insert_own_record" on public.chamas
for insert with check (auth.uid() = owner_id);

create policy "chamas_update_own_record" on public.chamas
for update using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chamas.id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chamas.id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

drop policy if exists "chama_members_own_record" on public.chama_members;
drop policy if exists "chama_members_insert_own_record" on public.chama_members;
drop policy if exists "chama_members_update_own_record" on public.chama_members;
create policy "chama_members_own_record" on public.chama_members
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.chamas c where c.id = chama_members.chama_id and c.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chama_members.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

create policy "chama_members_insert_own_record" on public.chama_members
for insert with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.chamas c where c.id = chama_members.chama_id and c.owner_id = auth.uid()
  )
);

create policy "chama_members_update_own_record" on public.chama_members
for update using (
  auth.uid() = user_id
  or exists (
    select 1 from public.chamas c where c.id = chama_members.chama_id and c.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chama_members.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
) with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.chamas c where c.id = chama_members.chama_id and c.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.chama_members cm
    where cm.chama_id = chama_members.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

drop policy if exists "chama_contributions_own_record" on public.chama_contributions;
drop policy if exists "chama_contributions_insert_own_record" on public.chama_contributions;
drop policy if exists "chama_contributions_update_own_record" on public.chama_contributions;
create policy "chama_contributions_own_record" on public.chama_contributions
for select using (
  exists (
    select 1 from public.chama_members cm
    where cm.id = member_id and cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  )
  or exists (
    select 1 from public.chamas c
    join public.chama_members cm on cm.chama_id = c.id
    where c.id = chama_contributions.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

create policy "chama_contributions_insert_own_record" on public.chama_contributions
for insert with check (
  exists (
    select 1 from public.chama_members cm
    where cm.id = member_id and cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  )
  or exists (
    select 1 from public.chamas c
    join public.chama_members cm on cm.chama_id = c.id
    where c.id = chama_contributions.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

create policy "chama_contributions_update_own_record" on public.chama_contributions
for update using (
  exists (
    select 1 from public.chama_members cm
    where cm.id = member_id and cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  )
  or exists (
    select 1 from public.chamas c
    join public.chama_members cm on cm.chama_id = c.id
    where c.id = chama_contributions.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
) with check (
  exists (
    select 1 from public.chama_members cm
    where cm.id = member_id and cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  )
  or exists (
    select 1 from public.chamas c
    join public.chama_members cm on cm.chama_id = c.id
    where c.id = chama_contributions.chama_id
      and cm.user_id = auth.uid()
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
      and cm.status = 'ACTIVE'
  )
);

drop policy if exists "notifications_own_record" on public.notifications;
create policy "notifications_own_record" on public.notifications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper function for profile creation after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
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
    (new.id, 'Gift', 'INCOME'),
    (new.id, 'Other Income', 'INCOME'),
    (new.id, 'Uncategorized', 'INCOME'),
    (new.id, 'Food', 'EXPENSE'),
    (new.id, 'Transport', 'EXPENSE'),
    (new.id, 'Rent', 'EXPENSE'),
    (new.id, 'Utilities', 'EXPENSE'),
    (new.id, 'Airtime', 'EXPENSE'),
    (new.id, 'Internet', 'EXPENSE'),
    (new.id, 'Shopping', 'EXPENSE'),
    (new.id, 'Entertainment', 'EXPENSE'),
    (new.id, 'Education', 'EXPENSE'),
    (new.id, 'Medical', 'EXPENSE'),
    (new.id, 'Family', 'EXPENSE'),
    (new.id, 'Loans', 'EXPENSE'),
    (new.id, 'Savings', 'EXPENSE'),
    (new.id, 'Business', 'EXPENSE'),
    (new.id, 'Other', 'EXPENSE'),
    (new.id, 'Uncategorized', 'EXPENSE')
  on conflict do nothing;

  insert into public.financial_sources (user_id, name)
  values
    (new.id, 'M-Pesa'),
    (new.id, 'Cash'),
    (new.id, 'Bank'),
    (new.id, 'Salary'),
    (new.id, 'Business'),
    (new.id, 'Chama'),
    (new.id, 'Other')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill defaults for users created before the signup seed was added.
insert into public.categories (user_id, name, kind)
select p.id, defaults.name, defaults.kind
from public.profiles p
cross join (values
  ('Salary', 'INCOME'), ('Business', 'INCOME'), ('Freelance', 'INCOME'),
  ('Gift', 'INCOME'), ('Other Income', 'INCOME'), ('Uncategorized', 'INCOME'),
  ('Food', 'EXPENSE'), ('Transport', 'EXPENSE'), ('Rent', 'EXPENSE'),
  ('Utilities', 'EXPENSE'), ('Airtime', 'EXPENSE'), ('Internet', 'EXPENSE'),
  ('Shopping', 'EXPENSE'), ('Entertainment', 'EXPENSE'), ('Education', 'EXPENSE'),
  ('Medical', 'EXPENSE'), ('Family', 'EXPENSE'), ('Loans', 'EXPENSE'),
  ('Savings', 'EXPENSE'), ('Business', 'EXPENSE'), ('Other', 'EXPENSE'),
  ('Uncategorized', 'EXPENSE')
) as defaults(name, kind)
on conflict do nothing;

insert into public.financial_sources (user_id, name)
select p.id, defaults.name
from public.profiles p
cross join (values ('M-Pesa'), ('Cash'), ('Bank'), ('Salary'), ('Business'), ('Chama'), ('Other')) as defaults(name)
on conflict do nothing;

-- Profiles are created automatically when a real auth user signs up.
-- Do not insert fake rows directly into public.profiles with IDs that do not exist in auth.users.
