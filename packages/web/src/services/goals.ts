export type GoalMetrics = {
  target_amount: number;
  total_contributions: number;
  total_goal_purchases: number;
  total_transfers_in: number;
  total_transfers_out: number;
  total_withdrawals: number;
  current_balance: number;
  achievement_percentage: number;
  completion_percentage: number;
  status: "ACTIVE" | "ACHIEVED" | "COMPLETED";
};

export const calculateGoalMetrics = (goal: Pick<GoalMetrics, "target_amount" | "total_contributions" | "status"> & Partial<GoalMetrics>): GoalMetrics => {
  const targetAmount = Number(goal.target_amount);
  const totalContributions = Number(goal.total_contributions);
  const totalGoalPurchases = Number(goal.total_goal_purchases ?? 0);
  const totalTransfersIn = Number(goal.total_transfers_in ?? 0);
  const totalTransfersOut = Number(goal.total_transfers_out ?? 0);
  const totalWithdrawals = Number(goal.total_withdrawals ?? 0);

  return {
    ...goal,
    target_amount: targetAmount,
    total_contributions: totalContributions,
    total_goal_purchases: totalGoalPurchases,
    total_transfers_in: totalTransfersIn,
    total_transfers_out: totalTransfersOut,
    total_withdrawals: totalWithdrawals,
    current_balance: totalContributions - totalGoalPurchases - totalTransfersOut + totalTransfersIn - totalWithdrawals,
    achievement_percentage: targetAmount > 0 ? totalContributions / targetAmount * 100 : 0,
    completion_percentage: goal.status === "COMPLETED" ? 100 : 0,
    status: goal.status,
  };
};