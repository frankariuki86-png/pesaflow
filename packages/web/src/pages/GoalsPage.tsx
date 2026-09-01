import { useEffect, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
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

  const loadData = async () => {
    if (!user?.id) return;

    const { data, error: goalsError } = await supabase
      .from("savings_goals")
      .select("id, name, target_amount, saved_amount, target_date, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsError) {
      setError("Unable to load goals.");
      setLoading(false);
      return;
    }

    setGoals((data as Goal[]) ?? []);
    setAllocationForm((current) => ({
      ...current,
      goalId: current.goalId || (data as Goal[] | undefined)?.[0]?.id || "",
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

      <div className="grid gap-6 xl:grid-cols-2">
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
          <h2 className="text-xl font-semibold text-navy">Goal update</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Goal</label>
              <select value={allocationForm.goalId} onChange={(event) => setAllocationForm({ ...allocationForm, goalId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
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
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-soft">
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
              const progress = goal.target_amount > 0 ? Math.min((goal.saved_amount / goal.target_amount) * 100, 100) : 0;
              const isComplete = goal.saved_amount >= goal.target_amount;
              return (
                <div key={goal.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm text-text">
                  <div>
                    <div className="font-semibold">{goal.name}</div>
                    <div className="text-xs text-muted">{goal.target_date ? new Date(goal.target_date).toLocaleDateString() : "No deadline"}</div>
                  </div>
                  <div>{formatCurrency(goal.saved_amount)}</div>
                  <div>{formatCurrency(goal.target_amount)}</div>
                  <div>
                    <div className="mb-1 text-xs text-muted">{progress.toFixed(0)}%</div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {isComplete ? "Completed" : "Active"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
