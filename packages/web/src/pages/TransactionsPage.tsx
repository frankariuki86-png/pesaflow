import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type TransactionRow = {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  direction: "INCOME" | "EXPENSE" | "TRANSFER";
  source: string;
  occurred_at: string;
};

type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };
type SourceLabel = "M-Pesa" | "Cash" | "Bank" | "Other";

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(amount || 0);

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    categoryId: "",
    amount: "",
    description: "",
    source: "Cash" as SourceLabel,
  });

  const availableCategories = useMemo(
    () => categories.filter((category) => category.kind === form.type),
    [categories, form.type],
  );

  const loadTransactions = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", user.id)
      .order("name");

    if (categoryError) {
      console.error(categoryError);
      setError("Unable to load transactions.");
      setTransactions([]);
      setLoading(false);
      return;
    }

    let loadedCategories = (categoryData as Category[]) ?? [];
    if (loadedCategories.length === 0) {
      const defaults = [
        ...defaultExpenseCategories.map((name) => ({ user_id: user.id, name, kind: "EXPENSE" })),
        ...defaultIncomeCategories.map((name) => ({ user_id: user.id, name, kind: "INCOME" })),
      ];

      const { data: seededData, error: seedError } = await supabase
        .from("categories")
        .upsert(defaults, { onConflict: "user_id,name,kind" })
        .select("id, name, kind");

      if (seedError) {
        console.error(seedError);
        setError("Unable to load transactions.");
        setTransactions([]);
        setLoading(false);
        return;
      }

      loadedCategories = (seededData as Category[]) ?? [];
    }

    const { data: transactionResult, error: transactionError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(30);

    if (transactionError) {
      console.error(transactionError);
      setError("Unable to load transactions.");
      setTransactions([]);
      setLoading(false);
      return;
    }

    const preferredCategory =
      loadedCategories.find((item) => item.kind === form.type && item.name === "Uncategorized") ||
      loadedCategories.find((item) => item.kind === form.type) ||
      loadedCategories[0];

    setTransactions((transactionResult as TransactionRow[]) ?? []);
    setCategories(loadedCategories);
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId && loadedCategories.some((item) => item.id === current.categoryId)
        ? current.categoryId
        : preferredCategory?.id ?? "",
    }));
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    void loadTransactions();
  }, [user?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.type) {
        throw new Error("Please select a transaction type.");
      }

      if (!form.categoryId) {
        throw new Error("Please select a category.");
      }

      const amount = Number(form.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount.");
      }

      const category = categories.find((item) => item.id === form.categoryId);
      if (!category) {
        throw new Error("Please select a valid category.");
      }

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_name: "M-Pesa",
        category: category.name,
        description: form.description.trim() || null,
        amount,
        direction: form.type,
        source: toDbSource(form.source),
        occurred_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      setForm((current) => ({ ...current, amount: "", description: "", categoryId: availableCategories[0]?.id ?? "" }));
      setSuccess("Transaction added successfully.");
      await loadTransactions();
    } catch (error: any) {
      setError(error?.message || "Unable to create the transaction.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const name = newCategoryName.trim();
    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ user_id: user.id, name, kind: form.type })
        .select("id, name, kind")
        .single();

      if (error) throw error;
      const created = data as Category;
      setCategories((current) => [...current, created]);
      setForm((current) => ({ ...current, categoryId: created.id }));
      setNewCategoryName("");
      setShowCategoryForm(false);
    } catch (error: any) {
      setError(error?.message || "Unable to create the category.");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Money movement</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Transactions</h1>
        </div>
      </div>

      <div className="mb-6 rounded-3xl bg-white p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-navy">Add Transaction</h3>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text">Transaction Type</label>
            <select
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value as "INCOME" | "EXPENSE";
                const nextCategory = categories.find((item) => item.kind === nextType && item.name === "Uncategorized") || categories.find((item) => item.kind === nextType);
                setForm((current) => ({ ...current, type: nextType, categoryId: nextCategory?.id ?? "" }));
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
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
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
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                className="w-full border-0 bg-transparent px-3 py-3 text-right outline-none"
                placeholder="500.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text">Description (Optional)</label>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Lunch"
              className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text">Source</label>
            <select
              value={form.source}
              onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as SourceLabel }))}
              className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
            >
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-emerald px-4 py-3 font-semibold text-white disabled:opacity-70">
            {saving ? "Adding Transaction..." : "Add Transaction"}
          </button>
        </form>
        {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
      </div>

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
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCategoryForm(false)} className="rounded-2xl border border-border px-4 py-2 font-medium text-text">Cancel</button>
                <button type="submit" className="rounded-2xl bg-emerald px-4 py-2 font-semibold text-white">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl bg-white shadow-soft">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <div>Date</div>
            <div className="col-span-2">Description</div>
            <div>Source</div>
            <div className="text-right">Amount</div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-muted">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-sm text-muted">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm text-text">
                  <div>{new Date(transaction.occurred_at).toLocaleDateString()}</div>
                  <div className="col-span-2">
                    <p className="font-semibold">{transaction.description || "No description"}</p>
                    <p className="text-xs text-muted">{transaction.category}</p>
                  </div>
                  <div>{transaction.source}</div>
                  <div className={`text-right font-semibold ${transaction.direction === "INCOME" ? "text-emerald" : "text-red-600"}`}>
                    {transaction.direction === "INCOME" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
