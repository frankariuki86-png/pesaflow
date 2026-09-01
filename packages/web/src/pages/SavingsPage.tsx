import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type SavingsTransaction = {
  id: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  description: string | null;
  created_at: string;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
}).format(amount || 0);

export default function SavingsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingForm, setSavingForm] = useState({ amount: "", description: "" });
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", description: "" });

  const loadSavings = async () => {
    if (!user?.id) return;

    const { data, error: queryError } = await supabase
      .from("savings_transactions")
      .select("id, kind, amount, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError("Unable to load savings statements.");
      return;
    }

    setTransactions((data as SavingsTransaction[]) ?? []);
    setError("");
    setLoading(false);
  };

  useEffect(() => { void loadSavings(); }, [user?.id]);

  const summary = useMemo(() => {
    const deposits = transactions.filter((item) => item.kind === "DEPOSIT").reduce((sum, item) => sum + Number(item.amount), 0);
    const withdrawals = transactions.filter((item) => item.kind === "WITHDRAWAL").reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      totalSaved: deposits,
      totalWithdrawn: withdrawals,
      currentSavings: deposits - withdrawals,
    };
  }, [transactions]);

  const saveMoney = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const amount = Number(savingForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid savings amount.");
      return;
    }

    const { error: saveError } = await supabase.rpc("save_money", {
      p_user_id: user.id,
      p_amount: amount,
      p_description: savingForm.description.trim() || "Saved money",
    });

    if (saveError) {
      setError(saveError.message || "Unable to save money.");
      return;
    }

    setSavingForm({ amount: "", description: "" });
    setMessage("Money saved successfully.");
    await loadSavings();
  };

  const withdrawMoney = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const amount = Number(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }

    const { error: withdrawError } = await supabase.rpc("withdraw_savings", {
      p_user_id: user.id,
      p_amount: amount,
      p_description: withdrawForm.description.trim() || "Withdrew money from savings",
    });

    if (withdrawError) {
      setError(withdrawError.message || "Unable to withdraw savings.");
      return;
    }

    setWithdrawForm({ amount: "", description: "" });
    setMessage("Savings withdrawal recorded successfully.");
    await loadSavings();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Built-in savings</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Savings</h1>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-sm text-muted">Current savings</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{formatCurrency(summary.currentSavings)}</h2>
        </div>
        <div className="rounded-3xl bg-emerald-50 p-6 shadow-soft">
          <p className="text-sm text-emerald">Total saved</p>
          <h2 className="mt-4 text-3xl font-semibold text-emerald">{formatCurrency(summary.totalSaved)}</h2>
        </div>
        <div className="rounded-3xl bg-red-50 p-6 shadow-soft">
          <p className="text-sm text-red-600">Total withdrawn</p>
          <h2 className="mt-4 text-3xl font-semibold text-red-600">{formatCurrency(summary.totalWithdrawn)}</h2>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={saveMoney} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Save money</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Amount</label>
              <input type="number" min="0" step="0.01" value={savingForm.amount} onChange={(event) => setSavingForm({ ...savingForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Description</label>
              <input value={savingForm.description} onChange={(event) => setSavingForm({ ...savingForm, description: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Monthly savings" />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-emerald px-4 py-3 font-semibold text-white">Save money</button>
          </div>
        </form>

        <form onSubmit={withdrawMoney} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Withdraw from savings</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Amount</label>
              <input type="number" min="0" step="0.01" value={withdrawForm.amount} onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">Description</label>
              <input value={withdrawForm.description} onChange={(event) => setWithdrawForm({ ...withdrawForm, description: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Emergency withdrawal" />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white">Withdraw savings</button>
          </div>
        </form>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-soft">
        <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          <div>Date</div>
          <div>Type</div>
          <div>Description</div>
          <div>Amount</div>
          <div>Balance</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted">Loading savings statement...</div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-sm text-muted">No savings movements yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((entry, index) => {
              const balanceAfter = transactions.slice(0, index + 1).reduce((sum, item) => {
                const delta = item.kind === "DEPOSIT" ? Number(item.amount) : -Number(item.amount);
                return sum + delta;
              }, 0);

              return (
                <div key={entry.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm text-text">
                  <div>{new Date(entry.created_at).toLocaleDateString()}</div>
                  <div className={entry.kind === "DEPOSIT" ? "text-emerald font-semibold" : "text-red-600 font-semibold"}>{entry.kind}</div>
                  <div>{entry.description || "No description"}</div>
                  <div className={entry.kind === "DEPOSIT" ? "text-emerald font-semibold" : "text-red-600 font-semibold"}>{entry.kind === "DEPOSIT" ? "+" : "-"}{formatCurrency(entry.amount)}</div>
                  <div className="font-semibold text-navy">{formatCurrency(balanceAfter)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
