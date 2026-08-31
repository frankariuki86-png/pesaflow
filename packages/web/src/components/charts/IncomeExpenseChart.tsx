import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function IncomeExpenseChart({ data }: { data: Array<{ label: string; income: number; expenses: number }> }) {
  if (!data.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No data available for this range.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E1E8EF" />
          <XAxis dataKey="label" stroke="#667085" fontSize={12} />
          <YAxis stroke="#667085" fontSize={12} tickFormatter={(value) => `KES ${Number(value) / 1000}K`} />
          <Tooltip formatter={(value: number) => `KES ${Number(value).toLocaleString()}`} />
          <Bar dataKey="income" fill="#10B981" radius={[8, 8, 0, 0]} />
          <Bar dataKey="expenses" fill="#F97316" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
