alter table public.savings_goals
  add column if not exists status text not null default 'ACTIVE' check (status in ('ACTIVE','ACHIEVED','COMPLETED')),
  add column if not exists completed_at timestamptz;

alter table public.transactions
  add column if not exists funding_source text check (funding_source in ('AVAILABLE_MONEY','SAVINGS','GOAL'));

create or replace function public.refresh_goal_status(p_user_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_record public.savings_goals%rowtype;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to goal status';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if goal_record.status = 'COMPLETED' then
    return;
  end if;

  if goal_record.saved_amount >= goal_record.target_amount then
    update public.savings_goals
    set status = 'ACHIEVED',
        updated_at = now()
    where id = p_goal_id and user_id = p_user_id;
  else
    update public.savings_goals
    set status = 'ACTIVE',
        updated_at = now()
    where id = p_goal_id and user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.contribute_to_goal(p_user_id uuid, p_goal_id uuid, p_amount numeric, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
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

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description)
  values (p_user_id, p_goal_id, 'CONTRIBUTION', p_amount, coalesce(p_description, 'Goal contribution'))
  returning id into txn_id;

  update public.savings_goals
  set saved_amount = saved_amount + p_amount,
      status = case
        when status = 'COMPLETED' then 'COMPLETED'
        when saved_amount + p_amount >= target_amount then 'ACHIEVED'
        else 'ACTIVE'
      end,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

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
  txn_id uuid;
  current_goal public.savings_goals%rowtype;
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

  select * into current_goal
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if current_goal.saved_amount < p_amount then
    raise exception 'Insufficient goal balance.';
  end if;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description)
  values (p_user_id, p_goal_id, 'WITHDRAWAL', p_amount, coalesce(p_description, 'Goal withdrawal'))
  returning id into txn_id;

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      status = case
        when status = 'COMPLETED' then 'COMPLETED'
        when saved_amount - p_amount >= target_amount then 'ACHIEVED'
        else 'ACTIVE'
      end,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

create or replace function public.spend_from_savings(
  p_user_id uuid,
  p_amount numeric,
  p_category text default 'Other',
  p_description text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  savings_balance numeric;
  txn_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to savings spending';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Spending amount must be greater than zero';
  end if;

  select coalesce(sum(case when kind = 'DEPOSIT' then amount when kind = 'WITHDRAWAL' then -amount else 0 end), 0)
  into savings_balance
  from public.savings_transactions
  where user_id = p_user_id;

  if savings_balance < p_amount then
    raise exception 'Insufficient savings balance.';
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
    metadata,
    funding_source
  )
  values (
    p_user_id,
    'Savings',
    coalesce(p_category, 'Other'),
    p_amount,
    'EXPENSE',
    'MANUAL',
    coalesce(p_description, 'Spending from savings'),
    p_occurred_at,
    jsonb_build_object('funding_source', 'SAVINGS', 'spending_kind', 'SAVINGS_EXPENSE'),
    'SAVINGS'
  )
  returning id into txn_id;

  insert into public.savings_transactions (user_id, kind, amount, description, metadata)
  values (
    p_user_id,
    'WITHDRAWAL',
    p_amount,
    coalesce(p_description, 'Spending from savings'),
    jsonb_build_object('funding_source', 'EXPENSE', 'expense_transaction_id', txn_id)
  );

  return txn_id;
end;
$$;

create or replace function public.spend_from_goal(
  p_user_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_category text default 'Other',
  p_description text default null,
  p_occurred_at timestamptz default now()
)
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
    raise exception 'Unauthorized access to goal spending';
  end if;

  if p_goal_id is null then
    raise exception 'Goal is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Spending amount must be greater than zero';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if goal_record.status = 'COMPLETED' then
    raise exception 'Completed goals are closed and cannot be purchased again.';
  end if;

  if goal_record.saved_amount < p_amount then
    raise exception 'Insufficient goal balance.';
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
    metadata,
    funding_source
  )
  values (
    p_user_id,
    'Goal:' || goal_record.name,
    coalesce(p_category, 'Other'),
    p_amount,
    'EXPENSE',
    'MANUAL',
    coalesce(p_description, 'Spending from goal:' || goal_record.name),
    p_occurred_at,
    jsonb_build_object('funding_source', 'GOAL', 'goal_id', p_goal_id, 'spending_kind', 'GOAL_EXPENSE'),
    'GOAL'
  )
  returning id into txn_id;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description, metadata)
  values (
    p_user_id,
    p_goal_id,
    'WITHDRAWAL',
    p_amount,
    coalesce(p_description, 'Spending from goal'),
    jsonb_build_object('funding_source', 'EXPENSE', 'expense_transaction_id', txn_id, 'goal_spend', true)
  );

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      status = 'COMPLETED',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

create or replace function public.complete_goal_purchase(
  p_user_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_category text default 'Other',
  p_description text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.spend_from_goal(p_user_id, p_goal_id, p_amount, p_category, p_description, p_occurred_at);
end;
$$;

create or replace function public.transfer_completed_goal_to_available_money(
  p_user_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default now()
)
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
    raise exception 'Unauthorized access to completed goal transfer';
  end if;

  if p_goal_id is null then
    raise exception 'Goal is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  select * into goal_record
  from public.savings_goals
  where id = p_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Goal not found';
  end if;

  if goal_record.status <> 'COMPLETED' then
    raise exception 'Only completed goals can be transferred to available money.';
  end if;

  if goal_record.saved_amount < p_amount then
    raise exception 'Transfer amount exceeds remaining goal balance.';
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
    metadata,
    funding_source
  )
  values (
    p_user_id,
    'Available Money',
    'Transfer',
    p_amount,
    'TRANSFER',
    'MANUAL',
    coalesce(p_description, 'Transferred remaining goal balance to available money'),
    p_occurred_at,
    jsonb_build_object('transfer_kind', 'GOAL_TO_AVAILABLE_MONEY', 'source_goal_id', p_goal_id),
    'AVAILABLE_MONEY'
  )
  returning id into txn_id;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description, metadata)
  values (
    p_user_id,
    p_goal_id,
    'WITHDRAWAL',
    p_amount,
    coalesce(p_description, 'Transferred remaining goal balance to available money'),
    jsonb_build_object('transfer_kind', 'GOAL_TO_AVAILABLE_MONEY', 'transaction_id', txn_id)
  );

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

