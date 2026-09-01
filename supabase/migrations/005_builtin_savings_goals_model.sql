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

create index if not exists idx_savings_transactions_user_created on public.savings_transactions(user_id, created_at desc);
create index if not exists idx_goal_transactions_goal_created on public.goal_transactions(goal_id, created_at desc);

create or replace function public.get_personal_finance_summary(p_user_id uuid)
returns table (
  available_money numeric,
  savings_balance numeric,
  goals_balance numeric,
  income_total numeric,
  expense_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to personal finance summary';
  end if;

  return query
  with income_expense as (
    select
      coalesce(sum(case when direction = 'INCOME' then amount else 0 end), 0) as income_total,
      coalesce(sum(case when direction = 'EXPENSE' then amount else 0 end), 0) as expense_total
    from public.transactions
    where user_id = p_user_id
  ),
  savings as (
    select
      coalesce(sum(case when kind = 'DEPOSIT' then amount else 0 end), 0) as total_saved,
      coalesce(sum(case when kind = 'WITHDRAWAL' then amount else 0 end), 0) as total_withdrawn
    from public.savings_transactions
    where user_id = p_user_id
  ),
  goals as (
    select
      coalesce(sum(case when kind = 'CONTRIBUTION' then amount else 0 end), 0) as total_contributed,
      coalesce(sum(case when kind = 'WITHDRAWAL' then amount else 0 end), 0) as total_withdrawn
    from public.goal_transactions
    where user_id = p_user_id
  )
  select
    (ie.income_total - ie.expense_total - s.total_saved + s.total_withdrawn - g.total_contributed + g.total_withdrawn) as available_money,
    (s.total_saved - s.total_withdrawn) as savings_balance,
    (g.total_contributed - g.total_withdrawn) as goals_balance,
    ie.income_total as income_total,
    ie.expense_total as expense_total
  from income_expense ie
  cross join savings s
  cross join goals g;
end;
$$;

create or replace function public.save_money(p_user_id uuid, p_amount numeric, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to savings';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Saving amount must be greater than zero';
  end if;

  insert into public.savings_transactions (user_id, kind, amount, description)
  values (p_user_id, 'DEPOSIT', p_amount, coalesce(p_description, 'Saved money'))
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.withdraw_savings(p_user_id uuid, p_amount numeric, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  savings_balance numeric;
  saved_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to savings withdrawal';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  select coalesce(sum(case when kind = 'DEPOSIT' then amount when kind = 'WITHDRAWAL' then -amount else 0 end), 0)
  into savings_balance
  from public.savings_transactions
  where user_id = p_user_id;

  if savings_balance < p_amount then
    raise exception 'Insufficient savings balance.';
  end if;

  insert into public.savings_transactions (user_id, kind, amount, description)
  values (p_user_id, 'WITHDRAWAL', p_amount, coalesce(p_description, 'Withdrew money from savings'))
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.contribute_to_goal(p_user_id uuid, p_goal_id uuid, p_amount numeric, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_record public.savings_goals%rowtype;
  txn_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to goal contributions';
  end if;

  if p_goal_id is null then
    raise exception 'Goal is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Contribution amount must be greater than zero';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description)
  values (p_user_id, p_goal_id, 'CONTRIBUTION', p_amount, coalesce(p_description, 'Goal contribution'))
  returning id into txn_id;

  update public.savings_goals
  set saved_amount = saved_amount + p_amount,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

create or replace function public.withdraw_from_goal(p_user_id uuid, p_goal_id uuid, p_amount numeric, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_record public.savings_goals%rowtype;
  txn_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to goal withdrawals';
  end if;

  if p_goal_id is null then
    raise exception 'Goal is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if goal_record.saved_amount < p_amount then
    raise exception 'Insufficient goal balance.';
  end if;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description)
  values (p_user_id, p_goal_id, 'WITHDRAWAL', p_amount, coalesce(p_description, 'Goal withdrawal'))
  returning id into txn_id;

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

alter table public.savings_transactions enable row level security;
alter table public.goal_transactions enable row level security;

create policy if not exists "savings_transactions_own_record" on public.savings_transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "goal_transactions_own_record" on public.goal_transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
