create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  amount numeric(12,2) not null check (amount >= 0),
  period text not null default 'MONTHLY' check (period in ('WEEKLY','MONTHLY','YEARLY')),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  category text not null default 'Other',
  account_name text not null default 'M-Pesa',
  frequency text not null default 'MONTHLY' check (frequency in ('DAILY','WEEKLY','MONTHLY','YEARLY','ONE_TIME')),
  status text not null default 'UPCOMING' check (status in ('UPCOMING','DUE_TODAY','PAID','OVERDUE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  type text not null check (type in ('INCOME','EXPENSE','TRANSFER')),
  category text not null default 'Other',
  account_name text not null default 'M-Pesa',
  frequency text not null check (frequency in ('DAILY','WEEKLY','MONTHLY','YEARLY','CUSTOM')),
  start_date date not null default current_date,
  next_occurrence date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, account_name)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chama_invitations (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  email text,
  phone text,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','EXPIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chama_id, email)
);

create table if not exists public.chama_loans (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  principal numeric(12,2) not null check (principal > 0),
  interest_rate numeric(5,2) not null default 0 check (interest_rate >= 0),
  repayment_period integer not null default 1 check (repayment_period > 0),
  total_due numeric(12,2) not null check (total_due >= 0),
  outstanding_balance numeric(12,2) not null check (outstanding_balance >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','ACTIVE','PARTIALLY_PAID','PAID','OVERDUE','REJECTED')),
  issue_date date not null default current_date,
  due_date date,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chama_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.chama_loans(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'MPESA' check (payment_method in ('CASH','MPESA','BANK','OTHER')),
  reference text,
  paid_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_budgets_user_period on public.budgets(user_id, period, status);
create index if not exists idx_bills_user_due_date on public.bills(user_id, due_date, status);
create index if not exists idx_recurring_transactions_user_next on public.recurring_transactions(user_id, active, next_occurrence);
create index if not exists idx_notification_preferences_user on public.notification_preferences(user_id, enabled);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_chama_loans_chama_status on public.chama_loans(chama_id, status, due_date);
create index if not exists idx_chama_invitations_chama on public.chama_invitations(chama_id, status);

create or replace function public.get_chama_user_role(p_user_id uuid, p_chama_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.chama_members
  where user_id = p_user_id
    and chama_id = p_chama_id
    and status = 'ACTIVE'
  limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

drop trigger if exists set_bills_updated_at on public.bills;
create trigger set_bills_updated_at
before update on public.bills
for each row execute function public.set_updated_at();

drop trigger if exists set_recurring_transactions_updated_at on public.recurring_transactions;
create trigger set_recurring_transactions_updated_at
before update on public.recurring_transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_chama_invitations_updated_at on public.chama_invitations;
create trigger set_chama_invitations_updated_at
before update on public.chama_invitations
for each row execute function public.set_updated_at();

drop trigger if exists set_chama_loans_updated_at on public.chama_loans;
create trigger set_chama_loans_updated_at
before update on public.chama_loans
for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
alter table public.bills enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;
alter table public.chama_invitations enable row level security;
alter table public.chama_loans enable row level security;
alter table public.chama_loan_repayments enable row level security;

create policy if not exists "budgets_own_record" on public.budgets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "bills_own_record" on public.bills
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "recurring_transactions_own_record" on public.recurring_transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "user_preferences_own_record" on public.user_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "notification_preferences_own_record" on public.notification_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "audit_logs_own_record" on public.audit_logs
for select using (auth.uid() = user_id or exists (
  select 1
  from public.chama_members cm
  where cm.user_id = auth.uid()
    and cm.status = 'ACTIVE'
));

create policy if not exists "chama_invitations_access" on public.chama_invitations
for all using (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_invitations.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
  )
) with check (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_invitations.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
      and cm.role in ('CHAIRPERSON','TREASURER','SECRETARY')
  )
);

create policy if not exists "chama_loans_access" on public.chama_loans
for all using (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_loans.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
) with check (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_loans.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy if not exists "chama_loan_repayments_access" on public.chama_loan_repayments
for all using (
  exists (
    select 1
    from public.chama_loans cl
    join public.chama_members cm on cm.chama_id = cl.chama_id
    where cl.id = chama_loan_repayments.loan_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
) with check (
  exists (
    select 1
    from public.chama_loans cl
    join public.chama_members cm on cm.chama_id = cl.chama_id
    where cl.id = chama_loan_repayments.loan_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy if not exists "chamas_membership_access" on public.chamas
for select using (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chamas.id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy if not exists "chama_members_access" on public.chama_members
for all using (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_members.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
) with check (
  exists (
    select 1
    from public.chama_members cm
    where cm.chama_id = chama_members.chama_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy if not exists "chama_contributions_access" on public.chama_contributions
for all using (
  exists (
    select 1
    from public.chama_members cm
    where cm.id = chama_contributions.member_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
) with check (
  exists (
    select 1
    from public.chama_members cm
    where cm.id = chama_contributions.member_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  )
);

create policy if not exists "notifications_own_record" on public.notifications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.notification_preferences (user_id, category, enabled)
select p.id, v.category, true
from public.profiles p
cross join (
  values
    ('budget_warning'),
    ('budget_exceeded'),
    ('upcoming_bill'),
    ('overdue_bill'),
    ('savings_milestone'),
    ('recurring_reminder'),
    ('security_alert')
) as v(category)
on conflict (user_id, category) do nothing;
