create or replace view public.goal_metrics
with (security_invoker = true)
as
with transaction_totals as (
  select
    goal_id,
    coalesce(sum(amount) filter (where kind = 'CONTRIBUTION' and metadata->>'transfer_kind' is null), 0) as total_contributions,
    coalesce(sum(amount) filter (where kind = 'WITHDRAWAL' and metadata->>'goal_spend' = 'true'), 0) as total_goal_purchases,
    coalesce(sum(amount) filter (where kind = 'CONTRIBUTION' and metadata->>'transfer_kind' = 'GOAL_TO_GOAL'), 0) as total_transfers_in,
    coalesce(sum(amount) filter (where kind = 'WITHDRAWAL' and metadata->>'transfer_kind' is not null), 0) as total_transfers_out,
    coalesce(sum(amount) filter (where kind = 'WITHDRAWAL' and metadata->>'transfer_kind' is null and metadata->>'goal_spend' is distinct from 'true'), 0) as total_withdrawals
  from public.goal_transactions
  group by goal_id
)
select
  goal.id,
  goal.user_id,
  goal.name,
  goal.target_amount,
  coalesce(t.total_contributions, 0) as total_contributions,
  coalesce(t.total_goal_purchases, 0) as total_goal_purchases,
  coalesce(t.total_transfers_in, 0) as total_transfers_in,
  coalesce(t.total_transfers_out, 0) as total_transfers_out,
  coalesce(t.total_withdrawals, 0) as total_withdrawals,
  coalesce(t.total_contributions, 0) - coalesce(t.total_goal_purchases, 0) - coalesce(t.total_transfers_out, 0) + coalesce(t.total_transfers_in, 0) - coalesce(t.total_withdrawals, 0) as current_balance,
  case when goal.target_amount > 0 then coalesce(t.total_contributions, 0) / goal.target_amount * 100 else 0 end as achievement_percentage,
  case when goal.status = 'COMPLETED' then 100 else 0 end as completion_percentage,
  goal.status,
  goal.target_date,
  goal.completed_at,
  goal.created_at,
  goal.updated_at
from public.savings_goals goal
left join transaction_totals t on t.goal_id = goal.id;

grant select on public.goal_metrics to authenticated;