create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'OTHER' check (type in ('CASH','MPESA','BANK','SAVINGS','OTHER')),
  opening_balance numeric(12,2) not null default 0 check (opening_balance >= 0),
  currency text not null default 'KES',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_accounts_user_id on public.accounts(user_id, status, name);
create index if not exists idx_transactions_user_direction_date on public.transactions(user_id, direction, occurred_at desc);
create index if not exists idx_transactions_user_account on public.transactions(user_id, account_name, occurred_at desc);

create or replace function public.get_account_balance(p_user_id uuid, p_account_id uuid default null)
returns numeric(12,2)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to financial summary';
  end if;

  return (
    with account_match as (
      select a.id, a.name, a.opening_balance
      from public.accounts a
      where a.user_id = p_user_id
        and (p_account_id is null or a.id = p_account_id)
    ),
    tx as (
      select
        coalesce(sum(
          case
            when t.direction = 'INCOME' then t.amount
            when t.direction = 'EXPENSE' then -t.amount
            when t.direction = 'TRANSFER' and lower(coalesce(t.metadata->>'transfer_direction', '')) = 'incoming' then t.amount
            when t.direction = 'TRANSFER' and lower(coalesce(t.metadata->>'transfer_direction', '')) = 'outgoing' then -t.amount
            else 0
          end
        ), 0) as net_flow
      from public.transactions t
      where t.user_id = p_user_id
        and (
          p_account_id is null
          or t.account_name = (select a.name from account_match a where a.id = p_account_id)
          or t.account_name = (select a.name from public.accounts a where a.id = p_account_id)
        )
    )
    select coalesce((select sum(account_match.opening_balance) from account_match), 0) + coalesce((select net_flow from tx), 0)
  );
end;
$$;

create or replace function public.get_dashboard_summary(p_user_id uuid)
returns table (
  total_income numeric,
  total_expenses numeric,
  balance numeric,
  monthly_income numeric,
  monthly_expenses numeric,
  monthly_savings numeric,
  cash_flow numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to user dashboard';
  end if;

  return query
  select
    coalesce(sum(case when direction = 'INCOME' then amount else 0 end), 0) as total_income,
    coalesce(sum(case when direction = 'EXPENSE' then amount else 0 end), 0) as total_expenses,
    coalesce(sum(
      case
        when direction = 'INCOME' then amount
        when direction = 'EXPENSE' then -amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
        else 0
      end
    ), 0) as balance,
    coalesce(sum(case when direction = 'INCOME' and occurred_at >= date_trunc('month', now()) then amount else 0 end), 0) as monthly_income,
    coalesce(sum(case when direction = 'EXPENSE' and occurred_at >= date_trunc('month', now()) then amount else 0 end), 0) as monthly_expenses,
    coalesce(sum(case when direction = 'INCOME' and occurred_at >= date_trunc('month', now()) then amount when direction = 'EXPENSE' and occurred_at >= date_trunc('month', now()) then -amount else 0 end), 0) as monthly_savings,
    coalesce(sum(case when occurred_at >= date_trunc('month', now()) then
      case
        when direction = 'INCOME' then amount
        when direction = 'EXPENSE' then -amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
        else 0
      end
      else 0 end), 0) as cash_flow
  from public.transactions
  where user_id = p_user_id;
end;
$$;

create or replace function public.get_monthly_income(p_user_id uuid)
returns numeric(12,2)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to monthly income';
  end if;

  return (
    select coalesce(sum(amount), 0)
    from public.transactions
    where user_id = p_user_id
      and direction = 'INCOME'
      and occurred_at >= date_trunc('month', now())
  );
end;
$$;

create or replace function public.get_monthly_expenses(p_user_id uuid)
returns numeric(12,2)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to monthly expenses';
  end if;

  return (
    select coalesce(sum(amount), 0)
    from public.transactions
    where user_id = p_user_id
      and direction = 'EXPENSE'
      and occurred_at >= date_trunc('month', now())
  );
end;
$$;

create or replace function public.get_monthly_savings(p_user_id uuid)
returns numeric(12,2)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to monthly savings';
  end if;

  return coalesce(
    (
      select sum(case when direction = 'INCOME' then amount when direction = 'EXPENSE' then -amount else 0 end)
      from public.transactions
      where user_id = p_user_id
        and occurred_at >= date_trunc('month', now())
    ),
    0
  );
end;
$$;

create or replace function public.get_cash_flow(p_user_id uuid)
returns numeric(12,2)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to cash flow';
  end if;

  return coalesce(
    (
      select sum(
        case
          when direction = 'INCOME' then amount
          when direction = 'EXPENSE' then -amount
          when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
          when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
          else 0
        end
      )
      from public.transactions
      where user_id = p_user_id
        and occurred_at >= date_trunc('month', now())
    ),
    0
  );
end;
$$;

create or replace function public.get_spending_by_category(p_user_id uuid)
returns table (name text, value numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to category spending';
  end if;

  return query
  select t.category as name, sum(t.amount) as value
  from public.transactions t
  where t.user_id = p_user_id
    and t.direction = 'EXPENSE'
  group by t.category
  order by value desc;
end;
$$;

create or replace function public.get_income_by_source(p_user_id uuid)
returns table (name text, value numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to income sources';
  end if;

  return query
  select coalesce(t.source, 'Other') as name, sum(t.amount) as value
  from public.transactions t
  where t.user_id = p_user_id
    and t.direction = 'INCOME'
  group by coalesce(t.source, 'Other')
  order by value desc;
end;
$$;

create or replace function public.get_dashboard_summary(p_user_id uuid)
returns table (
  total_income numeric,
  total_expenses numeric,
  balance numeric,
  monthly_income numeric,
  monthly_expenses numeric,
  monthly_savings numeric,
  cash_flow numeric
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when direction = 'INCOME' then amount else 0 end), 0) as total_income,
    coalesce(sum(case when direction = 'EXPENSE' then amount else 0 end), 0) as total_expenses,
    coalesce(sum(
      case
        when direction = 'INCOME' then amount
        when direction = 'EXPENSE' then -amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
        else 0
      end
    ), 0) as balance,
    coalesce(sum(case when direction = 'INCOME' and occurred_at >= date_trunc('month', now()) then amount else 0 end), 0) as monthly_income,
    coalesce(sum(case when direction = 'EXPENSE' and occurred_at >= date_trunc('month', now()) then amount else 0 end), 0) as monthly_expenses,
    coalesce(sum(case when direction = 'INCOME' and occurred_at >= date_trunc('month', now()) then amount when direction = 'EXPENSE' and occurred_at >= date_trunc('month', now()) then -amount else 0 end), 0) as monthly_savings,
    coalesce(sum(case when occurred_at >= date_trunc('month', now()) then
      case
        when direction = 'INCOME' then amount
        when direction = 'EXPENSE' then -amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
        when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
        else 0
      end
      else 0 end), 0) as cash_flow
  from public.transactions
  where user_id = p_user_id;
$$;

create or replace function public.get_monthly_income(p_user_id uuid)
returns numeric(12,2)
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)
  from public.transactions
  where user_id = p_user_id
    and direction = 'INCOME'
    and occurred_at >= date_trunc('month', now());
$$;

create or replace function public.get_monthly_expenses(p_user_id uuid)
returns numeric(12,2)
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)
  from public.transactions
  where user_id = p_user_id
    and direction = 'EXPENSE'
    and occurred_at >= date_trunc('month', now());
