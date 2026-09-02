import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";
import ChartCard from "../components/charts/ChartCard";
import IncomeExpenseChart from "../components/charts/IncomeExpenseChart";
import SpendingTrendChart from "../components/charts/SpendingTrendChart";
import ExpenseCategoryChart from "../components/charts/ExpenseCategoryChart";
import IncomeSourceChart from "../components/charts/IncomeSourceChart";
import {
  buildCategorySeries,
  buildIncomeExpenseSeries,
  buildSourceSeries,
  buildSummary,
  buildTrendSeries,
  formatCurrency,
  type TransactionLike,
} from "../services/analytics";

type DashboardTransaction = TransactionLike;
type Direction = "INCOME" | "EXPENSE";
type CategoryRow = { id: string; name: string; kind: Direction };
type SourceLabel = "M-Pesa" | "Cash" | "Bank" | "Other";

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

type SavingsGoal = {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  achievement_percentage: number;
  target_date: string | null;
};

const defaultExpenseCategories = [
  "Food",
  "Transport",
  "Rent",
  "Utilities",
  "Airtime",
  "Internet",
  "Shopping",
  "Entertainment",
  "Education",
  "Medical",
  "Family",
  "Loans",
  "Savings",
  "Business",
  "Other",
  "Uncategorized",
];

const defaultIncomeCategories = [
  "Salary",
  "Business",
  "Freelance",
  "Gift",
  "Transfer",
  "Other Income",
  "Uncategorized",
];

const sourceOptions: SourceLabel[] = ["M-Pesa", "Cash", "Bank", "Other"];

const toDbSource = (source: SourceLabel) => {
  switch (source) {
    case "M-Pesa":
      return "MPESA";
    case "Cash":
      return "MANUAL";
    case "Bank":
      return "BANK";
    case "Other":
      return "IMPORT";
    default:
      return "MANUAL";
  }
};

