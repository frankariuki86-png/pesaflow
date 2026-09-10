import { useEffect, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";
import { calculateGoalMetrics } from "../services/goals";

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  total_contributions: number;
  total_goal_purchases: number;
  total_transfers_in: number;
  total_transfers_out: number;
  total_withdrawals: number;
  current_balance: number;
  achievement_percentage: number;
  completion_percentage: number;
  target_date: string | null;
  status: "ACTIVE" | "ACHIEVED" | "COMPLETED";
  created_at: string;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
}).format(amount || 0);

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [goalForm, setGoalForm] = useState({
    name: "",
    target_amount: "",
    target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [allocationForm, setAllocationForm] = useState({
    goalId: "",
    amount: "",
    note: "",
    kind: "CONTRIBUTION" as "CONTRIBUTION" | "WITHDRAWAL",
  });
  const [purchaseForm, setPurchaseForm] = useState({
    goalId: "",
    amount: "",
    note: "",
  });
  const [transferForm, setTransferForm] = useState({
    sourceGoalId: "",
    destinationGoalId: "",
    amount: "",
    kind: "AVAILABLE_MONEY" as "AVAILABLE_MONEY" | "GOAL",
  });

  const activeGoals = goals.filter((goal) => goal.status !== "COMPLETED");
  const completedGoals = goals.filter((goal) => goal.status === "COMPLETED" && Number(goal.saved_amount) > 0);
  const openGoalOptions = activeGoals.map((goal) => ({ label: goal.name, value: goal.id }));

  const loadData = async () => {
    if (!user?.id) return;

    const { data, error: goalsError } = await supabase
      .from("goal_metrics")
      .select("id, name, target_amount, total_contributions, total_goal_purchases, total_transfers_in, total_transfers_out, total_withdrawals, current_balance, achievement_percentage, completion_percentage, target_date, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsError) {
      setError("Unable to load goals.");
      setLoading(false);
      return;
    }

    const loadedGoals = ((data as Goal[]) ?? []).map((goal) => ({ ...goal, saved_amount: Number(goal.current_balance) }));
    setGoals(loadedGoals);
    setAllocationForm((current) => ({
      ...current,
      goalId: current.goalId || loadedGoals.find((goal) => goal.status !== "COMPLETED")?.id || "",
    }));
    setPurchaseForm((current) => ({
      ...current,
      goalId: current.goalId || loadedGoals.find((goal) => goal.status !== "COMPLETED")?.id || "",
    }));
    setTransferForm((current) => ({
      ...current,
      sourceGoalId: current.sourceGoalId || loadedGoals.find((goal) => goal.status === "COMPLETED")?.id || "",
    }));
    setLoading(false);
    setError("");
  };

  useEffect(() => { void loadData(); }, [user?.id]);

  const createGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const targetAmount = Number(goalForm.target_amount);
    if (!goalForm.name.trim() || Number.isNaN(targetAmount) || targetAmount <= 0) {
      setError("Provide a goal name and a valid target amount.");
      return;
    }

    const { error: insertError } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: goalForm.name.trim(),
      target_amount: targetAmount,
      saved_amount: 0,
      target_date: goalForm.target_date,
      status: "ACTIVE",
    });

    if (insertError) {
      setError(insertError.message || "Unable to create goal.");
      return;
    }

    setGoalForm({
      name: "",
      target_amount: "",
      target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    setMessage("Goal created successfully.");
    await loadData();
  };

  const handleAllocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const goal = goals.find((item) => item.id === allocationForm.goalId);
    if (!goal) {
      setError("Select a valid goal.");
      return;
    }

    if (goal.status === "COMPLETED") {
      setError("Completed goals cannot accept contributions or withdrawals.");
      return;
    }

    const amount = Number(allocationForm.amount);
    if (!allocationForm.goalId || !Number.isFinite(amount) || amount <= 0) {
      setError("Select a goal and enter a valid amount.");
      return;
    }

    const rpcName = allocationForm.kind === "CONTRIBUTION" ? "contribute_to_goal" : "withdraw_from_goal";
    const { error: rpcError } = await supabase.rpc(rpcName, {
      p_user_id: user.id,
      p_goal_id: allocationForm.goalId,
      p_amount: amount,
      p_description: allocationForm.note.trim() || (allocationForm.kind === "CONTRIBUTION" ? "Goal contribution" : "Goal withdrawal"),
    });

    if (rpcError) {
      setError(rpcError.message || "Unable to update goal.");
      return;
    }

    setAllocationForm({
      goalId: allocationForm.goalId,
      amount: "",
      note: "",
      kind: allocationForm.kind,
    });
    setMessage(`${allocationForm.kind === "CONTRIBUTION" ? "Contribution" : "Withdrawal"} recorded successfully.`);
    await loadData();
  };

  const handleGoalPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const goal = goals.find((item) => item.id === purchaseForm.goalId);
    if (!goal) {
      setError("Select a valid goal.");
      return;
    }

    if (goal.status === "COMPLETED") {
      setError("This goal is already completed and closed.");
      return;
    }

    const amount = Number(purchaseForm.amount);
    if (!purchaseForm.goalId || !Number.isFinite(amount) || amount <= 0) {
      setError("Select a goal and enter a valid purchase amount.");
      return;
    }

    if (amount > Number(goal.saved_amount)) {
      setError("Insufficient goal balance.");
      return;
    }

    const { error: purchaseError } = await supabase.rpc("spend_from_goal", {
      p_user_id: user.id,
      p_goal_id: purchaseForm.goalId,
      p_amount: amount,
      p_category: "Other",
      p_description: purchaseForm.note.trim() || "Goal purchase",
      p_occurred_at: new Date().toISOString(),
    });

    if (purchaseError) {
      setError(purchaseError.message || "Unable to complete the goal purchase.");
      return;
    }

    setPurchaseForm({
      goalId: purchaseForm.goalId,
      amount: "",
      note: "",
    });
    setMessage("Goal purchase recorded and the goal was closed.");
    await loadData();
  };

  const handleTransferRemainingBalance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const sourceGoal = goals.find((goal) => goal.id === transferForm.sourceGoalId);
    if (!sourceGoal || sourceGoal.status !== "COMPLETED") {
      setError("Select a completed goal to transfer from.");
      return;
    }

    const amount = Number(transferForm.amount);
    const availableBalance = Number(sourceGoal.saved_amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > availableBalance) {
      setError("Transfer amount must be greater than zero and cannot exceed the remaining goal balance.");
      return;
    }

    if (transferForm.kind === "AVAILABLE_MONEY") {
      const { error: transferError } = await supabase.rpc("transfer_completed_goal_to_available_money", {
        p_user_id: user.id,
        p_goal_id: sourceGoal.id,
        p_amount: amount,
        p_description: "Transferred remaining goal balance to available money",
        p_occurred_at: new Date().toISOString(),
      });

      if (transferError) {
        setError(transferError.message || "Unable to transfer remaining balance.");
        return;
      }

      setTransferForm({
        sourceGoalId: transferForm.sourceGoalId,
        destinationGoalId: "",
        amount: "",
        kind: "AVAILABLE_MONEY",
      });
      setMessage("Remaining goal balance transferred to available money.");
      await loadData();
      return;
    }

    if (!transferForm.destinationGoalId) {
      setError("Select a destination goal for the transfer.");
      return;
    }

    const destinationGoal = goals.find((goal) => goal.id === transferForm.destinationGoalId);
    if (!destinationGoal || destinationGoal.status !== "ACTIVE") {
      setError("Destination goal must be ACTIVE.");
      return;
    }

    const { error: transferError } = await supabase.rpc("transfer_completed_goal_to_goal", {
      p_user_id: user.id,
      p_source_goal_id: sourceGoal.id,
      p_destination_goal_id: destinationGoal.id,
      p_amount: amount,
      p_description: "Transferred remaining goal balance to another goal",
      p_occurred_at: new Date().toISOString(),
    });

    if (transferError) {
      setError(transferError.message || "Unable to transfer remaining balance to another goal.");
      return;
    }

    setTransferForm({
      sourceGoalId: transferForm.sourceGoalId,
      destinationGoalId: "",
      amount: "",
      kind: "AVAILABLE_MONEY",
    });
    setMessage("Remaining goal balance transferred to another active goal.");
    await loadData();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Targets</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Goals</h1>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={createGoal} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Create goal</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Goal name</label>
              <input value={goalForm.name} onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Emergency fund" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Target amount</label>
              <input type="number" min="0" step="0.01" value={goalForm.target_amount} onChange={(event) => setGoalForm({ ...goalForm, target_amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Deadline</label>
              <input type="date" value={goalForm.target_date} onChange={(event) => setGoalForm({ ...goalForm, target_date: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-emerald px-4 py-3 font-semibold text-white">Save goal</button>
          </div>
        </form>

        <form onSubmit={handleAllocation} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Goal transfer</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Goal</label>
              <select value={allocationForm.goalId} onChange={(event) => setAllocationForm({ ...allocationForm, goalId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select goal</option>
                {openGoalOptions.map((goal) => (
                  <option key={goal.value} value={goal.value}>{goal.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Action</label>
              <select value={allocationForm.kind} onChange={(event) => setAllocationForm({ ...allocationForm, kind: event.target.value as "CONTRIBUTION" | "WITHDRAWAL" })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="CONTRIBUTION">Contribution</option>
                <option value="WITHDRAWAL">Withdrawal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Amount</label>
              <input type="number" min="0" step="0.01" value={allocationForm.amount} onChange={(event) => setAllocationForm({ ...allocationForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Note</label>
              <input value={allocationForm.note} onChange={(event) => setAllocationForm({ ...allocationForm, note: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Monthly contribution" />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white">Save update</button>
          </div>
        </form>

        <form onSubmit={handleGoalPurchase} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Complete goal</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Goal</label>
              <select value={purchaseForm.goalId} onChange={(event) => setPurchaseForm({ ...purchaseForm, goalId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select goal</option>
                {openGoalOptions.map((goal) => (
                  <option key={goal.value} value={goal.value}>{goal.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Purchase amount</label>
              <input type="number" min="0" step="0.01" value={purchaseForm.amount} onChange={(event) => setPurchaseForm({ ...purchaseForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="2500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Description</label>
              <input value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Bought laptop" />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-rose-600 px-4 py-3 font-semibold text-white">Complete goal / make purchase</button>
          </div>
        </form>
      </div>

      {completedGoals.length > 0 && (
        <form onSubmit={handleTransferRemainingBalance} className="mt-8 rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Transfer remaining balance</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-text">Completed goal</label>
              <select value={transferForm.sourceGoalId} onChange={(event) => setTransferForm({ ...transferForm, sourceGoalId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select goal</option>
                {completedGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Destination</label>
              <select value={transferForm.kind} onChange={(event) => setTransferForm({ ...transferForm, kind: event.target.value as "AVAILABLE_MONEY" | "GOAL" })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="AVAILABLE_MONEY">Available money</option>
                <option value="GOAL">Another active goal</option>
              </select>
            </div>
            {transferForm.kind === "GOAL" && (
              <div>
                <label className="block text-sm font-medium text-text">Destination goal</label>
                <select value={transferForm.destinationGoalId} onChange={(event) => setTransferForm({ ...transferForm, destinationGoalId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                  <option value="">Select destination</option>
                  {activeGoals.filter((goal) => goal.id !== transferForm.sourceGoalId).map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text">Amount</label>
              <input type="number" min="0" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="2500" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white">Transfer remaining balance</button>
          </div>
        </form>
      )}

      <div className="mt-8 overflow-x-auto rounded-3xl bg-white shadow-soft">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <div>Goal</div>
            <div>Saved</div>
            <div>Target</div>
            <div>Progress</div>
            <div>Status</div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-muted">Loading goals...</div>
          ) : goals.length === 0 ? (
            <div className="p-6 text-sm text-muted">No goals yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {goals.map((goal) => {
                const metrics = calculateGoalMetrics(goal);
                const achievementPercent = metrics.achievement_percentage;
                const currentStatus = goal.status || (goal.saved_amount >= goal.target_amount ? "ACHIEVED" : "ACTIVE");
                const isClosed = currentStatus === "COMPLETED";
                const completionPercent = metrics.completion_percentage;
                const remainingBalance = Math.max(metrics.current_balance, 0);
                return (
                  <div key={goal.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm text-text">
                    <div>
                      <div className="font-semibold">{goal.name}</div>
                      <div className="text-xs text-muted">{goal.target_date ? new Date(goal.target_date).toLocaleDateString() : "No deadline"}</div>
                    </div>
                    <div>{formatCurrency(goal.saved_amount)}</div>
                    <div>{formatCurrency(goal.target_amount)}</div>
                    <div>
                      <div className="mb-1 text-xs text-muted">{achievementPercent.toFixed(0)}% achieved</div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald" style={{ width: `${Math.min(achievementPercent, 100)}%` }} />
                      </div>
                      {isClosed && <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{completionPercent}% complete</div>}
                    </div>
                    <div className="space-y-1">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isClosed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {currentStatus}
                      </span>
                      {isClosed && remainingBalance > 0 && (
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Balance {formatCurrency(remainingBalance)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
