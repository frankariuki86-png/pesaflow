export type TxDirection = "INCOME" | "EXPENSE" | "TRANSFER";

export type TransactionLike = {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  direction: TxDirection;
  source: string;
  occurred_at: string;
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(amount || 0);

export function getRangeBounds(range: string, fromDate?: string, toDate?: string) {
  const now = new Date();
  const end = toDate ? new Date(`${toDate}T23:59:59`) : new Date(now);

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    return { start, end };
  }

  const start = new Date(now);

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

export function filterTransactions(
  transactions: TransactionLike[],
  range: string,
  type: string,
  category: string,
  source: string,
  fromDate?: string,
  toDate?: string,
) {
  const { start, end } = getRangeBounds(range, fromDate, toDate);

  return transactions.filter((transaction) => {
    const txDate = new Date(transaction.occurred_at);
    const withinDate = txDate >= start && txDate <= end;
    const matchesType = type === "ALL" || transaction.direction === type;
    const matchesCategory = category === "ALL" || transaction.category === category;
    const matchesSource = source === "ALL" || transaction.source === source;

    return withinDate && matchesType && matchesCategory && matchesSource;
  });
}

export function buildSummary(transactions: TransactionLike[]) {
  return transactions.reduce(
    (acc, transaction) => {
      if (transaction.direction === "INCOME") acc.income += Number(transaction.amount || 0);
      if (transaction.direction === "EXPENSE") acc.expenses += Number(transaction.amount || 0);
      return acc;
    },
    { income: 0, expenses: 0, balance: 0 },
  );
}

export function buildIncomeExpenseSeries(transactions: TransactionLike[], range: string) {
  const { start, end } = getRangeBounds(range);
  const bucketMap = new Map<string, { label: string; income: number; expenses: number }>();

  transactions.forEach((transaction) => {
    const txDate = new Date(transaction.occurred_at);
    if (txDate < start || txDate > end) return;

    const key =
      range === "year"
        ? new Date(txDate.getFullYear(), txDate.getMonth(), 1).toISOString().slice(0, 7)
        : new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).toISOString().slice(0, 10);

    const label =
      range === "year"
        ? new Date(txDate.getFullYear(), txDate.getMonth(), 1).toLocaleDateString("en-KE", { month: "short" })
        : new Date(txDate).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

    const current = bucketMap.get(key) ?? { label, income: 0, expenses: 0 };
    if (transaction.direction === "INCOME") current.income += Number(transaction.amount || 0);
    if (transaction.direction === "EXPENSE") current.expenses += Number(transaction.amount || 0);
    bucketMap.set(key, current);
  });

  return Array.from(bucketMap.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function buildCategorySeries(transactions: TransactionLike[]) {
  const map = new Map<string, number>();

  transactions
    .filter((item) => item.direction === "EXPENSE")
    .forEach((item) => {
      const value = map.get(item.category) ?? 0;
      map.set(item.category, value + Number(item.amount || 0));
    });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function buildSourceSeries(transactions: TransactionLike[]) {
  const map = new Map<string, number>();

  transactions
    .filter((item) => item.direction === "INCOME")
    .forEach((item) => {
      const value = map.get(item.source) ?? 0;
      map.set(item.source, value + Number(item.amount || 0));
    });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildPaymentMethodSeries(transactions: TransactionLike[]) {
  const map = new Map<string, number>();

  transactions.forEach((item) => {
    const sourceName = item.source || "Other";
    const value = map.get(sourceName) ?? 0;
    map.set(sourceName, value + Number(item.amount || 0));
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildTrendSeries(transactions: TransactionLike[], range: string) {
  const { start } = getRangeBounds(range);
  const map = new Map<string, number>();

  transactions
    .filter((item) => item.direction === "EXPENSE")
    .forEach((item) => {
      const txDate = new Date(item.occurred_at);
      if (txDate < start) return;
      const key =
        range === "year"
          ? new Date(txDate.getFullYear(), txDate.getMonth(), 1).toISOString().slice(0, 7)
          : new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).toISOString().slice(0, 10);
      const value = map.get(key) ?? 0;
      map.set(key, value + Number(item.amount || 0));
    });

  return Array.from(map.entries())
    .map(([key, value]) => ({
      date: key,
      label:
        range === "year"
          ? new Date(`${key}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short" })
          : new Date(`${key}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
      value,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