const toLabelSource = (source: string): SourceLabel => {
  switch (source) {
    case "MPESA":
      return "M-Pesa";
    case "BANK":
      return "Bank";
    case "IMPORT":
      return "Other";
    case "MANUAL":
    default:
      return "Cash";
  }
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [dashboardSummary, setDashboardSummary] = useState({
    total_income: 0,
    total_expenses: 0,
    balance: 0,
    monthly_income: 0,
    monthly_expenses: 0,
    monthly_savings: 0,
    cash_flow: 0,
  });
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [transactionForm, setTransactionForm] = useState({
    type: "EXPENSE" as Direction,
    categoryId: "",
    amount: "",
    description: "",
    source: "Cash" as SourceLabel,
  });

  const [goalForm, setGoalForm] = useState({
    name: "",
    target_amount: "",
    target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const availableCategories = useMemo(
    () => categoryOptions.filter((category) => category.kind === transactionForm.type),
    [categoryOptions, transactionForm.type],
  );

  const selectedCategory = useMemo(
    () => categoryOptions.find((category) => category.id === transactionForm.categoryId) ?? null,
    [categoryOptions, transactionForm.categoryId],
  );

  const loadCategoryOptions = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase.from("categories").select("*").eq("user_id", user.id).order("name");
    if (error) {
      throw error;
    }

    const loadedCategories = (data as CategoryRow[]) ?? [];
    if (loadedCategories.length === 0) {
      const seedCategories = [
        ...defaultExpenseCategories.map((name) => ({ user_id: user.id, name, kind: "EXPENSE" })),
        ...defaultIncomeCategories.map((name) => ({ user_id: user.id, name, kind: "INCOME" })),
      ];

      const { data: seededData, error: seedError } = await supabase
        .from("categories")
        .upsert(seedCategories, { onConflict: "user_id,name,kind" })
        .select("*");

      if (seedError) throw seedError;
      setCategoryOptions((seededData as CategoryRow[]) ?? []);
      return;
    }

    setCategoryOptions(loadedCategories);
  };

  const fetchDashboardData = async () => {
    if (!user?.id) return;

    const [transactionsResult, goalsResult, summaryResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(25),
      supabase.from("goal_metrics").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.rpc("get_personal_finance_summary", { p_user_id: user.id }),
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (goalsResult.error) throw goalsResult.error;
    if (summaryResult.error) throw summaryResult.error;

    const summaryRow = summaryResult.data?.[0] ?? summaryResult.data ?? null;
    const totals = {
      total_income: Number(summaryRow?.income_total ?? 0),
      total_expenses: Number(summaryRow?.expense_total ?? 0),
      balance: Number(summaryRow?.available_money ?? 0),
      monthly_income: Number(summaryRow?.income_total ?? 0),
      monthly_expenses: Number(summaryRow?.expense_total ?? 0),
      monthly_savings: Number(summaryRow?.savings_balance ?? 0),
      cash_flow: Number(summaryRow?.available_money ?? 0),
    };

    setTransactions((transactionsResult.data as DashboardTransaction[]) ?? []);
    setGoals((goalsResult.data as SavingsGoal[]) ?? []);
    setDashboardSummary(totals);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setSummaryError("");
        if (!user?.id) return;
        await loadCategoryOptions();
        await fetchDashboardData();
      } catch (error) {
        console.error("Failed to load dashboard", error);
        setSummaryError(error instanceof Error ? error.message : "Unable to load your financial summary.");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user?.id]);

  useEffect(() => {
    if (!availableCategories.length) return;

    const preferredCategory =
      availableCategories.find((category) => category.name === "Uncategorized") ?? availableCategories[0];

    setTransactionForm((current) => ({
      ...current,
      categoryId: current.categoryId && availableCategories.some((category) => category.id === current.categoryId)
        ? current.categoryId
        : preferredCategory.id,
    }));
  }, [availableCategories]);

  const summary = useMemo(() => ({
    balance: dashboardSummary.balance,
    monthlyIncome: dashboardSummary.monthly_income,
    monthlyExpenses: dashboardSummary.monthly_expenses,
    goalProgress: goals.length
      ? goals.reduce((sum, goal) => sum + Number(goal.achievement_percentage ?? 0), 0) / goals.length
      : 0,
  }), [dashboardSummary, goals]);

  const incomeExpenseData = useMemo(() => buildIncomeExpenseSeries(transactions, "month"), [transactions]);
  const spendingTrendData = useMemo(() => buildTrendSeries(transactions, "month"), [transactions]);
  const expenseCategoryData = useMemo(() => buildCategorySeries(transactions), [transactions]);
  const incomeSourceData = useMemo(() => buildSourceSeries(transactions), [transactions]);
  const summaryTotals = useMemo(() => buildSummary(transactions), [transactions]);

  const handleTransactionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    try {
      if (!transactionForm.type) {
        throw new Error("Please select a transaction type.");
      }

      if (!transactionForm.categoryId) {
        throw new Error("Please select a category.");
      }

      const amount = Number(transactionForm.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount.");
      }

      const chosenCategory = categoryOptions.find((category) => category.id === transactionForm.categoryId);
      if (!chosenCategory) {
        throw new Error("Please select a valid category.");
      }

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_name: "M-Pesa",
        category: chosenCategory.name,
        description: transactionForm.description.trim() || null,
        amount,
        direction: transactionForm.type,
        source: toDbSource(transactionForm.source),
        occurred_at: new Date().toISOString(),
      });

      if (error) throw error;

      setTransactionForm({
        type: "EXPENSE",
        categoryId: availableCategories[0]?.id ?? "",
        amount: "",
        description: "",
        source: "Cash",
      });
      setShowTransactionForm(false);
      setSuccessMessage("Transaction added successfully.");
      await loadCategoryOptions();
      await fetchDashboardData();
    } catch (error: any) {
      setFormError(error?.message || "Unable to save this transaction.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setFormError("");
    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      setFormError("Please enter a category name.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: categoryName,
          kind: transactionForm.type,
        })
        .select("*")
        .single();

      if (error) throw error;

      const insertedCategory = data as CategoryRow;
      setCategoryOptions((current) => [...current, insertedCategory]);
      setTransactionForm((current) => ({ ...current, categoryId: insertedCategory.id }));
      setNewCategoryName("");
      setShowCategoryForm(false);
    } catch (error: any) {
      setFormError(error?.message || "Unable to create the category.");
    }
  };

  const handleGoalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setFormError("");

    try {
      const targetAmount = Number(goalForm.target_amount);
      if (!goalForm.name.trim() || Number.isNaN(targetAmount) || targetAmount <= 0) {
        throw new Error("Please give your goal a name and a valid target amount.");
      }

      const { error } = await supabase.from("savings_goals").insert({
        user_id: user.id,
        name: goalForm.name.trim(),
        target_amount: targetAmount,
        saved_amount: 0,
        target_date: goalForm.target_date,
      });

      if (error) throw error;

      setGoalForm({
        name: "",
        target_amount: "",
        target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      setShowGoalForm(false);
      await fetchDashboardData();
    } catch (error: any) {
      setFormError(error?.message || "Unable to save this goal.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  const topCategories = expenseCategoryData.slice(0, 5);
  const greeting = getGreeting(now);
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || "";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Overview</p>
          <h1 className="mt-2 text-2xl font-semibold text-navy sm:text-3xl">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowTransactionForm(true)} className="rounded-2xl bg-emerald px-4 py-2.5 font-semibold text-white hover:bg-emerald-600">
            + Add transaction
          </button>
          <button onClick={() => setShowGoalForm(true)} className="rounded-2xl border-2 border-emerald bg-white px-4 py-2.5 font-semibold text-emerald hover:bg-emerald-50">
            + New goal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-soft text-muted">Loading dashboard...</div>
      ) : summaryError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-soft">
          <p className="font-semibold">Unable to load your financial summary.</p>
          <p className="mt-2 text-sm">Please try again.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-white p-6 shadow-soft">
              <p className="text-sm text-muted">Total income</p>
              <h2 className="mt-4 text-3xl font-semibold text-navy">{formatCurrency(dashboardSummary.total_income)}</h2>
              <p className="mt-2 text-sm text-muted">Across tracked transactions</p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-6 shadow-soft">
              <p className="text-sm text-emerald">Total expenses</p>
              <h2 className="mt-4 text-3xl font-semibold text-emerald">{formatCurrency(dashboardSummary.total_expenses)}</h2>
              <p className="mt-2 text-sm text-emerald/80">Updated from your latest records</p>
            </div>
            <div className="rounded-3xl bg-red-50 p-6 shadow-soft">
              <p className="text-sm text-red-600">Balance</p>
              <h2 className="mt-4 text-3xl font-semibold text-red-600">{formatCurrency(dashboardSummary.balance)}</h2>
              <p className="mt-2 text-sm text-red-500/80">Net cash position</p>
            </div>
            <div className="rounded-3xl bg-sky-50 p-6 shadow-soft">
              <p className="text-sm text-sky-700">Savings</p>
              <h2 className="mt-4 text-3xl font-semibold text-sky-700">{formatCurrency(dashboardSummary.monthly_savings)}</h2>
              <p className="mt-2 text-sm text-sky-600">Monthly surplus</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <ChartCard title="Income vs expenses">
              <IncomeExpenseChart data={incomeExpenseData} />
            </ChartCard>
            <ChartCard title="Spending trend">
              <SpendingTrendChart data={spendingTrendData} />
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <ChartCard title="Expenses by category">
              <ExpenseCategoryChart data={expenseCategoryData} />
            </ChartCard>
            <ChartCard title="Income by source">
              <IncomeSourceChart data={incomeSourceData} />
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-3xl bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-navy">Recent activity</h3>
                <button onClick={() => navigate("/transactions")} className="text-sm font-semibold text-emerald hover:underline">
                  View all
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No transactions yet. Add your first transaction to get started.</div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 6).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-border bg-slate-50 p-4">
                      <div>
                        <p className="font-semibold text-text">{transaction.description || "No description"}</p>
                        <p className="text-xs text-muted">{transaction.category} • {new Date(transaction.occurred_at).toLocaleDateString()} • {toLabelSource(transaction.source || "MANUAL")}</p>
                      </div>
                      <div className={`text-right font-semibold ${transaction.direction === "INCOME" ? "text-emerald" : "text-red-600"}`}>
                        {transaction.direction === "INCOME" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-navy">Top spending categories</h3>
              </div>

              {topCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No spending data yet.</div>
              ) : (
                <div className="space-y-4">
                  {topCategories.map((item) => {
                    const max = Math.max(...topCategories.map((entry) => entry.value), 1);
                    const width = (item.value / max) * 100;

                    return (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-text">{item.name}</span>
                          <span className="font-semibold text-navy">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showTransactionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-navy">Add Transaction</h3>
              <button type="button" onClick={() => setShowTransactionForm(false)} className="text-sm text-muted hover:text-text">Close</button>
            </div>

            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">Transaction Type</label>
                <select
                  value={transactionForm.type}
                  onChange={(event) => {
                    const nextType = event.target.value as Direction;
                    const nextCategory = categoryOptions.find((category) => category.kind === nextType && category.name === "Uncategorized") ?? categoryOptions.find((category) => category.kind === nextType);
                    setTransactionForm((current) => ({ ...current, type: nextType, categoryId: nextCategory?.id ?? "" }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text">Category</label>
                <select
                  value={transactionForm.categoryId}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                >
                  <option value="">Select Category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowCategoryForm(true)} className="mt-3 text-left text-sm font-semibold text-emerald hover:underline">
                  + Add Category
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-text">Amount</label>
                <div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-border bg-white">
                  <span className="px-4 py-3 text-sm font-semibold text-muted">KES</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
                    className="w-full border-0 bg-transparent px-3 py-3 text-right outline-none"
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text">Description (Optional)</label>
                <input
                  value={transactionForm.description}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                  placeholder="Lunch"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text">Source</label>
                <select
                  value={transactionForm.source}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, source: event.target.value as SourceLabel }))}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                >
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              {formError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
              {successMessage && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTransactionForm(false)} className="rounded-2xl border border-border px-4 py-2 font-medium text-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-2xl bg-emerald px-4 py-2 font-semibold text-white disabled:opacity-70">
                  {saving ? "Adding Transaction..." : "Add Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft">
            <h3 className="text-xl font-semibold text-navy">Add Category</h3>
            <form onSubmit={handleAddCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">Category Name</label>
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                  placeholder="Personal Care"
                />
              </div>

              {formError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCategoryForm(false)} className="rounded-2xl border border-border px-4 py-2 font-medium text-text">Cancel</button>
                <button type="submit" className="rounded-2xl bg-emerald px-4 py-2 font-semibold text-white">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGoalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-navy">Add savings goal</h3>
              <button type="button" onClick={() => setShowGoalForm(false)} className="text-sm text-muted hover:text-text">Close</button>
            </div>

            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">Goal name</label>
                <input value={goalForm.name} onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none" placeholder="Emergency fund" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-text">Target amount</label>
                  <input type="number" min="0" step="0.01" value={goalForm.target_amount} onChange={(event) => setGoalForm((current) => ({ ...current, target_amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text">Target date</label>
                  <input type="date" value={goalForm.target_date} onChange={(event) => setGoalForm((current) => ({ ...current, target_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none" />
                </div>
              </div>

              {formError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowGoalForm(false)} className="rounded-2xl border border-border px-4 py-2 font-medium text-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-2xl bg-emerald px-4 py-2 font-semibold text-white disabled:opacity-70">{saving ? "Saving..." : "Save goal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
