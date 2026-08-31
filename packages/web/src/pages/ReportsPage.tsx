import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";
import ChartCard from "../components/charts/ChartCard";
import IncomeExpenseChart from "../components/charts/IncomeExpenseChart";
import SpendingTrendChart from "../components/charts/SpendingTrendChart";
import ExpenseCategoryChart from "../components/charts/ExpenseCategoryChart";
import IncomeSourceChart from "../components/charts/IncomeSourceChart";
import PaymentMethodChart from "../components/charts/PaymentMethodChart";
import {
  buildCategorySeries,
  buildIncomeExpenseSeries,
  buildPaymentMethodSeries,
  buildSourceSeries,
  buildSummary,
  buildTrendSeries,
  filterTransactions,
  formatCurrency,
  type TransactionLike,
} from "../services/analytics";

type Transaction = TransactionLike;
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };
type Source = { id: string; name: string };

const defaultFilters = {
  range: "month",
  type: "ALL",
  category: "ALL",
  source: "ALL",
  fromDate: "",
  toDate: "",
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const [transactionResult, categoryResult, sourceResult] = await Promise.all([
        supabase.from("transactions").select("id, description, category, source, direction, amount, occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(1000),
        supabase.from("categories").select("id, name, kind").eq("user_id", user.id).order("name"),
        supabase.from("financial_sources").select("id, name").eq("user_id", user.id).order("name"),
      ]);

      if (transactionResult.error || categoryResult.error || sourceResult.error) {
        setError("Unable to load report data.");
      } else {
        setTransactions((transactionResult.data as Transaction[]) ?? []);
        setCategories((categoryResult.data as Category[]) ?? []);
        setSources((sourceResult.data as Source[]) ?? []);
      }
      setLoading(false);
    };

    void load();
  }, [user?.id]);

  const filtered = useMemo(
    () =>
      filterTransactions(
        transactions,
        appliedFilters.range,
        appliedFilters.type,
        appliedFilters.category,
        appliedFilters.source,
        appliedFilters.fromDate || undefined,
        appliedFilters.toDate || undefined,
      ),
    [transactions, appliedFilters],
  );

  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const incomeExpenseSeries = useMemo(() => buildIncomeExpenseSeries(filtered, appliedFilters.range), [filtered, appliedFilters.range]);
  const spendingTrendSeries = useMemo(() => buildTrendSeries(filtered, appliedFilters.range), [filtered, appliedFilters.range]);
  const categoryData = useMemo(() => buildCategorySeries(filtered), [filtered]);
  const sourceData = useMemo(() => buildSourceSeries(filtered), [filtered]);
  const paymentData = useMemo(() => buildPaymentMethodSeries(filtered), [filtered]);

  const exportCsv = () => {
    const rows = [["Date", "Type", "Category", "Source", "Description", "Amount"], ...filtered.map((item) => [new Date(item.occurred_at).toISOString(), item.direction, item.category, item.source, item.description || "", String(item.amount)])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "pesaflow-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Insights</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Financial reports</h1>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="rounded-2xl bg-emerald px-4 py-2.5 font-semibold text-white disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))} className="rounded-xl border border-border px-3 py-2">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="rounded-xl border border-border px-3 py-2">
            <option value="ALL">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-border px-3 py-2">
            <option value="ALL">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} className="rounded-xl border border-border px-3 py-2">
            <option value="ALL">All sources</option>
            {sources.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} className="rounded-xl border border-border px-3 py-2" />
          <input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} className="rounded-xl border border-border px-3 py-2" />
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={() => setAppliedFilters(filters)} className="rounded-2xl bg-emerald px-4 py-2.5 font-semibold text-white">Apply Filters</button>
          <button onClick={resetFilters} className="rounded-2xl border border-border px-4 py-2.5 font-semibold text-text">Reset</button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-6 text-muted shadow-soft">Loading report...</div>
      ) : (
        <>
          <div className="mb-8 grid gap-6 md:grid-cols-3">
            <Metric label="Total income" value={formatCurrency(summary.income)} color="text-emerald" />
            <Metric label="Total expenses" value={formatCurrency(summary.expenses)} color="text-red-600" />
            <Metric label="Net balance" value={formatCurrency(summary.income - summary.expenses)} color="text-navy" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Income vs expense">
              <IncomeExpenseChart data={incomeExpenseSeries} />
            </ChartCard>
            <ChartCard title="Spending by category">
              <ExpenseCategoryChart data={categoryData} />
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <ChartCard title="Spending trend">
              <SpendingTrendChart data={spendingTrendSeries} />
            </ChartCard>
            <ChartCard title="Income by source">
              <IncomeSourceChart data={sourceData} />
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <ChartCard title="Payment method distribution">
              <PaymentMethodChart data={paymentData} />
            </ChartCard>
            <ChartCard title="Filtered transactions">
              <div className="max-h-[320px] overflow-auto rounded-2xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-muted">No transactions match the selected filters.</td>
                      </tr>
                    ) : (
                      filtered.slice(0, 12).map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-3">{new Date(item.occurred_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{item.direction}</td>
                          <td className="px-4 py-3">{item.category}</td>
                          <td className={`px-4 py-3 font-semibold ${item.direction === "INCOME" ? "text-emerald" : "text-red-600"}`}>{formatCurrency(item.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
