create table if not exists public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in ('CONTRIBUTION','WITHDRAWAL')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'MANUAL' check (source in ('MANUAL','MPESA','BANK_IMPORT','CSV','SMS','OTHER')),
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','PARSED','REJECTED','ACCEPTED','IGNORED')),
  parsed_data jsonb not null default '{}'::jsonb,
  fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goal_allocations_goal on public.goal_allocations(goal_id, created_at desc);
create index if not exists idx_transaction_imports_user on public.transaction_imports(user_id, created_at desc);

create or replace function public.transfer_between_accounts(
  p_user_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  from_account public.accounts%rowtype;
  to_account public.accounts%rowtype;
  transfer_id uuid := gen_random_uuid();
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to transfers';
  end if;

  if p_from_account_id is null or p_to_account_id is null then
    raise exception 'Both source and destination accounts are required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'Source and destination accounts must be different';
  end if;

  select * into from_account
  from public.accounts
  where id = p_from_account_id and user_id = p_user_id for update;

  select * into to_account
  from public.accounts
  where id = p_to_account_id and user_id = p_user_id for update;

  if not found then
    raise exception 'Source account not found';
  end if;

  if to_account is null then
    raise exception 'Destination account not found';
  end if;

  if public.get_account_balance(p_user_id, p_from_account_id) < p_amount then
    raise exception 'Insufficient funds in source account';
  end if;

  insert into public.transactions (
    user_id,
    account_name,
    category,
    amount,
    direction,
    source,
    description,
    occurred_at,
    metadata
  )
  values (
    p_user_id,
    from_account.name,
    'Transfer',
    p_amount,
    'TRANSFER',
    'MANUAL',
    coalesce(p_note, 'Transfer between accounts'),
    p_occurred_at,
    jsonb_build_object('transfer_id', transfer_id, 'transfer_direction', 'outgoing', 'to_account_id', p_to_account_id, 'from_account_id', p_from_account_id)
  );

  insert into public.transactions (
    user_id,
    account_name,
    category,
    amount,
    direction,
    source,
    description,
    occurred_at,
    metadata
  )
  values (
    p_user_id,
    to_account.name,
    'Transfer',
    p_amount,
    'TRANSFER',
    'MANUAL',
    coalesce(p_note, 'Transfer between accounts'),
    p_occurred_at,
    jsonb_build_object('transfer_id', transfer_id, 'transfer_direction', 'incoming', 'to_account_id', p_to_account_id, 'from_account_id', p_from_account_id)
  );

  return jsonb_build_object(
    'transfer_id', transfer_id,
    'from_account_id', p_from_account_id,
    'to_account_id', p_to_account_id,
    'amount', p_amount,
    'note', coalesce(p_note, 'Transfer between accounts')
  );
end;
$$;

create or replace function public.allocate_to_goal(
  p_user_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_note text default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_record public.savings_goals%rowtype;
  account_record public.accounts%rowtype;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to goal allocations';
  end if;

  if p_goal_id is null then
    raise exception 'Goal is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Allocation amount must be greater than zero';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if p_account_id is not null then
    select * into account_record
    from public.accounts
    where id = p_account_id and user_id = p_user_id;

    if not found then
      raise exception 'Account not found';
    end if;
  end if;

  insert into public.goal_allocations (user_id, goal_id, account_id, amount, kind, note)
  values (p_user_id, p_goal_id, p_account_id, p_amount, 'CONTRIBUTION', coalesce(p_note, 'Goal contribution'));

  update public.savings_goals
  set saved_amount = saved_amount + p_amount,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'amount', p_amount,
    'account_id', p_account_id,
    'note', coalesce(p_note, 'Goal contribution')
  );
end;
$$;

create or replace function public.withdraw_from_goal(
  p_user_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_note text default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_record public.savings_goals%rowtype;
  account_record public.accounts%rowtype;
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
    raise exception 'Withdrawal amount exceeds current goal balance';
  end if;

  if p_account_id is not null then
    select * into account_record
    from public.accounts
    where id = p_account_id and user_id = p_user_id;

    if not found then
      raise exception 'Account not found';
    end if;
  end if;

  insert into public.goal_allocations (user_id, goal_id, account_id, amount, kind, note)
  values (p_user_id, p_goal_id, p_account_id, p_amount, 'WITHDRAWAL', coalesce(p_note, 'Goal withdrawal'));

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'amount', p_amount,
    'account_id', p_account_id,
    'note', coalesce(p_note, 'Goal withdrawal')
  );
end;
$$;

alter table public.goal_allocations enable row level security;
alter table public.transaction_imports enable row level security;

create policy if not exists "goal_allocations_own_record" on public.goal_allocations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "transaction_imports_own_record" on public.transaction_imports
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