create or replace function public.transfer_completed_goal_to_goal(
  p_user_id uuid,
  p_source_goal_id uuid,
  p_destination_goal_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_goal public.savings_goals%rowtype;
  destination_goal public.savings_goals%rowtype;
  txn_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Unauthorized access to completed goal transfer';
  end if;

  if p_source_goal_id is null or p_destination_goal_id is null then
    raise exception 'Source and destination goals are required';
  end if;

  if p_source_goal_id = p_destination_goal_id then
    raise exception 'A goal cannot transfer to itself.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  select * into source_goal
  from public.savings_goals
  where id = p_source_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Source goal not found';
  end if;

  if source_goal.status <> 'COMPLETED' then
    raise exception 'Only a completed goal can transfer remaining balance to another goal.';
  end if;

  if source_goal.saved_amount < p_amount then
    raise exception 'Transfer amount exceeds remaining goal balance.';
  end if;

  select * into destination_goal
  from public.savings_goals
  where id = p_destination_goal_id and user_id = p_user_id;

  if not found then
    raise exception 'Destination goal not found';
  end if;

  if destination_goal.status <> 'ACTIVE' then
    raise exception 'Transfer destination must be an active goal.';
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
    metadata,
    funding_source
  )
  values (
    p_user_id,
    'Goal Transfer',
    'Transfer',
    p_amount,
    'TRANSFER',
    'MANUAL',
    coalesce(p_description, 'Transferred remaining goal balance to another goal'),
    p_occurred_at,
    jsonb_build_object('transfer_kind', 'GOAL_TO_GOAL', 'source_goal_id', p_source_goal_id, 'destination_goal_id', p_destination_goal_id),
    'GOAL'
  )
  returning id into txn_id;

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description, metadata)
  values (
    p_user_id,
    p_source_goal_id,
    'WITHDRAWAL',
    p_amount,
    coalesce(p_description, 'Transferred remaining goal balance to another goal'),
    jsonb_build_object('transfer_kind', 'GOAL_TO_GOAL', 'destination_goal_id', p_destination_goal_id, 'transaction_id', txn_id)
  );

  insert into public.goal_transactions (user_id, goal_id, kind, amount, description, metadata)
  values (
    p_user_id,
    p_destination_goal_id,
    'CONTRIBUTION',
    p_amount,
    coalesce(p_description, 'Received transferred goal balance'),
    jsonb_build_object('transfer_kind', 'GOAL_TO_GOAL', 'source_goal_id', p_source_goal_id, 'transaction_id', txn_id)
  );

  update public.savings_goals
  set saved_amount = saved_amount - p_amount,
      updated_at = now()
  where id = p_source_goal_id and user_id = p_user_id;

  update public.savings_goals
  set saved_amount = saved_amount + p_amount,
      status = case when saved_amount + p_amount >= target_amount then 'ACHIEVED' else 'ACTIVE' end,
      updated_at = now()
  where id = p_destination_goal_id and user_id = p_user_id;

  return txn_id;
end;
$$;

create or replace function public.prevent_completed_goal_modifications()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'COMPLETED' then
    if new.status <> 'COMPLETED'
      or new.user_id <> old.user_id
      or new.name <> old.name
      or new.target_amount <> old.target_amount
      or new.target_date is distinct from old.target_date
      or new.completed_at is distinct from old.completed_at
      or new.saved_amount > old.saved_amount
      or new.saved_amount = old.saved_amount
    then
      raise exception 'Completed goals are read-only and cannot be edited.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists completed_goal_read_only on public.savings_goals;
create trigger completed_goal_read_only
before update on public.savings_goals
for each row
execute function public.prevent_completed_goal_modifications();

create or replace function public.prevent_completed_goal_contributions()
returns trigger
language plpgsql
as $$
declare
  goal_status text;
begin
  select status into goal_status
  from public.savings_goals
  where id = new.goal_id;

  if goal_status = 'COMPLETED' and new.kind = 'CONTRIBUTION' then
    raise exception 'Completed goals cannot receive new contributions.';
  end if;

  if goal_status = 'COMPLETED' and new.kind = 'WITHDRAWAL' and coalesce(new.metadata->>'transfer_kind', '') = '' and coalesce(new.metadata->>'goal_spend', 'false')::boolean is not true then
    raise exception 'Completed goals can only be reduced by approved transfers or goal purchases.';
  end if;

  return new;
end;
$$;

drop trigger if exists completed_goal_transaction_guard on public.goal_transactions;
create trigger completed_goal_transaction_guard
before insert or update on public.goal_transactions
for each row
execute function public.prevent_completed_goal_contributions();

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
    where user_id = p_user_id and direction in ('INCOME','EXPENSE')
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
    where user_id = p_user_id and kind in ('CONTRIBUTION','WITHDRAWAL')
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