$$;

create or replace function public.get_monthly_savings(p_user_id uuid)
returns numeric(12,2)
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sum(case when direction = 'INCOME' then amount when direction = 'EXPENSE' then -amount else 0 end)
      from public.transactions
      where user_id = p_user_id
        and occurred_at >= date_trunc('month', now())
    ),
    0
  );
$$;

create or replace function public.get_cash_flow(p_user_id uuid)
returns numeric(12,2)
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sum(
        case
          when direction = 'INCOME' then amount
          when direction = 'EXPENSE' then -amount
          when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'incoming' then amount
          when direction = 'TRANSFER' and lower(coalesce(metadata->>'transfer_direction', '')) = 'outgoing' then -amount
          else 0
        end
      )
      from public.transactions
      where user_id = p_user_id
        and occurred_at >= date_trunc('month', now())
    ),
    0
  );
$$;

create or replace function public.get_spending_by_category(p_user_id uuid)
returns table (name text, value numeric)
language sql
security definer
set search_path = public
as $$
  select t.category as name, sum(t.amount) as value
  from public.transactions t
  where t.user_id = p_user_id
    and t.direction = 'EXPENSE'
  group by t.category
  order by value desc;
$$;

create or replace function public.get_income_by_source(p_user_id uuid)
returns table (name text, value numeric)
language sql
security definer
set search_path = public
as $$
  select coalesce(t.source, 'Other') as name, sum(t.amount) as value
  from public.transactions t
  where t.user_id = p_user_id
    and t.direction = 'INCOME'
  group by coalesce(t.source, 'Other')
  order by value desc;
$$;

create or replace function public.create_default_accounts_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type)
  values
    (new.id, 'Cash', 'CASH'),
    (new.id, 'M-Pesa', 'MPESA'),
    (new.id, 'Bank', 'BANK'),
    (new.id, 'Savings', 'SAVINGS'),
    (new.id, 'Other', 'OTHER')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_accounts_on_profile on public.profiles;
create trigger create_default_accounts_on_profile
after insert on public.profiles
for each row execute function public.create_default_accounts_for_user();

insert into public.accounts (user_id, name, type)
select p.id, v.name, v.type
from public.profiles p
cross join (
  values
    ('Cash', 'CASH'),
    ('M-Pesa', 'MPESA'),
    ('Bank', 'BANK'),
    ('Savings', 'SAVINGS'),
    ('Other', 'OTHER')
) as v(name, type)
on conflict (user_id, name) do nothing;

alter table public.accounts enable row level security;

drop policy if exists "accounts_own_record" on public.accounts;
create policy "accounts_own_record" on public.accounts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
